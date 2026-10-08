import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AgentsVerifier,
  VerificationFailure,
  RailwayDeployer,
  generateSite,
  canonicalJson,
  sha256
} from '../dist/index.js';
import { fixtureSubmission } from '../scripts/fixture-lib.mjs';
const input = await fixtureSubmission(),
  source = await generateSite(
    input.spec,
    new Map(
      Object.entries(input.assets).map(([id, v]) => [
        id,
        Buffer.from(v, 'base64')
      ])
    )
  );
const files = Object.fromEntries(
  Object.entries(source.binaryFiles).map(([p, v]) => [p.slice(7), v])
);
for (const p of input.spec.pages)
  files[p.path === '/' ? 'index.html' : p.path.slice(1) + 'index.html'] =
    Buffer.from('Fictional adapter double').toString('base64');
const report = {
  version: 1,
  passed: true,
  sourceSha256: source.sourceSha256,
  specSha256: source.specSha256,
  outputSha256: sha256(canonicalJson(files)),
  checks: [
    'catalog-syntax',
    'astro-build',
    ...input.spec.pages.flatMap((p) => [
      'a11y:' + p.path,
      'links:' + p.path,
      'lighthouse:' + p.path,
      'visual:' + p.path + ':390',
      'visual:' + p.path + ':1280'
    ])
  ].map((name) => ({ name, passed: true, details: { testDouble: true } }))
};
function verifierClient(scenario = {}) {
  const calls = [],
    logs = [],
    downloaded = [];
  let sent,
    connected = false,
    submitted = false,
    deleted = 0;
  const bytes = {
    'report.json': JSON.stringify(scenario.report ?? report),
    'site.json': JSON.stringify({ files })
  };
  if (scenario.invalidJson) bytes['report.json'] = '{PRIVATE OUTPUT';
  if (scenario.invalidSite) bytes['site.json'] = JSON.stringify({ files: [] });
  const privateError = () => {
    throw Error('PRIVATE provider response and credential');
  };
  const stream = {
    controller: {
      abort() {
        calls.push('stream.abort');
      }
    },
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'agent.session.turn.created',
        turn: { id: 'fictional-turn', subagent_id: null }
      };
      if (scenario.turnFailure) {
        yield {
          type: scenario.turnFailure,
          turn: { id: 'fictional-turn', subagent_id: null },
          error: { message: 'PRIVATE response' }
        };
        return;
      }
      if (scenario.streamFailure) privateError();
      if (scenario.incomplete) return;
      // An unrelated completion must not unlock downloads.
      yield {
        type: 'agent.session.turn.completed',
        turn: { id: 'other-turn', subagent_id: null }
      };
      yield {
        type: 'agent.session.turn.completed',
        turn: { id: 'fictional-turn', subagent_id: null }
      };
      calls.push('stream.continued-after-completion');
    }
  };
  const client = {
    beta: {
      agents: {
        environments: {
          async retrieve(id, options) {
            assert.equal(id, 'fictional-environment');
            calls.push('environment.retrieve');
            scenario.onRetrieve?.(options);
            if (scenario.setupRequestFailure) privateError();
            const status = scenario.statuses?.shift() ?? 'connected';
            connected = status === 'connected';
            calls.push('environment.' + status);
            return { id, status };
          },
          files: {
            async *list(id, options) {
              assert.equal(connected, true);
              assert.equal(options.path, '/workspace/outputs');
              calls.push('live.list');
              if (scenario.liveListFailure) privateError();
              for (const path of ['report.json', 'site.json'])
                if (path !== scenario.missingLive)
                  yield {
                    path: '/workspace/outputs/' + path,
                    size_bytes: Buffer.byteLength(bytes[path])
                  };
            }
          }
        },
        sessions: {
          async create(body) {
            calls.push('session.create');
            sent = body;
            if (scenario.createFailure) privateError();
            return {
              id: 'fictional-session',
              environment: {
                type: 'openai_hosted',
                id: 'fictional-environment'
              }
            };
          },
          async delete(id) {
            assert.equal(id, 'fictional-session');
            deleted++;
            calls.push('session.delete');
            if (scenario.cleanupFailure) privateError();
            return { deleted: true };
          },
          events: {
            async stream(id) {
              assert.equal(connected, true);
              assert.equal(submitted, false);
              calls.push('events.stream');
              if (scenario.subscribeFailure) privateError();
              return stream;
            },
            async create(id, body) {
              assert.equal(connected, true);
              assert.ok(calls.includes('live.list'));
              assert.ok(calls.includes('events.stream'));
              calls.push('events.create');
              submitted = true;
              assert.equal(
                body.events[0].input[0].content[0].text,
                'Publish the fixed checker outputs as artifacts. Acknowledge completion.'
              );
              if (scenario.submitFailure) privateError();
            }
          },
          artifacts: {
            async *list() {
              assert.equal(submitted, true);
              calls.push('artifacts.list');
              if (scenario.artifactListFailure) privateError();
              yield {
                id: 'old',
                turn_id: 'other-turn',
                path: '/workspace/outputs/report.json',
                size_bytes: 1
              };
              if (scenario.unpublished) return;
              for (const [name, data] of Object.entries(bytes))
                if (name !== scenario.missingArtifact)
                  yield {
                    id: name,
                    turn_id: 'fictional-turn',
                    path: '/workspace/outputs/' + name,
                    size_bytes: scenario.oversized
                      ? 64 * 1024 * 1024 + 1
                      : Buffer.byteLength(data)
                  };
            },
            async content(id) {
              assert.notEqual(id, 'old');
              downloaded.push(id);
              if (scenario.downloadFailure) privateError();
              return new Response(bytes[id]);
            }
          }
        }
      }
    }
  };
  return {
    client,
    logs,
    calls,
    downloaded,
    get sent() {
      return sent;
    },
    get deleted() {
      return deleted;
    }
  };
}
function verify(mock) {
  return new AgentsVerifier(mock.client, (e) => mock.logs.push(e)).verify(
    source,
    input.spec,
    input.preview,
    { test: true }
  );
}
test('Agents ordering waits for connected and live outputs before subscribing/submitting; credentials/tools stay absent', async () => {
  const mock = verifierClient({ statuses: ['pending', 'connected'] });
  const build = await verify(mock);
  assert.ok(
    mock.calls.indexOf('environment.connected') <
      mock.calls.indexOf('events.create')
  );
  assert.equal('input' in mock.sent, false);
  assert.equal(mock.sent.stream, false);
  assert.equal(build.report.passed, true);
  assert.equal(mock.deleted, 1);
  assert.deepEqual(mock.downloaded, ['report.json', 'site.json']);
  assert.equal(mock.calls.includes('stream.continued-after-completion'), false);
  assert.ok(mock.logs.every((e) => e.test === true));
  assert.deepEqual(mock.sent.agent.tools, []);
  assert.equal(mock.sent.agent.multi_agent.enabled, false);
  assert.deepEqual(mock.sent.environment.env, {
    ASTRO_TELEMETRY_DISABLED: '1'
  });
  assert.equal(mock.sent.environment.network.access, 'restricted');
  assert.deepEqual(mock.sent.environment.network.allowed_domains, [
    'registry.npmjs.org',
    'storage.googleapis.com',
    'cdn.playwright.dev',
    'playwright.download.prss.microsoft.com',
    'cdn.playwright.download.prss.microsoft.com',
    'deb.debian.org',
    'security.debian.org',
    'archive.ubuntu.com',
    'security.ubuntu.com'
  ]);
  assert.ok(
    mock.sent.environment.files.some((f) => f.path === '/workspace/verify.mjs')
  );
  assert.ok(
    mock.sent.environment.setup_commands.some(
      (c) => c.command === 'node verify.mjs; test -f outputs/report.json'
    )
  );
  assert.ok(!JSON.stringify(mock.sent).includes('API_KEY'));
  assert.equal(mock.logs.at(-1).result, 'pass');
});
for (const [name, scenario, code] of [
  [
    'session create rejection',
    { createFailure: true },
    'sandbox_session_create_failed'
  ],
  ['setup failed status', { statuses: ['failed'] }, 'sandbox_setup_failed'],
  ['setup expired status', { statuses: ['expired'] }, 'sandbox_setup_failed'],
  [
    'setup API rejection',
    { setupRequestFailure: true },
    'sandbox_setup_failed'
  ],
  ['live listing rejection', { liveListFailure: true }, 'sandbox_setup_failed'],
  [
    'live report missing',
    { missingLive: 'report.json' },
    'sandbox_report_missing'
  ],
  ['live site missing', { missingLive: 'site.json' }, 'sandbox_site_missing'],
  ['subscription rejection', { subscribeFailure: true }, 'sandbox_turn_failed'],
  ['submission rejection', { submitFailure: true }, 'sandbox_turn_failed'],
  [
    'failed turn',
    { turnFailure: 'agent.session.turn.failed' },
    'sandbox_turn_failed'
  ],
  [
    'cancelled turn',
    { turnFailure: 'agent.session.turn.cancelled' },
    'sandbox_turn_failed'
  ],
  [
    'environment failed during turn',
    { turnFailure: 'agent.session.environment.failed' },
    'sandbox_turn_failed'
  ],
  ['incomplete turn', { incomplete: true }, 'sandbox_turn_incomplete'],
  ['interrupted stream', { streamFailure: true }, 'sandbox_turn_incomplete'],
  [
    'no outputs for completed turn',
    { unpublished: true },
    'sandbox_outputs_unpublished'
  ],
  [
    'artifact listing rejection',
    { artifactListFailure: true },
    'sandbox_artifact_download_failed'
  ],
  [
    'artifact content rejection',
    { downloadFailure: true },
    'sandbox_artifact_download_failed'
  ],
  [
    'report artifact missing',
    { missingArtifact: 'report.json' },
    'sandbox_report_missing'
  ],
  [
    'site artifact missing',
    { missingArtifact: 'site.json' },
    'sandbox_site_missing'
  ],
  ['malformed JSON report', { invalidJson: true }, 'sandbox_report_invalid'],
  [
    'malformed report shape',
    { report: { ...report, checks: null } },
    'sandbox_report_invalid'
  ],
  ['malformed site shape', { invalidSite: true }, 'sandbox_report_invalid'],
  [
    'artifact size limit',
    { oversized: true },
    'verification_artifact_too_large'
  ]
]) {
  test(
    'Agents ' +
      name +
      ' emits only ' +
      code +
      ' and disposes any created session',
    async () => {
      const mock = verifierClient(scenario);
      await assert.rejects(
        verify(mock),
        (error) => error.code === code && error.message === code
      );
      assert.equal(mock.deleted, scenario.createFailure ? 0 : 1);
      assert.equal(mock.logs.at(-1).code, code);
      assert.ok(!JSON.stringify(mock.logs).includes('PRIVATE'));
      if (
        [
          'sandbox_setup_failed',
          'sandbox_report_missing',
          'sandbox_site_missing'
        ].includes(code) &&
        !scenario.missingArtifact
      )
        assert.equal(mock.calls.includes('events.create'), false);
    }
  );
}
test('Agents bounded setup timeout emits sandbox_setup_timeout and deletes the session', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const mock = verifierClient({
    statuses: ['pending'],
    onRetrieve: () => t.mock.timers.tick(20 * 60 * 1000)
  });
  await assert.rejects(
    verify(mock),
    (error) => error.code === 'sandbox_setup_timeout'
  );
  assert.equal(mock.deleted, 1);
  assert.equal(mock.calls.includes('events.create'), false);
  assert.equal(mock.logs.at(-1).code, 'sandbox_setup_timeout');
});
test('Agents failing checker check remains verification_failed after connected and successful publication', async () => {
  const failed = structuredClone(report);
  failed.checks[0].passed = false;
  const mock = verifierClient({ report: failed });
  await assert.rejects(
    verify(mock),
    (error) =>
      error instanceof VerificationFailure &&
      error.code === 'verification_failed' &&
      error.build.report.checks[0].passed === false
  );
  assert.equal(mock.deleted, 1);
  assert.ok(mock.calls.includes('environment.connected'));
});
for (const scenario of [{}, { unpublished: true }]) {
  test(
    'Agents cleanup failure is separate and preserves ' +
      (scenario.unpublished ? 'primary error' : 'success'),
    async () => {
      const mock = verifierClient({ ...scenario, cleanupFailure: true });
      if (scenario.unpublished)
        await assert.rejects(
          verify(mock),
          (error) => error.code === 'sandbox_outputs_unpublished'
        );
      else assert.equal((await verify(mock)).report.passed, true);
      assert.equal(mock.deleted, 1);
      assert.equal(mock.logs.at(-1).event, 'agents.cleanup.pending');
      assert.equal(mock.logs.at(-1).code, 'sandbox_cleanup_pending');
      assert.ok(!JSON.stringify(mock.logs).includes('PRIVATE'));
    }
  );
}
test('Railway adapter caps both isolated services, preserves provisioned CMS keys, and requires the exact upload deployment', async () => {
  const mutations = [],
    saved = [],
    uploads = [];
  let environment = 'fixture';
  const polls = new Map();
  const resources = {
    projectId: 'fictional-project',
    environmentId: 'fictional-environment',
    webServiceId: 'fictional-web',
    cmsServiceId: 'fictional-cms',
    volumeId: 'fictional-volume',
    cmsConfigured: true
  };
  const provider = new RailwayDeployer(
    {
      apiToken: 'fictional-test-only',
      workspaceId: 'fictional-workspace',
      protectedProjectIds: new Set(['protected-platform']),
      test: true,
      backupVariables: {}
    },
    async (q, v) => {
      if (q.startsWith('mutation')) {
        mutations.push({ q, v });
        if (q.includes('serviceDomainCreate'))
          return {
            serviceDomainCreate: {
              id: 'fictional-domain',
              domain: 'fixture.example.invalid'
            }
          };
        return {};
      }
      if (q.includes('project(id:'))
        return {
          project: {
            name: 'cli-001-fictional',
            workspaceId: 'fictional-workspace',
            environments: {
              edges: [
                { node: { id: resources.environmentId, name: environment } }
              ]
            },
            services: {
              edges: [
                { node: { id: resources.webServiceId, name: 'web' } },
                { node: { id: resources.cmsServiceId, name: 'cms' } }
              ]
            }
          }
        };
      if (q.includes('deployments(')) {
        const count = (polls.get(v.input.serviceId) ?? 0) + 1;
        polls.set(v.input.serviceId, count);
        return {
          deployments: {
            edges: [
              {
                node: {
                  id:
                    count === 1
                      ? 'older-release'
                      : 'uploaded-' + v.input.serviceId,
                  status: 'SUCCESS'
                }
              }
            ]
          }
        };
      }
      return {};
    }
  );
  provider.waitPublic = async (domain, build) => {
    assert.equal(domain, 'fixture.example.invalid');
    assert.equal(build.report.outputSha256, report.outputSha256);
  };
  provider.upload = async (directory, r, id) => {
    const config = JSON.parse(
      await readFile(directory + '/railway.json', 'utf8')
    );
    assert.equal(config.deploy.numReplicas, 1);
    assert.equal(config.deploy.limitOverride.containers.cpu, 1);
    assert.equal(config.deploy.limitOverride.containers.memoryBytes, 500000000);
    uploads.push(id);
    return 'uploaded-' + id;
  };
  const build = {
    report,
    files,
    artifacts: {},
    sessionId: 'fictional-session'
  };
  const result = await provider.deploy({
    name: 'cli-001-fictional',
    spec: input.spec,
    build,
    resources,
    clientEmail: 'fictional@example.invalid',
    clientPassword: 'fictional-pending-only',
    saveResources: async (r) => saved.push({ ...r })
  });
  assert.equal(result.domain, 'fixture.example.invalid');
  assert.equal(polls.get(resources.webServiceId), 2);
  assert.equal(polls.get(resources.cmsServiceId), 2);
  assert.deepEqual(uploads, [resources.cmsServiceId, resources.webServiceId]);
  assert.equal(
    mutations.filter((m) => m.q.includes('serviceInstanceLimitsUpdate')).length,
    2
  );
  assert.equal(
    mutations.filter((m) => m.q.includes('variableCollectionUpsert')).length,
    1
  );
  assert.equal(
    mutations.some((m) => JSON.stringify(m.v).includes('PB_ENCRYPTION_KEY')),
    false
  );
  environment = 'production';
  await assert.rejects(
    provider.status(resources, 'cli-001-fictional'),
    /deployment_target_mismatch/
  );
  await assert.rejects(
    provider.deploy({
      name: 'cli-001-fictional',
      spec: input.spec,
      build,
      resources,
      domain: 'mcp.a2aviary.io',
      saveResources: async () => {}
    }),
    /protected_or_invalid_domain/
  );
});
test('managed-domain readiness requires HTTPS and exact verified bytes; it cannot probe arbitrary hosts', async () => {
  const provider = new RailwayDeployer(
    {
      apiToken: 'fictional',
      workspaceId: 'fictional',
      protectedProjectIds: new Set(),
      test: true,
      backupVariables: {}
    },
    async () => ({})
  );
  await assert.rejects(
    provider.waitPublic('mcp.a2aviary.io', { files }),
    /deployment_outcome_unknown/
  );
  const savedFetch = globalThis.fetch;
  let attempts = 0;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://fictional-fixture.up.railway.app/');
      assert.equal(options.redirect, 'error');
      attempts++;
      return new Response(
        attempts === 1
          ? 'previous deployment'
          : Buffer.from(files['index.html'], 'base64')
      );
    };
    await provider.waitPublic('fictional-fixture.up.railway.app', { files });
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

test('tester deploy overrides production default, provisions only a dedicated fixture project and reset checks every resource boundary', async () => {
  const mutations = [];
  let project = null;
  const provider = new RailwayDeployer(
    {
      apiToken: 'fictional',
      workspaceId: 'workspace',
      protectedProjectIds: new Set(['platform']),
      test: false,
      backupVariables: {}
    },
    async (q, v) => {
      if (q.startsWith('query')) return { project };
      mutations.push({ q, v });
      if (q.includes('projectCreate')) {
        assert.equal(v.input.defaultEnvironmentName, 'fixture');
        assert.ok(v.input.description.includes('test=true'));
        project = {
          name: v.input.name,
          workspaceId: 'workspace',
          environments: {
            edges: [{ node: { id: 'fixture-environment', name: 'fixture' } }]
          },
          services: { edges: [] }
        };
        return {
          projectCreate: {
            id: 'test-project',
            environments: project.environments
          }
        };
      }
      if (q.includes('serviceCreate')) {
        const id = 'test-' + v.input.name;
        project.services.edges.push({ node: { id, name: v.input.name } });
        return { serviceCreate: { id } };
      }
      if (q.includes('volumeCreate'))
        return { volumeCreate: { id: 'test-volume' } };
      if (q.includes('serviceDomainCreate'))
        return {
          serviceDomainCreate: {
            id: 'test-domain',
            domain: 'fictional-test.up.railway.app'
          }
        };
      if (q.includes('projectDelete')) {
        assert.equal(v.id, 'test-project');
        project = null;
        return { projectDelete: true };
      }
      return {};
    }
  );
  provider.upload = async () => 'fictional-upload';
  provider.waitHealthy = async () => {};
  provider.waitPublic = async (domain) =>
    assert.equal(domain, 'fictional-test.up.railway.app');
  const build = { report, files, artifacts: {}, sessionId: 'fictional' };
  await assert.rejects(
    provider.deploy({
      name: 'cli-001-fictional',
      spec: input.spec,
      build,
      resources: {},
      test: true,
      domain: 'customer.example.invalid',
      saveResources: async () => {}
    }),
    /test_custom_domain_forbidden/
  );
  assert.equal(mutations.length, 0);
  const r = await provider.deploy({
    name: 'cli-001-fictional',
    spec: input.spec,
    build,
    resources: {},
    test: true,
    clientEmail: 'tester@example.invalid',
    clientPassword: 'fictional-password-only',
    saveResources: async () => {}
  });
  assert.equal(r.test, true);
  assert.equal(r.domain, 'fictional-test.up.railway.app');
  const pristine = structuredClone(project),
    before = mutations.length;
  for (const problem of [
    'environment',
    'extra-environment',
    'service',
    'extra-service',
    'workspace',
    'name'
  ]) {
    project = structuredClone(pristine);
    if (problem === 'environment')
      project.environments.edges[0].node.name = 'production';
    if (problem === 'extra-environment')
      project.environments.edges.push({
        node: { id: 'other', name: 'production' }
      });
    if (problem === 'service') project.services.edges[0].node.name = 'platform';
    if (problem === 'extra-service')
      project.services.edges.push({ node: { id: 'other', name: 'customer' } });
    if (problem === 'workspace') project.workspaceId = 'other';
    if (problem === 'name') project.name = 'platform';
    await assert.rejects(provider.reset(r, 'cli-001-fictional', true));
    assert.equal(mutations.length, before);
  }
  project = pristine;
  await assert.rejects(
    provider.reset({ ...r, projectId: 'platform' }, 'cli-001-fictional', true),
    /protected_project/
  );
  await assert.rejects(
    provider.reset(r, 'cli-001-fictional', false),
    /test_site_required/
  );
  await assert.rejects(
    provider.reset(
      { ...r, customDomain: 'customer.example.invalid' },
      'cli-001-fictional',
      true
    ),
    /test_site_required/
  );
  await provider.reset(r, 'cli-001-fictional', true);
  assert.equal(
    mutations.filter((m) => m.q.includes('projectDelete')).length,
    1
  );
  await provider.reset(r, 'cli-001-fictional', true);
  assert.equal(
    mutations.filter((m) => m.q.includes('projectDelete')).length,
    1
  );
  assert.ok(
    mutations
      .filter((m) => m.q.includes('variableCollectionUpsert'))
      .every((m) => m.v.input.variables.A2AVIARY_TEST_MODE === 'true')
  );
});

test('bucket reset deletes all pages of exactly one spec prefix, rejects traversal and retains failed cleanup for retry', async () => {
  const { BucketStore } = await import('../dist/index.js');
  const prefix = 'specs/00000000-0000-0000-0000-000000000001/';
  const data = new Set(
    Array.from({ length: 1001 }, (_, i) => prefix + 'artifact-' + i)
  );
  data.add('specs/other/keep');
  let sends = 0,
    fail = true;
  const store = new BucketStore(
    {
      async send(command) {
        sends++;
        if (command.constructor.name === 'ListObjectsV2Command')
          return {
            Contents: [...data]
              .filter((k) => k.startsWith(command.input.Prefix))
              .slice(0, 1000)
              .map((Key) => ({ Key }))
          };
        assert.equal(command.constructor.name, 'DeleteObjectsCommand');
        assert.ok(
          command.input.Delete.Objects.every((o) => o.Key.startsWith(prefix))
        );
        if (fail) return { Errors: [{ Code: 'AccessDenied' }] };
        for (const o of command.input.Delete.Objects) data.delete(o.Key);
        return {};
      }
    },
    'fictional'
  );
  for (const bad of [
    '',
    'specs/',
    '../',
    'specs/other/',
    'specs/00000000-0000-0000-0000-000000000001/../'
  ])
    await assert.rejects(store.deletePrefix(bad), /unsafe_reset_prefix/);
  assert.equal(sends, 0);
  await assert.rejects(store.deletePrefix(prefix), /asset_reset_failed/);
  assert.equal(data.size, 1002);
  fail = false;
  await store.deletePrefix(prefix);
  assert.deepEqual([...data], ['specs/other/keep']);
  await store.deletePrefix(prefix);
  assert.deepEqual([...data], ['specs/other/keep']);
});
