import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  pocketBaseMigration,
  pocketBaseBootstrap,
  pocketBaseDockerfile,
  cmsEditorHtml,
  cmsEditorScript,
  caddyfile,
  caddyDockerfile
} from '../dist/index.js';
import { fixtureSubmission } from './fixture-lib.mjs';
const { spec } = await fixtureSubmission(),
  dir = fileURLToPath(new URL('../../../work/phase3-cms', import.meta.url)),
  name = 'a2aviary-phase3-cms-' + process.pid,
  volume = name + '-data',
  webName = name + '-web',
  network = name + '-net',
  image = 'a2aviary-phase3-cms:local';
await mkdir(dir + '/pb_migrations', { recursive: true });
await mkdir(dir + '/pb_hooks', { recursive: true });
await mkdir(dir + '/pb_public', { recursive: true });
await writeFile(dir + '/Dockerfile', pocketBaseDockerfile);
await writeFile(dir + '/pb_migrations/2-fixture.js', pocketBaseMigration(spec));
await writeFile(dir + '/pb_hooks/bootstrap.pb.js', pocketBaseBootstrap);
await writeFile(dir + '/pb_public/editor.html', cmsEditorHtml());
await writeFile(dir + '/pb_public/editor.js', cmsEditorScript(spec));
execFileSync('docker', ['build', '--tag', image, dir], { stdio: 'inherit' });
const variables = {
  PB_ADMIN_EMAIL: 'cms-admin@example.invalid',
  PB_ADMIN_PASSWORD: 'fictional-admin-password-never-production',
  PB_CLIENT_EMAIL: 'cms-client@example.invalid',
  PB_CLIENT_PASSWORD: 'fictional-client-password-never-production',
  PB_ENCRYPTION_KEY: 'a'.repeat(32),
  PB_BACKUP_BUCKET: 'fictional-backups',
  PB_BACKUP_ENDPOINT: 'https://backup.example.invalid',
  PB_BACKUP_REGION: 'auto',
  PB_BACKUP_ACCESS_KEY_ID: 'fictional-key',
  PB_BACKUP_SECRET_ACCESS_KEY: 'fictional-secret',
  PB_BACKUP_FORCE_PATH_STYLE: 'true'
};
try {
  execFileSync('docker', ['network', 'create', network], { stdio: 'pipe' });
  execFileSync(
    'docker',
    [
      'run',
      '--detach',
      '--name',
      name,
      '--network',
      network,
      '--network-alias',
      'cms',
      '--publish',
      '127.0.0.1::8090',
      '--mount',
      'type=volume,source=' + volume + ',target=/pb/pb_data',
      ...Object.entries(variables).flatMap(([k, v]) => ['--env', k + '=' + v]),
      image
    ],
    { stdio: 'pipe' }
  );
  const port = execFileSync('docker', ['port', name, '8090'], {
      encoding: 'utf8'
    })
      .trim()
      .split(':')
      .at(-1),
    origin = 'http://127.0.0.1:' + port;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) {
    const logResult = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
    const logs = (logResult.stdout ?? '') + (logResult.stderr ?? '');
    console.error(
      logs
        .split('\n')
        .map((l) =>
          l
            .replace(/https?:\/\/\S+/g, '[url]')
            .replace(/[A-Za-z0-9_-]{30,}/g, '[redacted]')
        )
        .slice(-4)
        .join('\n')
    );
  }
  assert.ok(ready, 'PocketBase readiness');
  const request = (path, method = 'GET', data, token) =>
    fetch(origin + '/api/' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: token } : {})
      },
      body: data ? JSON.stringify(data) : undefined
    });
  const auth = await request('collections/editors/auth-with-password', 'POST', {
    identity: variables.PB_CLIENT_EMAIL,
    password: variables.PB_CLIENT_PASSWORD
  });
  if (!auth.ok) {
    const logResult = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
    console.error(
      ((logResult.stdout ?? '') + (logResult.stderr ?? ''))
        .split('\n')
        .filter((l) => l.includes('Fixture bootstrap'))
        .join('\n')
    );
    const failure = await auth.clone().json();
    console.error(
      JSON.stringify({
        authFailure: {
          code: failure.code,
          message: failure.message,
          fields: Object.keys(failure.data ?? {})
        }
      })
    );
    const rootAuth = await request(
      'collections/_superusers/auth-with-password',
      'POST',
      {
        identity: variables.PB_ADMIN_EMAIL,
        password: variables.PB_ADMIN_PASSWORD
      }
    );
    console.error('adminAuthStatus:' + rootAuth.status);
    if (rootAuth.ok) {
      const token = (await rootAuth.json()).token;
      const records = await (
        await request('collections/editors/records', 'GET', undefined, token)
      ).json();
      console.error('editorCount:' + records.items?.length);
    }
  }
  assert.equal(auth.status, 200);
  const client = (await auth.json()).token;
  const anonymous = await request('collections/catalog/records', 'POST', {
    title: 'Fictional entry',
    body: 'Prepared content',
    published: true
  });
  assert.equal(anonymous.ok, false);
  const signup = await request('collections/editors/records', 'POST', {
    email: 'intruder@example.invalid',
    password: 'fictional-uninvited-password',
    passwordConfirm: 'fictional-uninvited-password'
  });
  assert.equal(signup.ok, false);
  const created = await request(
    'collections/catalog/records',
    'POST',
    { title: 'Fictional entry', body: 'Prepared content', published: false },
    client
  );
  assert.equal(created.status, 200);
  const record = await created.json();
  const publicList = await (
    await request('collections/catalog/records')
  ).json();
  assert.equal(publicList.items.length, 0);
  const edited = await request(
    'collections/catalog/records/' + record.id,
    'PATCH',
    { published: true, body: 'Edited directly through CMS' },
    client
  );
  assert.equal(edited.status, 200);
  const published = await (await request('collections/catalog/records')).json();
  assert.equal(published.items[0].body, 'Edited directly through CMS');
  const tooLong = await request(
    'collections/catalog/records/' + record.id,
    'PATCH',
    { title: 'x'.repeat(121) },
    client
  );
  assert.equal(tooLong.ok, false);
  const adminAuth = await request(
    'collections/_superusers/auth-with-password',
    'POST',
    {
      identity: variables.PB_ADMIN_EMAIL,
      password: variables.PB_ADMIN_PASSWORD
    }
  );
  assert.equal(adminAuth.status, 200);
  const admin = (await adminAuth.json()).token;
  const settings = await (
    await request('settings', 'GET', undefined, admin)
  ).json();
  assert.equal(settings.backups.cron, '0 3 * * *');
  assert.equal(settings.backups.s3.enabled, true);
  assert.equal(settings.rateLimits.enabled, true);
  assert.equal((await fetch(origin + '/editor.html')).status, 200);
  const webDir = dir + '-web';
  await mkdir(webDir, { recursive: true });
  await mkdir(webDir + '/site', { recursive: true });
  await writeFile(
    webDir + '/site/index.html',
    '<!doctype html><html><title>Fictional fixture</title><body><h1>Fictional fixture</h1></body></html>'
  );
  await writeFile(
    webDir + '/site/404.html',
    '<!doctype html><html><title>Missing</title><body><h1>Missing</h1></body></html>'
  );
  await writeFile(webDir + '/Dockerfile', caddyDockerfile);
  await writeFile(webDir + '/Caddyfile', caddyfile(spec));
  execFileSync(
    'docker',
    ['build', '--tag', 'a2aviary-phase3-web:local', webDir],
    { stdio: 'inherit' }
  );
  execFileSync(
    'docker',
    [
      'run',
      '--detach',
      '--name',
      webName,
      '--network',
      network,
      '--publish',
      '127.0.0.1::8080',
      '--env',
      'CMS_UPSTREAM=cms:8090',
      'a2aviary-phase3-web:local'
    ],
    { stdio: 'pipe' }
  );
  const webPort = execFileSync('docker', ['port', webName, '8080'], {
      encoding: 'utf8'
    })
      .trim()
      .split(':')
      .at(-1),
    webOrigin = 'http://127.0.0.1:' + webPort;
  let webReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch(webOrigin + '/healthz')).ok) {
        webReady = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!webReady) {
    console.error(
      spawnSync('docker', ['logs', webName], { encoding: 'utf8' }).stderr
    );
  }
  assert.ok(webReady, 'Caddy readiness');
  assert.equal((await fetch(webOrigin + '/')).status, 200);
  assert.equal((await fetch(webOrigin + '/missing')).status, 404);
  assert.equal((await fetch(webOrigin + '/api/cms/editor.html')).status, 200);
  for (const path of [
    '/api/cms/_/',
    '/api/cms/api/settings',
    '/api/cms/api/collections/_superusers/auth-with-password'
  ])
    assert.equal((await fetch(webOrigin + path)).status, 404);
  const proxiedAuth = await fetch(
    webOrigin + '/api/cms/api/collections/editors/auth-with-password',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        identity: variables.PB_CLIENT_EMAIL,
        password: variables.PB_CLIENT_PASSWORD
      })
    }
  );
  assert.equal(proxiedAuth.status, 200);
  const proxiedRecords = await fetch(
    webOrigin +
      '/api/cms/api/collections/catalog/records?filter=published%3Dtrue'
  );
  assert.equal(proxiedRecords.status, 200);
  assert.equal(
    (await proxiedRecords.json()).items[0].body,
    'Edited directly through CMS'
  );
  console.log(
    JSON.stringify({
      cms: 'pass',
      login: true,
      caddyProxy: true,
      adminApisBlocked: true,
      anonymousWritesRejected: true,
      contentEditWithoutRedeploy: true,
      backupSchedule: 'configured; remote backup execution not verified',
      version: '0.40.4'
    })
  );
} finally {
  try {
    execFileSync('docker', ['rm', '--force', webName], { stdio: 'pipe' });
  } catch {}
  try {
    execFileSync('docker', ['rm', '--force', name], { stdio: 'pipe' });
  } catch {}
  try {
    execFileSync('docker', ['volume', 'rm', volume], { stdio: 'pipe' });
  } catch {}
  try {
    execFileSync('docker', ['network', 'rm', network], { stdio: 'pipe' });
  } catch {}
}
