import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
const env = { ...process.env, CDK_CONTEXT_JSON: JSON.stringify({ target: 'local' }) };
delete env.A2AVIARY_CONFIG;
test('local target shares durable workers while excluding cloud-only hosting and billing', () => {
  const output = mkdtempSync(tmpdir() + '/a2aviary-local-synth-');
  try {
    execFileSync('node', ['build/app.js'], { env: { ...env, CDK_OUTDIR: output }, stdio: 'pipe' });
    const types = [];
    for (const stack of ['website', 'email', 'runtime', 'controls']) {
      const template = JSON.parse(readFileSync(`${output}/a2aviary-local-${stack}.template.json`));
      types.push(...Object.values(template.Resources).map(resource => resource.Type));
      if (stack === 'runtime') {
        const workers = Object.values(template.Resources).filter(resource => resource.Type === 'AWS::Lambda::Function');
        assert(workers.length >= 8);
        for (const worker of workers) {
          assert.equal(worker.Properties.Runtime, 'nodejs22.x');
          assert.equal(worker.Properties.Environment.Variables.A2AVIARY_TARGET, 'local');
        }
      }
    }
    for (const type of ['AWS::S3::Bucket', 'AWS::DynamoDB::Table', 'AWS::SNS::Topic', 'AWS::SQS::Queue', 'AWS::SecretsManager::Secret', 'AWS::Lambda::EventSourceMapping', 'AWS::Events::Rule', 'AWS::CloudWatch::Alarm']) assert(types.includes(type));
    assert(!types.some(type => /CloudFront|Route53|Certificate|Budget|ApiGateway/.test(type)));
  } finally { rmSync(output, { recursive: true, force: true }); }
});
test('local target rejects any production configuration selector', () => {
  const result = spawnSync('node', ['build/app.js'], { env: { ...env, A2AVIARY_CONFIG: 'config.example.json' }, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert(result.stderr.includes('Local target must not read deployment configuration'));
});
