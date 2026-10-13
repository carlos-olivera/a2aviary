// Local-only timing evidence: real renderer and checker, no hosted provider/model.
import { mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { quickRender, generateSite, normalizeImage } from '../dist/index.js';
import {
  fixtureSubmission,
  writeSource,
} from '@a2aviary/site-core/fixtures/catalog';
import {
  composition,
  compositionNames,
} from '@a2aviary/site-core/fixtures/presentation';
import { profileComposition } from '../../site-core/fixtures/starters/profile.mjs';
const root = new URL('../../../', import.meta.url).pathname;
const out = root + '.local/quick-preview-benchmark';
await mkdir(out, { recursive: true });
const evidence = {
  node: process.version,
  platform: process.platform,
  quickSamplesPerComposition: 5,
  fullSamplesPerComposition: 3,
  method:
    'nearest-rank percentiles, wall milliseconds; normalized assets in memory; dependencies preinstalled; full includes source generation + real verify.mjs, excludes hosted upload/setup/AI/queue; quick includes child startup; fictional inputs only',
  compositions: [],
};
const stats = (v) => ({
  p50Ms: Math.round(
    [...v].sort((a, b) => a - b)[Math.ceil(v.length * 0.5) - 1],
  ),
  p95Ms: Math.round(
    [...v].sort((a, b) => a - b)[Math.ceil(v.length * 0.95) - 1],
  ),
  samplesMs: v.map(Math.round),
});
for (const name of [...compositionNames, 'profile', 'catalog']) {
  const input =
    name === 'catalog'
      ? await fixtureSubmission()
      : name === 'profile'
        ? await profileComposition('light-es')
        : await composition(name);
  const assets = new Map();
  for (const a of input.spec.assets) {
    const normalized = await normalizeImage(
      Buffer.from(input.assets[a.id], 'base64'),
    );
    const { normalizerVersion, ...metadata } = normalized.metadata;
    Object.assign(a, metadata);
    assets.set(a.id, normalized.bytes);
  }
  const quick = [],
    full = [];
  let result, report;
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    result = await quickRender(input.spec, assets, true);
    quick.push(performance.now() - start);
  }
  const directory = out + '/' + name;
  await mkdir(directory, { recursive: true });
  try {
    await symlink(root + 'node_modules', directory + '/node_modules', 'dir');
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  for (let i = 0; i < 3; i++) {
    const start = performance.now(),
      source = await generateSite(input.spec, assets, {
        serverNormalized: true,
        test: true,
      });
    await writeSource(directory, source, input.spec);
    const child = spawn(process.execPath, ['verify.mjs'], {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ASTRO_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    child.stdout.on('data', (b) => (log += b));
    child.stderr.on('data', (b) => (log += b));
    const code = await new Promise((r, j) => {
      child.on('error', j);
      child.on('close', r);
    });
    full.push(performance.now() - start);
    await writeFile(directory + '/verifier-' + i + '.log', log);
    report = JSON.parse(await readFile(directory + '/outputs/report.json'));
    if (code !== 0 || !report.passed)
      throw Error(
        name + ': ' + JSON.stringify(report.checks.filter((c) => !c.passed)),
      );
    const built = JSON.parse(await readFile(directory + '/outputs/site.json'));
    for (const [path, bytes] of Object.entries(result.files)) {
      if (path.endsWith('.html')) continue;
      if (built.files[path] !== bytes)
        throw Error('Static asset mismatch: ' + path);
    }
    console.log(name + ' full sample ' + (i + 1) + ' passed');
  }
  evidence.compositions.push({
    name,
    pages: input.spec.pages.length,
    quick: stats(quick),
    full: stats(full),
    checks: report.checks.map((c) => ({ name: c.name, passed: c.passed })),
  });
  await writeFile(
    out + '/timings.json',
    JSON.stringify(evidence, null, 2) + '\n',
  );
}
console.log(JSON.stringify(evidence, null, 2));
