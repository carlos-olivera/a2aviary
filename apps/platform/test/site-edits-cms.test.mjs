import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  RailwayDeployer,
  pocketBaseMigration,
  pocketBaseBootstrap,
  pocketBaseDockerfile,
  ensureCollectionsCommand,
} from '@a2aviary/generator';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { prepare, approve } from './draft-fixture.mjs';
import { hostedComposition } from './hosted-fixture-cms.mjs';

// Real persistent Docker PocketBase/Caddy; Railway control-plane/SSH transport
// and build verifier are doubles. No hosted credentials or provider calls.
test(
  'Docker CMS survives create, edit with new collection, unbinding and stored-byte restoration',
  { skip: process.env.RUN_LOCAL_FIXTURE_CMS !== 'true', timeout: 240000 },
  async (t) => {
    const docker = (...args) =>
      execFileSync('docker', args, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000,
      });
    const id = 'site-edit-' + randomUUID().slice(0, 8),
      network = id + '-net',
      cms = id + '-cms',
      web = id + '-web',
      volume = id + '-data',
      cmsImage = cms + ':local',
      webImage = web + ':local';
    const dir = await mkdtemp(join(tmpdir(), 'site-edit-cms-'));
    const deps = testDependencies(),
      f = await fixture(deps);
    t.after(f.close);
    t.after(async () => {
      for (const c of [web, cms])
        try {
          docker('rm', '-f', c);
        } catch {}
      try {
        docker('network', 'rm', network);
      } catch {}
      try {
        docker('volume', 'rm', volume);
      } catch {}
      for (const i of [cmsImage, webImage])
        try {
          docker('image', 'rm', i);
        } catch {}
      await rm(dir, { recursive: true, force: true });
    });
    const u = await f.user('tester@example.invalid'),
      s = f.app.sites,
      input = await hostedComposition('light-es');
    for (const folder of ['pb_migrations', 'pb_hooks', 'pb_public'])
      await mkdir(join(dir, folder));
    for (const [path, bytes] of Object.entries({
      Dockerfile: pocketBaseDockerfile,
      'pb_migrations/2-site.js': pocketBaseMigration(input.spec),
      'pb_hooks/bootstrap.pb.js': pocketBaseBootstrap,
      'pb_public/editor.html': '<!doctype html><title>Fictional editor</title>',
    }))
      await writeFile(join(dir, path), bytes);
    docker('build', '-t', cmsImage, dir);
    docker('network', 'create', network);
    docker('volume', 'create', volume);
    const password = 'FictionalPassword_for_CMS_only_1234';
    const variables = {
      PB_ADMIN_EMAIL: 'cms-admin@internal.invalid',
      PB_ADMIN_PASSWORD: password,
      PB_CLIENT_EMAIL: u.email,
      PB_CLIENT_PASSWORD: password,
      PB_ENCRYPTION_KEY: 'a'.repeat(32),
      PB_BACKUP_BUCKET: 'fictional',
      PB_BACKUP_ENDPOINT: 'https://backup.example.invalid',
      PB_BACKUP_REGION: 'auto',
      PB_BACKUP_ACCESS_KEY_ID: 'fictional',
      PB_BACKUP_SECRET_ACCESS_KEY: 'fictional',
      PB_BACKUP_FORCE_PATH_STYLE: 'true',
    };
    const containerId = docker(
      'run',
      '-d',
      '--name',
      cms,
      '--network',
      network,
      '--network-alias',
      'cms',
      '-p',
      '127.0.0.1::8090',
      '-v',
      volume + ':/pb/pb_data',
      ...Object.entries(variables).flatMap(([k, v]) => ['-e', k + '=' + v]),
      cmsImage,
    ).trim();
    const cmsOrigin =
      'http://127.0.0.1:' +
      docker('port', cms, '8090').trim().split(':').at(-1);
    async function ready(url) {
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(url)).ok) return;
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      throw Error('Local readiness failed');
    }
    await ready(cmsOrigin + '/api/health');
    const provider = new RailwayDeployer({
      apiToken: 'fictional-never-sent',
      workspaceId: 'fixture',
      protectedProjectIds: new Set(),
      test: true,
      backupVariables: {},
    });
    const resources = {
      projectId: 'fixture-project',
      environmentId: 'fixture',
      webServiceId: web,
      cmsServiceId: cms,
      volumeId: volume,
      domain: 'fictional.up.railway.app',
      cmsConfigured: true,
      test: true,
    };
    let webOrigin,
      uploads = 0;
    provider.guard = async () => true;
    provider.ensureCollections = async (_r, spec) => {
      assert.equal(
        docker('exec', cms, 'sh', '-c', ensureCollectionsCommand(spec)).trim(),
        'CMS_COLLECTIONS_READY',
      );
    };
    provider.upload = async (directory, _r, service) => {
      assert.equal(service, web);
      uploads++;
      docker('build', '-t', webImage, directory);
      try {
        docker('rm', '-f', web);
      } catch {}
      docker(
        'run',
        '-d',
        '--name',
        web,
        '--network',
        network,
        '-p',
        '127.0.0.1::8080',
        '-e',
        'CMS_UPSTREAM=cms:8090',
        webImage,
      );
      webOrigin =
        'http://127.0.0.1:' +
        docker('port', web, '8080').trim().split(':').at(-1);
      return 'fixture-deployment';
    };
    provider.waitHealthy = async () => ready(webOrigin + '/healthz');
    provider.waitPublic = async (_domain, build) =>
      assert.equal(
        await (await fetch(webOrigin + '/')).text(),
        Buffer.from(build.files['index.html'], 'base64').toString(),
      );
    deps.deployer.deploy = async (input) => {
      deps.inputs.push(input);
      return provider.deploy({ ...input, resources, redeploy: true });
    };
    const initial = await prepare(f, u, input);
    await s.processOne();
    await approve(f, u, initial.specId);
    await s.deploy(
      u.id,
      initial.siteId,
      initial.specId,
      password,
      'DEPLOY_SITE:' + initial.siteId,
    );
    await s.processOne();
    assert.equal(
      (await s.status(u.id, initial.siteId)).currentSpecId,
      initial.specId,
    );
    const auth = await fetch(
      webOrigin + '/api/cms/api/collections/editors/auth-with-password',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identity: u.email, password }),
      },
    );
    assert.equal(auth.status, 200);
    const token = (await auth.json()).token;
    const record = await fetch(
      webOrigin + '/api/cms/api/collections/announcements/records',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: token },
        body: JSON.stringify({
          title: 'Persistent fictional record',
          body: 'Must survive static edits',
          published: true,
        }),
      },
    );
    assert.equal(record.status, 200);
    const recordId = (await record.json()).id;
    const checkRecord = async () => {
      const res = await fetch(
        cmsOrigin + '/api/collections/announcements/records/' + recordId,
        { headers: { authorization: token } },
      );
      assert.equal(res.status, 200);
      assert.equal((await res.json()).title, 'Persistent fictional record');
      assert.equal(
        docker('inspect', '--format', '{{.Id}}', cms).trim(),
        containerId,
      );
    };
    await checkRecord();
    let draft = await s.drafts.openEdit(u.id, initial.siteId, randomUUID());
    let content = (await s.drafts.get(u.id, draft.draftId, 'full')).content;
    content.pages[0].seo.title = 'Edited fictional studio';
    content.tokens.colors.primary = '#123456';
    content.cms.collections.push('catalog');
    content.pages[0].sections.push({
      id: 'new-cms',
      blocks: [
        {
          id: 'new-catalog',
          component: 'catalog',
          variant: 'standard',
          props: {
            heading: 'Fictional catalog',
            collection: 'catalog',
            emptyText: 'No fictional entries yet.',
          },
        },
      ],
    });
    const newPage = {
      ...structuredClone(content.pages[0]),
      id: 'new-page',
      path: '/new-page/',
    };
    draft = await s.drafts.apply(u.id, {
      draftId: draft.draftId,
      expectedRevision: draft.revision,
      requestId: randomUUID(),
      operations: [
        {
          op: 'settings',
          settings: { tokens: content.tokens, cms: content.cms },
        },
        { op: 'upsert-page', page: content.pages[0] },
        { op: 'upsert-page', page: newPage, index: 1 },
      ],
    });
    let snapshot = await s.drafts.preview(u.id, draft.draftId, draft.revision);
    await s.processOne();
    await approve(f, u, snapshot.specId);
    await s.deploy(
      u.id,
      initial.siteId,
      snapshot.specId,
      undefined,
      'DEPLOY_SITE:' + initial.siteId,
    );
    await s.processOne();
    assert.equal(
      (await s.status(u.id, initial.siteId)).currentSpecId,
      snapshot.specId,
    );
    await checkRecord();
    assert.equal(
      (await fetch(webOrigin + '/api/cms/api/collections/catalog/records'))
        .status,
      200,
    );
    const editor = await (await fetch(webOrigin + '/api/cms/editor.js')).text();
    assert.match(editor, /catalog/);
    draft = await s.drafts.openEdit(u.id, initial.siteId, randomUUID());
    content = (await s.drafts.get(u.id, draft.draftId, 'full')).content;
    for (const p of content.pages)
      p.sections = p.sections.filter((section) => section.id !== 'studio-news');
    content.cms.collections = ['catalog'];
    draft = await s.drafts.apply(u.id, {
      draftId: draft.draftId,
      expectedRevision: draft.revision,
      requestId: randomUUID(),
      operations: [
        { op: 'settings', settings: { cms: content.cms } },
        ...content.pages.map((page) => ({ op: 'upsert-page', page })),
      ],
    });
    snapshot = await s.drafts.preview(u.id, draft.draftId, draft.revision);
    await s.processOne();
    await approve(f, u, snapshot.specId);
    await assert.rejects(
      s.deploy(
        u.id,
        initial.siteId,
        snapshot.specId,
        undefined,
        'DEPLOY_SITE:' + initial.siteId,
      ),
      /confirmation/,
    );
    await s.deploy(
      u.id,
      initial.siteId,
      snapshot.specId,
      undefined,
      'DEPLOY_SITE:' + initial.siteId,
      undefined,
      'RETAIN_CMS_RECORDS:' + snapshot.specId + ':announcements',
    );
    await s.processOne();
    await checkRecord();
    assert.equal(
      (
        await fetch(
          webOrigin + '/api/cms/api/collections/announcements/records',
        )
      ).status,
      404,
    );
    // Adapter-level restoration evidence only; public rollback admission is proposed.
    const row = (
      await f.pool.query('SELECT * FROM platform_site_spec WHERE id=$1', [
        initial.specId,
      ])
    ).rows[0];
    const build = await s.readVerifiedBuild(row);
    const verifies = deps.counts.verifies;
    await provider.deploy({
      ...deps.inputs[0],
      spec: row.spec,
      build,
      resources,
      redeploy: true,
      clientPassword: undefined,
    });
    await checkRecord();
    assert.equal(deps.counts.verifies, verifies);
    assert.equal(uploads, 4);
    assert.equal(
      (
        await fetch(
          webOrigin + '/api/cms/api/collections/announcements/records',
        )
      ).status,
      200,
    );
    assert.equal((await s.status(u.id, initial.siteId)).monthlyRequestsUsed, 2);
  },
);
