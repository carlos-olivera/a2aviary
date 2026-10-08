// A disposable decoder process. No controller credentials or inherited sockets.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
sharp.cache(false);
sharp.concurrency(1);
let chunks = [],
  size = 0;
try {
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 20 * 1024 * 1024) throw Error('raw_image_bytes');
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks);
  chunks = [];
  const magic = input
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? 'png'
    : input[0] === 255 && input[1] === 216 && input[2] === 255
      ? 'jpeg'
      : input.toString('ascii', 0, 4) === 'RIFF' &&
          input.toString('ascii', 8, 12) === 'WEBP'
        ? 'webp'
        : null;
  if (!magic) throw Error('image_format');
  // Detect APNG and WebP animation independently of the decoder's first-frame view.
  if (magic === 'png')
    for (let o = 8; o + 12 <= input.length;) {
      const n = input.readUInt32BE(o),
        k = input.toString('ascii', o + 4, o + 8);
      if (['acTL', 'fcTL', 'fdAT'].includes(k)) throw Error('image_animated');
      if (o + n + 12 > input.length) throw Error('image_decode');
      o += n + 12;
    }
  if (magic === 'webp')
    for (let o = 12; o + 8 <= input.length;) {
      const n = input.readUInt32LE(o + 4),
        k = input.toString('ascii', o, o + 4);
      if (
        k === 'ANIM' ||
        k === 'ANMF' ||
        (k === 'VP8X' && n && input[o + 8] & 2)
      )
        throw Error('image_animated');
      if (o + n + 8 > input.length) throw Error('image_decode');
      o += 8 + n + (n % 2);
    }
  const options = { limitInputPixels: 40000000, failOn: 'warning' };
  const meta = await sharp(input, options).metadata();
  if (meta.format !== magic || (meta.pages ?? 1) !== 1)
    throw Error('image_animated');
  if (
    !meta.width ||
    !meta.height ||
    meta.width > 12000 ||
    meta.height > 12000 ||
    meta.width * meta.height > 40000000
  )
    throw Error('image_pixels');
  // Full decoding before accepting any output; output methods strip EXIF/ICC/XMP/IPTC.
  await sharp(input, options).raw().toBuffer();
  let result;
  for (const edge of [2560, 2048, 1536, 1024]) {
    for (const quality of [80, 70, 60]) {
      const { data, info } = await sharp(input, options)
        .rotate()
        .resize({
          width: edge,
          height: edge,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      if (data.length <= 2 * 1024 * 1024) {
        result = {
          bytes: data,
          metadata: {
            format: 'webp',
            bytes: data.length,
            width: info.width,
            height: info.height,
            sha256: createHash('sha256').update(data).digest('hex'),
            normalizerVersion: '1.0.0',
          },
        };
        break;
      }
    }
    if (result) break;
  }
  if (!result) throw Error('normalized_image_bytes');
  process.stdout.write(JSON.stringify(result.metadata) + '\n');
  process.stdout.write(result.bytes);
} catch (error) {
  const safe = new Set([
    'raw_image_bytes',
    'image_format',
    'image_animated',
    'image_pixels',
    'normalized_image_bytes',
    'image_decode',
  ]);
  process.stderr.write(
    safe.has(error.message) ? error.message : 'image_decode',
  );
  process.exitCode = 1;
}
