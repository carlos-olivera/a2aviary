import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
await build({ entryPoints: ['src/protocol.ts', 'src/intake.ts', 'src/runtime.ts', 'src/sender.ts', 'src/dispatcher.ts', 'src/watchdog.ts', 'src/operator.ts', 'src/client.ts', 'src/feedback.ts', 'src/policy.ts', 'src/support.ts'], bundle: true, platform: 'node', target: 'node22', format: 'esm', outdir: 'dist', sourcemap: true, banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });

// Standalone contract validators are not imported by any AWS worker. Sharp stays external.
await build({ entryPoints: ['src/site/validator.ts', 'src/site/generator.ts', 'src/site/examples.ts'], bundle: true, packages: 'external', platform: 'node', target: 'node22', format: 'esm', outdir: 'dist/site' });

await import('./licenses.mjs');
await writeFile('dist/package.json', JSON.stringify({ type: 'module' }));
