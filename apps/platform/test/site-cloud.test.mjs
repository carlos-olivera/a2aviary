import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { siteRuntime } from '@a2aviary/generator';
import { fixture } from './helpers.mjs';
import { cleanupFixture } from './cloud-fixture-cleanup.mjs';
import { fixtureSubmission } from '../../../packages/generator/scripts/fixture-lib.mjs';
test(
  'live fixture: approved spec → bucket → Astro/Agents sandbox checks → isolated Railway site/CMS; opt-in tester reset',
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
    const testerMode = process.env.RUN_TESTER_CLOUD_E2E === 'true';
    let owner,
      saved,
      verified = false,
      resetVerified = false,
      deploymentEvidence;
    t.after(async () => {
      try {
        if (saved) {
          let evidenceReadFailed = false;
          const rows = await f.pool.query(
            'SELECT s.resources,p.state,p.spec_sha256,p.source_sha256,p.output_sha256 FROM platform_site s JOIN platform_site_spec p ON p.site_id=s.id WHERE s.id=$1 AND p.id=$2',
            [saved.siteId, saved.specId]
          ).catch(() => { evidenceReadFailed = true; return { rows: [] }; });
          const cleanup = await cleanupFixture({
            enabled: testerMode, saved, owner, sites: f.app.sites, resetVerified
          });
          resetVerified = cleanup.resetVerified;
          const remaining = await f.pool.query(
            'SELECT lifecycle,resources FROM platform_site WHERE id=$1', [saved.siteId]
          );
          const retained = await f.pool.query(
            'SELECT id FROM platform_site_spec WHERE site_id=$1', [saved.siteId]
          );
          const leftovers = {
            resources: remaining.rows[0]?.resources ?? {},
            specPrefixes: retained.rows.map(row => 'specs/' + row.id + '/')
          };
          if (cleanup.attempted)
            console.log(JSON.stringify({ event: 'site.fixture.cleanup', siteId: saved.siteId, ...cleanup, leftovers }));
          const dir = new URL('../../../.local/', import.meta.url);
          await mkdir(dir, { recursive: true });
          await writeFile(
            new URL('phase3-cloud-evidence.json', dir),
            JSON.stringify(
              {
                siteId: saved.siteId,
                specId: saved.specId,
                ...rows.rows[0],
                deploymentEvidence,
                test: testerMode,
                resetVerified,
                cleanup,
                evidenceReadFailed,
                leftovers,
                cloudGatePassed: verified,
                createdAt: new Date().toISOString()
              },
              null,
              2
            ) + '\n',
            { mode: 0o600 }
          );
          if (verified && testerMode) assert.equal(resetVerified, true, 'Tester cleanup must complete');
        }
      } finally {
        await f.close();
      }
    });
    owner = await f.user('owner@example.invalid');
    const user = await f.user('fixture-owner@example.invalid');
    if (testerMode)
      await f.app.store.tester(owner.id, 'testers.add', user.email);
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
    assert.equal(status.test, testerMode);
    deploymentEvidence = (
      await f.pool.query('SELECT resources FROM platform_site WHERE id=$1', [
        saved.siteId
      ])
    ).rows[0];
    if (testerMode)
      assert.match(
        new URL(status.siteUrl).hostname,
        /^[a-z0-9-]+\.up\.railway\.app$/
      );
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
    if (testerMode) {
      const credentials = await cms.json();
      const record = await fetch(
        status.siteUrl + '/api/cms/api/collections/catalog/records',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: credentials.token
          },
          body: JSON.stringify({
            title: 'Fictional smoke content',
            body: 'Fictional test record',
            published: true
          }),
          signal: AbortSignal.timeout(30000)
        }
      );
      assert.equal(record.status, 200);
      assert.equal(
        (await sites.status(user.id, saved.siteId)).monthlyRequestsRemaining,
        4
      );
      await assert.rejects(
        sites.reset(owner.id, saved.siteId, 'yes'),
        /confirmation_required/
      );
      assert.equal(
        (await sites.reset(owner.id, saved.siteId, 'RESET ' + saved.siteId))
          .reset,
        true
      );
      assert.equal(
        (await sites.inspect(owner.id, saved.siteId)).lifecycle,
        'archived'
      );
      assert.equal((await f.app.store.principal(user.id)).role, 'tester');
      assert.equal(
        (await sites.reset(owner.id, saved.siteId, 'RESET ' + saved.siteId))
          .reset,
        true
      );
      resetVerified = true;
    }
    verified = true;
    console.log(
      JSON.stringify({
        event: 'site.fixture.cloud.verified',
        specSha256: status.specs[0].specSha256,
        outputSha256: status.specs[0].outputSha256,
        credentialsLogged: false,
        test: testerMode,
        resetVerified
      })
    );
  }
);
