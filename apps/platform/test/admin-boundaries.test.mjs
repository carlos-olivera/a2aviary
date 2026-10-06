import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { fixtureSubmission } from '../../../packages/generator/scripts/fixture-lib.mjs';
import { TOOL_ROLES } from '../src/store.ts';
import { redactedAudit } from '../src/audit.ts';

test('audit detail allowlist excludes secret-like result strings and unknown nested fields', () => {
  const row = redactedAudit(
    {
      details: {
        tool: 'not-a-tool',
        result: 'fictional-private-token',
        authorization: 'fictional-private-token',
        unknown: { secret: 'fictional-private-token' },
        test: true
      },
      testMode: true
    },
    TOOL_ROLES
  );
  assert.deepEqual(row.details, { test: true });
  assert.equal(row.test, true);
});

test('admin schema boundaries, pagination, permission denial and audit rollback', async (t) => {
  const d = testDependencies(),
    f = await fixture(d);
  t.after(f.close);
  const owner = await f.user('owner@example.invalid'),
    tester = await f.user('tester@example.invalid');
  const rpc = async (name, args = {}) =>
    await (
      await f.rpc(await f.token(owner), 'tools/call', { name, arguments: args })
    ).json();
  const call = async (name, args = {}) => {
    const r = await rpc(name, args);
    assert.ok(r.result?.content);
    return JSON.parse(r.result.content[0].text);
  };
  await t.test(
    'MCP rejects extra rules/trust arguments, bad dates, pagination and ambiguous revoke targets, while auditing attempted calls',
    async () => {
      for (const [name, args] of [
        ['testers.add', { email: 'bad' }],
        [
          'testers.add',
          { email: 'new@example.invalid', policy: { pages: 99 } }
        ],
        [
          'testers.remove',
          {
            email: 'new@example.invalid',
            allowedOrigins: ['https://other.example.invalid']
          }
        ],
        ['testers.list', { limit: 0 }],
        ['testers.list', { limit: 101 }],
        ['sites.list', { limit: 101 }],
        ['sites.list', { status: 'anything' }],
        ['sites.list', { after: 'not-a-uuid' }],
        ['logs.query', { from: 'bad' }],
        ['logs.query', { limit: 101 }],
        ['logs.query', { tool: 'policy.write' }],
        [
          'admin.revoke',
          {
            email: 'new@example.invalid',
            userId: 'fictional',
            confirmation: 'REVOKE_ADMIN:new@example.invalid'
          }
        ],
        ['tester.reset', { siteId: 'bad', confirmation: 'yes' }]
      ]) {
        const before = (
          await f.pool.query(
            "SELECT count(*)::int FROM platform_audit WHERE action='tool.call' AND target=$1",
            [name]
          )
        ).rows[0].count;
        const r = await rpc(name, args);
        assert.ok(r.error || r.result?.isError, JSON.stringify({ name, r }));
        assert.equal(
          (
            await f.pool.query(
              "SELECT count(*)::int FROM platform_audit WHERE action='tool.call' AND target=$1",
              [name]
            )
          ).rows[0].count,
          before + 1
        );
      }
      assert.equal(
        (
          await f.pool.query('SELECT 1 FROM platform_tester WHERE email=$1', [
            'new@example.invalid'
          ])
        ).rowCount,
        0
      );
      await assert.rejects(
        f.app.store.tester(tester.id, 'testers.list'),
        /forbidden/
      );
      await assert.rejects(
        f.app.store.tester(
          tester.id,
          'capabilities.get',
          'bypass@example.invalid'
        ),
        /invalid_tester_operation/
      );
      await assert.rejects(
        f.app.store.tester(owner.id, 'testers.list', 'bypass@example.invalid'),
        /invalid_tester_operation/
      );
      await assert.rejects(
        f.app.store.tester(owner.id, 'testers.add', 'UPPER@EXAMPLE.INVALID'),
        /invalid_email/
      );
      await assert.rejects(
        f.app.store.logs(tester.id, { limit: 25 }),
        /forbidden/
      );
      await assert.rejects(
        f.app.sites.list(tester.id, { limit: 25 }),
        /forbidden/
      );
      await assert.rejects(
        f.app.sites.reset(
          tester.id,
          '00000000-0000-0000-0000-000000000001',
          'RESET 00000000-0000-0000-0000-000000000001'
        ),
        /forbidden/
      );
    }
  );
  await t.test(
    'bounded cursors and UTC ranges return matching records without skipping classifications',
    async () => {
      await call('testers.add', { email: 'a@example.invalid' });
      await call('testers.add', { email: 'b@example.invalid' });
      const first = await call('testers.list', { limit: 1 });
      assert.equal(first.testers.length, 1);
      assert.ok(first.nextAfter);
      const second = await call('testers.list', {
        limit: 100,
        after: first.nextAfter
      });
      assert.ok(second.testers.every((r) => r.email > first.nextAfter));
      const sample = await fixtureSubmission();
      const a = await f.app.sites.submit(tester.id, {
        ...sample,
        slug: 'fixture-a'
      });
      const b = await f.app.sites.submit(tester.id, {
        ...sample,
        slug: 'fixture-b'
      });
      const rows = await call('sites.list', {
        test: true,
        owner: tester.id,
        limit: 1
      });
      assert.equal(rows.sites.length, 1);
      assert.ok(rows.nextAfter);
      const rest = await call('sites.list', {
        test: true,
        owner: tester.id,
        after: rows.nextAfter,
        limit: 1
      });
      assert.equal(rest.sites.length, 1);
      assert.notEqual(rows.sites[0].siteId, rest.sites[0].siteId);
      assert.deepEqual(
        new Set([a.siteId, b.siteId]),
        new Set([rows.sites[0].siteId, rest.sites[0].siteId])
      );
      const logs = await call('logs.query', { test: true, limit: 1 });
      assert.equal(logs.records.length, 1);
      assert.ok(logs.nextBefore);
      const older = await call('logs.query', {
        test: true,
        limit: 100,
        before: logs.nextBefore,
        from: new Date(Date.now() - 60000).toISOString(),
        to: new Date(Date.now() + 1000).toISOString()
      });
      assert.ok(
        older.records.every(
          (r) => r.test && BigInt(r.id) < BigInt(logs.nextBefore)
        )
      );
      assert.equal(
        (
          await call('logs.query', {
            from: '2026-10-02T00:00:00Z',
            to: '2026-10-01T00:00:00Z'
          })
        ).error,
        'invalid_log_range'
      );
    }
  );
  await t.test(
    'failed audit rolls back tester enrollment and prevents destructive reset provider calls',
    async () => {
      await f.pool.query(
        "CREATE FUNCTION reject_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='testers.add' OR (NEW.action='tester.reset' AND NEW.details->>'result'='started') THEN RAISE EXCEPTION 'fictional audit failure'; END IF; RETURN NEW; END $$"
      );
      await f.pool.query(
        'CREATE TRIGGER reject_admin_audit BEFORE INSERT ON platform_audit FOR EACH ROW EXECUTE FUNCTION reject_admin_audit()'
      );
      assert.equal(
        (await call('testers.add', { email: 'rollback@example.invalid' }))
          .error,
        'operation_failed'
      );
      assert.equal(
        (
          await f.pool.query('SELECT 1 FROM platform_tester WHERE email=$1', [
            'rollback@example.invalid'
          ])
        ).rowCount,
        0
      );
      const site = (
        await f.pool.query(
          'SELECT id FROM platform_site WHERE owner_id=$1 LIMIT 1',
          [tester.id]
        )
      ).rows[0];
      assert.equal(
        (
          await call('tester.reset', {
            siteId: site.id,
            confirmation: 'RESET ' + site.id
          })
        ).error,
        'operation_failed'
      );
      assert.equal(d.resets.length, 0);
      assert.equal(
        (
          await f.pool.query(
            'SELECT lifecycle FROM platform_site WHERE id=$1',
            [site.id]
          )
        ).rows[0].lifecycle,
        'active'
      );
      await f.pool.query('DROP TRIGGER reject_admin_audit ON platform_audit');
    }
  );
  await t.test('interrupted tester jobs retain test flags and a failed final reset audit retains history for retry',async()=>{
    const spec=(await f.pool.query('SELECT p.id,p.site_id FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE s.owner_id=$1 LIMIT 1',[tester.id])).rows[0];
    await f.app.sites.build(tester.id,spec.id);
    await f.pool.query("UPDATE platform_site_job SET state='running' WHERE spec_id=$1",[spec.id]);
    await f.app.sites.recoverInterrupted();
    assert.equal((await f.pool.query("SELECT test_mode FROM platform_audit WHERE action='site.worker.recovery' AND target=$1",[spec.id])).rows[0].test_mode,true);
    await f.pool.query("CREATE FUNCTION reject_reset_success() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='tester.reset' AND NEW.details->>'result'='success' THEN RAISE EXCEPTION 'fictional final audit failure'; END IF; RETURN NEW; END $$");
    await f.pool.query('CREATE TRIGGER reject_reset_success BEFORE INSERT ON platform_audit FOR EACH ROW EXECUTE FUNCTION reject_reset_success()');
    const args={siteId:spec.site_id,confirmation:'RESET '+spec.site_id};
    assert.equal((await call('tester.reset',args)).error,'operation_failed');
    assert.equal((await f.app.sites.inspect(owner.id,spec.site_id)).lifecycle,'resetting');
    assert.equal((await f.pool.query('SELECT count(*)::int FROM platform_site_spec WHERE id=$1',[spec.id])).rows[0].count,1);
    assert.equal([...d.data.keys()].some(k=>k.startsWith('specs/'+spec.id+'/')),false);
    await f.pool.query('DROP TRIGGER reject_reset_success ON platform_audit');
    assert.equal((await call('tester.reset',args)).reset,true);
    assert.equal((await f.pool.query('SELECT count(*)::int FROM platform_site_spec WHERE id=$1',[spec.id])).rows[0].count,0);
    const records=(await f.pool.query("SELECT test_mode,details FROM platform_audit WHERE action='tester.reset' AND target=$1",[spec.site_id])).rows;
    assert.ok(records.every(r=>r.test_mode&&r.details.confirmation===args.confirmation));
    assert.ok(records.some(r=>r.details.result==='success'));
  });

});
