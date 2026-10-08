// Read production configuration only. Secret values never reach a file or stdout.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
const run = promisify(execFile),
  root = new URL('../../../', import.meta.url),
  railway = new URL('packages/generator/dist/bin/railway', root);
const requested = [
  'OPENAI_API_KEY',
  'RAILWAY_API_TOKEN',
  'SITE_RAILWAY_WORKSPACE_ID',
  'SITE_PROTECTED_PROJECT_IDS',
  'SITE_PROTECTED_DOMAINS',
  'SITE_CREDENTIAL_KEY',
];
const bucketRequired = [
  'SITE_BUCKET_ENDPOINT',
  'SITE_BUCKET_REGION',
  'SITE_BUCKET_NAME',
  'SITE_BUCKET_ACCESS_KEY_ID',
  'SITE_BUCKET_SECRET_ACCESS_KEY',
  'PB_BACKUP_BUCKET',
  'PB_BACKUP_ENDPOINT',
  'PB_BACKUP_REGION',
  'PB_BACKUP_ACCESS_KEY_ID',
  'PB_BACKUP_SECRET_ACCESS_KEY',
];
let database, admin;
try {
  const inventory = JSON.parse(
    (
      await run(railway.pathname, ['list', '--json'], {
        env: {
          ...process.env,
          RAILWAY_CALLER: 'skill:use-railway@1.6.1',
          RAILWAY_AGENT_SESSION: 'server-drafts-preview',
        },
        maxBuffer: 1048576,
        timeout: 60000,
      })
    ).stdout,
  );
  const matches = inventory.filter(
    (p) => p.name === 'a2aviary-platform' && !p.deletedAt,
  );
  if (matches.length !== 1)
    throw Error('ambiguous_fixture_configuration_source');
  const project = matches[0],
    environments = project.environments.edges.filter(
      (e) => e.node.name === 'production',
    ),
    services = project.services.edges.filter((s) => s.node.name === 'platform');
  if (environments.length !== 1 || services.length !== 1)
    throw Error('ambiguous_fixture_configuration_source');
  const result = await run(
    railway.pathname,
    [
      'variable',
      'list',
      '--json',
      '--project',
      project.id,
      '--environment',
      environments[0].node.id,
      '--service',
      services[0].node.id,
    ],
    {
      env: {
        ...process.env,
        RAILWAY_CALLER: 'skill:use-railway@1.6.1',
        RAILWAY_AGENT_SESSION: 'server-drafts-preview',
      },
      maxBuffer: 1024 * 1024,
      timeout: 60000,
    },
  );
  const variables = JSON.parse(result.stdout),
    selected = Object.fromEntries(
      Object.entries(variables).filter(
        ([name, value]) =>
          typeof value === 'string' &&
          (requested.includes(name) ||
            name.startsWith('SITE_BUCKET_') ||
            name.startsWith('PB_BACKUP_')),
      ),
    );
  result.stdout = '';
  result.stderr = '';
  for (const name of Object.keys(variables)) delete variables[name];
  const names = Object.keys(selected).sort();
  const missing = [
    ...requested.filter((name) => name !== 'SITE_PROTECTED_DOMAINS'),
    ...bucketRequired,
  ].filter((name) => !selected[name]);
  console.log(
    JSON.stringify({
      event: 'fixture.credentials.read',
      variableNames: names,
      missingVariableNames: missing,
    }),
  );
  if (missing.length) throw Error('fixture_credentials_unavailable');
  if (process.argv.includes('--preflight')) process.exit(0);
  const attempt = new URL('.local/server-drafts-hosted-attempt.json', root);
  await writeFile(
    attempt,
    JSON.stringify({ startedAt: new Date().toISOString(), attempts: 1 }) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  database =
    'a2aviary_platform_drafts_fixture_' + randomUUID().replaceAll('-', '');
  admin = new Pool({
    connectionString:
      'postgresql://platform:local-development-only@localhost:55432/a2aviary_platform',
  });
  await admin.query('CREATE DATABASE ' + database);
  const child = spawn(
    process.execPath,
    ['--test', 'test/site-cloud.test.mjs'],
    {
      cwd: new URL('apps/platform/', root),
      stdio: 'inherit',
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ...selected,
        TEST_DATABASE_URL:
          'postgresql://platform:local-development-only@localhost:55432/' +
          database,
        SITE_WORKFLOW_ENABLED: 'true',
        SITE_DRAFTS_ENABLED: 'true',
        SITE_DEPLOY_ENVIRONMENT: 'fixture',
        RUN_SITE_CLOUD_E2E: 'true',
        RUN_TESTER_CLOUD_E2E: 'true',
        FIXTURE_VARIABLE_NAMES: JSON.stringify(names),
      },
    },
  );
  for (const name of names) delete selected[name];
  process.exitCode = await new Promise((resolve) =>
    child.on('exit', (code) => resolve(code ?? 1)),
  );
} catch {
  console.error(
    'Hosted fixture runner stopped; inspect sanitized stage evidence.',
  );
  process.exitCode = 1;
} finally {
  if (admin) {
    if (database)
      await admin.query(
        'DROP DATABASE IF EXISTS ' + database + ' WITH (FORCE)',
      );
    await admin.end();
  }
}
