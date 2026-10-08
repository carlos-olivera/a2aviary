import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { normalizeImage } from '../dist/index.js';

test('JPEG/PNG/WebP inputs become deterministic, oriented, bounded WebP with metadata removed', async () => {
  const input = sharp({
    create: {
      width: 3200,
      height: 1000,
      channels: 4,
      background: { r: 20, g: 40, b: 60, alpha: 0.5 },
    },
  });
  for (const format of ['jpeg', 'png', 'webp']) {
    const bytes = await input
      .clone()
      [format]()
      .withMetadata({ orientation: 6 })
      .withExif({
        IFD0: { Artist: 'Fictional artist' },
        IFD2: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'W' },
      })
      .toBuffer();
    const one = await normalizeImage(bytes),
      two = await normalizeImage(bytes);
    assert.deepEqual(one, two);
    assert.equal(one.metadata.format, 'webp');
    assert.ok(one.metadata.width <= 2560 && one.metadata.height <= 2560);
    assert.ok(one.metadata.height > one.metadata.width);
    assert.ok(one.metadata.bytes <= 2 * 1024 * 1024);
    const meta = await sharp(one.bytes).metadata();
    if (format !== 'jpeg') assert.equal(meta.hasAlpha, true);
    for (const field of ['exif', 'icc', 'xmp', 'iptc', 'orientation'])
      assert.equal(meta[field], undefined);
  }
});
test('hostile/truncated/animated images, pixel limits and raw bytes fail without provider work', async () => {
  for (const input of [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    Buffer.from('https://example.invalid/image.png'),
    Buffer.from([255, 216, 255]),
    Buffer.alloc(20 * 1024 * 1024 + 1),
  ])
    await assert.rejects(normalizeImage(input));
  const huge = await sharp({
    create: { width: 8000, height: 6000, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  await assert.rejects(normalizeImage(huge));
  const apng = Buffer.from(
    '89504e470d0a1a0a000000086163544c0000000100000000deadbeef',
    'hex',
  );
  await assert.rejects(normalizeImage(apng), /image_animated/);
  const animation = Buffer.from(
    '524946461400000057454250414e494d06000000000000000000',
    'hex',
  );
  await assert.rejects(normalizeImage(animation), /image_animated/);
});
test('decoder timeout/crash are isolated and arbitrary stderr is redacted', async (t) => {
  const dir = await mkdtemp(tmpdir() + '/a2aviary-decoder-');
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(
    dir + '/hang.mjs',
    'process.stdin.resume();setInterval(()=>{},1000);',
  );
  await assert.rejects(
    normalizeImage(Buffer.from([0]), {
      timeoutMs: 50,
      worker: pathToFileURL(dir + '/hang.mjs'),
    }),
    /image_timeout/,
  );
  await writeFile(
    dir + '/crash.mjs',
    'process.stderr.write("PRIVATE-CREDENTIAL");process.exit(1);',
  );
  await assert.rejects(
    normalizeImage(Buffer.from([0]), {
      worker: pathToFileURL(dir + '/crash.mjs'),
    }),
    /image_decoder_failed/,
  );
});

test('the child inherits no credentials and forged output metadata is refused by the controller', async (t) => {
  const dir = await mkdtemp(tmpdir() + '/a2aviary-secret-free-');
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bytes = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#ffffff' },
    })
      .webp({ quality: 80 })
      .toBuffer(),
    { sha256 } = await import('../dist/index.js');
  const meta = {
    format: 'webp',
    bytes: bytes.length,
    width: 1,
    height: 1,
    sha256: sha256(bytes),
    normalizerVersion: '1.0.0',
  };
  const original = process.env.FICTIONAL_DECODER_CREDENTIAL;
  process.env.FICTIONAL_DECODER_CREDENTIAL = 'fictional-secret-do-not-inherit';
  t.after(() => {
    if (original === undefined) delete process.env.FICTIONAL_DECODER_CREDENTIAL;
    else process.env.FICTIONAL_DECODER_CREDENTIAL = original;
  });
  await writeFile(
    dir + '/safe.mjs',
    `if(Object.keys(process.env).some(key=>!['PATH','__CF_USER_TEXT_ENCODING'].includes(key)))process.exit(1);process.stdin.resume();process.stdout.write(${JSON.stringify(JSON.stringify(meta) + '\n')});process.stdout.write(Buffer.from('${bytes.toString('base64')}','base64'));`,
  );
  assert.deepEqual(
    (
      await normalizeImage(Buffer.from([0]), {
        worker: pathToFileURL(dir + '/safe.mjs'),
      })
    ).metadata,
    meta,
  );
  await writeFile(
    dir + '/forged.mjs',
    `process.stdin.resume();process.stdout.write(${JSON.stringify(JSON.stringify({ ...meta, sha256: '0'.repeat(64) }) + '\n')});process.stdout.write(Buffer.from('${bytes.toString('base64')}','base64'));`,
  );
  await assert.rejects(
    normalizeImage(Buffer.from([0]), {
      worker: pathToFileURL(dir + '/forged.mjs'),
    }),
    /image_decoder_failed/,
  );
});
