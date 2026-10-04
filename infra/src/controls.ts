import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Email } from './email.js';
import { Runtime } from './runtime.js';
import type { Config } from './app.js';
export class Controls extends cdk.Stack {
 constructor(scope:Construct,id:string,config:Config,email:Email,runtime:Runtime){super(scope,id,{env:{account:config.account,region:config.region},terminationProtection:true});
  const notifications=new sns.Topic(this,'OwnerAlerts');notifications.addSubscription(new subscriptions.EmailSubscription(config.ownerEmail));
  const metrics:Record<string,cw.IMetric>={};runtime.functions.forEach((fn,i)=>{metrics['f'+i]=fn.metricErrors({period:cdk.Duration.minutes(5)});});
  const total=new cw.MathExpression({expression:Object.keys(metrics).join('+'),usingMetrics:metrics,period:cdk.Duration.minutes(5)});
  const errors=new cw.Alarm(this,'WorkerFailures',{metric:total,threshold:1,evaluationPeriods:1,treatMissingData:cw.TreatMissingData.NOT_BREACHING});errors.addAlarmAction(new actions.SnsAction(notifications));
  for(const [i,q]of email.queues.entries())if(i%2===1){const alarm=new cw.Alarm(this,'DeadLetters'+i,{metric:q.metricApproximateNumberOfMessagesVisible({period:cdk.Duration.minutes(5)}),threshold:1,evaluationPeriods:1,treatMissingData:cw.TreatMissingData.NOT_BREACHING});alarm.addAlarmAction(new actions.SnsAction(notifications));}
  new budgets.CfnBudget(this,'AwsBudget',{budget:{budgetName:'a2aviary-prod-aws',budgetType:'COST',timeUnit:'MONTHLY',budgetLimit:{amount:15,unit:'USD'},costFilters:{TagKeyValue:['Project$a2aviary']}},notificationsWithSubscribers:[50,80,100].map(threshold=>({notification:{comparisonOperator:'GREATER_THAN',notificationType:'ACTUAL',threshold,thresholdType:'PERCENTAGE'},subscribers:[{address:config.ownerEmail,subscriptionType:'EMAIL'}]}))});
  new cdk.CfnOutput(this,'AlertsTopic',{value:notifications.topicArn});
 }
}
