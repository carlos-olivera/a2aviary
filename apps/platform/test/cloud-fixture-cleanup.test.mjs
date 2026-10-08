import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanupFixture } from './cloud-fixture-cleanup.mjs';
const saved = { siteId: 'fictional-site' }, owner = { id: 'fictional-owner' };
for (const failedStage of ['verification', 'provisioning', 'CMS login']) {
  test('tester cleanup after failed ' + failedStage, async () => {
    let calls = 0;
    const result = await cleanupFixture({
      enabled: true, saved, owner, resetVerified: false,
      sites: {
        async reset(id, siteId, confirmation) {
          assert.equal(id, owner.id); assert.equal(siteId, saved.siteId);
          assert.equal(confirmation, 'RESET fictional-site'); calls++; return { reset: true };
        },
        async inspect() { return { lifecycle: 'archived' }; }
      }
    });
    assert.equal(calls, 1); assert.equal(result.resetVerified, true);
  });
}
test('cleanup failure is explicit and redacts the provider error', async () => {
  const result = await cleanupFixture({
    enabled: true, saved, owner, resetVerified: false,
    sites: { async reset() { throw Error('private provider response'); } }
  });
  assert.deepEqual(result, { attempted: true, resetVerified: false, errorCode: 'fixture_reset_failed' });
});
test('non-test, unadmitted and already-reset fixtures are left alone', async () => {
  for (const overrides of [{ enabled: false }, { saved: undefined }, { resetVerified: true }]) {
    const result = await cleanupFixture({
      enabled: true, saved, owner, resetVerified: false,
      sites: { async reset() { assert.fail('unexpected reset'); } }, ...overrides
    });
    assert.equal(result.attempted, false);
  }
});
test('an unarchived reset is reported as incomplete cleanup', async () => {
  const result = await cleanupFixture({
    enabled: true, saved, owner, resetVerified: false,
    sites: { async reset() { return { reset: true }; }, async inspect() { return { lifecycle: 'active' }; } }
  });
  assert.equal(result.resetVerified, false); assert.equal(result.errorCode, 'fixture_reset_failed');
});
