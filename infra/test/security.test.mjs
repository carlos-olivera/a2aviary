import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const out = mkdtempSync(tmpdir()+'/a2aviary-cdk-');
execFileSync('node',['build/app.js'],{env:{...process.env,CDK_OUTDIR:out,A2AVIARY_CONFIG:process.env.A2AVIARY_CONFIG??'config.example.json'},stdio:'pipe'});
const template=name=>JSON.parse(readFileSync(`${out}/${name}.template.json`));
const resources=(t,type)=>Object.values(t.Resources).filter(r=>r.Type===type);
test('website uses a private REST origin and OAC',()=>{const t=template('a2aviary-prod-website');for(const b of resources(t,'AWS::S3::Bucket'))assert.equal(b.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy,true);assert.equal(resources(t,'AWS::CloudFront::OriginAccessControl').length,1);const d=resources(t,'AWS::CloudFront::Distribution')[0].Properties.DistributionConfig;assert.equal(d.DefaultRootObject,'index.html');assert.equal(d.DefaultCacheBehavior.ViewerProtocolPolicy,'redirect-to-https');assert.ok(d.Origins.every(o=>o.S3OriginConfig));});
test('missing website objects return a custom HTTP 404 without weakening security headers',()=>{
  const t=template('a2aviary-prod-website');
  const d=resources(t,'AWS::CloudFront::Distribution')[0].Properties.DistributionConfig;
  assert.deepEqual(d.CustomErrorResponses,[403,404].map(ErrorCode=>({ErrorCode,ResponseCode:404,ResponsePagePath:'/404.html',ErrorCachingMinTTL:0})));
  const headers=resources(t,'AWS::CloudFront::ResponseHeadersPolicy')[0].Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig;
  assert.equal(headers.ContentSecurityPolicy.ContentSecurityPolicy,"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  assert.equal(headers.ContentSecurityPolicy.Override,true);
  assert.equal(headers.ContentTypeOptions.Override,true);
  assert.equal(headers.StrictTransportSecurity.AccessControlMaxAgeSec,31536000);
});
test('CI trust is exact and has no infrastructure administration',()=>{const t=template('a2aviary-prod-ci');const role=resources(t,'AWS::IAM::Role')[0];const c=role.Properties.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals;assert.equal(c['token.actions.githubusercontent.com:aud'],'sts.amazonaws.com');assert.equal(c['token.actions.githubusercontent.com:sub'],'repo:carlos-olivera@1182541/a2aviary@1403745581:ref:refs/heads/main');const policies=JSON.stringify(resources(t,'AWS::IAM::Policy'));assert.ok(!policies.includes('iam:'));assert.ok(!policies.includes('cloudformation:'));assert.ok(!policies.includes('secretsmanager:'));});
test('email state is durable and processing queues have dead letters',()=>{const t=template('a2aviary-prod-email');const db=resources(t,'AWS::DynamoDB::Table')[0];assert.equal(db.Properties.BillingMode,'PAY_PER_REQUEST');assert.equal(db.Properties.DeletionProtectionEnabled,true);const data=Object.entries(t.Resources).find(([id,r])=>id.startsWith('Data')&&r.Type==='AWS::S3::Bucket')[1];assert.ok(data.Properties.LifecycleConfiguration.Rules.some(r=>r.ExpirationInDays===7&&JSON.stringify(r).includes('pending')));const queues=resources(t,'AWS::SQS::Queue');assert.equal(queues.filter(q=>q.Properties.RedrivePolicy).length,4);for(const q of queues.filter(q=>q.Properties.RedrivePolicy)){assert.equal(q.Properties.VisibilityTimeout,360);assert.equal(q.Properties.RedrivePolicy.maxReceiveCount,5);}});
test('model worker cannot send email or access GitHub private keys',()=>{const t=template('a2aviary-prod-runtime');const executor=Object.entries(t.Resources).find(([id,r])=>id.startsWith('Executor')&&r.Type==='AWS::Lambda::Function');assert.ok(executor);const env=executor[1].Properties.Environment.Variables;assert.ok(env.OPENAI_SECRET);assert.equal(env.APP_KEY_SECRET,undefined);assert.equal(env.SIGNING_SECRET,undefined);const p=Object.entries(t.Resources).filter(([id,r])=>id.startsWith('Executor')&&r.Type==='AWS::IAM::Policy');assert.ok(!JSON.stringify(p).includes('ses:Send'));assert.ok(!JSON.stringify(p).includes('lambda:Invoke'));});

test('structured worker failures and committed budgets produce metrics; feedback and stream failures are durable',()=>{const runtime=template('a2aviary-prod-runtime'),controls=template('a2aviary-prod-controls');for(const f of resources(runtime,'AWS::Lambda::Function'))assert.equal(f.Properties.LoggingConfig.LogFormat,'JSON');const filters=resources(controls,'AWS::Logs::MetricFilter');assert.ok(filters.some(f=>f.Properties.FilterPattern.includes('$.message.error')));assert.ok(filters.some(f=>f.Properties.MetricTransformations.some(m=>m.MetricValue==='$.message.committedDollars')));const destination=resources(runtime,'AWS::Lambda::EventInvokeConfig')[0];assert.equal(destination.Properties.MaximumRetryAttempts,2);assert.ok(destination.Properties.DestinationConfig.OnFailure.Destination);const queues=resources(runtime,'AWS::SQS::Queue');assert.equal(queues.length,2);for(const queue of queues)assert.equal(queue.Properties.MessageRetentionPeriod,1209600);const mapping=resources(runtime,'AWS::Lambda::EventSourceMapping').find(m=>m.Properties.StartingPosition);assert.ok(JSON.stringify(mapping.Properties.DestinationConfig).includes('DispatcherDlq'));assert.ok(!JSON.stringify(mapping.Properties.DestinationConfig).includes('IntakeDlq'));});

test('support route, storage, ledger, worker, and delivery permissions are isolated',()=>{
  const email=template('a2aviary-prod-email'),runtime=template('a2aviary-prod-runtime'),controls=template('a2aviary-prod-controls');
  const rules=resources(email,'AWS::SES::ReceiptRule');
  const support=rules.find(r=>r.Properties.Rule.Name==='a2aviary-support');
  assert.deepEqual(support.Properties.Rule.Recipients,['hello@a2aviary.io']);assert.equal(support.Properties.Rule.ScanEnabled,true);
  assert.equal(support.Properties.Rule.Actions.length,1);assert.equal(support.Properties.Rule.Actions[0].S3Action.ObjectKeyPrefix,'support/');
  const agent=rules.find(r=>r.Properties.Rule.Name==='a2aviary-agent');assert.deepEqual(agent.Properties.Rule.Recipients,['agent@a2aviary.io']);assert.ok(agent.Properties.After.Ref.includes('SupportRule'));assert.equal(agent.Properties.Rule.Actions.at(-1).StopAction.Scope,'RuleSet');
  const bucket=Object.entries(email.Resources).find(([id,r])=>id.startsWith('SupportRaw')&&r.Type==='AWS::S3::Bucket')[1];assert.equal(bucket.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy,true);assert.equal(bucket.Properties.LifecycleConfiguration.Rules[0].ExpirationInDays,7);
  const ledger=Object.entries(email.Resources).find(([id,r])=>id.startsWith('SupportState')&&r.Type==='AWS::DynamoDB::Table')[1];assert.equal(ledger.Properties.TimeToLiveSpecification.AttributeName,'ttl');assert.equal(ledger.Properties.DeletionProtectionEnabled,true);
  const fn=Object.entries(runtime.Resources).find(([id,r])=>id.startsWith('Support')&&r.Type==='AWS::Lambda::Function')[1];assert.equal(fn.Properties.Runtime,'nodejs22.x');assert.equal(fn.Properties.ReservedConcurrentExecutions,1);
  const env=fn.Properties.Environment.Variables;assert.equal(env.SUPPORT_OWNER,'owner@example.com');assert.deepEqual(Object.keys(env).sort(),['SUPPORT_BUCKET','SUPPORT_OWNER','SUPPORT_TABLE','SUPPORT_TOPIC']);
  const policies=Object.entries(runtime.Resources).filter(([id,r])=>id.startsWith('Support')&&r.Type==='AWS::IAM::Policy').map(([,r])=>r.Properties.PolicyDocument.Statement).flat();
  const send=policies.find(s=>Array.isArray(s.Action)&&s.Action.includes('ses:SendEmail'));assert.deepEqual(send.Action,['ses:SendEmail','ses:SendRawEmail']);assert.equal(send.Resource,'arn:aws:ses:us-east-1:111111111111:identity/a2aviary.io');assert.equal(send.Condition.StringEquals['ses:FromAddress'],'hello@a2aviary.io');assert.deepEqual(send.Condition['ForAllValues:StringEquals']['ses:Recipients'],['owner@example.com']);
  const serialized=JSON.stringify(policies);for(const excluded of ['secretsmanager:','StateTable','RawBucket','RuntimeQueue','OutboxQueue'])assert.ok(!serialized.includes(excluded));
  assert.ok(serialized.includes('support/*'));assert.ok(resources(runtime,'AWS::Logs::LogGroup').some(r=>r.Properties.RetentionInDays===30));
  assert.equal(resources(controls,'AWS::CloudWatch::Alarm').filter(r=>r.Properties.MetricName==='ApproximateNumberOfMessagesVisible').length,6);
});
