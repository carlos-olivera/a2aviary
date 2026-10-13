// Local fictional fixture regression gate. No provider access or deployment.
import assert from 'node:assert/strict';
import { readFile, mkdir, readdir, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { generateSite } from '@a2aviary/generator';
import { canonicalJson, sha256, policyForVersion, catalog } from '@a2aviary/site-core';
import { library } from '../packages/generator/src/library-data.ts';
import {
  fixtureSubmission, writeSource,
} from '@a2aviary/site-core/fixtures/catalog';
import {
  composition, compositionNames,
} from '@a2aviary/site-core/fixtures/presentation';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const catalogInput = await fixtureSubmission();
const boxedInput = {
  spec: JSON.parse(await readFile('contracts/site/2.1.0/examples/site-spec.json')),
  assets: catalogInput.assets,
};
const inputs = [
  ['catalog', catalogInput],
  ['boxed-2.1', boxedInput],
  ...await Promise.all(compositionNames.map(async name => [name, await composition(name)])),
];
const boxedGolden = JSON.parse(await readFile('packages/generator/test/fixtures/boxed-2.1.json', 'utf8'));
const results = {};
for (const [name, input] of inputs) {
  const options = { test: true };
  if (name === 'boxed-2.1') {
    options.fixtureLibrary = { policy: policyForVersion('2.1.0'), catalog, variants: library };
  }
  const assets = new Map(Object.entries(input.assets).map(([id, b64]) => [id, Buffer.from(b64, 'base64')]));
  const source = await generateSite(input.spec, assets, options);
  if (name === 'catalog' || name === 'boxed-2.1') {
    for (const [path, expectedHash] of Object.entries(boxedGolden.hashes)) {
      const bytes = path in source.binaryFiles
        ? Buffer.from(source.binaryFiles[path], 'base64')
        : source.files[path];
      assert.equal(sha256(bytes), expectedHash, `${name}: historical boxed bytes changed at ${path}`);
    }
  }
  const directory = join(root, '.local/workspace-parity', name);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  await writeSource(directory, source, input.spec);
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'));
  execFileSync(process.execPath, [join(root, 'node_modules/astro/bin/astro.mjs'), 'build'], {
    cwd: directory,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
    stdio: 'pipe',
  });
  const files = {};
  async function walk(path = '') {
    const entries = await readdir(join(directory, 'dist', path), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await walk(file);
      else files[file] = (await readFile(join(directory, 'dist', file))).toString('base64');
    }
  }
  await walk();
  results[name] = {
    spec: source.specSha256,
    source: source.sourceSha256,
    sourceFiles: sha256(canonicalJson({ files: source.files, binaryFiles: source.binaryFiles })),
    output: sha256(canonicalJson(files)),
  };
}
const expected = JSON.parse(await readFile('docs/evidence/site-core-workspaces/generator-hashes.json', 'utf8'));
assert.deepEqual(results, expected);
console.log('All five fixture spec, source, source-file and built-output hashes match the pre-refactor baseline.');
