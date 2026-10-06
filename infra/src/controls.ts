import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Email } from './email.js';
import { Runtime } from './runtime.js';
import type { Config } from './app.js';
export class Controls extends cdk.Stack {
 constructor(scope:Construct,id:string,config:Config,email:Email,runtime:Runtime){super(scope,id,{env:{account:config.account,region:config.region},terminationProtection:!config.local});
  const notifications=new sns.Topic(this,'OwnerAlerts');if (!config.local) notifications.addSubscription(new subscriptions.EmailSubscription(config.ownerEmail));
  const metrics:Record<string,cw.IMetric>={};runtime.functions.forEach((fn,i)=>{metrics['f'+i]=fn.metricErrors({period:cdk.Duration.minutes(5)});});
  for(const [i,fn] of runtime.functions.entries())new logs.MetricFilter(this,'LoggedFailure'+i,{logGroup:fn.logGroup,filterPattern:logs.FilterPattern.exists('$.message.error'),metricNamespace:'a2aviary',metricName:'LoggedWorkerFailures',metricValue:'1'});
  const logged=new cw.Alarm(this,'LoggedFailures',{metric:new cw.Metric({namespace:'a2aviary',metricName:'LoggedWorkerFailures',statistic:'Sum',period:cdk.Duration.minutes(5)}),threshold:1,evaluationPeriods:1,treatMissingData:cw.TreatMissingData.NOT_BREACHING});logged.addAlarmAction(new actions.SnsAction(notifications));
  const supportFailures=new cw.Alarm(this,'SupportFailures',{metric:runtime.supportFunction.metricErrors({period:cdk.Duration.minutes(5)}),threshold:1,evaluationPeriods:1,treatMissingData:cw.TreatMissingData.NOT_BREACHING});supportFailures.addAlarmAction(new actions.SnsAction(notifications));
  new logs.MetricFilter(this,'SupportLoggedFailure',{logGroup:runtime.supportFunction.logGroup,filterPattern:logs.FilterPattern.exists('$.message.error'),metricNamespace:'a2aviary',metricName:'LoggedWorkerFailures',metricValue:'1'});
  const total=new cw.MathExpression({expression:Object.keys(metrics).join('+'),usingMetrics:metrics,period:cdk.Duration.minutes(5)});
  const errors=new cw.Alarm(this,'WorkerFailures',{metric:total,threshold:1,evaluationPeriods:1,treatMissingData:cw.TreatMissingData.NOT_BREACHING});errors.addAlarmAction(new actions.SnsAction(notifications));
  for(const [i,q]of email.queues.entries())if(i%2===1){const alarm=new cw.Alarm(this,'DeadLetters'+i,{metric:q.metricApproximateNumberOfMessagesVisible({period:cdk.Duration.minutes(5)}),threshold:1,evaluationPeriods:1,treatMissingData:cw.TreatMissingData.NOT_BREACHING});alarm.addAlarmAction(new actions.SnsAction(notifications));}
  const feedbackAlarm=new cw.Alarm(this,'FeedbackDeadLetters',{metric:runtime.feedbackDlq.metricApproximateNumberOfMessagesVisible({period:cdk.Duration.minutes(5)}),threshold:1,evaluationPeriods:1,treatMissingData:cw.TreatMissingData.NOT_BREACHING});feedbackAlarm.addAlarmAction(new actions.SnsAction(notifications));
  const streamAlarm=new cw.Alarm(this,'StreamDeadLetters',{metric:runtime.dispatcherDlq.metricApproximateNumberOfMessagesVisible({period:cdk.Duration.minutes(5)}),threshold:1,evaluationPeriods:1,treatMissingData:cw.TreatMissingData.NOT_BREACHING});streamAlarm.addAlarmAction(new actions.SnsAction(notifications));
  const watchdog=runtime.functions.find(fn=>fn.node.id==='Watchdog')!;
  new logs.MetricFilter(this,'ModelBudgetMetric',{logGroup:watchdog.logGroup,filterPattern:logs.FilterPattern.stringValue('$.message.operation','=','budget.observe'),metricNamespace:'a2aviary',metricName:'CommittedModelDollars',metricValue:'$.message.committedDollars'});
  const modelBudget=new cw.Alarm(this,'ModelBudgetWarning',{metric:new cw.Metric({namespace:'a2aviary',metricName:'CommittedModelDollars',statistic:'Maximum',period:cdk.Duration.minutes(5)}),threshold:8,evaluationPeriods:1,treatMissingData:cw.TreatMissingData.NOT_BREACHING});modelBudget.addAlarmAction(new actions.SnsAction(notifications));
  if (!config.local) new budgets.CfnBudget(this,'AwsBudget',{budget:{budgetName:'a2aviary-prod-aws',budgetType:'COST',timeUnit:'MONTHLY',budgetLimit:{amount:15,unit:'USD'},costFilters:{TagKeyValue:['Project$a2aviary']}},notificationsWithSubscribers:[50,80,100].map(threshold=>({notification:{comparisonOperator:'GREATER_THAN',notificationType:'ACTUAL',threshold,thresholdType:'PERCENTAGE'},subscribers:[{address:config.ownerEmail,subscriptionType:'EMAIL'}]}))});
  new cdk.CfnOutput(this,'AlertsTopic',{value:notifications.topicArn});
 }
}
