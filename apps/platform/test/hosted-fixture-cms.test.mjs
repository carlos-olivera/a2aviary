import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateSiteSpec, defaultPolicy } from '@a2aviary/site-core';
import {
  pocketBaseMigration,
  pocketBaseBootstrap,
  pocketBaseDockerfile,
  caddyfile,
  caddyDockerfile,
} from '@a2aviary/generator';
import {
  composition,
  compositionNames,
} from '@a2aviary/site-core/fixtures/presentation';
import { hostedComposition, editFixtureCms } from './hosted-fixture-cms.mjs';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { prepare } from './draft-fixture.mjs';

test('hosted presentations declare and bind a valid CMS collection in every composition', async () => {
  for (const name of compositionNames) {
    const { spec } = await hostedComposition(name);
    const result = validateSiteSpec(spec, defaultPolicy, { test: true });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(spec.cms.collections, ['announcements']);
    const calls = [];
    const cms = await editFixtureCms({
      spec,
      origin: 'http://fixture.invalid',
      token: 'fictional',
      request: async (url, options) => {
        calls.push({ url, options });
        return { status: 200 };
      },
    });
    assert.equal(cms.collection, 'announcements');
    assert.equal(cms.stage, 'edited');
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      'http://fixture.invalid/api/cms/api/collections/announcements/records',
    );
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(JSON.parse(calls[0].options.body).published, true);
    assert.deepEqual((await composition(name)).spec.cms.collections, []);
  }
});

test('CMS targets the bound declaration, rejects mismatches and requires the expected HTTP status', async () => {
  const { spec } = await hostedComposition('light-es');
  spec.cms.collections.unshift('catalog');
  const run = (status) =>
    editFixtureCms({
      spec,
      origin: 'http://fixture.invalid',
      token: 'fictional',
      request: async () => ({ status }),
    });
  assert.equal((await run(200)).collection, 'announcements');
  await assert.rejects(run(404), /CMS fixture write status/);
  spec.cms.collections = ['catalog'];
  await assert.rejects(run(200), /bindings must be declared/);
  const empty = (await composition('light-es')).spec;
  const calls = [];
  const none = (status) =>
    editFixtureCms({
      spec: empty,
      origin: 'http://fixture.invalid',
      token: 'fictional',
      request: async (url) => {
        calls.push(url);
        return { status };
      },
    });
  assert.deepEqual(await none(404), {
    stage: 'no collection to edit',
    collection: 'fixture_undeclared',
    httpStatus: 404,
  });
  assert.match(calls[0], /collections\/fixture_undeclared\/records$/);
  await assert.rejects(none(200), /CMS fixture write status/);
  empty.cms.collections = ['catalog'];
  await assert.rejects(none(404), /must be bound/);
});

test(
  'local hosted light-es CMS and no-collection composition through real PocketBase/Caddy',
  { skip: process.env.RUN_LOCAL_FIXTURE_CMS !== 'true', timeout: 180000 },
  async (t) => {
    const f = await fixture(testDependencies());
    t.after(f.close);
    const user = await f.user('tester@example.invalid');
    const docker = (...args) =>
      execFileSync('docker', args, { encoding: 'utf8', stdio: 'pipe' });
    for (const withCollection of [true, false]) {
      const input = await (withCollection
        ? hostedComposition('light-es')
        : composition('light-es'));
      if (!withCollection) input.slug += '-no-cms';
      const saved = await prepare(f, user, input, true);
      const { spec } = (
        await f.pool.query(
          'SELECT spec FROM platform_site_spec WHERE id=$1',
          [saved.specId],
        )
      ).rows[0];
      const dir = await mkdtemp(join(tmpdir(), 'fixture-cms-'));
      const name =
        'fixture-cms-' + process.pid + '-' + Number(withCollection);
      const web = name + '-web',
        network = name + '-net';
      const cmsImage = name + ':local',
        webImage = web + ':local';
      const password = 'fictional-password-never-production';
      try {
        await chmod(dir, 0o755);
        for (const folder of [
          'pb_migrations',
          'pb_hooks',
          'pb_public',
          'web/site',
        ])
          await mkdir(join(dir, folder), { recursive: true, mode: 0o755 });
        for (const [path, bytes] of Object.entries({
          Dockerfile: pocketBaseDockerfile,
          'pb_migrations/2-fixture.js': pocketBaseMigration(spec),
          'pb_hooks/bootstrap.pb.js': pocketBaseBootstrap,
          'pb_public/editor.html':
            '<!doctype html><title>Fictional editor</title>',
          'web/Dockerfile': caddyDockerfile,
          'web/Caddyfile': caddyfile(spec),
          'web/site/index.html':
            '<!doctype html><title>Fictional fixture</title>',
        }))
          await writeFile(join(dir, path), bytes, { mode: 0o644 });
        docker('build', '-t', cmsImage, dir);
        docker('build', '-t', webImage, join(dir, 'web'));
        docker('network', 'create', network);
        const variables = {
          PB_ADMIN_EMAIL: 'admin@example.invalid',
          PB_ADMIN_PASSWORD: password,
          PB_CLIENT_EMAIL: user.email,
          PB_CLIENT_PASSWORD: password,
          PB_ENCRYPTION_KEY: 'a'.repeat(32),
          PB_BACKUP_BUCKET: 'fictional',
          PB_BACKUP_ENDPOINT: 'https://backup.example.invalid',
          PB_BACKUP_REGION: 'auto',
          PB_BACKUP_ACCESS_KEY_ID: 'fictional',
          PB_BACKUP_SECRET_ACCESS_KEY: 'fictional',
          PB_BACKUP_FORCE_PATH_STYLE: 'true',
        };
        docker(
          'run',
          '-d',
          '--name',
          name,
          '--network',
          network,
          '--network-alias',
          'cms',
          ...Object.entries(variables).flatMap(([key, value]) => [
            '-e',
            key + '=' + value,
          ]),
          cmsImage,
        );
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
        const origin =
          'http://127.0.0.1:' +
          docker('port', web, '8080').trim().split(':').at(-1);
        let ready = false;
        for (let i = 0; i < 60; i++) {
          try {
            if ((await fetch(origin + '/api/cms/editor.html')).ok) {
              ready = true;
              break;
            }
          } catch {}
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        assert.ok(ready, 'local PocketBase through Caddy is ready');
        const auth = await fetch(
          origin + '/api/cms/api/collections/editors/auth-with-password',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ identity: user.email, password }),
          },
        );
        assert.equal(auth.status, 200);
        const token = (await auth.json()).token;
        const result = await editFixtureCms({ spec, origin, token });
        assert.deepEqual(
          result,
          withCollection
            ? {
                stage: 'edited',
                collection: 'announcements',
                httpStatus: 200,
              }
            : {
                stage: 'no collection to edit',
                collection: 'fixture_undeclared',
                httpStatus: 404,
              },
        );
        if (withCollection) {
          const records = await fetch(
            origin + '/api/cms/api/collections/announcements/records',
          );
          assert.equal(records.status, 200);
          assert.equal(
            (await records.json()).items[0].body,
            'Fictional test record',
          );
          const oldTarget = await fetch(
            origin + '/api/cms/api/collections/catalog/records',
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: token,
              },
              body: JSON.stringify({
                title: 'Fictional',
                body: 'Fictional',
                published: true,
              }),
            },
          );
          assert.equal(oldTarget.status, 404);
        }
      } finally {
        for (const container of [web, name]) {
          try {
            docker('rm', '-f', container);
          } catch {}
        }
        try {
          docker('network', 'rm', network);
        } catch {}
        for (const image of [cmsImage, webImage]) {
          try {
            docker('image', 'rm', image);
          } catch {}
        }
        await rm(dir, { recursive: true, force: true });
      }
    }
  },
);
