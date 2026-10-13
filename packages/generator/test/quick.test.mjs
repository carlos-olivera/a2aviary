import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { quickRender } from '../dist/index.js';

test('quick renderer bounds time, input/output, child failure and credential inheritance', async (t) => {
  const dir = await mkdtemp(tmpdir() + '/a2aviary-quick-');
  t.after(() => rm(dir, { recursive: true, force: true }));
  const worker = async (name, code) => {
    await writeFile(dir + '/' + name + '.mjs', code);
    return pathToFileURL(dir + '/' + name + '.mjs');
  };
  await assert.rejects(
    quickRender({}, new Map([['huge', Buffer.alloc(28 * 1024 * 1024)]]), false),
    /quick_input_size/,
  );
  await assert.rejects(
    quickRender({}, new Map(), false, {
      worker: await worker(
        'hang',
        'process.stdin.resume();setInterval(()=>{},1000)',
      ),
      timeoutMs: 100,
    }),
    /quick_timeout/,
  );
  await assert.rejects(
    quickRender({}, new Map(), false, {
      worker: await worker(
        'large',
        "process.stdin.resume();process.stdout.write('x'.repeat(41*1024*1024))",
      ),
    }),
    /quick_output_size/,
  );
  await assert.rejects(
    quickRender({}, new Map(), false, {
      worker: await worker('fail', 'process.exit(1)'),
    }),
    /quick_render_failed/,
  );
  await assert.rejects(
    quickRender({}, new Map(), false, {
      worker: await worker(
        'verified',
        `process.stdin.resume();process.stdout.write('{"verified":true,"files":{}}')`,
      ),
    }),
    /quick_render_failed/,
  );
  process.env.FICTIONAL_QUICK_SECRET = 'fictional';
  t.after(() => delete process.env.FICTIONAL_QUICK_SECRET);
  const result = await quickRender({}, new Map(), false, {
    worker: await worker(
      'safe',
      `if(Object.keys(process.env).some(k=>!['PATH','__CF_USER_TEXT_ENCODING'].includes(k)))process.exit(1);process.stdin.resume();process.stdout.write('{"verified":false,"files":{}}')`,
    ),
  });
  assert.equal(result.verified, false);
});
