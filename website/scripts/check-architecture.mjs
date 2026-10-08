import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceFingerprints } from './architecture-fingerprint.mjs';
const read = path => readFile(new URL('../../'+path,import.meta.url),'utf8');
const manifest = JSON.parse(await read('docs/architecture/stages.json'));
const coverage = JSON.parse(await read('docs/architecture/coverage.json'));
const provenance = JSON.parse(await read('docs/architecture/provenance.json'));
const html = await read('website/architecture/index.html');
const digest = value => createHash('sha256').update(value).digest('hex');
assert.equal(provenance.integratedPageSha256,digest(html),'Page differs from generation record');
assert.equal(provenance.manifestSha256,digest(await read('docs/architecture/stages.json')),'Stage membership changed: regenerate');
assert.equal(provenance.coverageSha256,digest(await read('docs/architecture/coverage.json')),'Coverage/status changed: regenerate');
assert.deepEqual(await sourceFingerprints(),provenance.sourceFingerprints,'Represented source changed: regenerate architecture');
assert.equal(manifest.stages.length,5);
assert.equal(provenance.sourceRevision,manifest.sourceRevision);
assert.equal(new Set(manifest.stages.map(stage=>stage.id)).size,5);
for (const info of Object.values(coverage)) if(info.targetStage) assert(manifest.stages.some(stage=>stage.id===info.targetStage),'Boundary target exists');
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
    assert(html.includes('https://github.com/carlos-olivera/a2aviary/blob/main/'+source.path));
    const text = await read(source.path); assert(source.line>=1 && source.end_line<=text.split('\n').length,'Invalid source range');
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
console.log('Five-stage architecture, exclusive membership, six finalized drawings, source freshness and CSP-safe resources verified.');
