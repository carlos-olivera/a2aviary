import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceFingerprints } from './architecture-fingerprint.mjs';
const model=JSON.parse(await readFile(new URL('../../docs/architecture/map.json',import.meta.url)));
const coverage=JSON.parse(await readFile(new URL('../../docs/architecture/coverage.json',import.meta.url)));
const provenance=JSON.parse(await readFile(new URL('../../docs/architecture/provenance.json',import.meta.url)));
const html=await readFile(new URL('../architecture/index.html',import.meta.url),'utf8');
const digest=value=>createHash('sha256').update(value).digest('hex');
assert.equal(provenance.candidateSha256,digest(await readFile(new URL('../../docs/architecture/map.json',import.meta.url))),'Map must match finalized candidate');
assert.equal(provenance.integratedPageSha256,digest(html),'Integrated page differs from its generation record');
assert.deepEqual(await sourceFingerprints(),provenance.sourceFingerprints,'Infrastructure/services changed: regenerate the source-backed map');
assert.deepEqual(Object.values(provenance.gates),['pass','pass','pass','pass']);
for(const node of model.components) {
  assert(coverage[node.id]);assert(html.includes(`data-node-id="${node.id}"`));
  for(const source of node.sources) {assert(html.includes('https://github.com/carlos-olivera/a2aviary/blob/main/'+source.path));const text=await readFile(new URL('../../'+source.path,import.meta.url),'utf8');assert(source.line>=1&&source.end_line<=text.split('\n').length);}
}
assert(!/<(?:style|script)\b[^>]*>\s*[^<\s]/.test(html),'No inline executable/style content');
assert(!/\s(?:on\w+|style)=/.test(html),'No inline handlers or CSS');
for(const match of html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)="([^"]+)"/g)) {
  if(match[0].includes('rel="canonical"'))continue;
  assert(match[1].startsWith('/')&&!match[1].startsWith('//'),'Resources must be same-origin');
}
for(const filename of ['architecture.css','architecture.js']) {const text=await readFile(new URL('../public/'+filename,import.meta.url),'utf8');assert(!/https?:\/\/|@import|eval\(|new Function\(/.test(text),'No external resources or unsafe code');}
console.log('Architecture candidate, source freshness, all node links, local annotations and CSP-safe resources verified.');
