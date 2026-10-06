import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import {
  generateSite,
  renderPage,
  specDigest,
  canonicalJson,
  sha256
} from '../dist/index.js';
export async function fixtureSubmission() {
  const spec = JSON.parse(
    await readFile(
      new URL(
        '../../../contracts/site/v1/examples/site-spec.json',
        import.meta.url
      ),
      'utf8'
    )
  );
  const bytes = await readFile(
    new URL(
      '../../../contracts/site/v1/examples/fictional-pixel.png',
      import.meta.url
    )
  );
  return bindPreview(spec, { [spec.assets[0].id]: bytes.toString('base64') });
}
export async function bindPreview(spec, assetBytes) {
  delete spec.preview;
  spec.approval.specSha256 = specDigest(spec);
  const assets = new Map(
      Object.entries(assetBytes).map(([id, b64]) => [
        id,
        Buffer.from(b64, 'base64')
      ])
    ),
    source = await generateSite(spec, assets),
    preview = { files: {} };
  for (const page of spec.pages)
    preview.files[
      page.path === '/' ? 'index.html' : page.path.slice(1) + 'index.html'
    ] = Buffer.from(renderPage(spec, page.id)).toString('base64');
  preview.files['catalog.css'] = Buffer.from(
    source.files['public/catalog.css']
  ).toString('base64');
  for (const [path, b64] of Object.entries(source.binaryFiles))
    preview.files[path.slice('public/'.length)] = b64;
  spec.preview = {
    artifactId: 'fictional-approved-catalog-preview',
    sha256: sha256(canonicalJson(preview))
  };
  spec.approval.specSha256 = specDigest(spec);
  return { slug: 'fictional-guide', spec, assets: assetBytes, preview };
}
export async function writeSource(directory, source, spec, preview) {
  for (const [path, text] of Object.entries(source.files)) {
    const file = join(directory, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
  }
  for (const [path, b64] of Object.entries(source.binaryFiles)) {
    const file = join(directory, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(b64, 'base64'));
  }
  for (const [path, b64] of Object.entries(preview.files)) {
    const file = join(directory, 'approved-preview', path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(b64, 'base64'));
  }
  await writeFile(
    join(directory, 'verification-input.json'),
    canonicalJson({
      paths: spec.pages.map((p) => p.path),
      sourceSha256: source.sourceSha256,
      specSha256: source.specSha256
    })
  );
}
