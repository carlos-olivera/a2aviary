import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { siteRuntime } from '@a2aviary/generator';
import { createServer } from '../src/tools.ts';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';

const snapshotUrl = new URL(
  './snapshots/tool-visibility.json',
  import.meta.url,
);
const runtimeEnv = {
  SITE_CREDENTIAL_KEY: 'a'.repeat(64),
  SITE_BUCKET_ENDPOINT: 'https://bucket.example.invalid',
  SITE_BUCKET_REGION: 'fictional',
  SITE_BUCKET_NAME: 'fictional',
  SITE_BUCKET_ACCESS_KEY_ID: 'fictional',
  SITE_BUCKET_SECRET_ACCESS_KEY: 'fictional',
  SITE_DEPLOY_ENVIRONMENT: 'fixture',
  SITE_PROTECTED_PROJECT_IDS: 'fictional-platform',
  SITE_RAILWAY_WORKSPACE_ID: 'fictional',
  RAILWAY_API_TOKEN: 'fictional',
  OPENAI_API_KEY: 'fictional',
  PB_BACKUP_ENDPOINT: 'https://backup.example.invalid',
  PB_BACKUP_REGION: 'fictional',
  PB_BACKUP_BUCKET: 'fictional',
  PB_BACKUP_ACCESS_KEY_ID: 'fictional',
  PB_BACKUP_SECRET_ACCESS_KEY: 'fictional',
};

// Captured on the unrefactored baseline. Update is explicit and is never used by CI.
test('tool schemas, annotations, ordering and capabilities: four roles × eight feature combinations', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const owner = await f.user('owner@example.invalid');
  const users = {
    superadmin: owner,
    admin: await f.user('admin@example.invalid'),
    client: await f.user('client@example.invalid'),
    tester: await f.user('tester@example.invalid'),
  };
  await f.app.store.inviteAdmin(
    owner.id,
    users.admin.email,
    'INVITE_ADMIN:admin@example.invalid',
  );
  const actual = {};
  for (const [role, user] of Object.entries(users)) {
    const principal = await f.app.store.principal(user.id);
    assert.equal(principal.role, role);
    for (const workflow of [false, true])
      for (const drafts of [false, true])
        for (const admin of [false, true]) {
          const enabled = Boolean(
            siteRuntime({
              ...runtimeEnv,
              SITE_WORKFLOW_ENABLED: String(workflow),
              SITE_DRAFTS_ENABLED: String(drafts),
            }),
          );
          assert.equal(enabled, workflow && drafts);
          const handler = createMcpHandler(
            () =>
              createServer(
                principal,
                f.app.store,
                f.app.plans,
                enabled ? f.app.sites : undefined,
                false,
                admin ? f.app.administration : undefined,
              ),
            { legacy: 'reject', maxSubscriptions: 0 },
          );
          const rpc = async (method, params = {}) => {
            const response = await handler.fetch(
              new Request(f.config.origin + '/mcp', {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  accept: 'application/json',
                  'mcp-protocol-version': '2026-07-28',
                  'mcp-method': method,
                  ...(params.name ? { 'mcp-name': params.name } : {}),
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method,
                  params: {
                    ...params,
                    _meta: {
                      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
                      'io.modelcontextprotocol/clientCapabilities': {},
                    },
                  },
                }),
              }),
            );
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.equal(body.error, undefined);
            return body.result;
          };
          const list = await rpc('tools/list');
          const capabilities = await rpc('tools/call', {
            name: 'capabilities.get',
            arguments: {},
          });
          assert.deepEqual(JSON.parse(capabilities.content[0].text).tools, list.tools.map(tool => tool.name), 'capabilities must equal registered tools in the same order');
          actual[
            `${role}/workflow=${workflow}/drafts=${drafts}/administration=${admin}`
          ] = {
            list,
            capabilities: JSON.parse(capabilities.content[0].text),
          };
          assert.ok(!list.tools.some(t => t.name === 'change.request'));

        }
  }
  if (process.env.UPDATE_TOOL_VISIBILITY_SNAPSHOTS === 'true')
    await writeFile(snapshotUrl, JSON.stringify(actual, null, 2) + '\n');
  assert.deepEqual(actual, JSON.parse(await readFile(snapshotUrl, 'utf8')));
});
