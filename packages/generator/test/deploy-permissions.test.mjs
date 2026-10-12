import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { RailwayDeployer } from '../dist/index.js';
import { fixtureSubmission } from '@a2aviary/site-core/fixtures/catalog';

test('deployment staging is readable by non-owner users under umask 077', async () => {
  const { spec } = await fixtureSubmission();
  const resources = {
    projectId: 'fictional-project',
    environmentId: 'fictional-environment',
    webServiceId: 'fictional-web',
    cmsServiceId: 'fictional-cms',
    volumeId: 'fictional-volume',
    cmsConfigured: true,
    domain: 'fictional.example.invalid'
  };
  const provider = new RailwayDeployer({
    apiToken: 'fictional', workspaceId: 'fictional-workspace',
    protectedProjectIds: new Set(), test: true, backupVariables: {}
  }, async (query) => {
    if (query.includes('project(id:')) return { project: {
      name: 'cli-001-fictional', workspaceId: 'fictional-workspace',
      environments: { edges: [{ node: { id: resources.environmentId, name: 'fixture' } }] },
      services: { edges: [
        { node: { id: resources.webServiceId, name: 'web' } },
        { node: { id: resources.cmsServiceId, name: 'cms' } }
      ] }
    } };
    assert.match(query, /^mutation.*(?:serviceInstanceUpdate|serviceInstanceLimitsUpdate|variableCollectionUpsert)/);
    return {};
  });
  const specSha256 = 'a'.repeat(64);
  const files = {
    'index.html': Buffer.from('Fictional home').toString('base64'),
    'assets/nested/image.bin': Buffer.from([0, 1, 128, 255]).toString('base64')
  };
  const uploaded = [];
  provider.upload = async (directory, _resources, serviceId) => {
    const stagedFiles = [];
    async function inspect(relative = '') {
      const path = join(directory, relative);
      const info = await stat(path);
      assert.equal(info.mode & 0o7777, info.isDirectory() ? 0o755 : 0o644,
        `${serviceId}/${relative || '.'} permissions`);
      if (info.isDirectory()) {
        for (const entry of await readdir(path)) await inspect(join(relative, entry));
      } else stagedFiles.push(relative);
    }
    await inspect();
    const expected = serviceId === resources.webServiceId
      ? ['Dockerfile', 'Caddyfile', 'railway.json', ...Object.keys(files).map(path => 'site/' + path)]
      : ['Dockerfile', 'railway.json', `pb_migrations/2-${specSha256}.js`,
        'pb_hooks/bootstrap.pb.js', 'pb_public/editor.html', 'pb_public/editor.js'];
    assert.deepEqual(stagedFiles.sort(), expected.sort());
    if (serviceId === resources.webServiceId) {
      for (const [path, data] of Object.entries(files))
        assert.deepEqual(await readFile(join(directory, 'site', path)), Buffer.from(data, 'base64'));
    }
    uploaded.push(directory);
    return 'fictional-deployment';
  };
  provider.waitHealthy = async () => {};
  provider.waitPublic = async () => {};
  // Node's test runner isolates this file in its own process; restore even on failure.
  const previousUmask = process.umask(0o077);
  try {
    await provider.deploy({
      name: 'cli-001-fictional', spec, resources,
      build: { files, report: { specSha256 }, artifacts: {}, sessionId: 'fictional' },
      clientEmail: 'fictional@example.invalid', clientPassword: 'fictional',
      saveResources: async () => {}
    });
  } finally {
    process.umask(previousUmask);
  }
  assert.equal(uploaded.length, 2);
  for (const directory of uploaded)
    await assert.rejects(stat(directory), { code: 'ENOENT' });
});
