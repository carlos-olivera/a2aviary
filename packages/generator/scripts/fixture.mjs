import { writeFile, mkdir } from 'node:fs/promises';
import { fixtureSubmission, writeSource } from './fixture-lib.mjs';
import { fileURLToPath } from 'node:url';
import { generateSite } from '../dist/index.js';
const input = await fixtureSubmission(),
  directory =
    process.argv[2] ??
    fileURLToPath(new URL('../../../work/phase3-fixture', import.meta.url));
await mkdir(directory, { recursive: true });
await writeFile(
  directory + '/submission.json',
  JSON.stringify(input, null, 2) + '\n'
);
const assets = new Map(
  Object.entries(input.assets).map(([id, data]) => [
    id,
    Buffer.from(data, 'base64')
  ])
);
const source = await generateSite(input.spec, assets);
await writeSource(directory, source, input.spec);
console.log(
  JSON.stringify({
    directory,
    specSha256: source.specSha256,
    sourceSha256: source.sourceSha256,
    pages: input.spec.pages.length
  })
);
