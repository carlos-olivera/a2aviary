import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sub from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as actions from 'aws-cdk-lib/aws-ses-actions';
import * as dns from 'aws-cdk-lib/aws-route53';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as custom from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Config } from './app.js';

export class Email extends cdk.Stack {
  raw:s3.Bucket; data:s3.Bucket; state:ddb.Table; intake:sqs.Queue; runtime:sqs.Queue; outbox:sqs.Queue;
  openai:secrets.Secret; signing:secrets.Secret; appKey:secrets.Secret; webhook:secrets.Secret; configSet:ses.IConfigurationSet; feedback:sns.Topic;
  supportRaw:s3.Bucket; supportState:ddb.Table; supportQueue:sqs.Queue; supportTopic:sns.Topic;
  queues:sqs.Queue[]=[];
  constructor(scope:Construct,id:string,config:Config){
    super(scope,id,{env:{account:config.account,region:config.region},terminationProtection:!config.local});
    this.raw=new s3.Bucket(this,'Raw',{blockPublicAccess:s3.BlockPublicAccess.BLOCK_ALL,enforceSSL:true,encryption:s3.BucketEncryption.S3_MANAGED,removalPolicy:cdk.RemovalPolicy.RETAIN,lifecycleRules:[{expiration:cdk.Duration.days(30)},{tagFilters:{Disposition:'rejected'},expiration:cdk.Duration.days(7)}]});
    this.data=new s3.Bucket(this,'Data',{blockPublicAccess:s3.BlockPublicAccess.BLOCK_ALL,enforceSSL:true,encryption:s3.BucketEncryption.S3_MANAGED,removalPolicy:cdk.RemovalPolicy.RETAIN,lifecycleRules:[{expiration:cdk.Duration.days(30)},{tagFilters:{Disposition:'pending'},expiration:cdk.Duration.days(7)}]});
    this.state=new ddb.Table(this,'State',{partitionKey:{name:'pk',type:ddb.AttributeType.STRING},billingMode:ddb.BillingMode.PAY_PER_REQUEST,encryption:ddb.TableEncryption.AWS_MANAGED,timeToLiveAttribute:'ttl',pointInTimeRecoverySpecification:{pointInTimeRecoveryEnabled:true,recoveryPeriodInDays:1},stream:ddb.StreamViewType.NEW_AND_OLD_IMAGES,removalPolicy:cdk.RemovalPolicy.RETAIN,deletionProtection:true});
    this.state.addGlobalSecondaryIndex({indexName:'work-due',partitionKey:{name:'work',type:ddb.AttributeType.STRING},sortKey:{name:'due',type:ddb.AttributeType.NUMBER},projectionType:ddb.ProjectionType.ALL});
    this.state.addGlobalSecondaryIndex({indexName:'message-id',partitionKey:{name:'messageId',type:ddb.AttributeType.STRING},projectionType:ddb.ProjectionType.ALL});
    const queue=(name:string)=>{const dlq=new sqs.Queue(this,name+'Dlq',{retentionPeriod:cdk.Duration.days(14),encryption:sqs.QueueEncryption.SQS_MANAGED});const q=new sqs.Queue(this,name,{visibilityTimeout:cdk.Duration.seconds(360),retentionPeriod:cdk.Duration.days(4),encryption:sqs.QueueEncryption.SQS_MANAGED,deadLetterQueue:{queue:dlq,maxReceiveCount:5}});this.queues.push(q,dlq);return q;};
    this.intake=queue('Intake');this.runtime=queue('Runtime');this.outbox=queue('Outbox');
    this.supportRaw=new s3.Bucket(this,'SupportRaw',{blockPublicAccess:s3.BlockPublicAccess.BLOCK_ALL,enforceSSL:true,encryption:s3.BucketEncryption.S3_MANAGED,removalPolicy:cdk.RemovalPolicy.RETAIN,lifecycleRules:[{expiration:cdk.Duration.days(7)}]});
    this.supportState=new ddb.Table(this,'SupportState',{partitionKey:{name:'pk',type:ddb.AttributeType.STRING},billingMode:ddb.BillingMode.PAY_PER_REQUEST,encryption:ddb.TableEncryption.AWS_MANAGED,timeToLiveAttribute:'ttl',removalPolicy:cdk.RemovalPolicy.RETAIN,deletionProtection:true});
    this.supportQueue=queue('Support');
    this.supportTopic=new sns.Topic(this,'SupportReceipt');this.supportTopic.addSubscription(new sub.SqsSubscription(this.supportQueue));
    const receipt=new sns.Topic(this,'Receipt');receipt.addSubscription(new sub.SqsSubscription(this.intake));
    if (!config.local) {
    const zone=dns.HostedZone.fromHostedZoneAttributes(this,'Zone',{hostedZoneId:config.zoneId,zoneName:'a2aviary.io'});
    new ses.EmailIdentity(this,'Identity',{identity:ses.Identity.publicHostedZone(zone),mailFromDomain:'bounce.a2aviary.io',mailFromBehaviorOnMxFailure:ses.MailFromBehaviorOnMxFailure.REJECT_MESSAGE});
    new dns.MxRecord(this,'InboundMX',{zone,values:[{priority:10,hostName:'inbound-smtp.us-east-1.amazonaws.com'}],ttl:cdk.Duration.minutes(5)});
    new dns.TxtRecord(this,'DMARC',{zone,recordName:'_dmarc',values:['v=DMARC1; p=reject; adkim=s; aspf=r'],ttl:cdk.Duration.minutes(5)});
    } // Local sending identities are verified through the SES v1 adapter setup.
    const rules=new ses.ReceiptRuleSet(this,'Rules',{receiptRuleSetName:config.local?'a2aviary-local':'a2aviary-prod'});
    receipt.addToResourcePolicy(new iam.PolicyStatement({principals:[new iam.ServicePrincipal('ses.amazonaws.com')],actions:['sns:Publish'],resources:[receipt.topicArn],conditions:{StringEquals:{'AWS:SourceAccount':config.account},ArnEquals:{'AWS:SourceArn':`arn:aws:ses:${config.region}:${config.account}:receipt-rule-set/a2aviary-prod:receipt-rule/a2aviary-agent`}}}));
    this.supportTopic.addToResourcePolicy(new iam.PolicyStatement({principals:[new iam.ServicePrincipal('ses.amazonaws.com')],actions:['sns:Publish'],resources:[this.supportTopic.topicArn],conditions:{StringEquals:{'AWS:SourceAccount':config.account},ArnEquals:{'AWS:SourceArn':`arn:aws:ses:${config.region}:${config.account}:receipt-rule-set/a2aviary-prod:receipt-rule/a2aviary-support`}}}));
    // No Stop action here: messages also addressed to an agent/test recipient retain their existing routing.
    const supportRule=rules.addRule('SupportRule',{receiptRuleName:'a2aviary-support',recipients:['hello@a2aviary.io'],enabled:true,scanEnabled:true,tlsPolicy:ses.TlsPolicy.REQUIRE,actions:[new actions.S3({bucket:this.supportRaw,objectKeyPrefix:'support/',topic:this.supportTopic})]});
    rules.addRule('AgentRule',{receiptRuleName:'a2aviary-agent',after:supportRule,recipients:['agent@a2aviary.io'],enabled:true,scanEnabled:true,tlsPolicy:ses.TlsPolicy.REQUIRE,actions:[new actions.S3({bucket:this.raw,objectKeyPrefix:'inbound/',topic:receipt}),new actions.Stop()]});
    rules.addRule('TestRule',{receiptRuleName:'a2aviary-controlled-test',recipients:['test@a2aviary.io'],enabled:true,scanEnabled:true,tlsPolicy:ses.TlsPolicy.REQUIRE,actions:[new actions.S3({bucket:this.raw,objectKeyPrefix:'controlled/'}),new actions.Stop()]});
    if (!config.local) new custom.AwsCustomResource(this,'ActivateRules',{installLatestAwsSdk:false,onCreate:{service:'SES',action:'setActiveReceiptRuleSet',parameters:{RuleSetName:rules.receiptRuleSetName},physicalResourceId:custom.PhysicalResourceId.of('a2aviary-prod-active-rules')},policy:custom.AwsCustomResourcePolicy.fromSdkCalls({resources:custom.AwsCustomResourcePolicy.ANY_RESOURCE})}).node.addDependency(rules);
    const sec=(name:string)=>new secrets.Secret(this,name,{secretName:'a2aviary/'+(config.local?'local':'prod')+'/'+name.toLowerCase(),generateSecretString:{secretStringTemplate:'{}',generateStringKey:'bootstrapToken'},removalPolicy:cdk.RemovalPolicy.RETAIN});
    this.openai=sec('OpenAI');this.signing=sec('Signing');this.appKey=sec('GithubKey');this.webhook=sec('GithubWebhook');
    this.feedback=new sns.Topic(this,'Feedback');
    if (config.local) this.configSet=ses.ConfigurationSet.fromConfigurationSetName(this,'Sending','a2aviary-local');
    else {
      const sending=new ses.ConfigurationSet(this,'Sending',{configurationSetName:'a2aviary-prod'});
      sending.addEventDestination('FeedbackDestination',{destination:ses.EventDestination.snsTopic(this.feedback),events:[ses.EmailSendingEvent.DELIVERY,ses.EmailSendingEvent.BOUNCE,ses.EmailSendingEvent.COMPLAINT]});
      this.configSet=sending;
    }
    if (config.local) new cdk.CfnOutput(this,'FeedbackTopic',{value:this.feedback.topicArn});
    for(const [key,value]of Object.entries({SupportRawBucket:this.supportRaw.bucketName,SupportStateTable:this.supportState.tableName,SupportQueue:this.supportQueue.queueUrl,RawBucket:this.raw.bucketName,DataBucket:this.data.bucketName,StateTable:this.state.tableName,IntakeQueue:this.intake.queueUrl,RuntimeQueue:this.runtime.queueUrl,OutboxQueue:this.outbox.queueUrl,OpenAISecret:this.openai.secretArn,SigningSecret:this.signing.secretArn,AppKeySecret:this.appKey.secretArn,WebhookSecret:this.webhook.secretArn}))new cdk.CfnOutput(this,key,{value});
  }
}
