import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSite,
  specDigest,
  SiteError,
  canonicalJson,
  sha256,
  validatePreview,
  assertVerified,
  siteRuntime,
  pocketBaseMigration,
  caddyfile,
  RailwayDeployer
} from '../dist/index.js';
import { fixtureSubmission } from '../scripts/fixture-lib.mjs';
const input = await fixtureSubmission();
const assets = new Map(
  Object.entries(input.assets).map(([id, b64]) => [
    id,
    Buffer.from(b64, 'base64')
  ])
);
test('seven-page catalog fixture generates reproducible sources, exact original assets and all catalog blocks', async () => {
  const first = await generateSite(input.spec, assets),
    second = await generateSite(structuredClone(input.spec), new Map(assets));
  assert.deepEqual(first, second);
  assert.equal(input.spec.pages.length, 7);
  assert.equal(first.sourceSha256.length, 64);
  const html = Object.values(first.files).join('\n');
  for (const c of [
    'hero',
    'rich-text',
    'feature-grid',
    'steps',
    'link-cards',
    'gallery',
    'faq',
    'cta',
    'contact',
    'catalog',
    'blog',
    'announcements'
  ])
    assert.ok(html.includes('data-component=\\"' + c + '\\"'));
  assert.equal(
    first.binaryFiles['public/assets/' + input.spec.assets[0].sha256 + '.png'],
    input.assets[input.spec.assets[0].id]
  );
  assert.ok(
    pocketBaseMigration(input.spec).includes(
      "@request.auth.collectionName = 'editors'"
    )
  );
  assert.ok(
    caddyfile(input.spec).includes('/api/cms/api/collections/catalog/records*')
  );
  assert.ok(!caddyfile(input.spec).includes('/api/cms/_/'));
});
test('client text remains text, including Astro expressions and executable markup', async () => {
  const s = structuredClone(input.spec);
  s.pages[0].sections[0].blocks[0].props.heading =
    '<script>alert(1)</script> {process.env}';
  s.approval.specSha256 = specDigest(s);
  const result = await generateSite(s, assets);
  const html = result.files['src/pages/index.astro'];
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('set:html={html}'));
});
test('invalid spec, unknown component/variant, altered approval and corrupt/prepared assets fail closed', async () => {
  for (const mutate of [
    (s) => (s.pages[0].sections[0].blocks[0].component = 'custom'),
    (s) => (s.pages[0].sections[0].blocks[0].variant = 'custom'),
    (s) => (s.approval.approved = false),
    (s) => (s.approval.specSha256 = '0'.repeat(64)),
    (s) => (s.tokens.fonts.body = 'unknown')
  ]) {
    const spec = structuredClone(input.spec);
    mutate(spec);
    await assert.rejects(
      generateSite(spec, assets),
      (e) =>
        e instanceof SiteError &&
        e.code === 'invalid_spec' &&
        e.errors.every(
          (e) => typeof e.path === 'string' && e.rule && e.suggestion
        )
    );
  }
  await assert.rejects(
    generateSite(
      input.spec,
      new Map([[input.spec.assets[0].id, Buffer.from('bad')]])
    ),
    /invalid_assets/
  );
  await assert.rejects(generateSite(input.spec, new Map()), /invalid_assets/);
  const extra = new Map(assets);
  extra.set('extra', Buffer.from('x'));
  await assert.rejects(generateSite(input.spec, extra), /invalid_assets/);
});
test('approved preview binds every file, contains all pages and rejects traversal/scripts', () => {
  validatePreview(input.spec, input.preview);
  const wrong = structuredClone(input.preview);
  wrong.files['index.html'] = 'eA==';
  assert.throws(() => validatePreview(input.spec, wrong), /preview_digest/);
  for (const path of ['../outside.html', '/index.html', 'script.js']) {
    const p = structuredClone(input.preview);
    p.files[path] = 'eA==';
    const s = structuredClone(input.spec);
    s.preview.sha256 = sha256(canonicalJson(p));
    assert.throws(() => validatePreview(s, p), /invalid_preview_file/);
  }
  const p = structuredClone(input.preview);
  delete p.files['contact/index.html'];
  const s = structuredClone(input.spec);
  s.preview.sha256 = sha256(canonicalJson(p));
  assert.throws(() => validatePreview(s, p), /preview_page_missing/);
});
test('report text alone, missing checks, forged hashes and altered output bytes cannot authorize a deployment', async () => {
  const source = await generateSite(input.spec, assets);
  const files = {};
  for (const [p, b] of Object.entries(source.binaryFiles))
    files[p.slice(7)] = b;
  for (const p of input.spec.pages)
    files[p.path === '/' ? 'index.html' : p.path.slice(1) + 'index.html'] =
      Buffer.from('fixture').toString('base64');
  const names = [
    'catalog-syntax',
    'astro-build',
    ...input.spec.pages.flatMap((p) => [
      'a11y:' + p.path,
      'links:' + p.path,
      'lighthouse:' + p.path,
      'visual:' + p.path + ':390',
      'visual:' + p.path + ':1280'
    ])
  ];
  const report = {
    version: 1,
    passed: true,
    sourceSha256: source.sourceSha256,
    specSha256: source.specSha256,
    outputSha256: sha256(canonicalJson(files)),
    checks: names.map((name) => ({ name, passed: true, details: {} }))
  };
  const build = { report, files, artifacts: {}, sessionId: 'fictional' };
  assertVerified(build, source, input.spec);
  for (const mutate of [
    (b) => b.report.checks.pop(),
    (b) => (b.report.checks[0].passed = false),
    (b) => (b.report.sourceSha256 = '0'.repeat(64)),
    (b) => (b.files['index.html'] = 'eA=='),
    (b) => (b.report.passed = false)
  ]) {
    const b = structuredClone(build);
    mutate(b);
    assert.throws(
      () => assertVerified(b, source, input.spec),
      /verification_failed/
    );
  }
});
test('production workflow defaults off; unsupported AI gap mode cannot enable unreviewed code', () => {
  assert.equal(siteRuntime({}), undefined);
  assert.throws(() => siteRuntime({ SITE_WORKFLOW_ENABLED: 'yes' }));
  assert.throws(
    () =>
      siteRuntime({
        SITE_WORKFLOW_ENABLED: 'true',
        SITE_CREDENTIAL_KEY: 'a'.repeat(64),
        SITE_BUCKET_ENDPOINT: 'https://bucket.example.invalid',
        SITE_DEPLOY_ENVIRONMENT: 'fixture',
        SITE_AI_GAPS_ENABLED: 'true'
      }),
    /No AI gaps/
  );
});
test('Railway refuses protected projects and environment/workspace/name/service mismatches before any mutations', async () => {
  for (const problem of [
    'protected',
    'name',
    'environment',
    'workspace',
    'service'
  ]) {
    let mutations = 0;
    const options = {
      apiToken: 'fictional',
      workspaceId: 'workspace',
      protectedProjectIds: new Set(problem === 'protected' ? ['project'] : []),
      test: true,
      backupVariables: {}
    };
    const r = new RailwayDeployer(options, async (query) => {
      if (query.startsWith('mutation')) mutations++;
      return {
        project: {
          name: problem === 'name' ? 'platform' : 'cli-001-fictional',
          workspaceId: problem === 'workspace' ? 'other' : 'workspace',
          environments: {
            edges: [
              {
                node: {
                  id: 'environment',
                  name: problem === 'environment' ? 'production' : 'fixture'
                }
              }
            ]
          },
          services: {
            edges: [
              {
                node: {
                  id: 'web',
                  name: problem === 'service' ? 'platform' : 'web'
                }
              }
            ]
          }
        }
      };
    });
    await assert.rejects(
      r.status(
        {
          projectId: 'project',
          environmentId: 'environment',
          webServiceId: 'web'
        },
        'cli-001-fictional'
      )
    );
    assert.equal(mutations, 0);
  }
});
