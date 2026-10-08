import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pocketBaseDockerfile } from '../dist/index.js';

const run = promisify(execFile);
const docker = async args => (await run('docker', args, {
  timeout: 180000, maxBuffer: 4 * 1024 * 1024
})).stdout.trim();
const baseline = await readFile(new URL('../test/fixtures/pocketbase-before-runtime-chown.Dockerfile', import.meta.url), 'utf8');
for (const [label, dockerfile] of [['old', baseline], ['new', pocketBaseDockerfile]]) {
  test(label + ': empty root-owned runtime bind mount', { timeout: 240000 }, async () => {
    const name = 'a2aviary-pb-mount-' + randomUUID();
    const context = await mkdtemp(join(tmpdir(), 'a2aviary-pb-mount-'));
    try {
      for (const path of ['pb_hooks', 'pb_public', 'pb_migrations']) await mkdir(join(context, path));
      await writeFile(join(context, 'Dockerfile'), dockerfile);
      await docker(['build', '--tag', name, context]);
      // A fresh Linux directory in the Docker daemon works on Linux and Docker Desktop.
      // Mount that directory as a bind: no Docker volume copy-up can hide permissions.
      await docker(['volume', 'create', name]);
      const source = await docker(['volume', 'inspect', name, '--format', '{{.Mountpoint}}']);
      const mount = 'type=bind,source=' + source + ',target=/pb/pb_data';
      assert.equal(await docker([
        'run', '--rm', '--user', '0:0', '--entrypoint', 'sh', '--mount', mount, name,
        '-c', 'chown 0:0 /pb/pb_data; chmod 0755 /pb/pb_data; stat -c "%u:%g %a" /pb/pb_data; ls -A /pb/pb_data'
      ]), '0:0 755', 'Mount must begin empty and root-owned');
      await docker(['run', '--detach', '--name', name, '--mount', mount, name]);
      assert.equal(JSON.parse(await docker(['inspect', name]))[0].Mounts[0].Type, 'bind');
      let state;
      for (let i = 0; i < 60; i++) {
        state = JSON.parse(await docker(['inspect', name, '--format', '{{json .State}}']));
        if (label === 'old' && !state.Running) break;
        if (label === 'new' && state.Running) {
          const health = await docker(['exec', name, 'wget', '-qO-', 'http://127.0.0.1:8090/api/health']).catch(() => '');
          if (health && JSON.parse(health).code === 200) break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (label === 'old') {
        assert.equal(state.Running, false);
        assert.notEqual(state.ExitCode, 0);
        const logs = await run('docker', ['logs', name]);
        assert.match(logs.stdout + logs.stderr, /unable to open database file \(14\)/);
      } else {
        assert.equal(state.Running, true);
        const health = JSON.parse(await docker(['exec', name, 'wget', '-qO-', 'http://127.0.0.1:8090/api/health']));
        assert.equal(health.code, 200);
        const status = await docker(['exec', name, 'cat', '/proc/1/status']);
        assert.match(status, /^Uid:\s+1000\s+1000\s+1000\s+1000$/m);
        assert.match(status, /^Gid:\s+1000\s+1000\s+1000\s+1000$/m);
        assert.equal(await docker(['exec', name, 'stat', '-c', '%u:%g', '/pb/pb_data']), '1000:1000');
        assert.equal(await docker(['exec', name, 'stat', '-c', '%u:%g', '/pb/pocketbase']), '0:0');
      }
    } finally {
      await docker(['rm', '--force', name]).catch(() => {});
      await docker(['volume', 'rm', name]).catch(() => {});
      await docker(['image', 'rm', name]).catch(() => {});
      await rm(context, { recursive: true, force: true });
    }
  });
}
