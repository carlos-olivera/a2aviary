import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
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
