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
const pixelFile = resolve(out, 'examples/fictional-pixel.png');
// Original offline 1x1 PNG pixels. No client images or filesystem references.
const pixels = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNwSev4DwAEVgIy41TneAAAAABJRU5ErkJggg==', 'base64');
const asset = { id: 'fictional-pixel', format: 'png' as const, bytes: pixels.length, width: 1, height: 1, alt: 'Fictional demonstration pixel', sha256: sha256(pixels) };
const generated = generateContracts(defaultPolicy);
const examples = makeExamples(defaultPolicy, asset);
const context = { month: '2026-10', appliedRequests: 0, now: new Date('2026-10-06T12:00:00.000Z') };
for (const result of [validateSiteSpec(examples.spec), validateChangeRequest(examples.change, examples.spec, context), await validateAssets(examples.spec.assets, new Map([[asset.id, pixels]]))]) {
  if (!result.ok) throw new Error('Generated example is invalid: ' + JSON.stringify(result.errors));
}
const usage = {
  status: 'Contract and local validators only; no sale, checkout, hosting activation or visual-fidelity verification.',
  submission: 'Client understands intent, prepares copy/images, creates a catalog-expressible preview and obtains human approval before sending the spec and separate asset bytes.',
  validation: 'Validate JSON and references with validateSiteSpec; verify the complete supplied image bundle with validateAssets. Both must succeed. For changes, validateChangeRequest returns a candidate spec; verify its complete resulting asset bundle before accepting it.',
  text: 'Copy is literal data. Rich text uses typed nodes. Renderers must escape copy; no raw HTML, scripts, styles, prompts or free-text instructions are supported.',
  digest: 'Recursively sort object keys using JavaScript default string order, preserve array order and JSON scalar serialization, emit compact UTF-8 JSON, exclude only the top-level approval property, then SHA-256. No Unicode normalization. Preview, when present, is included. Not RFC 8785.',
  approval: 'approved=true plus a canonical UTC timestamp and matching result digest is a declaration, not authenticated proof. Authentication must later bind the approving human.',
  previews: 'Optional artifactId/sha256 only; never fetched or executed. Previews must use this component catalog and tokens. Contract validation cannot prove visual identity.',
  changes: 'Typed operations target stable IDs. A block ID is edited at most once. New pages are complete and cannot be edited again in the same request. Section containers persist. New assets use new IDs; an updated block references the new ID. Historical assets cannot be overwritten or removed in v1.',
  accounting: 'All blocks in add-page count; SEO counts one distinct page; token/navigation/footer edits use the separate global cap. Successful applied requests count once in the trusted UTC-month ledger. Validation performs no reservation, persistence or idempotency. CMS content edits use a later separate CMS path.',
  versions: 'Use the exact pinned policy version; no latest-version fallback. effectiveDate does not activate a plan or migrate clients.'
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
