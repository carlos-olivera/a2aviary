import test from 'node:test';
import assert from 'node:assert/strict';
import { siteRuntime } from '../dist/index.js';

test('either disabled or absent workflow flag leaves site operations off without requiring provider credentials', () => {
  for (const workflow of [undefined, '', 'false', 'true']) {
    for (const drafts of [undefined, '', 'false', 'true']) {
      if (workflow === 'true' && drafts === 'true') continue;
      const env = {};
      if (workflow !== undefined) env.SITE_WORKFLOW_ENABLED = workflow;
      if (drafts !== undefined) env.SITE_DRAFTS_ENABLED = drafts;
      assert.equal(siteRuntime(env), undefined);
    }
  }
});

test('malformed flags still fail closed when the other flag is disabled or enabled', () => {
  for (const name of ['SITE_WORKFLOW_ENABLED', 'SITE_DRAFTS_ENABLED']) {
    const other = name === 'SITE_WORKFLOW_ENABLED'
      ? 'SITE_DRAFTS_ENABLED'
      : 'SITE_WORKFLOW_ENABLED';
    for (const value of ['yes', 'TRUE', ' true ', '0']) {
      for (const otherValue of [undefined, 'false', 'true']) {
        const env = { [name]: value };
        if (otherValue !== undefined) env[other] = otherValue;
        assert.throws(() => siteRuntime(env), { message: 'Invalid ' + name });
      }
    }
  }
});

test('both enabled flags still require complete site configuration', () => {
  assert.throws(
    () => siteRuntime({ SITE_WORKFLOW_ENABLED: 'true', SITE_DRAFTS_ENABLED: 'true' }),
    { message: 'Missing SITE_CREDENTIAL_KEY' },
  );
});
