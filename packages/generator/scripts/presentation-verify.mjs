// Local evidence only. No provider or credential access, hosted runner, or deployment.
import { mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { generateSite } from '../dist/index.js';
import { writeSource } from './fixture-lib.mjs';
import {
  composition,
  compositionNames,
} from '../test/fixtures/presentation/compositions.mjs';
const root = new URL('../../../', import.meta.url).pathname,
  out = join(root, '.local/presentation-verifier');
await mkdir(out, { recursive: true });
const reports = [];
for (const name of compositionNames) {
  const input = await composition(name),
    directory = join(out, name);
  await mkdir(directory, { recursive: true });
  const source = await generateSite(
    input.spec,
    new Map(
      Object.entries(input.assets).map(([id, b]) => [
        id,
        Buffer.from(b, 'base64'),
      ]),
    ),
    { test: true },
  );
  await writeSource(directory, source, input.spec);
  try {
    await symlink(
      join(root, 'packages/generator/node_modules'),
      join(directory, 'node_modules'),
      'dir',
    );
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
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
    child.on('exit', r);
  });
  await writeFile(join(directory, 'verifier.log'), log);
  const report = JSON.parse(
    await readFile(join(directory, 'outputs/report.json')),
  );
  if (code !== 0 || !report.passed)
    throw Error(
      name +
        ' local verification failed: ' +
        JSON.stringify(report.checks.filter((c) => !c.passed)),
    );
  const built = JSON.parse(
      await readFile(join(directory, 'outputs/site.json')),
    ),
    weight = {};
  for (const [path, b64] of Object.entries(built.files)) {
    const data = Buffer.from(b64, 'base64'),
      type = path.endsWith('.html')
        ? 'html'
        : path.endsWith('.css')
          ? 'css'
          : path.endsWith('.js')
            ? 'js'
            : path.endsWith('.woff2')
              ? 'fonts'
              : path.endsWith('.webp')
                ? 'images'
                : 'other';
    weight[type] ??= { bytes: 0, gzipBytes: 0, files: 0 };
    weight[type].bytes += data.length;
    weight[type].gzipBytes += gzipSync(data, { level: 9 }).length;
    weight[type].files++;
  }
  reports.push({ name, weight, sourceSha256: source.sourceSha256, report });
  await writeFile(
    join(out, 'summary.json'),
    JSON.stringify(
      {
        complete: reports.length === compositionNames.length,
        compositions: reports,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(name + ' passed local verifier');
}
