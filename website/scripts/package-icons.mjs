import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// ICO supports PNG payloads. Store all three sizes without adding an image library.
const sizes = [16, 32, 48];
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
const images = await Promise.all(sizes.map(size => readFile(new URL(`../../output/playwright/favicon-${size}.png`, import.meta.url))));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (const [index, image] of images.entries()) {
  const size = sizes[index];
  assert(image.subarray(0, 8).equals(pngSignature), 'Icon payload must be PNG');
  assert.equal(image.readUInt32BE(16), size);
  assert.equal(image.readUInt32BE(20), size);
  const entry = 6 + index * 16;
  directory[entry] = size;
  directory[entry + 1] = size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(image.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += image.length;
}
await writeFile(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([directory, ...images]));
console.log('Packaged 16, 32, and 48-pixel favicon variants.');
