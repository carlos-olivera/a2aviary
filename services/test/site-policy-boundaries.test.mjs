import test from 'node:test';
import assert from 'node:assert/strict';
import {policyDecision} from '../dist/policy.js';

test('plan paths and rename origins require current-head owner approval', () => {
  for(const files of [[{filename:'plans/web-simple.policy.json'}],[{filename:'docs/safe.md',previous_filename:'plans/web-simple.policy.json'}]]){
    assert.equal(policyDecision(files,[],'head').allowed,false);
    assert.equal(policyDecision(files,[{user:{login:'carlos-olivera'},state:'APPROVED',commit_id:'old'}],'head').allowed,false);
    assert.equal(policyDecision(files,[{user:{login:'carlos-olivera'},state:'APPROVED',commit_id:'head'}],'head').allowed,true);
  }
});
