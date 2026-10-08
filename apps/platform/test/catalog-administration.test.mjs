import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { fixtureSubmission } from '../../../packages/generator/scripts/fixture-lib.mjs';
import { SiteAdministration } from '../src/site-administration.ts';
import { migrate, migrationInventory } from '../src/migrate.ts';

test('catalog site grants, owner billing, queued revocation, costs and atomic pilot isolation', async (t) => {
  const d = testDependencies(),
    f = await fixture(d);
  t.after(f.close);
  const owner = await f.user('owner@example.invalid'),
    client = await f.user('catalog-owner@example.invalid'),
    second = await f.user('catalog-second@example.invalid'),
    admin = await f.user('catalog-admin@example.invalid'),
    outsider = await f.user('catalog-outsider@example.invalid'),
    unverified = await f.user('pending@example.invalid', false),
    tester = await f.user('tester@example.invalid');
  const a = new SiteAdministration(f.app.store),
    s = f.app.sites;
  const input = await fixtureSubmission();
  const fixtureSite = await s.submit(tester.id, {
    ...input,
    slug: 'tester-first'
  });
  assert.equal(
    (
      await f.pool.query(
        'SELECT first_client_pilot FROM platform_site WHERE id=$1',
        [fixtureSite.siteId]
      )
    ).rows[0].first_client_pilot,
    false
  );
  const sites = await Promise.all([
    s.submit(client.id, { ...input, slug: 'catalog-first' }),
    s.submit(second.id, { ...input, slug: 'catalog-second' })
  ]);
  assert.equal(
    (
      await f.pool.query(
        'SELECT count(*)::int n FROM platform_site WHERE first_client_pilot'
      )
    ).rows[0].n,
    1
  );
  const initial = sites[0];
  const pilotId = (
    await f.pool.query('SELECT id FROM platform_site WHERE first_client_pilot')
  ).rows[0].id;
  await s.submit(client.id, { ...input, slug: 'catalog-first' });
  assert.equal(
    (
      await f.pool.query(
        'SELECT id FROM platform_site WHERE first_client_pilot'
      )
    ).rows[0].id,
    pilotId
  );
  await a.admins(owner.id, initial.siteId, 'assign', [
    admin.email,
    unverified.email
  ]);
  assert.equal((await f.app.store.principal(admin.id)).role, 'client');
  await assert.rejects(
    s.status(outsider.id, initial.siteId),
    /owned_site_required/
  );
  await assert.rejects(
    s.status(unverified.id, initial.siteId),
    /verified_user_required/
  );
  await assert.rejects(
    a.admins(admin.id, initial.siteId, 'assign', [outsider.email]),
    /forbidden/
  );
  assert.equal((await s.status(admin.id, initial.siteId)).free, false);
  await s.build(admin.id, initial.specId);
  await a.admins(owner.id, initial.siteId, 'remove', [admin.email]);
  await s.processOne();
  assert.equal(d.counts.verifies, 0);
  assert.equal(
    (
      await f.pool.query(
        "SELECT state FROM platform_site_job WHERE spec_id=$1 AND kind='build'",
        [initial.specId]
      )
    ).rows[0].state,
    'failed'
  );
  await a.admins(owner.id, initial.siteId, 'assign', [admin.email]);
  await s.build(admin.id, initial.specId);
  await s.processOne();
  await s.deploy(
    admin.id,
    initial.siteId,
    initial.specId,
    'fictional-long-password',
    'DEPLOY_SITE:' + initial.siteId
  );
  await s.processOne();
  assert.equal(d.inputs[0].clientEmail, client.email);
  // Billing exemption follows the owner, independently of the acting administrator.
  await f.app.store.inviteAdmin(
    owner.id,
    client.email,
    'INVITE_ADMIN:' + client.email
  );
  await f.app.store.principal(client.id);
  assert.equal(
    (
      await a.report(
        admin.id,
        initial.siteId,
        new Date().toISOString().slice(0, 7)
      )
    ).billing.eligible,
    false
  );
  await f.app.store.revokeAdmin(
    owner.id,
    client.id,
    'REVOKE_ADMIN:' + client.id
  );
  const report = await a.report(
    admin.id,
    initial.siteId,
    new Date().toISOString().slice(0, 7)
  );
  assert.equal(report.billing.eligible, true);
  assert.ok(report.eligibility.some((e) => e.eligible === false));
  assert.ok(
    report.operations.some(
      (o) =>
        o.kind === 'site.deploy' &&
        o.result === 'success' &&
        o.billing.eligible === true
    )
  );
  await assert.rejects(
    f.pool.query(
      'UPDATE platform_site_billing SET eligible=false WHERE site_id=$1',
      [initial.siteId]
    ),
    /immutable history/
  );
  await assert.rejects(
    f.pool.query('DELETE FROM platform_site_operation WHERE site_id=$1', [
      initial.siteId
    ]),
    /immutable history/
  );
  const period = new Date().toISOString().slice(0, 7);
  await a.refresh(admin.id, initial.siteId, period);
  const jobs = await Promise.all([
    a.refresh(admin.id, initial.siteId, period),
    a.refresh(client.id, initial.siteId, period)
  ]);
  assert.equal(jobs[0].jobId, jobs[1].jobId);
  await a.admins(owner.id, initial.siteId, 'remove', [admin.email]);
  await s.processOne();
  assert.equal(
    (await f.pool.query('SELECT count(*)::int n FROM platform_site_cost'))
      .rows[0].n,
    0
  );
  await a.admins(owner.id, initial.siteId, 'assign', [admin.email]);
  await a.refresh(admin.id, initial.siteId, period);
  await s.processOne();
  const costReport = await a.report(admin.id, initial.siteId, period);
  assert.equal(costReport.costs.data.amount, null);
  assert.equal(costReport.costs.data.status, 'unavailable');
  assert.equal(
    (await a.refresh(client.id, initial.siteId, period)).state,
    'cached'
  );
  assert.equal(
    (await f.pool.query('SELECT count(*)::int n FROM platform_site_cost'))
      .rows[0].n,
    1
  );
  const csv = '/api/site-reports/' + initial.siteId + '/' + period + '.csv';
  assert.equal((await f.request(csv)).status, 401);
  assert.equal(
    (
      await f.request(csv, {
        headers: { authorization: 'Bearer ' + (await f.token(outsider)) }
      })
    ).status,
    403
  );
  const downloaded = await f.request(csv, {
    headers: { authorization: 'Bearer ' + (await f.token(admin)) }
  });
  assert.equal(downloaded.status, 200);
  assert.match(await downloaded.text(), /railway/);
  // Usage interruption must not damage the live catalog specification.
  await f.pool.query(
    "UPDATE platform_site_job SET state='running' WHERE kind='usage'"
  );
  await s.recoverInterrupted();
  assert.equal(
    (await s.status(client.id, initial.siteId)).currentSpecId,
    initial.specId
  );
  // Tester cleanup retains operation history and never consumes or reassigns pilot status.
  const history = (
    await f.pool.query(
      'SELECT count(*)::int n FROM platform_site_operation WHERE site_id=$1',
      [fixtureSite.siteId]
    )
  ).rows[0].n;
  await s.reset(owner.id, fixtureSite.siteId, 'RESET ' + fixtureSite.siteId);
  assert.equal(
    (
      await f.pool.query(
        'SELECT count(*)::int n FROM platform_site_operation WHERE site_id=$1',
        [fixtureSite.siteId]
      )
    ).rows[0].n,
    history
  );
  assert.equal(
    (
      await f.pool.query(
        'SELECT id FROM platform_site WHERE first_client_pilot'
      )
    ).rows[0].id,
    pilotId
  );
});

test('six migrations are idempotent and readiness rejects incomplete, altered or obsolete inventories', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const names = await migrationInventory(f.pool);
  assert.equal(names.length, 6);
  assert.equal(names[5], '006-site-administration-billing.sql');
  await migrate(f.pool);
  assert.deepEqual(
    (await (await f.request('/healthz')).json()).migrations,
    names
  );
  const last = (
    await f.pool.query('SELECT * FROM platform_migration WHERE name=$1', [
      names[5]
    ])
  ).rows[0];
  await f.pool.query('DELETE FROM platform_migration WHERE name=$1', [
    last.name
  ]);
  assert.equal((await f.request('/healthz')).status, 503);
  await f.pool.query(
    'INSERT INTO platform_migration(name,sha256) VALUES($1,$2)',
    [last.name, last.sha256]
  );
  await f.pool.query(
    "UPDATE platform_migration SET sha256='altered' WHERE name=$1",
    [last.name]
  );
  await assert.rejects(migrate(f.pool), /Immutable migration changed/);
  assert.equal((await f.request('/healthz')).status, 503);
  await f.pool.query(
    'UPDATE platform_migration SET name=$2,sha256=$3 WHERE name=$1',
    [last.name, '006-retired.sql', last.sha256]
  );
  await assert.rejects(migrate(f.pool), /Unexpected applied migration/);
  assert.equal((await f.request('/healthz')).status, 503);
});

test('deployment and usage workers recheck grants, identity and test classification before provider actions', async (t) => {
  const d = testDependencies(),
    f = await fixture(d);
  t.after(f.close);
  const owner = await f.user('owner@example.invalid'),
    client = await f.user('worker-owner@example.invalid'),
    admin = await f.user('worker-admin@example.invalid');
  const s = f.app.sites,
    a = f.app.administration,
    input = await fixtureSubmission();
  const site = await s.submit(client.id, { ...input, slug: 'worker-site' });
  await a.admins(owner.id, site.siteId, 'assign', [admin.email]);
  await s.build(admin.id, site.specId);
  await s.processOne();
  await s.deploy(
    admin.id,
    site.siteId,
    site.specId,
    'fictional-long-password',
    'DEPLOY_SITE:' + site.siteId
  );
  await a.admins(owner.id, site.siteId, 'remove', [admin.email]);
  await s.processOne();
  assert.equal(d.counts.deploys, 0);
  // The owner explicitly rebuilds the failed candidate before retrying deployment.
  await s.build(client.id, site.specId);
  await s.processOne();
  await s.deploy(
    client.id,
    site.siteId,
    site.specId,
    'fictional-long-password',
    'DEPLOY_SITE:' + site.siteId
  );
  await s.processOne();
  assert.equal(d.counts.deploys, 1);
  await a.admins(owner.id, site.siteId, 'assign', [admin.email]);
  const period = new Date().toISOString().slice(0, 7);
  let reads = 0;
  d.deployer.usage = async (r, n, p) => {
    reads++;
    await a.admins(owner.id, site.siteId, 'remove', [admin.email]);
    return {
      currency: 'USD',
      period: p,
      status: 'available',
      basis: 'provider-accrued',
      amount: 5,
      metrics: null,
      metricsStatus: 'unavailable'
    };
  };
  await a.refresh(admin.id, site.siteId, period);
  await s.processOne();
  assert.equal(reads, 1);
  assert.equal(
    (await f.pool.query('SELECT count(*)::int n FROM platform_site_cost'))
      .rows[0].n,
    0
  );
  d.deployer.usage = async (r, n, p) => ({
    currency: 'USD',
    period: p,
    status: 'available',
    basis: 'provider-accrued',
    amount: 5,
    metrics: null,
    metricsStatus: 'unavailable'
  });
  await a.refresh(client.id, site.siteId, period);
  await s.processOne();
  assert.equal(
    (await a.report(client.id, site.siteId, period)).costs.data.amount,
    5
  );
  await a.admins(owner.id, site.siteId, 'assign', [admin.email]);
  await f.app.store.tester(
    owner.id,
    'testers.add',
    admin.email
  );
  await assert.rejects(s.status(admin.id, site.siteId), /site_mode_mismatch/);
  await assert.rejects(
    a.admins(owner.id, site.siteId, 'assign', [admin.email]),
    /reserved_identity/
  );
});
