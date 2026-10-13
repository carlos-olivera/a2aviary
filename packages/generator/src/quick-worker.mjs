import {
  renderQuickSite,
  QUICK_INPUT_BYTES,
  QUICK_OUTPUT_BYTES,
} from './index.js';
try {
  let size = 0;
  const chunks = [];
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > QUICK_INPUT_BYTES) throw Error();
    chunks.push(chunk);
  }
  const { spec, assets, test } = JSON.parse(Buffer.concat(chunks).toString());
  const result = await renderQuickSite(
    spec,
    new Map(
      Object.entries(assets).map(([id, b]) => [id, Buffer.from(b, 'base64')]),
    ),
    test === true,
  );
  const output = JSON.stringify(result);
  if (Buffer.byteLength(output) > QUICK_OUTPUT_BYTES) throw Error();
  process.stdout.write(output);
} catch {
  process.exitCode = 1;
}
