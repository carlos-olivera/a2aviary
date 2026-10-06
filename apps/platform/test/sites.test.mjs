import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.mjs';
import {
  fixtureSubmission,
  bindPreview
} from '../../../packages/generator/scripts/fixture-lib.mjs';
import {
  canonicalJson,
  sha256,
  specDigest,
  SiteError,
  VerificationFailure
} from '@a2aviary/generator';
import {testDependencies} from './site-dependencies.mjs';
test('site intake, role visibility, owned jobs, atomic audit and successful-change accounting in Postgres', async (t) => {
  const d = testDependencies(),
    f = await fixture(d);
  t.after(f.close);
  const client = await f.user('site-client@example.invalid'),
    other = await f.user('site-other@example.invalid'),
    owner = await f.user('owner@example.invalid'),
    tester = await f.user('tester@example.invalid');
  const sites = f.app.sites;
  const input = await fixtureSubmission();
  let initial;
  const call = async (user, name, args = {}) =>
    (
      await f.rpc(await f.token(user), 'tools/call', { name, arguments: args })
    ).json();
  await t.test(
    'site tools require feature activation, verified human role and OAuth audience; intake enforces origin',
    async () => {
      for (const user of [client, owner, tester]) {
        const list = await (await f.rpc(await f.token(user))).json();
        for (const n of [
          'site.build',
          'site.status',
          'site.deploy',
          'change.request'
        ])
          assert.ok(list.result.tools.some((t) => t.name === n));
      }
      const capabilities = await (
        await f.rpc(await f.token(tester), 'tools/call', {
          name: 'capabilities.get',
          arguments: {}
        })
      ).json();
      const testerCapabilities = JSON.parse(
        capabilities.result.content[0].text
      );
      assert.equal(testerCapabilities.websiteProduction, false);
      assert.equal(testerCapabilities.mandate, 'approved-catalog-sites');
      assert.equal(testerCapabilities.freePlan.planId,'web-simple');
      assert.equal(
        (
          await f.request('/api/site-specs', {
            method: 'POST',
            headers: {
              authorization:
                'Bearer ' +
                (await f.token(client, {
                  aud: 'https://other.example.invalid/mcp'
                })),
              'content-type': 'application/json'
            },
            body: JSON.stringify(input)
          })
        ).status,
        401
      );
      assert.equal(
        (
          await f.request('/api/site-specs', {
            method: 'POST',
            headers: {
              authorization: 'Bearer ' + (await f.token(client)),
              origin: 'https://other.example.invalid',
              'content-type': 'application/json'
            },
            body: JSON.stringify(input)
          })
        ).status,
        403
      );
      const r = await f.request('/api/site-specs', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + (await f.token(client)),
          'content-type': 'application/json'
        },
        body: JSON.stringify(input)
      });
      assert.equal(r.status, 201);
      initial = await r.json();
    }
  );
  await t.test(
    'invalid approval, out-of-catalog components and missing bytes create no sites or jobs',
    async () => {
      for (const mutate of [
        (i) => (i.spec.approval.specSha256 = '0'.repeat(64)),
        (i) => (i.spec.pages[0].sections[0].blocks[0].component = 'checkout'),
        (i) => (i.assets = {})
      ]) {
        const bad = structuredClone(input);
        mutate(bad);
        await assert.rejects(sites.submit(client.id, bad));
      }
      assert.equal(
        (await f.pool.query('SELECT count(*)::int FROM platform_site')).rows[0]
          .count,
        1
      );
      assert.equal(
        (await f.pool.query('SELECT count(*)::int FROM platform_site_job'))
          .rows[0].count,
        0
      );
    }
  );
  await t.test(
    'ownership applies to administrators too, confirmation is required, and the first successful deploy is free',
    async () => {
      for (const actor of [other, owner]) {
        await assert.rejects(
          sites.status(actor.id, initial.siteId),
          /owned_site_required/
        );
        await assert.rejects(
          sites.build(actor.id, initial.specId),
          /owned_spec_required/
        );
      }
      await assert.rejects(
        sites.deploy(
          client.id,
          initial.siteId,
          initial.specId,
          'fictional-password-at-least-16',
          'yes'
        ),
        /confirmation_required/
      );
      await assert.rejects(
        sites.deploy(
          client.id,
          initial.siteId,
          initial.specId,
          'fictional-password-at-least-16',
          'DEPLOY_SITE:' + initial.siteId
        ),
        /verified_build_required/
      );
      await sites.build(client.id, initial.specId);
      await sites.processOne();
      assert.equal(
        (await sites.status(client.id, initial.siteId)).specs[0].state,
        'verified'
      );
      await sites.deploy(
        client.id,
        initial.siteId,
        initial.specId,
        'fictional-password-at-least-16',
        'DEPLOY_SITE:' + initial.siteId
      );
      const encrypted = (
        await f.pool.query(
          'SELECT client_password_ciphertext FROM platform_site_spec WHERE id=$1',
          [initial.specId]
        )
      ).rows[0].client_password_ciphertext;
      assert.ok(encrypted);
      assert.ok(!encrypted.includes('fictional-password'));
      await sites.processOne();
      const status = await sites.status(client.id, initial.siteId);
      assert.equal(status.specs[0].state, 'live');
      assert.equal(status.monthlyRequestsRemaining, 4);
      assert.ok(status.cmsLogin.endsWith('/api/cms/editor.html'));
      assert.equal(
        (
          await f.pool.query(
            'SELECT client_password_ciphertext FROM platform_site_spec WHERE id=$1',
            [initial.specId]
          )
        ).rows[0].client_password_ciphertext,
        null
      );
      await sites.build(client.id, initial.specId);
      await sites.deploy(
        client.id,
        initial.siteId,
        initial.specId,
        'fictional-password-at-least-16',
        'DEPLOY_SITE:' + initial.siteId
      );
      assert.deepEqual(d.counts, { verifies: 1, deploys: 1 });
    }
  );
  let current = structuredClone(input.spec);
  async function candidate(text) {
    const next = structuredClone(current);
    const block = next.pages[0].sections[0].blocks[0];
    block.props.heading = text;
    const submission = await bindPreview(next, input.assets);
    submission.siteId = initial.siteId;
    delete submission.slug;
    const saved = await sites.submit(client.id, submission);
    const request = {
      contractVersion: next.contractVersion,
      planId: next.planId,
      policyVersion: next.policyVersion,
      baseSpecSha256: specDigest(current),
      operations: [
        {
          op: 'update-block',
          pageId: 'home',
          sectionId: 'section-0',
          blockId: 'block-0',
          block
        }
      ],
      assets: [],
      preview: next.preview,
      approval: next.approval
    };
    return { saved, request, next };
  }
  await t.test(
    'unaccounted full-spec replacements, stale bases, oversized changes and no-op diffs cannot bypass accounting',
    async () => {
      const { saved, request } = await candidate(
        'A fictional approved revision'
      );
      await sites.build(client.id, saved.specId);
      await sites.processOne();
      await assert.rejects(
        sites.deploy(
          client.id,
          initial.siteId,
          saved.specId,
          'fictional-password-at-least-16',
          'DEPLOY_SITE:' + initial.siteId
        ),
        /approved_change_required/
      );
      const stale = structuredClone(request);
      stale.baseSpecSha256 = '0'.repeat(64);
      await assert.rejects(
        sites.change(
          client.id,
          initial.siteId,
          stale,
          saved.specId,
          'APPLY_CHANGE:' + initial.siteId
        ),
        (e) => e.errors.some((e) => e.rule === 'change.stale')
      );
      const empty = structuredClone(request);
      empty.operations = [];
      await assert.rejects(
        sites.change(
          client.id,
          initial.siteId,
          empty,
          saved.specId,
          'APPLY_CHANGE:' + initial.siteId
        )
      );
      const oversized = structuredClone(request);
      oversized.operations = Array.from({ length: 11 }, (_, i) => ({
        op: 'update-block',
        pageId: 'home',
        sectionId: 'section-' + i,
        blockId: 'block-' + i,
        block: { ...request.operations[0].block, id: 'block-' + i }
      }));
      await assert.rejects(
        sites.change(
          client.id,
          initial.siteId,
          oversized,
          saved.specId,
          'APPLY_CHANGE:' + initial.siteId
        )
      );
    }
  );
  await t.test(
    'four applied changes count once; reservation is concurrent-safe and shared operations have a separate cap',
    async () => {
      for (let i = 1; i <= 4; i++) {
        const { saved, request, next } = await candidate(
          'Fictional revision ' + i
        );
        const results = await Promise.all([
          sites.change(
            client.id,
            initial.siteId,
            request,
            saved.specId,
            'APPLY_CHANGE:' + initial.siteId
          ),
          sites.change(
            client.id,
            initial.siteId,
            request,
            saved.specId,
            'APPLY_CHANGE:' + initial.siteId
          )
        ]);
        assert.equal(results[0].accounting.blocksModified, 1);
        assert.equal(results[0].accounting.pagesTouched, 1);
        assert.equal(results[0].accounting.globalOperations, 0);
        assert.equal(results[1].specId, saved.specId);
        await sites.build(client.id, saved.specId);
        await sites.processOne();
        await sites.deploy(
          client.id,
          initial.siteId,
          saved.specId,
          'fictional-password-at-least-16',
          'DEPLOY_SITE:' + initial.siteId
        );
        await sites.processOne();
        current = next;
        assert.equal(
          (await sites.status(client.id, initial.siteId))
            .monthlyRequestsRemaining,
          4 - i
        );
      }
      const { saved, request } = await candidate('Fifth fictional revision');
      await assert.rejects(
        sites.change(
          client.id,
          initial.siteId,
          request,
          saved.specId,
          'APPLY_CHANGE:' + initial.siteId
        ),
        (e) => e.errors.some((e) => e.rule === 'change.monthly')
      );
      const rows = await f.pool.query(
        'SELECT count(*)::int FROM platform_site_spec WHERE applied_at IS NOT NULL'
      );
      assert.equal(rows.rows[0].count, 4);
      // Previous months provide no rollover. A new UTC month starts with its policy allowance.
      await f.pool.query(
        "UPDATE platform_site_spec SET applied_at=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '1 second' WHERE applied_at IS NOT NULL"
      );
      assert.equal(
        (await sites.status(client.id, initial.siteId))
          .monthlyRequestsRemaining,
        4
      );
    }
  );
  await t.test(
    'failed verification/deploy does not charge; unknown deployment retains reservation for reconciliation',
    async () => {
      const first = await candidate('Failed fixture verification');
      await sites.change(
        client.id,
        initial.siteId,
        first.request,
        first.saved.specId,
        'APPLY_CHANGE:' + initial.siteId
      );
      d.failVerification(true);
      await sites.build(client.id, first.saved.specId);
      await sites.processOne();
      assert.equal(
        (await sites.status(client.id, initial.siteId))
          .monthlyRequestsRemaining,
        4
      );
      const failedReport = JSON.parse(
        (
          await sites.artifact(client.id, first.saved.specId, 'report.json')
        ).toString()
      );
      assert.equal(failedReport.passed, false);
      await assert.rejects(
        sites.artifact(owner.id, first.saved.specId, 'report.json'),
        /owned_spec_required/
      );
      d.failVerification(false);
      const second = await candidate('Failed fixture deploy');
      await sites.change(
        client.id,
        initial.siteId,
        second.request,
        second.saved.specId,
        'APPLY_CHANGE:' + initial.siteId
      );
      await sites.build(client.id, second.saved.specId);
      await sites.processOne();
      d.failDeployment(true);
      await sites.deploy(
        client.id,
        initial.siteId,
        second.saved.specId,
        'fictional-password-at-least-16',
        'DEPLOY_SITE:' + initial.siteId
      );
      await sites.processOne();
      assert.equal(
        (await sites.status(client.id, initial.siteId))
          .monthlyRequestsRemaining,
        4
      );
      const third = await candidate('Uncertain fixture deploy');
      await sites.change(
        client.id,
        initial.siteId,
        third.request,
        third.saved.specId,
        'APPLY_CHANGE:' + initial.siteId
      );
      await sites.build(client.id, third.saved.specId);
      await sites.processOne();
      d.failDeployment(true, true);
      await sites.deploy(
        client.id,
        initial.siteId,
        third.saved.specId,
        'fictional-password-at-least-16',
        'DEPLOY_SITE:' + initial.siteId
      );
      await sites.processOne();
      const s = await sites.status(client.id, initial.siteId);
      assert.equal(s.specs[0].state, 'unknown');
      assert.equal(s.monthlyRequestsRemaining, 3);
      assert.equal(s.specs[0].appliedAt, null);
    }
  );
  await t.test(
    'queue writes roll back with audit failure; audit records contain actor, tool, spec hash and result but no secrets',
    async () => {
      const fresh = await fixtureSubmission();
      fresh.slug = 'another-fictional';
      const saved = await sites.submit(client.id, fresh);
      await f.pool.query(
        "CREATE FUNCTION reject_site_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='site.tool.result' THEN RAISE EXCEPTION 'fictional audit unavailable'; END IF; RETURN NEW; END $$"
      );
      await f.pool.query(
        'CREATE TRIGGER reject_site_audit BEFORE INSERT ON platform_audit FOR EACH ROW EXECUTE FUNCTION reject_site_audit()'
      );
      await assert.rejects(
        sites.build(client.id, saved.specId),
        /fictional audit unavailable/
      );
      assert.equal(
        (
          await f.pool.query(
            'SELECT count(*)::int FROM platform_site_job WHERE spec_id=$1',
            [saved.specId]
          )
        ).rows[0].count,
        0
      );
      await f.pool.query('DROP TRIGGER reject_site_audit ON platform_audit');
      const audits = (
        await f.pool.query(
          "SELECT * FROM platform_audit WHERE action='site.tool.result'"
        )
      ).rows;
      assert.ok(
        audits.some(
          (a) =>
            a.details.specSha256 === input.spec.approval.specSha256 &&
            a.details.result === 'applied'
        )
      );
      assert.ok(
        audits.every(
          (a) => a.actor_user_id && a.details.tool && a.details.result
        )
      );
      assert.ok(
        !JSON.stringify(audits).includes('fictional-password-at-least-16')
      );
    }
  );
});
