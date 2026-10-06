import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, rm, open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const state = resolve(root, '.local/local');
const command = process.argv[2];
const env = { ...process.env, AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test', AWS_REGION: 'us-east-1', AWS_DEFAULT_REGION: 'us-east-1', AWS_EC2_METADATA_DISABLED: 'true', AWS_ENDPOINT_URL: 'http://127.0.0.1:4566', AWS_ENDPOINT_URL_S3: 'http://s3.localhost.localstack.cloud:4566', AWS_S3_FORCE_PATH_STYLE: '1', A2AVIARY_TARGET: 'local', OPENAI_BASE_URL: 'http://127.0.0.1:8090/v1', GITHUB_BASE_URL: 'http://127.0.0.1:8090/github', LOCAL_SES_ENDPOINT: 'http://127.0.0.1:8090' };
// Configuration comes only from the local example/override, never deploy.json or a profile.
try {
  const text = await readFile(resolve(root, '.env.local'), 'utf8');
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Z_]+)=(.*)$/); if (!match || !(match[1] in env) || !['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_REGION','AWS_EC2_METADATA_DISABLED','AWS_ENDPOINT_URL','OPENAI_BASE_URL','GITHUB_BASE_URL','LOCAL_SES_ENDPOINT'].includes(match[1])) throw new Error('unsupported_local_setting');
    env[match[1]] = match[2].trim();
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const name of Object.keys(env)) if (name.startsWith('AWS_ENDPOINT_URL_') && name !== 'AWS_ENDPOINT_URL_S3') delete env[name];
for (const name of ['AWS_CONFIG_FILE','AWS_SHARED_CREDENTIALS_FILE','OPENAI_API_KEY','GITHUB_TOKEN','GH_TOKEN','AWS_PROFILE','AWS_DEFAULT_PROFILE','AWS_SESSION_TOKEN','AWS_SECURITY_TOKEN','A2AVIARY_CONFIG','CDK_DEFAULT_ACCOUNT','CDK_DEFAULT_REGION','CDK_OUTDIR','CDK_CONTEXT_JSON']) delete env[name];
assert.equal(env.AWS_ACCESS_KEY_ID, 'test', 'Only fake credentials are accepted'); assert.equal(env.AWS_SECRET_ACCESS_KEY, 'test'); assert.equal(env.AWS_REGION, 'us-east-1'); assert.equal(env.AWS_EC2_METADATA_DISABLED, 'true');
for (const [name, expected] of Object.entries({AWS_ENDPOINT_URL:'http://127.0.0.1:4566',OPENAI_BASE_URL:'http://127.0.0.1:8090/v1',GITHUB_BASE_URL:'http://127.0.0.1:8090/github',LOCAL_SES_ENDPOINT:'http://127.0.0.1:8090'})) assert.equal(env[name], expected, 'Local endpoints must use the Compose loopback defaults');
if (command !== 'down' && Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Use Node.js 22');
await mkdir(state, { recursive: true, mode: 0o700 });
async function run(program, args, cwd = root) {
  const log = await open(resolve(state, 'commands.log'), 'a', 0o600);
  const child = spawn(program, args, { cwd, env, stdio: ['ignore', log.fd, log.fd] });
  const timer = setTimeout(() => child.kill('SIGTERM'), 600000);
  let code;
  try { code = await new Promise((done, reject) => { child.on('error', reject); child.on('exit', done); }); }
  finally { clearTimeout(timer); await log.close(); }
  if (code !== 0) throw new Error('local_command_failed: ' + program + ' (private diagnostics in .local/local/commands.log)');
}
const compose = (...args) => run('docker', ['compose', '-f', 'docker-compose.local.yml', ...args]);
const delay = ms => new Promise(done => setTimeout(done, ms));
async function waitFor(check, timeout = 180000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { try { const result = await check(); if (result) return result; } catch {} await delay(1000); }
  throw new Error('local_wait_timeout');
}
async function request(path, value) {
  const response = await fetch('http://127.0.0.1:8090' + path, { method: value ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: value ? JSON.stringify(value) : undefined, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('local_adapter_http_' + response.status); return response.json();
}
async function clients() {
  const require = createRequire(new URL('../package.json', import.meta.url)), services = createRequire(new URL('../../services/package.json', import.meta.url));
  const options = { endpoint: env.AWS_ENDPOINT_URL, region: env.AWS_REGION, credentials: { accessKeyId: 'test', secretAccessKey: 'test' }, forcePathStyle: true };
  const cloudformation = require('@aws-sdk/client-cloudformation'), ses = require('@aws-sdk/client-ses'), cloudwatch = require('@aws-sdk/client-cloudwatch'), logs = require('@aws-sdk/client-cloudwatch-logs');
  const dynamodb = services('@aws-sdk/client-dynamodb'), doc = services('@aws-sdk/lib-dynamodb'), s3 = services('@aws-sdk/client-s3'), secrets = services('@aws-sdk/client-secrets-manager'), lambda = services('@aws-sdk/client-lambda');
  return { ...cloudformation, ...ses, ...cloudwatch, ...logs, ...doc, ...s3, ...secrets, ...lambda, cf: new cloudformation.CloudFormationClient(options), ses: new ses.SESClient(options), cw: new cloudwatch.CloudWatchClient(options), logs: new logs.CloudWatchLogsClient(options), db: doc.DynamoDBDocumentClient.from(new dynamodb.DynamoDBClient(options)), s3: new s3.S3Client(options), sm: new secrets.SecretsManagerClient(options), lambda: new lambda.LambdaClient(options), jose: services('jose') };
}
async function outputs() { const all = JSON.parse(await readFile(resolve(state, 'outputs.json'))); return { ...all['a2aviary-local-website'], ...all['a2aviary-local-email'], ...all['a2aviary-local-runtime'], ...all['a2aviary-local-controls'] }; }
async function up() { await compose('up', '-d'); await waitFor(async () => (await fetch(env.AWS_ENDPOINT_URL + '/_localstack/health')).ok && (await request('/health')).ready); console.log('PASS local:up — Community and local adapters ready'); }
async function deploy() {
  for (const [pkg, scripts] of [['services',['check','build']],['infra',['build']],['website',['check','build']]]) for (const script of scripts) await run('npm', ['run', script], resolve(root, pkg));
  const cli = resolve(root, 'infra/node_modules/.bin/cdklocal');
  await run(cli, ['bootstrap', 'aws://' + '0'.repeat(12) + '/us-east-1', '--context', 'target=local'], resolve(root, 'infra'));
  await run(cli, ['deploy','--all','--context','target=local','--require-approval','never','--outputs-file',resolve(state,'outputs.json'),'--output',resolve(state,'cdk.out')], resolve(root,'infra'));
  const c = await clients(), o = await outputs();
  // Community CFN acknowledges SES receipt resources without provisioning them.
  // Materialize only these adapter resources from the same synthesized CDK rules.
  const emailTemplate=JSON.parse(await readFile(resolve(state,'cdk.out/a2aviary-local-email.template.json')));
  const deployed=(await c.cf.send(new c.DescribeStackResourcesCommand({StackName:'a2aviary-local-email'}))).StackResources;
  const refs=Object.fromEntries(deployed.map(r=>[r.LogicalResourceId,r.PhysicalResourceId]));
  for(const [id,r] of Object.entries(emailTemplate.Resources)) if(r.Type==='AWS::SES::ReceiptRule') refs[id]=r.Properties.Rule.Name;
  const materialize=value=>{
    if(Array.isArray(value)) return value.map(materialize);
    if(value && typeof value==='object') {
      if(value.Ref) { if(!(value.Ref in refs)) throw new Error('local_rule_reference_missing'); return refs[value.Ref]; }
      if(value['Fn::GetAtt']) { const [id,attribute]=value['Fn::GetAtt']; if(attribute!=='TopicArn'||!(id in refs)) throw new Error('local_rule_attribute_unsupported'); return refs[id]; }
      return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,materialize(v)]));
    } return value;
  };
  try { await c.ses.send(new c.CreateReceiptRuleSetCommand({RuleSetName:'a2aviary-local'})); } catch(error) { if(error.name!=='AlreadyExistsException') throw error; }
  for(const resource of Object.values(emailTemplate.Resources)) if(resource.Type==='AWS::SES::ReceiptRule') {
    const props=resource.Properties;
    try { await c.ses.send(new c.CreateReceiptRuleCommand({RuleSetName:'a2aviary-local',Rule:materialize(props.Rule),...(props.After?{After:materialize(props.After)}:{})})); } catch(error) { if(error.name!=='AlreadyExistsException') throw error; }
  }
  await c.ses.send(new c.SetActiveReceiptRuleSetCommand({ RuleSetName: 'a2aviary-local' }));
  try { await c.ses.send(new c.CreateConfigurationSetCommand({ConfigurationSet:{Name:'a2aviary-local'}})); } catch(error) { if(error.name!=='ConfigurationSetAlreadyExistsException') throw error; }
  try { await c.ses.send(new c.CreateConfigurationSetEventDestinationCommand({ConfigurationSetName:'a2aviary-local',EventDestination:{Name:'local-feedback',Enabled:true,MatchingEventTypes:['delivery','bounce','complaint'],SNSDestination:{TopicARN:o.FeedbackTopic}}})); } catch(error) { if(error.name!=='EventDestinationAlreadyExistsException') throw error; }
  await c.ses.send(new c.VerifyEmailIdentityCommand({ EmailAddress: 'agent@a2aviary.io' }));
  async function upload(dir, prefix = '') { for (const entry of await readdir(dir, {withFileTypes:true})) { const key = prefix + entry.name; if (entry.isDirectory()) await upload(resolve(dir, entry.name), key + '/'); else { const { websiteContentType } = await import('../../services/scripts/website-content-type.mjs'); await c.s3.send(new c.PutObjectCommand({ Bucket:o.WebsiteBucket,Key:key,Body:await readFile(resolve(dir,entry.name)),ContentType:websiteContentType(key) })); } } }
  await upload(resolve(root,'website/dist')); await request('/local/website', {bucket:o.WebsiteBucket});
  console.log('PASS local:deploy — shared CDK stacks and production website output deployed');
  console.log('SKIP cloud-only — CloudFront, public DNS/TLS, production OIDC/API hosting, billing budgets, real mailbox delivery');
}
async function seed() {
  const c = await clients(), o = await outputs(), protocol = await import('../../services/dist/protocol.js');
  const { privateKey, publicKey } = await c.jose.generateKeyPair('ES256', { extractable:true });
  let signingKeys;
  try { signingKeys=JSON.parse(await readFile(resolve(state,'signing.json'))); } catch(error) { if(error.code!=='ENOENT') throw error; const pair=await c.jose.generateKeyPair('ES256',{extractable:true}); signingKeys={privateKey:await c.jose.exportJWK(pair.privateKey),publicKey:await c.jose.exportJWK(pair.publicKey)}; await writeFile(resolve(state,'signing.json'),JSON.stringify(signingKeys),{mode:0o600}); }
  const kid = 'local-' + randomUUID();
  const grant = {pk:'PARTNER#'+kid,kid,sender:'local-fixture',publicKey:await c.jose.exportJWK(publicKey),projects:['local-project'],actions:['task.submit','task.status','capabilities.get'],replyTo:'fixture@example.invalid',expiresAt:Math.floor(Date.now()/1000)+3600,research:false};
  await c.db.send(new c.PutCommand({TableName:o.StateTable,Item:grant}));
  await c.db.send(new c.PutCommand({TableName:o.StateTable,Item:{pk:'CONTROL#flags',admission:true,processing:true,sending:true,developmentEnabled:true}}));
  const now = Math.floor(Date.now()/1000), month = 'BUDGET#'+new Date().toISOString().slice(0,7);
  const existing = await c.db.send(new c.GetCommand({TableName:o.StateTable,Key:{pk:month}}));
  if (!existing.Item) await c.db.send(new c.PutCommand({TableName:o.StateTable,Item:{pk:month,availableMicros:10000000,reservedMicros:0,spentMicros:0,activeTasks:0,ttl:now+90*86400}}));
  const secret = async (id,value) => c.sm.send(new c.PutSecretValueCommand({SecretId:id,SecretString:JSON.stringify(value)}));
  await secret(o.SigningSecret,{kid:'local-service',privateKey:signingKeys.privateKey}); await secret(o.OpenAISecret,{apiKey:'local-mock-placeholder'});
  const rsa = generateKeyPairSync('rsa',{modulusLength:2048}); await secret(o.AppKeySecret,{appId:1,installationId:1,privateKey:rsa.privateKey.export({type:'pkcs8',format:'pem'})});
  const input = {version:'1.0',messageId:randomUUID(),correlationId:randomUUID(),nonce:randomUUID(),sender:grant.sender,projectId:'local-project',action:'task.submit',issuedAt:now,expiresAt:now+900,replyTo:grant.replyTo,payload:{brief:'A fictional community garden needs a simple information site for volunteers.',research:false}};
  const jws = await protocol.sign(input,await c.jose.exportJWK(privateKey),kid), mime = protocol.mimeMessage(grant.replyTo,'agent@a2aviary.io',jws,input.messageId,input.correlationId);
  const fixture = {input,jws,mime:mime.toString('base64'),publicKey:signingKeys.publicKey};
  await writeFile(resolve(state,'seed.json'),JSON.stringify(fixture),{mode:0o600});
  await request('/local/receive',{recipients:['agent@a2aviary.io'],mime:fixture.mime});
  console.log('PASS local:seed — fictional signed request submitted through receipt adapter'); return fixture;
}
async function test() {
  const lock = await open(resolve(state,'test.lock'),'wx',0o600);
  try {
    const fixture = await seed(), c = await clients(), o = await outputs(), protocol = await import('../../services/dist/protocol.js');
    const scan = async () => (await c.db.send(new c.ScanCommand({TableName:o.StateTable}))).Items ?? [];
    const task = await waitFor(async () => (await scan()).find(i => i.pk.startsWith('TASK#') && i.correlationId===fixture.input.correlationId && i.state==='completed' && i.providerDeletedAt), 300000);
    assert.deepEqual(task.result, JSON.parse(await readFile(resolve(root,'local/fixtures/brief-analysis.json'))));
    assert.equal(task.slotHeld,false); assert.equal((await c.db.send(new c.GetCommand({TableName:o.StateTable,Key:{pk:'BUDGET#concurrency'}}))).Item.activeTasks,0);
    for (const key of [task.contentKey,'results/'+task.taskId+'.json']) assert((await c.s3.send(new c.GetObjectCommand({Bucket:o.DataBucket,Key:key}))).ContentLength>0);
    console.log('PASS queued flow — signed intake, stored input/result, completed analysis, cleanup and released concurrency');
    await waitFor(async () => {
      for (const message of (await request('/local/records')).sent) {
        const parsed = await protocol.parseMime(Buffer.from(message.raw,'base64'));
        const verified = await c.jose.compactVerify(parsed.jws,await c.jose.importJWK(fixture.publicKey,'ES256'),{algorithms:['ES256']});
        const payload = JSON.parse(Buffer.from(verified.payload).toString());
        if (payload.correlationId===fixture.input.correlationId && payload.action==='task.result') { assert.equal(payload.causationId,fixture.input.messageId); assert.equal(payload.payload.state,'completed'); assert.deepEqual(payload.payload.result,task.result); return true; }
      }
    });
    console.log('PASS reply — captured SES raw email has valid ES256 signature and request correlation');
    await request('/local/receive',{recipients:['agent@a2aviary.io'],mime:fixture.mime});
    const parts=fixture.jws.split('.'); const changed={...fixture.input,payload:{brief:'tampered'}}; parts[1]=Buffer.from(JSON.stringify(changed)).toString('base64url');
    await request('/local/receive',{recipients:['agent@a2aviary.io'],mime:protocol.mimeMessage('fixture@example.invalid','agent@a2aviary.io',parts.join('.'),fixture.input.messageId,fixture.input.correlationId).toString('base64')});
    await waitFor(async () => (await scan()).some(i=>i.operation==='email.validate'&&i.reason==='signature_invalid'));
    assert.equal((await scan()).filter(i=>i.pk.startsWith('TASK#')&&i.correlationId===fixture.input.correlationId).length,1);
    console.log('PASS rejection — duplicate creates no extra task; tampered signature is rejected');
    const broker = await c.lambda.send(new c.InvokeCommand({FunctionName:o.DevelopmentBrokerName,Payload:Buffer.from('{}')})); assert(!broker.FunctionError); const token = JSON.parse(Buffer.from(broker.Payload).toString()).token; assert.equal(token,'local-fake-token');
    const pr = await fetch(env.GITHUB_BASE_URL+'/repos/local/fixture/pulls',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({title:'Fictional local request',head:'local-fixture',base:'main'})}); assert.equal(pr.status,201); assert((await request('/local/records')).prs.length>0);
    console.log('PASS operator — deployed broker uses mock GitHub and records a PR request');
    const groups=(await c.logs.send(new c.DescribeLogGroupsCommand({}))).logGroups;
    const watchdog=groups.find(g=>g.logGroupName.includes('Watchdog'));
    await waitFor(async () => (await c.logs.send(new c.FilterLogEventsCommand({logGroupName:watchdog.logGroupName}))).events?.some(e=>e.message.includes('budget.observe')));
    const alarms=await c.cw.send(new c.DescribeAlarmsCommand({})); assert(alarms.MetricAlarms.length>0);
    const template=JSON.parse(await readFile(resolve(state,'cdk.out/a2aviary-local-email.template.json'))); const resources=Object.values(template.Resources); assert(resources.some(r=>r.Properties?.LifecycleConfiguration?.Rules.some(x=>x.ExpirationInDays===7))); assert(resources.some(r=>r.Properties?.LifecycleConfiguration?.Rules.some(x=>x.ExpirationInDays===30)));
    console.log('PASS controls — scheduled watchdog observed; alarms and retention configured (expiration/delivery not claimed)');
    console.log('PASS local:test — all local integration assertions passed');
  } finally { await lock.close(); await rm(resolve(state,'test.lock'),{force:true}); }
}
async function down() { await compose('down','--volumes','--remove-orphans'); await rm(state,{recursive:true,force:true}); console.log('PASS local:down — disposable Compose environment removed'); }
try {
  if (command==='quickstart') { for(const pkg of ['infra','services','website']) await run('npm',['ci'],resolve(root,pkg)); await up(); await deploy(); await test(); }
  else if (command==='up') await up(); else if(command==='deploy') await deploy(); else if(command==='seed') await seed(); else if(command==='test') await test(); else if(command==='down') await down(); else throw new Error('Unknown local command');
} catch (error) { console.error(error.message); process.exitCode=1; }
