import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { fixture } from './helpers.mjs';

test('an enabled workflow with absent or disabled drafts boots discovery with all seven migrations', async (t) => {
  const names = ['SITE_WORKFLOW_ENABLED', 'SITE_DRAFTS_ENABLED'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
  process.env.SITE_WORKFLOW_ENABLED = 'false';
  delete process.env.SITE_DRAFTS_ENABLED;
  const f = await fixture();
  t.after(f.close);

  for (const drafts of [undefined, 'false']) {
    process.env.SITE_WORKFLOW_ENABLED = 'true';
    if (drafts === undefined) delete process.env.SITE_DRAFTS_ENABLED;
    else process.env.SITE_DRAFTS_ENABLED = drafts;
    // Exercise the default siteRuntime path used by main.js, with no injected providers.
    const app = await createApp(f.config, f.pool);
    assert.equal(app.sites, undefined);
    const response = await app.fetch(new Request(f.config.origin + '/healthz'));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.mandate, 'discovery-only');
    assert.equal(body.migrations.length, 7);
    assert.equal(body.migrations.at(-1).name, '007-server-drafts-preview.sql');
    assert.equal(await f.pool.query('SELECT count(*)::int AS count FROM platform_site').then((r) => r.rows[0].count), 0);
  }
});
