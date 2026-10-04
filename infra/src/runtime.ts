import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as sns from 'aws-cdk-lib/aws-sns-subscriptions';
import { resolve } from 'node:path';
import { Email } from './email.js';
import type { Config } from './app.js';

export class Runtime extends cdk.Stack {
  functions:lambda.Function[]=[];api:apigw.HttpApi;broker:lambda.Function;development:lambda.Function;
  constructor(scope:Construct,id:string,config:Config,email:Email){
    super(scope,id,{env:{account:config.account,region:config.region},terminationProtection:true});
    const code=lambda.Code.fromAsset(resolve('../services/dist'));
    const shared={STATE_TABLE:email.state.tableName,RAW_BUCKET:email.raw.bucketName,DATA_BUCKET:email.data.bucketName,RUNTIME_QUEUE:email.runtime.queueUrl,OUTBOX_QUEUE:email.outbox.queueUrl};
    const make=(name:string,handler:string,concurrency:number,environment:Record<string,string>={})=>{const group=new logs.LogGroup(this,name+'Logs',{retention:logs.RetentionDays.THREE_MONTHS,removalPolicy:cdk.RemovalPolicy.RETAIN});const f=new lambda.Function(this,name,{runtime:lambda.Runtime.NODEJS_22_X,code,handler,timeout:cdk.Duration.seconds(60),memorySize:256,reservedConcurrentExecutions:concurrency,environment:{...shared,...environment},logGroup:group});email.state.grantReadData(f);this.functions.push(f);return f;};
    const writes=(f:lambda.Function,prefixes:string[])=>f.addToRolePolicy(new iam.PolicyStatement({actions:['dynamodb:PutItem','dynamodb:UpdateItem','dynamodb:DeleteItem'],resources:[email.state.tableArn],conditions:{'ForAllValues:StringLike':{'dynamodb:LeadingKeys':prefixes.map(p=>p+'#*')}}}));
    const intake=make('Intake','intake.handler',2);writes(intake,['IN','NONCE','TASK','OUT','DAY','AUDIT']);email.raw.grantRead(intake);email.data.grantPut(intake,'inputs/*');intake.addToRolePolicy(new iam.PolicyStatement({actions:['s3:PutObjectTagging'],resources:[email.raw.arnForObjects('inbound/*')]}));
    const executor=make('Executor','runtime.handler',2,{OPENAI_SECRET:email.openai.secretArn});writes(executor,['TASK','TOOL','OUT','BUDGET','AUDIT']);email.openai.grantRead(executor);email.data.grantRead(executor,'inputs/*');email.data.grantPut(executor,'results/*');
    const sender=make('Sender','sender.handler',1,{SIGNING_SECRET:email.signing.secretArn,SES_CONFIG_SET:email.configSet.configurationSetName});writes(sender,['OUT','AUDIT']);email.signing.grantRead(sender);sender.addToRolePolicy(new iam.PolicyStatement({actions:['ses:SendEmail','ses:SendRawEmail'],resources:[`arn:aws:ses:${config.region}:${config.account}:identity/a2aviary.io`,`arn:aws:ses:${config.region}:${config.account}:configuration-set/a2aviary-prod`],conditions:{StringEquals:{'ses:FromAddress':'agent@a2aviary.io'}}}));
    for(const [fn,queue] of [[intake,email.intake],[executor,email.runtime],[sender,email.outbox]] as const)fn.addEventSource(new sources.SqsEventSource(queue,{batchSize:1,...(fn===sender?{}:{maxConcurrency:2}),reportBatchItemFailures:true}));
    const dispatch=make('Dispatcher','dispatcher.handler',1);email.runtime.grantSendMessages(dispatch);email.outbox.grantSendMessages(dispatch);
    dispatch.addEventSource(new sources.DynamoEventSource(email.state,{startingPosition:lambda.StartingPosition.TRIM_HORIZON,batchSize:50,retryAttempts:5,bisectBatchOnError:true,reportBatchItemFailures:true,onFailure:new sources.SqsDlq(email.queues[1])}));
    const watchdog=make('Watchdog','watchdog.handler',1);writes(watchdog,['BUDGET','OUT','AUDIT']);email.runtime.grantSendMessages(watchdog);email.outbox.grantSendMessages(watchdog);
    new events.Rule(this,'Reconcile',{schedule:events.Schedule.rate(cdk.Duration.minutes(1)),targets:[new targets.LambdaFunction(watchdog)]});
    const feedback=make('Feedback','feedback.handler',1);writes(feedback,['OUT','SUPPRESS','AUDIT']);email.feedback.addSubscription(new sns.LambdaSubscription(feedback));
    this.broker=make('Broker','operator.broker',1,{APP_KEY_SECRET:email.appKey.secretArn});email.appKey.grantRead(this.broker);
    this.development=make('DevelopmentBroker','operator.developmentBroker',1,{APP_KEY_SECRET:email.appKey.secretArn});email.appKey.grantRead(this.development);
    const webhook=make('GithubWebhook','operator.webhook',2,{APP_WEBHOOK_SECRET:email.webhook.secretArn,BROKER_FUNCTION:this.broker.functionName});writes(webhook,['AUDIT']);email.webhook.grantRead(webhook);this.broker.grantInvoke(webhook);
    const callback=make('Registration','operator.callback',1,{APP_KEY_SECRET:email.appKey.secretArn,APP_WEBHOOK_SECRET:email.webhook.secretArn});writes(callback,['CONTROL']);
    callback.addToRolePolicy(new iam.PolicyStatement({actions:['secretsmanager:PutSecretValue'],resources:[email.appKey.secretArn,email.webhook.secretArn]}));
    this.api=new apigw.HttpApi(this,'OperatorApi',{createDefaultStage:true});
    this.api.addRoutes({path:'/github/webhook',methods:[apigw.HttpMethod.POST],integration:new HttpLambdaIntegration('Webhook',webhook)});
    this.api.addRoutes({path:'/github/setup/callback',methods:[apigw.HttpMethod.GET],integration:new HttpLambdaIntegration('Registration',callback)});
    new cdk.CfnOutput(this,'OperatorUrl',{value:this.api.apiEndpoint});
    new cdk.CfnOutput(this,'PolicyBroker',{value:this.broker.functionName});new cdk.CfnOutput(this,'DevelopmentBrokerName',{value:this.development.functionName});
    for(const [n,f]of Object.entries({IntakeFunction:intake,ExecutorFunction:executor,SenderFunction:sender,WatchdogFunction:watchdog}))new cdk.CfnOutput(this,n,{value:f.functionName});
  }
}
