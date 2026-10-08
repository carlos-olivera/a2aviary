import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { fixtureSubmission } from '../../../packages/generator/scripts/fixture-lib.mjs';
import { SiteAdministration } from '../src/site-administration.ts';
import { migrate, migrationInventory } from '../src/migrate.ts';

test('seven migrations are idempotent and readiness rejects incomplete, altered or obsolete inventories', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const names = await migrationInventory(f.pool);
  assert.equal(names.length, 7);
  assert.equal(names[6].name, '007-server-drafts-preview.sql');
  await migrate(f.pool);
  assert.deepEqual(
    (await (await f.request('/healthz')).json()).migrations,
    names
  );
  const last = (
    await f.pool.query('SELECT * FROM platform_migration WHERE name=$1', [
      names[5].name
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

import {randomUUID} from 'node:crypto';
import {prepare,approve} from './draft-fixture.mjs';
test('site-scoped administrators, owner eligibility, immutable reports, first-client isolation and queued revocation',async t=>{
 const d=testDependencies(),f=await fixture(d);t.after(f.close);const owner=await f.user('owner@example.invalid'),client=await f.user('client@example.invalid'),other=await f.user('other@example.invalid'),admin=await f.user('admin@example.invalid'),tester=await f.user('tester@example.invalid'),s=f.app.sites,a=s.administration;
 const testSite=await s.drafts.create(tester.id,'tester-first',randomUUID());const [one,two]=await Promise.all([s.drafts.create(client.id,'client-first',randomUUID()),s.drafts.create(other.id,'client-second',randomUUID())]);assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM platform_site WHERE first_client_pilot')).rows[0].n,1);assert.equal((await f.pool.query('SELECT first_client_pilot FROM platform_site WHERE id=$1',[testSite.siteId])).rows[0].first_client_pilot,false);
 await a.admins(owner.id,one.siteId,'assign',[admin.email]);assert.equal((await s.drafts.get(admin.id,one.draftId)).siteId,one.siteId);await assert.rejects(s.drafts.get(admin.id,two.draftId));await a.admins(owner.id,one.siteId,'remove',[admin.email]);await assert.rejects(s.drafts.get(admin.id,one.draftId));
 const report=await a.report(client.id,one.siteId,'2026-10');assert.equal(report.billing.chargesEnabled,false);await assert.rejects(a.report(other.id,one.siteId,'2026-10'));await assert.rejects(f.pool.query('DELETE FROM platform_site_operation WHERE site_id=$1',[one.siteId]),/immutable history/);
 const saved=await prepare(f,client,{...(await fixtureSubmission()),slug:'queued'});await s.processOne();await a.admins(owner.id,saved.siteId,'assign',[admin.email]);await approve(f,admin,saved.specId);await s.deploy(admin.id,saved.siteId,saved.specId,'fictional-password-12345','DEPLOY_SITE:'+saved.siteId);await a.admins(owner.id,saved.siteId,'remove',[admin.email]);await s.processOne();assert.equal(d.counts.deploys,0);assert.equal((await s.status(client.id,saved.siteId)).specs[0].state,'failed');
});
