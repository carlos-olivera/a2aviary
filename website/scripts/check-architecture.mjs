import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceFingerprints } from './architecture-fingerprint.mjs';
import { changedArchitecturePaths, sourceFreshnessRequired } from './architecture-scope.mjs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
const read = path => readFile(new URL('../../'+path,import.meta.url),'utf8');
const manifest = JSON.parse(await read('docs/architecture/stages.json'));
const coverage = JSON.parse(await read('docs/architecture/coverage.json'));
const provenance = JSON.parse(await read('docs/architecture/provenance.json'));
const html = await read('website/architecture/index.html');
const digest = value => createHash('sha256').update(value).digest('hex');
assert.equal(provenance.integratedPageSha256,digest(html),'Page differs from generation record');
assert.equal(provenance.manifestSha256,digest(await read('docs/architecture/stages.json')),'Stage membership changed: regenerate');
assert.equal(provenance.coverageSha256,digest(await read('docs/architecture/coverage.json')),'Coverage/status changed: regenerate');
const fresh = isDeepStrictEqual(await sourceFingerprints(), provenance.sourceFingerprints);
const required = sourceFreshnessRequired(changedArchitecturePaths(fileURLToPath(new URL('../../', import.meta.url))), process.env.ARCHITECTURE_RELEASE === '1');
if (!fresh && required) throw new Error('Architecture-relevant change or release: regenerate architecture provenance.');
if (!fresh) console.warn('WARNING: architecture source fingerprint is stale; this unrelated change does not require regeneration. Regenerate before the next architecture-relevant change or release.');
for (const path of ['package.json', 'package-lock.json', 'packages/site-core/src/index.ts', 'packages/site-core/src/policy.ts', 'packages/site-core/src/validator.ts', 'scripts/check-workspace-parity.mjs']) {
  assert(Object.hasOwn(provenance.sourceFingerprints, path), 'Workspace/domain source must be fingerprinted: ' + path);
}
assert.equal(manifest.stages.length,5);
assert.equal(provenance.sourceRevision,manifest.sourceRevision);
assert.equal(new Set(manifest.stages.map(stage=>stage.id)).size,5);
for (const info of Object.values(coverage)) if(info.targetStage) assert(manifest.stages.some(stage=>stage.id===info.targetStage),'Boundary target exists');
const root = fileURLToPath(new URL('../../', import.meta.url));
try { execFileSync('git', ['cat-file','-e',provenance.sourceRevision+'^{commit}'], {cwd:root,stdio:'pipe'}); }
catch { execFileSync('git', ['fetch','--no-tags','--depth=1','origin',provenance.sourceRevision], {cwd:root,stdio:'pipe'}); }
const assigned = new Set();
for (const [id, record] of Object.entries(provenance.diagrams)) {
  const model = JSON.parse(await read(record.candidatePath));
  assert.equal(record.candidateSha256,digest(await read(record.candidatePath)),'Candidate must match finalized diagram');
  assert.equal(model.meta.repository.revision,manifest.sourceRevision);
  for (const gate of ['validate','deliver','check','browser-check']) assert.equal(record.gates[gate],'pass');
  if (id==='overview') {
    assert.deepEqual(model.components.map(node=>node.id),manifest.stages.map(stage=>stage.id));
  } else {
    const stage = manifest.stages.find(stage=>stage.id===id);assert(stage);
    assert.deepEqual(stage.nodes,model.components.map(node=>node.id));
    for (const node of model.components) {assert(!assigned.has(node.id),'Technical node assigned twice');assigned.add(node.id);assert(coverage[node.id]);}
  }
  for (const node of model.components) for (const source of node.sources) {
    assert(html.includes('https://github.com/carlos-olivera/a2aviary/blob/'+provenance.sourceRevision+'/'+source.path));
    const text = execFileSync('git', ['show', provenance.sourceRevision + ':' + source.path], {cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8'}); assert(source.line>=1 && source.end_line<=text.split('\n').length,'Invalid source range at recorded revision');
  }
}
assert.equal(Object.keys(provenance.diagrams).length,6);
assert.deepEqual([...assigned].sort(),Object.keys(coverage).sort());
assert.equal(coverage['hosting-customer'].status,'Implemented');
assert(!/<(?:style|script)\b[^>]*>\s*[^<\s]/.test(html),'No inline executable/style content');
assert(!/\s(?:on\w+|style)=/.test(html),'No inline handlers or CSS');
for (const match of html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"/g)) {
  if (match[0].includes('rel="canonical"'))continue;
  assert(match[1].startsWith('/')&&!match[1].startsWith('//'),'Resources must be same-origin');
}
for (const filename of ['architecture.css','architecture.js']) {
  const text = await read('website/public/'+filename);
  assert.equal(digest(text),provenance.assetSha256[filename],'Asset changed: regenerate integration');
  assert(!/https?:\/\/|@import|eval\(|new Function\(/.test(text),'No external resources or unsafe code');
}
console.log('Five-stage architecture, membership, six finalized drawings, recorded source ranges and CSP-safe resources verified; source fingerprint ' + (fresh ? 'current.' : 'warning only for unrelated change.'));
