import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defaultPolicy, sha256 } from '../../src/site/policy.ts';
import { artifactDirectory, assertPolicySnapshot, flattenRules, generateContracts } from '../../src/site/generator.ts';
import { makeExamples } from '../../src/site/examples.ts';
import { validateAssets, validateChangeRequest, validateSiteSpec } from '../../src/site/validator.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const out = resolve(root, 'contracts/site', artifactDirectory(defaultPolicy));
const check = process.argv.includes('--check');
const snapshotFile = resolve(root, 'plans/versions', defaultPolicy.planId.value, defaultPolicy.version.value + '.policy.json');
let snapshot: string | undefined;
try { snapshot = await readFile(snapshotFile, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
if (snapshot !== undefined) assertPolicySnapshot(defaultPolicy, JSON.parse(snapshot));
if (check && snapshot === undefined) throw new Error('Missing policy snapshot; run site:generate.');
const pixelFile = resolve(out, 'examples/fictional-pixel.webp');
// Original offline 1x1 PNG pixels. No client images or filesystem references.
const rawPixels = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNwSev4DwAEVgIy41TneAAAAABJRU5ErkJggg==', 'base64');
const {default:sharp}=await import('sharp');
const pixels=await sharp(rawPixels).webp({quality:80,effort:4}).toBuffer();
const asset = { id: 'fictional-pixel', format: 'webp' as const, bytes: pixels.length, width: 1, height: 1, alt: 'Fictional demonstration pixel', sha256: sha256(pixels) };
const generated = generateContracts(defaultPolicy);
const examples = makeExamples(defaultPolicy, asset);
const context = { month: '2026-10', appliedRequests: 0, now: new Date('2026-10-06T12:00:00.000Z') };
for (const result of [validateSiteSpec(examples.spec), await validateAssets(examples.spec.assets, new Map([[asset.id, pixels]]))]) {
  if (!result.ok) throw new Error('Generated example is invalid: ' + JSON.stringify(result.errors));
}
const usage = {
 status: 'Prepared source only. Nothing is for sale; no live checkout or active Paddle merchant of record.',
 submission: 'Build a server draft incrementally through MCP. Upload bytes out of band through one agent/human upload session. Only server-normalized assets enter the spec.',
 digest: 'Hash compact UTF-8 JSON with recursively sorted object keys and preserved array order. Include the entire canonical spec. No Unicode normalization.',
 approval: 'A verified owner or enabled site administrator approves a verified server snapshot through the browser. Approval binds the spec and output hashes and draft revision. No MCP approval.',
 previews: 'Server-generated, sandbox-verified artifact and screenshots; deployment uses these exact bytes without rebuilding.',
 changes: 'change_requests_unavailable. CMS content edits remain available directly through PocketBase.',
 versions: 'Policy 2.0.0 and site contract 2.0 replace intake. Historical policies are frozen, retired artifacts.'
};
const rules = flattenRules(defaultPolicy);
const manifest = { ...generated.provenance, planId: defaultPolicy.planId.value, usage, includes: defaultPolicy.includes, firstVersion: defaultPolicy.firstVersion, changes: defaultPolicy.changes, schemas: { site: 'site-spec.schema.json', change: 'change-request.schema.json' }, examples: { spec: examples.spec, change: examples.change } };
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const markdown = `# web-simple client manifest\n\nPolicy ${generated.provenance.policyVersion}; SHA-256 ${generated.provenance.policySha256}.\n\n${Object.values(usage).join('\n\n')}\n\n## Limits and rationale\n\n| Policy rule | Value | Rationale |\n| --- | --- | --- |\n${rules.map(r => `| \`${r.path}\` | \`${JSON.stringify(r.value)}\` | ${r.rationale} |`).join('\n')}\n\n## Components\n\n${Object.entries(defaultPolicy.firstVersion.components).map(([name, c]) => `- **${name}**: variants ${c.variants.value.join(', ')}; ${Object.entries(c.fields).map(([key, f]) => `${key}: ${f.kind}${f.required ? ' (required)' : ' (optional)'}`).join('; ')}.`).join('\n')}\n\n## Examples\n\nAll content and pixels are fictional. No links are fetched.\n\nSite spec:\n\n\`\`\`json\n${json(examples.spec)}\`\`\`\n\nChange request:\n\n\`\`\`json\n${json(examples.change)}\`\`\`\n`;
const files = new Map<string, string | Uint8Array>([
  [resolve(out, 'site-spec.schema.json'), json(generated.siteSchema)], [resolve(out, 'change-request.schema.json'), json(generated.changeSchema)],
  [resolve(out, 'manifest.json'), json(manifest)], [resolve(out, 'manifest.md'), markdown],
  [resolve(out, 'examples/site-spec.json'), json(examples.spec)], [resolve(out, 'examples/change-request.json'), json(examples.change)], [pixelFile, pixels]
]);
for (const [path, content] of files) {
  const expected = Buffer.from(content);
  if (check) {
    let actual: Buffer;
    try { actual = await readFile(path); } catch { throw new Error('Missing generated artifact: ' + path); }
    if (!actual.equals(expected)) throw new Error('Stale generated artifact: ' + path + '; run npm run site:generate in services.');
  } else { await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, expected); }
}
if (!check && snapshot === undefined) {
  await mkdir(resolve(snapshotFile, '..'), { recursive: true });
  await writeFile(snapshotFile, json(defaultPolicy), { flag: 'wx' });
}
console.log(check ? 'Site contract artifacts match policy.' : 'Generated site contract artifacts and fictional examples.');
