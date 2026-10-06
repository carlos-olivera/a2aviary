import test from 'node:test';
import assert from 'node:assert/strict';
import { localEndpoint, awsOptions } from '../dist/environment.js';
test('local endpoints fail closed outside explicit local mode', () => {
  const original={...process.env};
  try {
    delete process.env.A2AVIARY_TARGET; process.env.LOCAL_SES_ENDPOINT='http://standins:8090';
    assert.throws(()=>localEndpoint('LOCAL_SES_ENDPOINT'),/local_endpoint_in_production/);
    process.env.A2AVIARY_TARGET='local';
    for (const value of ['https://api.openai.com','http://example.com','http://standins.example.com','http://user:password@standins:8090','http://127.0.0.1:8090?forward=remote']) {process.env.LOCAL_SES_ENDPOINT=value;assert.throws(()=>awsOptions(true),/local_endpoint_denied/);}
    process.env.LOCAL_SES_ENDPOINT='http://standins:8090';assert.equal(awsOptions(true).credentials.accessKeyId,'test');
    delete process.env.LOCAL_SES_ENDPOINT;assert.throws(()=>awsOptions(true),/local_endpoint_missing/);
  } finally { for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env,original); }
});
