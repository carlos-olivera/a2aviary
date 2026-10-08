import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { railwayUsage } from '../dist/index.js';

test('cost reads bind project/workspace and sum only catalog web/CMS, keeping provider gaps null', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'catalog-cost-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cli = join(dir, 'railway');
  const resources = {
    projectId: 'catalog-project',
    environmentId: 'catalog-environment',
    webServiceId: 'web',
    cmsServiceId: 'cms'
  };
  const service = (id, total) => ({
    id,
    totalDollars: total,
    cpuDollars: total,
    memoryDollars: 0,
    egressDollars: 0,
    volumeDollars: 0,
    backupDollars: 0
  });
  async function provider(usage) {
    await writeFile(
      cli,
      '#!/usr/bin/env node\nconst args=process.argv.slice(2);if(args[0]==="metrics"){process.stdout.write(JSON.stringify({cpu:{value:1},secret:"must-not-escape"}));}else{process.stdout.write(' +
        JSON.stringify(JSON.stringify(usage)) +
        ');}\n'
    );
    await chmod(cli, 0o700);
  }
  const fixture = {
    workspace: { id: 'workspace' },
    project: { id: 'catalog-project' },
    billingPeriod: { start: 'fictional' },
    services: [service('web', 2), service('cms', 3), service('shared', 900)]
  };
  await provider(fixture);
  const r = await railwayUsage(
    cli,
    'fictional-token',
    'workspace',
    resources,
    '2026-10'
  );
  assert.equal(r.amount, 5);
  assert.equal(r.breakdown.cpuDollars, 5);
  assert.equal(r.status, 'available');
  assert.equal(r.metricsStatus, 'available');
  assert.equal(JSON.stringify(r).includes('must-not-escape'), false);
  await provider({ ...fixture, project: { id: 'unrelated' } });
  assert.equal(
    (
      await railwayUsage(
        cli,
        'fictional-token',
        'workspace',
        resources,
        '2026-10'
      )
    ).amount,
    null
  );
  await provider({ ...fixture, services: [service('web', 2)] });
  const missing = await railwayUsage(
    cli,
    'fictional-token',
    'workspace',
    resources,
    '2026-10'
  );
  assert.equal(missing.amount, null);
  assert.equal(missing.status, 'unavailable');
  assert.equal(missing.metricsStatus, 'available');
  await provider({
    ...fixture,
    services: [service('web', -1), service('cms', 3)]
  });
  assert.equal(
    (
      await railwayUsage(
        cli,
        'fictional-token',
        'workspace',
        resources,
        '2026-10'
      )
    ).amount,
    null
  );
  await provider(fixture);
  assert.equal(
    (
      await railwayUsage(
        cli,
        'fictional-token',
        'workspace',
        { ...resources, cmsServiceId: 'web' },
        '2026-10'
      )
    ).amount,
    2
  );
});
