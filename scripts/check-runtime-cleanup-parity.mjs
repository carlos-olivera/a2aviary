// Exact-byte regression against main before runtime cleanup. Fictional local inputs only.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { generateSite, caddyfile, pocketBaseMigration, cmsEditorHtml, cmsEditorScript, GENERATOR_VERSION } from '@a2aviary/generator';
import { canonicalJson, sha256 } from '@a2aviary/site-core';
import { fixtureSubmission, writeSource } from '@a2aviary/site-core/fixtures/catalog';
import { composition, compositionNames } from '@a2aviary/site-core/fixtures/presentation';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const inputs = [['catalog', await fixtureSubmission()], ...await Promise.all(compositionNames.map(async name => [name, await composition(name)]))];
const results = { generatorVersion: GENERATOR_VERSION, contracts: {}, fixtures: {} };
async function hashes(directory, prefix = '') {
  const result = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const path = join(prefix, entry.name), file = join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(result, await hashes(file, path));
    else result[path] = sha256(await readFile(file));
  }
  return result;
}
results.contracts = await hashes('contracts/site/2.2.0');
for (const [name, input] of inputs) {
  const assets = new Map(Object.entries(input.assets).map(([id,b]) => [id, Buffer.from(b,'base64')]));
  const source = await generateSite(input.spec, assets, { test: true });
  const generated = { ...source.files, ...Object.fromEntries(Object.entries(source.binaryFiles).map(([p,b]) => [p,Buffer.from(b,'base64')])) };
  Object.assign(generated, { Caddyfile: caddyfile(input.spec), 'pb_migrations/site.js': pocketBaseMigration(input.spec), 'editor.html': cmsEditorHtml(), 'editor.js': cmsEditorScript(input.spec) });
  const directory = join(root,'.local/runtime-cleanup-parity',name);
  await rm(directory,{recursive:true,force:true}); await mkdir(directory,{recursive:true});
  await writeSource(directory,source,input.spec);
  await symlink(join(root,'node_modules'),join(directory,'node_modules'));
  execFileSync(process.execPath,[join(root,'node_modules/astro/bin/astro.mjs'),'build'],{cwd:directory,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'},stdio:'pipe'});
  results.fixtures[name] = { spec: source.specSha256, source: source.sourceSha256, generated: Object.fromEntries(Object.entries(generated).map(([p,b])=>[p,sha256(b)])), built: await hashes(join(directory,'dist')) };
}
const baseline = join(root,'docs/evidence/runtime-cleanup/byte-baseline.json');
if (process.argv.includes('--record')) {
  await mkdir(join(root,'docs/evidence/runtime-cleanup'),{recursive:true});
  await writeFile(baseline,JSON.stringify(results,null,2)+'\n');
} else assert.deepEqual(results,JSON.parse(await readFile(baseline,'utf8')));
console.log('Four current fixtures: generator version, contract hashes, spec/source digests, all generated and built resources, Caddy, PocketBase and editor bytes match.');
