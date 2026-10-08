import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  external: ['ajv', 'sharp'],
  outfile: 'dist/index.js'
});
await cp('src/normalize-worker.mjs','dist/normalize-worker.mjs');
await rm('dist/resources', { recursive: true, force: true });
await cp('template', 'dist/resources', { recursive: true });
await mkdir('dist/plans', { recursive: true });
await cp(
  '../../plans/web-simple.policy.json',
  'dist/plans/web-simple.policy.json'
);
execFileSync(process.execPath, ['scripts/install-railway.mjs'], {
  stdio: 'inherit'
});

execFileSync(process.execPath, ['scripts/licenses.mjs'], { stdio: 'inherit' });
