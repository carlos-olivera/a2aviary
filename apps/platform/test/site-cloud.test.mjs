import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { siteRuntime } from '@a2aviary/generator';
import { fixture } from './helpers.mjs';
import { fixtureSubmission } from '../../../packages/generator/scripts/fixture-lib.mjs';
test(
  'live fixture: approved spec → bucket → Astro/Agents sandbox checks → isolated Railway site and CMS',
  {
    skip: process.env.RUN_SITE_CLOUD_E2E !== 'true',
    timeout: 60 * 60 * 1000
  },
  async (t) => {
    assert.equal(
      process.env.SITE_DEPLOY_ENVIRONMENT,
      'fixture',
      'Never run the fixture against a production environment'
    );
    const runtime = siteRuntime({
      ...process.env,
      SITE_WORKFLOW_ENABLED: 'true'
    });
    assert.ok(runtime);
    const f = await fixture(runtime);
    let saved,
      verified = false;
    t.after(async () => {
      try {
        if (saved) {
          const rows = await f.pool.query(
            'SELECT s.resources,p.state,p.spec_sha256,p.source_sha256,p.output_sha256 FROM platform_site s JOIN platform_site_spec p ON p.site_id=s.id WHERE s.id=$1 AND p.id=$2',
            [saved.siteId, saved.specId]
          );
          const dir = new URL('../../../.local/', import.meta.url);
          await mkdir(dir, { recursive: true });
          await writeFile(
            new URL('phase3-cloud-evidence.json', dir),
            JSON.stringify(
              {
                siteId: saved.siteId,
                specId: saved.specId,
                ...rows.rows[0],
                cloudGatePassed: verified,
                createdAt: new Date().toISOString()
              },
              null,
              2
            ) + '\n',
            { mode: 0o600 }
          );
        }
      } finally {
        await f.close();
      }
    });
    const user = await f.user('fixture-owner@example.invalid');
    const submission = await fixtureSubmission();
    submission.slug = 'fixture-' + Date.now().toString(36);
    const sites = f.app.sites;
    saved = await sites.submit(user.id, submission);
    await sites.build(user.id, saved.specId);
    await sites.processOne();
    let status = await sites.status(user.id, saved.siteId);
    assert.equal(
      status.specs[0].state,
      'verified',
      'Require real sandbox pass before any Railway provisioning'
    );
    const password =
      'fixture-' +
      (await import('node:crypto')).randomBytes(24).toString('hex');
    await sites.deploy(
      user.id,
      saved.siteId,
      saved.specId,
      password,
      'DEPLOY_SITE:' + saved.siteId
    );
    await sites.processOne();
    status = await sites.status(user.id, saved.siteId);
    assert.equal(status.specs[0].state, 'live');
    assert.ok(status.siteUrl?.startsWith('https://'));
    const response = await fetch(status.siteUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(30000)
    });
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('Fictional'));
    const cms = await fetch(
      status.siteUrl + '/api/cms/api/collections/editors/auth-with-password',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identity: user.email, password }),
        signal: AbortSignal.timeout(30000)
      }
    );
    assert.equal(cms.status, 200);
    verified = true;
    console.log(
      JSON.stringify({
        event: 'site.fixture.cloud.verified',
        specSha256: status.specs[0].specSha256,
        outputSha256: status.specs[0].outputSha256,
        credentialsLogged: false
      })
    );
  }
);
