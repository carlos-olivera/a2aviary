// Use the pinned first-party Rust binary without the npm wrapper's vulnerable tar dependency.
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  copyFile,
  chmod,
  rm
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const targets = {
  'darwin-arm64': [
    'aarch64-apple-darwin',
    '0578c42c397c73c08d9adb2130b0ed9a376b80a972c51ba824d893ee0e71463a'
  ],
  'darwin-x64': [
    'x86_64-apple-darwin',
    'cc625805b74951449afbf6f09ec01de8d4c04863cf0a75549801ad9a6a431b83'
  ],
  'linux-x64': [
    'x86_64-unknown-linux-musl',
    'c937ab715dd5dff3e3bfe12a4172e927b97dbf46cf9940ee5caf9d6ca1ae6c62'
  ],
  'linux-arm64': [
    'aarch64-unknown-linux-musl',
    '5856211b27bf7f10828d35bb2a454b6ac6133e0c17205c2d4f8e44e33cd5391a'
  ]
};
const target = targets[process.platform + '-' + process.arch];
if (!target) throw Error('Unsupported Railway CLI host');
await mkdir('dist/bin', { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'a2aviary-railway-binary-'));
try {
  const response = await fetch(
    'https://github.com/railwayapp/cli/releases/download/v5.63.4/railway-v5.63.4-' +
      target[0] +
      '.tar.gz',
    { signal: AbortSignal.timeout(60000) }
  );
  if (!response.ok) throw Error('Railway binary download failed');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== target[1])
    throw Error('Railway binary checksum mismatch');
  const archive = join(dir, 'railway.tar.gz');
  await writeFile(archive, bytes);
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
    .trim()
    .split('\n');
  if (entries.length !== 1 || entries[0] !== 'railway')
    throw Error('Unexpected Railway binary archive');
  execFileSync('tar', ['-xzf', archive, '-C', dir, 'railway']);
  await copyFile(join(dir, 'railway'), 'dist/bin/railway');
  await chmod('dist/bin/railway', 0o755);
  const license = await fetch(
    'https://raw.githubusercontent.com/railwayapp/cli/v5.63.4/LICENSE'
  );
  if (!license.ok) throw Error('Railway license unavailable');
  await writeFile('dist/bin/RAILWAY-LICENSE', await license.text());
  await writeFile(
    'dist/bin/provenance.json',
    JSON.stringify(
      {
        version: '5.63.4',
        target: target[0],
        archiveSha256: target[1],
        binarySha256: createHash('sha256')
          .update(await readFile('dist/bin/railway'))
          .digest('hex')
      },
      null,
      2
    ) + '\n'
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
