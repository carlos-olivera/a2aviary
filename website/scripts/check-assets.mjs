import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

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
assert.equal(image.readUInt32BE(16), 1200, 'Open Graph image width');
assert.equal(image.readUInt32BE(20), 630, 'Open Graph image height');
console.log('Original checksums, derived contours, licensed assets, and 1200 × 630 social preview verified.');
