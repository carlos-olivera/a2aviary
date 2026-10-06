import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import {
  fixtureSubmission,
  bindPreview
} from '../../../packages/generator/scripts/fixture-lib.mjs';
import { specDigest } from '@a2aviary/generator';

test('tester enrollment, staging lifecycle and chat-only superadmin with real Postgres and provider doubles', async (t) => {
  const d = testDependencies(),
    f = await fixture(d);
  t.after(f.close);
  const owner = await f.user('owner@example.invalid'),
    tester = await f.user('tester@example.invalid'),
    client = await f.user('client@example.invalid'),
    admin = await f.user('admin@example.invalid');
  const sites = f.app.sites,
    store = f.app.store,
    input = await fixtureSubmission();
  const call = async (user, name, args = {}) => {
    const body = await (
      await f.rpc(await f.token(user), 'tools/call', { name, arguments: args })
    ).json();
    assert.ok(body.result?.content, JSON.stringify(body));
    return {
      error: body.result.isError === true,
      ...JSON.parse(body.result.content[0].text)
    };
  };
  const adminTools = [
    'admin.invite',
    'admin.revoke',
    'admin.audit.list',
    'testers.add',
    'testers.remove',
    'testers.list',
    'sites.list',
    'site.inspect',
    'logs.query',
    'tester.reset'
  ];
  await t.test(
    'superadmin identity cannot be allowlisted/revoked; invitations/revocations by email are idempotent and fresh JWTs do not retain revoked privileges',
    async () => {
      assert.equal(
        (
          await call(owner, 'admin.invite', {
            email: admin.email,
            confirmation: 'INVITE_ADMIN:' + admin.email
          })
        ).invited,
        true
      );
      assert.equal((await store.principal(admin.id)).role, 'admin');
      const oldToken = await f.token(admin);
      for (const user of [tester, client, admin]) {
        const names = (
          await (await f.rpc(await f.token(user))).json()
        ).result.tools.map((t) => t.name);
        for (const name of adminTools) assert.ok(!names.includes(name), name);
        const denied = await call(user, 'site.inspect', {
          siteId: '00000000-0000-0000-0000-000000000001'
        });
        assert.equal(denied.error, 'forbidden');
        assert.ok(!JSON.stringify(denied).includes('ownerId'));
      }
      assert.equal(
        (await call(owner, 'testers.add', { email: owner.email })).error,
        'reserved_identity'
      );
      assert.equal(
        (await call(owner, 'testers.add', { email: admin.email })).error,
        'reserved_identity'
      );
      assert.equal(
        (
          await call(owner, 'admin.revoke', {
            email: owner.email,
            confirmation: 'REVOKE_ADMIN:' + owner.email
          })
        ).error,
        'invited_admin_required'
      );
      assert.equal(
        (
          await call(owner, 'admin.revoke', {
            email: admin.email,
            confirmation: 'yes'
          })
        ).error,
        'confirmation_required'
      );
      assert.equal((await store.principal(admin.id)).role, 'admin');
      for (let i = 0; i < 2; i++)
        assert.equal(
          (
            await call(owner, 'admin.revoke', {
              email: admin.email,
              confirmation: 'REVOKE_ADMIN:' + admin.email
            })
          ).revoked,
          true
        );
      assert.equal((await store.principal(admin.id)).role, 'client');
      assert.ok(
        !(await (await f.rpc(oldToken)).json()).result.tools.some(
          (t) => t.name === 'admin.invite'
        )
      );
      await call(owner, 'admin.invite', {
        email: 'pending@example.invalid',
        confirmation: 'INVITE_ADMIN:pending@example.invalid'
      });
      await call(owner, 'admin.revoke', {
        email: 'pending@example.invalid',
        confirmation: 'REVOKE_ADMIN:pending@example.invalid'
      });
      assert.equal(
        (
          await f.pool.query(
            'SELECT 1 FROM platform_invitation WHERE email=$1',
            ['pending@example.invalid']
          )
        ).rowCount,
        0
      );
    }
  );
  let initial;
  await t.test(
    'tester automatically receives a free pinned plan; builds/changes/jobs/audits are test-tagged and custom domains are rejected before deploy',
    async () => {
      const caps = await call(tester, 'capabilities.get');
      assert.equal(caps.test, true);
      assert.equal(caps.paymentBypass, true);
      assert.equal(caps.freePlan.policyVersion, input.spec.policyVersion);
      // Exercise authenticated upload, not only the direct workflow interface.
      const response = await f.request('/api/site-specs', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + (await f.token(tester)),
          'content-type': 'application/json'
        },
        body: JSON.stringify(input)
      });
      assert.equal(response.status, 201);
      initial = await response.json();
      assert.equal(initial.test, true);
      assert.equal(initial.free, true);
      const duplicate = await sites.submit(tester.id, input);
      assert.equal(duplicate.specId, initial.specId);
      assert.equal(
        (await call(tester, 'site.build', { specId: initial.specId })).test,
        true
      );
      assert.equal(
        (
          await call(owner, 'tester.reset', {
            siteId: initial.siteId,
            confirmation: 'RESET ' + initial.siteId
          })
        ).error,
        'site_busy'
      );
      await sites.processOne();
      assert.deepEqual(d.contexts, [{ test: true }]);
      const args = {
        siteId: initial.siteId,
        specId: initial.specId,
        cmsPassword: 'fictional-secret-password-only',
        confirmation: 'DEPLOY_SITE:' + initial.siteId
      };
      assert.equal(
        (
          await call(tester, 'site.deploy', {
            ...args,
            domain: 'customer.example.invalid',
            confirmation: args.confirmation + ':customer.example.invalid'
          })
        ).error,
        'test_custom_domain_forbidden'
      );
      assert.equal(d.counts.deploys, 0);
      assert.equal((await call(tester, 'site.deploy', args)).test, true);
      await sites.processOne();
      assert.equal(d.inputs[0].test, true);
      assert.equal(d.inputs[0].domain, undefined);
      const status = await sites.status(tester.id, initial.siteId);
      assert.equal(status.test, true);
      assert.equal(status.monthlyRequestsRemaining, 4);
      assert.equal(
        new URL(status.siteUrl).hostname,
        'fictional-fixture.up.railway.app'
      );
      for (const table of [
        'platform_site',
        'platform_site_spec',
        'platform_site_job'
      ])
        assert.ok(
          (await f.pool.query('SELECT test_mode FROM ' + table)).rows.every(
            (r) => r.test_mode
          )
        );
      await assert.rejects(
        f.pool.query('UPDATE platform_site SET test_mode=false WHERE id=$1', [
          initial.siteId
        ]),
        /immutable site test mode/
      );
      assert.ok(
        (
          await f.pool.query(
            'SELECT test_mode FROM platform_audit WHERE actor_user_id=$1',
            [tester.id]
          )
        ).rows.every((r) => r.test_mode)
      );
    }
  );
  await t.test(
    'four successful tester changes consume the policy allowance; fifth is rejected and CMS edits do not add usage',
    async () => {
      let current = structuredClone(input.spec);
      for (let i = 1; i <= 5; i++) {
        const next = structuredClone(current);
        next.pages[0].sections[0].blocks[0].props.heading =
          'Fictional tester revision ' + i;
        const upload = await bindPreview(next, input.assets);
        upload.siteId = initial.siteId;
        delete upload.slug;
        const saved = await sites.submit(tester.id, upload);
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
              block: next.pages[0].sections[0].blocks[0]
            }
          ],
          assets: [],
          preview: next.preview,
          approval: next.approval
        };
        if (i === 5) {
          await assert.rejects(
            sites.change(
              tester.id,
              initial.siteId,
              request,
              saved.specId,
              'APPLY_CHANGE:' + initial.siteId
            ),
            (e) =>
              e.code === 'invalid_change' &&
              e.errors.some((e) => e.rule === 'change.monthly')
          );
          break;
        }
        assert.equal(
          (
            await sites.change(
              tester.id,
              initial.siteId,
              request,
              saved.specId,
              'APPLY_CHANGE:' + initial.siteId
            )
          ).test,
          true
        );
        await sites.build(tester.id, saved.specId);
        await sites.processOne();
        await sites.deploy(
          tester.id,
          initial.siteId,
          saved.specId,
          'fictional-secret-password-only',
          'DEPLOY_SITE:' + initial.siteId
        );
        await sites.processOne();
        current = next;
        assert.equal(
          (await sites.status(tester.id, initial.siteId))
            .monthlyRequestsRemaining,
          4 - i
        );
      }
      const inspected = await call(owner, 'site.inspect', {
        siteId: initial.siteId
      });
      assert.equal(inspected.test, true);
      assert.equal(inspected.monthlyRequestsUsed, 4);
      assert.equal(inspected.lastDeploy.state, 'done');
      assert.equal(inspected.specs.length, 6);
      assert.ok(!JSON.stringify(inspected).includes('client_password'));
      assert.equal(
        (
          await call(owner, 'sites.list', {
            test: true,
            owner: tester.id,
            status: 'live'
          })
        ).sites.length,
        1
      );
      assert.equal(
        (await call(owner, 'sites.list', { test: true, owner: tester.id }))
          .sites[0].test,
        true
      );
    }
  );
  await t.test(
    'removing enrollment cannot upgrade a test site; disabled env seeds persist across restart and explicit re-add restores access',
    async () => {
      assert.equal(
        (await call(owner, 'testers.remove', { email: tester.email })).enabled,
        false
      );
      assert.equal((await store.principal(tester.id)).role, 'client');
      await store.seedTesters();
      assert.equal((await store.principal(tester.id)).role, 'client');
      await assert.rejects(
        sites.status(tester.id, initial.siteId),
        /site_mode_mismatch/
      );
      assert.equal(
        (await call(owner, 'testers.list')).testers.find(
          (t) => t.email === tester.email
        ).enabled,
        false
      );
      assert.equal(
        (await call(owner, 'testers.add', { email: tester.email })).enabled,
        true
      );
      assert.equal((await store.principal(tester.id)).role, 'tester');
      const live = await sites.submit(client.id, {
        ...input,
        slug: 'fictional-live'
      });
      assert.equal(
        (
          await call(owner, 'tester.reset', {
            siteId: live.siteId,
            confirmation: 'RESET ' + live.siteId
          })
        ).error,
        'test_site_required'
      );
      await store.tester(owner.id, 'testers.add', client.email);
      await assert.rejects(
        sites.status(client.id, live.siteId),
        /site_mode_mismatch/
      );
      await store.tester(owner.id, 'testers.remove', client.email);
    }
  );
  await t.test(
    'reset confirmation, failed provider/asset cleanup, lock races, retry and complete audit/history cleanup',
    async () => {
      assert.equal(
        (
          await call(owner, 'tester.reset', {
            siteId: initial.siteId,
            confirmation: 'yes'
          })
        ).error,
        'confirmation_required'
      );
      assert.equal(d.resets.length, 0);
      d.failReset(true);
      assert.equal(
        (
          await call(owner, 'tester.reset', {
            siteId: initial.siteId,
            confirmation: 'RESET ' + initial.siteId
          })
        ).error,
        'test_reset_unconfirmed'
      );
      assert.equal(
        (await sites.inspect(owner.id, initial.siteId)).lifecycle,
        'resetting'
      );
      await assert.rejects(
        sites.build(tester.id, initial.specId),
        /site_resetting/
      );
      d.failReset(false);
      d.failAssetCleanup(true);
      assert.equal(
        (
          await call(owner, 'tester.reset', {
            siteId: initial.siteId,
            confirmation: 'RESET ' + initial.siteId
          })
        ).error,
        'asset_reset_failed'
      );
      assert.deepEqual(
        (
          await f.pool.query(
            'SELECT resources FROM platform_site WHERE id=$1',
            [initial.siteId]
          )
        ).rows[0].resources,
        {}
      );
      const lease = await f.pool.connect();
      await lease.query('SELECT pg_advisory_lock(hashtext($1))', [
        'tester-reset:' + initial.siteId
      ]);
      assert.equal(
        (
          await call(owner, 'tester.reset', {
            siteId: initial.siteId,
            confirmation: 'RESET ' + initial.siteId
          })
        ).error,
        'reset_busy'
      );
      await lease.query('SELECT pg_advisory_unlock(hashtext($1))', [
        'tester-reset:' + initial.siteId
      ]);
      lease.release();
      d.failAssetCleanup(false);
      for (let i = 0; i < 2; i++)
        assert.equal(
          (
            await call(owner, 'tester.reset', {
              siteId: initial.siteId,
              confirmation: 'RESET ' + initial.siteId
            })
          ).reset,
          true
        );
      assert.equal(
        (await sites.inspect(owner.id, initial.siteId)).lifecycle,
        'archived'
      );
      assert.equal(
        (await call(owner, 'sites.list', { test: true, status: 'archived' }))
          .sites[0].status,
        'archived'
      );
      for (const table of ['platform_site_spec', 'platform_site_job'])
        assert.equal(
          (
            await f.pool.query(
              'SELECT count(*)::int FROM ' +
                table +
                ' WHERE ' +
                (table.endsWith('spec') ? 'site_id=$1' : 'actor_id=$1'),
              [table.endsWith('spec') ? initial.siteId : tester.id]
            )
          ).rows[0].count,
          0
        );
      assert.equal(
        [...d.data.keys()].some((k) =>
          k.startsWith('specs/' + initial.specId + '/')
        ),
        false
      );
      assert.equal((await store.principal(tester.id)).role, 'tester');
      assert.equal(
        (await store.tester(owner.id, 'testers.list')).testers.find(
          (t) => t.email === tester.email
        ).enabled,
        true
      );
      const records = (
        await f.pool.query(
          "SELECT * FROM platform_audit WHERE action='tester.reset' AND target=$1",
          [initial.siteId]
        )
      ).rows;
      assert.ok(records.some((r) => r.details.result === 'success'));
      assert.ok(
        records.every(
          (r) =>
            r.test_mode &&
            r.actor_user_id === owner.id &&
            r.details.confirmation === 'RESET ' + initial.siteId
        )
      );
      const fresh = await sites.submit(tester.id, {
        ...input,
        slug: 'fictional-after-reset'
      });
      assert.equal(
        (await sites.status(tester.id, fresh.siteId)).monthlyRequestsRemaining,
        4
      );
      await assert.rejects(sites.submit(tester.id, input), /site_archived/);
    }
  );
  await t.test(
    'log filters and bounded redaction hide injected secret fields; denied accesses and admin reads are audited',
    async () => {
      await f.pool.query(
        `INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'site.tool.result','site.build',$2,true)`,
        [
          tester.id,
          JSON.stringify({
            tool: 'site.build',
            result: 'success',
            password: 'fictional-private-token',
            nested: { authorization: 'fictional-private-token' },
            specSha256: 'a'.repeat(64)
          })
        ]
      );
      const log = await call(owner, 'logs.query', {
        actor: tester.id,
        tool: 'site.build',
        test: true,
        limit: 100
      });
      assert.ok(log.records.length);
      assert.ok(
        log.records.every((r) => r.test && r.actorUserId === tester.id)
      );
      assert.ok(!JSON.stringify(log).includes('fictional-private-token'));
      assert.ok(
        log.records.some((r) => r.details.specSha256 === 'a'.repeat(64))
      );
      assert.equal(
        (
          await call(owner, 'logs.query', {
            from: '2026-01-01T00:00:00Z',
            to: '2026-03-01T00:00:00Z'
          })
        ).error,
        'invalid_log_range'
      );
      assert.ok(
        (
          await f.pool.query(
            "SELECT 1 FROM platform_audit WHERE action='admin.tool.result' AND details->>'result'='forbidden'"
          )
        ).rowCount
      );
      assert.ok(
        !(
          await f.pool.query(
            'SELECT details::text FROM platform_audit WHERE actor_user_id=$1',
            [owner.id]
          )
        ).rows.some((r) => r.details.includes('fictional-secret-password'))
      );
    }
  );
});
