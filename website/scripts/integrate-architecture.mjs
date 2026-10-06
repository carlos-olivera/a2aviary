// Integrate generated drawing, not the Archify package or viewer source.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { sourceFingerprints } from './architecture-fingerprint.mjs';
import { publicNavigation } from '../src/site-navigation.js';
const root=resolve(new URL('../../',import.meta.url).pathname);
const input=resolve(process.argv[2]??'.local/architecture/raw.html');
const raw=await readFile(input,'utf8');
const receipt=JSON.parse(await readFile(input.replace(/\.html$/,'.finalize-summary.json'),'utf8'));
if(!receipt.ok || Object.values(receipt.gates).some(value=>value!=='pass')) throw new Error('Archify finalize must pass before integration');
const digest=value=>createHash('sha256').update(value).digest('hex');
if(receipt.artifact.sha256!==digest(raw)) throw new Error('Generated artifact does not match its passing receipt');
const model=JSON.parse(await readFile(resolve(root,'docs/architecture/map.json'),'utf8'));
const coverage=JSON.parse(await readFile(resolve(root,'docs/architecture/coverage.json'),'utf8'));
if(receipt.specification.sha256!==digest(await readFile(resolve(root,'docs/architecture/map.json')))) throw new Error('Candidate differs from finalized source');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let svg=raw.match(/<svg\b[\s\S]*?<\/svg>/)?.[0]; if(!svg)throw new Error('Generated drawing missing');
svg=svg.replace(/ style="[^"]*"/g,'').replace(/ tabindex="0"| role="button"| aria-pressed="false"/g,'');
for(const node of model.components) {
  const mode=coverage[node.id]?.mode; if(!mode)throw new Error('Local coverage missing');
  svg=svg.replace(`id="node-${node.id}"`, `id="node-${node.id}" data-local-mode="${escape(mode)}" aria-controls="detail-${node.id}"`);
}
const details=model.components.map(node=>`<details id="detail-${escape(node.id)}" data-component="${escape(node.id)}"><summary>${escape(node.label)} <span class="badge">${escape(coverage[node.id].mode)}</span></summary><p>${escape(coverage[node.id].note)}</p><p>${node.sources.map(source=>`<a href="https://github.com/carlos-olivera/a2aviary/blob/main/${escape(source.path)}${source.line?'#L'+source.line:''}">${escape(source.path)}</a>`).join(' · ')}</p></details>`).join('\n');
const revision=model.meta.repository.revision;
const html=`<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0B1220">
<title>Architecture | a2aviary</title>
<meta name="description" content="Explore the source-backed a2aviary architecture, signed-email foundation, Operator workflow, planned capabilities and local verification coverage.">
<link rel="canonical" href="https://a2aviary.io/architecture">
<meta property="og:type" content="website"><meta property="og:title" content="Architecture | a2aviary"><meta property="og:description" content="Implemented foundations, planned capabilities and local verification boundaries."><meta property="og:url" content="https://a2aviary.io/architecture"><meta property="og:image" content="https://a2aviary.io/social-preview.png"><meta property="og:site_name" content="a2aviary">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/architecture.css"><script src="/architecture.js" defer></script>
</head><body>
<a class="skip-link" href="#content">Skip to content</a>
<div class="page"><header><a class="brand" href="/" aria-label="a2aviary homepage"><img src="/brand/a2aviary-logo-inverse.svg" width="1923" height="456" alt="a2aviary"></a><nav aria-label="Project resources"><a href="/costs">What it costs</a><a href="/architecture" aria-current="page">Architecture</a></nav></header>
<main id="content" tabindex="-1"><p class="eyebrow">Source-backed · open source · owner controlled</p><h1>Architecture</h1>
<p class="intro">Explore the project landing, signed-email brief analysis and Operator contribution workflow. Customer website production and checkout remain planned.</p>
<p class="evidence">Prepared for owner review and release. Source evidence: <a href="https://github.com/carlos-olivera/a2aviary/tree/${revision}">${revision.slice(0,8)}</a>. Nodes link to <code>main</code>; newly added files appear there after merge. <a href="https://github.com/carlos-olivera/a2aviary/blob/main/docs/release-verification.md">Release evidence</a> distinguishes configured, deployed, verified and blocked behavior.</p>
<section aria-labelledby="map-title"><h2 id="map-title">Explore the map</h2>
<div class="controls"><div role="group" aria-label="Architecture views"><button data-view="all" aria-pressed="true" disabled>Overview</button><button data-view="website" aria-pressed="false" disabled>Public website</button><button data-view="email" aria-pressed="false" disabled>Signed email</button><button data-view="operator" aria-pressed="false" disabled>Operator / GitHub</button><button data-view="planned" aria-pressed="false" disabled>Planned</button></div><label><input type="checkbox" id="local-toggle" disabled> Highlight local coverage</label></div>
<ul class="legend"><li><strong>Local emulation</strong> — shared resources/workers</li><li><strong>Mock</strong> — fixed local external-service responses</li><li><strong>Adapter</strong> — explicit protocol boundary</li><li><strong>Cloud-only</strong> — skipped locally</li><li><strong>Planned</strong> — unimplemented; dashed outline</li></ul>
<p id="map-help">Select a node to open its sourced details, or use the node list below. On small screens, scroll inside the map. Local highlighting retains cloud context.</p>
<div class="canvas" role="region" aria-label="Interactive architecture drawing" aria-describedby="map-help" tabindex="0">${svg}</div>
<p class="map-credit">Drawing generated with <a href="https://github.com/tt-a1i/archify">Archify 3.0.1</a> (<a href="/licenses/archify-MIT.txt">MIT</a>). Geometry and source references passed Archify showcase gates; site integration is verified separately.</p></section>
<section aria-labelledby="details-title"><h2 id="details-title">Nodes and source evidence</h2><div class="node-list">${details}</div></section>
<section class="notes" aria-labelledby="local-title"><h2 id="local-title">Run the same foundation locally</h2><p>With Docker and Node.js 22, run <code>npm --prefix infra run local:quickstart</code>. The normal website build, queued workers and durable state run locally. OpenAI/GitHub use safe stand-ins; SES receipt and reply protocols use named adapters.</p><p><a href="https://github.com/carlos-olivera/a2aviary/blob/main/docs/local-development.md">Local development, coverage and troubleshooting →</a></p><p>CloudFront, public DNS/TLS, production OIDC/API hosting, AWS billing budgets, real mailbox delivery and owner notifications are cloud-only. A local pass does not establish production delivery or IAM enforcement.</p><p>Retention is configured for 7 / 30 / 90 days by content/state/log type, with 14-day dead letters. Lifecycle/TTL deletion is asynchronous. Application allowance is $1/task against $10/month; the $8 model warning and $15 AWS notification budget are controls, not hard provider billing caps. See each node for source and limitations.</p></section>
</main><footer>${publicNavigation()}<p>Created by Carlos Olivera Terrazas. <a href="https://github.com/carlos-olivera/a2aviary/blob/main/LICENSE">Apache 2.0 source</a>. Open source. Building in public.</p></footer></div>
</body></html>\n`;
await mkdir(resolve(root,'website/architecture'),{recursive:true});await writeFile(resolve(root,'website/architecture/index.html'),html);
await writeFile(resolve(root,'docs/architecture/provenance.json'),JSON.stringify({generator:'Archify',version:'3.0.1',sourceRevision:revision,candidateSha256:digest(await readFile(resolve(root,'docs/architecture/map.json'))),rawArtifactSha256:digest(raw),generatedDrawingSha256:digest(svg),integratedPageSha256:digest(html),gates:receipt.gates,sourceFingerprints:await sourceFingerprints()},null,2)+'\n');
console.log('Integrated passing Archify drawing, site controls, source links and source fingerprints.');
