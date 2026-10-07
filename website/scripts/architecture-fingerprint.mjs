import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function sourceFingerprints() {
  const paths=execFileSync('git',['ls-files','infra','services','local','docker-compose.local.yml','.env.local.example','.github/workflows','contracts','apps/platform','packages/generator','plans'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean).sort();
  return Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')])));
}
