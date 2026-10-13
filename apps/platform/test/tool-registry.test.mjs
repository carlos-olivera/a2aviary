import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { SiteError } from '@a2aviary/generator';
import { createServer } from '../src/tools.ts';
import { loadPlans } from '../src/plans.ts';
import { requireRole } from '../src/store.ts';

function rpc(handler, name, args = {}) {
  return handler
    .fetch(
      new Request('http://localhost:3000/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'mcp-protocol-version': '2026-07-28',
          'mcp-method': 'tools/call',
          'mcp-name': name,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name,
            arguments: args,
            _meta: {
              'io.modelcontextprotocol/protocolVersion': '2026-07-28',
              'io.modelcontextprotocol/clientCapabilities': {},
            },
          },
        }),
      }),
    )
    .then((r) => r.json())
    .then((r) => r.result);
}

test('unknown names including inherited object properties remain forbidden for every role', () => {
  for (const role of ['superadmin', 'admin', 'client', 'tester'])
    for (const name of [
      'policy.write',
      '__proto__',
      'constructor',
      'toString',
      'hasOwnProperty',
    ])
      assert.throws(
        () =>
          requireRole(
            { id: 'fictional', role, testMode: role === 'tester' },
            name,
          ),
        /forbidden/,
      );
});

test('tool wrapper records exactly the existing site failure paths with sanitized identifiers', async () => {
  const principal = { id: 'fictional', role: 'client', testMode: false };
  const failures = [],
    calls = [];
  const fail = () => {
    throw new SiteError('owned_site_required');
  };
  const store = {
    principal: async () => principal,
    recordToolCall: async (...a) => calls.push(a),
  };
  const sites = {
    drafts: { preview: fail, create: fail },
    status: fail,
    deploy: fail,
    failure: async (...args) => failures.push(args),
  };
  const plans = await loadPlans();
  const handler = createMcpHandler(
    () => createServer(principal, store, plans, sites),
    { legacy: 'reject', maxSubscriptions: 0 },
  );
  const siteId = '00000000-0000-4000-8000-000000000001',
    specId = '00000000-0000-4000-8000-000000000002';
  for (const [name, args, expected] of [
    [
      'site.preview',
      { draftId: siteId, expectedRevision: 0 },
      [undefined, 'owned_site_required', undefined],
    ],
    ['site.status', { siteId }, [undefined, 'owned_site_required', siteId]],
    [
      'site.deploy',
      {
        siteId,
        specId,
        confirmation: 'fictional',
        cmsPassword: 'fictional-password',
      },
      [specId, 'owned_site_required', siteId],
    ],
    [
      'change.request',
      { siteId: 'not-a-uuid', specId: [] },
      [undefined, 'change_requests_unavailable', undefined],
    ],
  ]) {
    const result = await rpc(handler, name, args);
    assert.equal(result.isError, true);
    assert.deepEqual(failures.at(-1), [principal.id, name, ...expected]);
  }
  await rpc(handler, 'site.draft.create', {
    slug: 'fictional',
    requestId: specId,
  });
  assert.equal(failures.length, 4);
  assert.equal(calls.length, 5);
});

test('a registered administration tool rechecks the current role before its handler and records denial', async () => {
  const original = { id: 'fictional', role: 'superadmin', testMode: false };
  const results = [];
  const store = {
    principal: async () => ({ ...original, role: 'client' }),
    recordToolCall: async () =>
      assert.fail('denied calls must not be admitted'),
    tester: async () => assert.fail('denied handler must not run'),
    adminResult: async (...args) => results.push(args),
  };
  const plans = await loadPlans();
  const handler = createMcpHandler(() => createServer(original, store, plans), {
    legacy: 'reject',
    maxSubscriptions: 0,
  });
  const result = await rpc(handler, 'testers.list');
  assert.equal(result.isError, true);
  assert.deepEqual(JSON.parse(result.content[0].text), { error: 'forbidden' });
  assert.deepEqual(results, [
    [original.id, 'testers.list', 'forbidden', undefined, undefined],
  ]);
});
