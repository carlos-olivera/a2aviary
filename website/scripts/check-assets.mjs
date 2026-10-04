import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import './check-costs.mjs';

const brand = new URL('../../brand/', import.meta.url);
const publicRoot = new URL('../public/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', brand), 'utf8'));
for (const item of [...manifest.assets, ...manifest.vector_reconstructions]) {
  const bytes = await readFile(new URL(item.file, brand));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, `${item.file}: original changed`);
}
const originalBird = await readFile(new URL('logos/svg/a2aviary-bird.svg', brand), 'utf8');
assert.equal(await readFile(new URL('brand/a2aviary-bird.svg', publicRoot), 'utf8'), originalBird);
for (const name of ['a2aviary-bird', 'a2aviary-logo']) {
  const original = await readFile(new URL(`logos/svg/${name}.svg`, brand), 'utf8');
  const inverse = await readFile(new URL(`brand/${name}-inverse.svg`, publicRoot), 'utf8');
  const contours = (svg) => [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(contours(inverse), contours(original), `${name}: derived contours changed`);
  assert(!inverse.includes('#0B1220'), `${name}: inverse retains dark lettering`);
  assert(inverse.includes('#14F1C8'), `${name}: teal missing`);
}
for (const name of ['space-grotesk-OFL.txt', 'inter-OFL.txt', 'three-MIT.txt']) {
  assert((await readFile(new URL(`licenses/${name}`, publicRoot), 'utf8')).length > 500);
}
const image = await readFile(new URL('social-preview.png', publicRoot));
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
assert(image.subarray(0, 8).equals(pngSignature), 'Social preview PNG signature');
assert.equal(image.readUInt32BE(16), 1200, 'Open Graph image width');
assert.equal(image.readUInt32BE(20), 630, 'Open Graph image height');
const touchIcon = await readFile(new URL('apple-touch-icon.png', publicRoot));
assert(touchIcon.subarray(0, 8).equals(pngSignature), 'Apple touch PNG signature');
assert.equal(touchIcon.readUInt32BE(16), 180, 'Apple touch icon width');
assert.equal(touchIcon.readUInt32BE(20), 180, 'Apple touch icon height');
const favicon = await readFile(new URL('favicon.ico', publicRoot));
assert.equal(favicon.readUInt16LE(0), 0, 'ICO reserved field');
assert.equal(favicon.readUInt16LE(2), 1, 'ICO image type');
assert.equal(favicon.readUInt16LE(4), 3, 'ICO image count');
let offset = 6 + 3 * 16;
for (const [index, size] of [16, 32, 48].entries()) {
  const entry = 6 + index * 16;
  assert.equal(favicon[entry], size, 'ICO directory width');
  assert.equal(favicon[entry + 1], size, 'ICO directory height');
  assert.equal(favicon.readUInt16LE(entry + 4), 1, 'ICO color planes');
  assert.equal(favicon.readUInt16LE(entry + 6), 32, 'ICO bit depth');
  assert.equal(favicon.readUInt32LE(entry + 12), offset, 'ICO payload offset');
  const length = favicon.readUInt32LE(entry + 8);
  const payload = favicon.subarray(offset, offset + length);
  assert.equal(payload.length, length, 'ICO payload bounds');
  assert(payload.subarray(0, 8).equals(pngSignature), 'ICO PNG signature');
  assert.equal(payload.readUInt32BE(16), size, 'ICO payload width');
  assert.equal(payload.readUInt32BE(20), size, 'ICO payload height');
  offset += length;
}
assert.equal(offset, favicon.length, 'ICO file length');

// Validate the graph and referenced assets independently of browser rendering.
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const structured = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(structured.length, 1, 'One JSON-LD graph');
const data = JSON.parse(structured[0][1]);
assert.equal(data['@context'], 'https://schema.org');
assert(Array.isArray(data['@graph']), 'JSON-LD graph array');
const graph = new Map(data['@graph'].map(entity => [entity['@id'], entity]));
assert.equal(graph.size, data['@graph'].length, 'Unique entity IDs');
assert.deepEqual(new Set(data['@graph'].map(entity => entity['@type'])), new Set(['WebSite', 'Organization', 'Person', 'SoftwareSourceCode']));
function checkReferences(value) {
  if (!value || typeof value !== 'object') return;
  if ('@id' in value) {
    assert.equal(new URL(value['@id']).origin, 'https://a2aviary.io', 'Absolute site entity ID');
    assert(graph.has(value['@id']), 'JSON-LD entity reference resolves');
  }
  for (const item of Object.values(value)) checkReferences(item);
}
checkReferences(data['@graph']);
assert(data['@graph'].every(entity => !('logo' in entity)), 'No unapproved structured-data logo');
for (const tag of html.matchAll(/<(?:link|meta)\b[^>]*>/g)) {
  const attributes = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
  const asset = attributes.rel === 'icon' || attributes.rel === 'apple-touch-icon' || attributes.rel === 'preload'
    ? attributes.href
    : attributes.property === 'og:image' || attributes.name === 'twitter:image'
      ? new URL(attributes.content).pathname : undefined;
  if (asset) assert((await readFile(new URL('.' + asset, publicRoot))).length > 0, `${asset}: referenced asset exists`);
}
console.log('Original checksums, contours, licenses, social preview, icons, and linked JSON-LD entities verified.');
