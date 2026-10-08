// Integrate finalized Archify drawings; no package/viewer source is vendored.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprints } from './architecture-fingerprint.mjs';
import { publicNavigation } from '../src/site-navigation.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFile(resolve(root, path), 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const manifest = JSON.parse(await read('docs/architecture/stages.json'));
const overview = JSON.parse(await read('docs/architecture/map.json'));
const coverage = JSON.parse(await read('docs/architecture/coverage.json'));
const records = {};
const assetSha256 = Object.fromEntries(await Promise.all(['architecture.css','architecture.js'].map(async name=>[name,digest(await read('website/public/'+name))])));
async function drawing(model, candidatePath, namespace, macro = false) {
  const input = process.argv[2] ? resolve(process.argv[2], basename(model.meta.output)) : resolve(root, model.meta.output);
  const raw = await readFile(input, 'utf8');
  const receipt = JSON.parse(await readFile(input.replace(/\.html$/, '.finalize-summary.json'), 'utf8'));
  if (!receipt.ok || ['validate','deliver','check','browser-check'].some(gate => receipt.gates[gate] !== 'pass')) throw new Error('Archify finalize must pass for ' + namespace);
  const candidateSha256 = digest(await read(candidatePath));
  if (receipt.artifact.sha256 !== digest(raw) || receipt.specification.sha256 !== candidateSha256) throw new Error('Artifact/candidate differs from its passing receipt');
  if (model.meta.repository.revision !== manifest.sourceRevision) throw new Error('Mixed source revisions');
  let svg = raw.match(/<svg\b[\s\S]*?<\/svg>/)?.[0]; if (!svg) throw new Error('Drawing missing');
  svg = svg.replace('role="img"', 'role="group"').replace(/ style="[^"]*"/g, '').replace(/ tabindex="0"| role="button"| aria-pressed="false"/g, '');
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  for (const id of ids) {
    svg = svg.replaceAll(` id="${id}"`, ` id="${namespace}-${id}"`).replaceAll(`url(#${id})`, `url(#${namespace}-${id})`);
  }
  svg = svg.replace(/aria-labelledby="([^"]+)"/g, (_, value) => `aria-labelledby="${value.split(' ').map(id => namespace+'-'+id).join(' ')}"`);
  for (const node of model.components) {
    const attributes = macro ? ` data-stage-trigger="${escape(node.id)}" aria-controls="stage-panel"` : ` data-local-mode="${escape(coverage[node.id].mode)}" data-status="${escape(coverage[node.id].status)}" aria-controls="detail-${escape(node.id)}"`;
    svg = svg.replace(`data-node-id="${node.id}"`, `data-node-id="${node.id}"${attributes}`);
  }
  records[namespace] = { candidatePath, candidateSha256, rawArtifactSha256: digest(raw), generatedDrawingSha256: digest(svg), gates: receipt.gates };
  return svg;
}
const sourceLinks = node => node.sources.map(source => `<a href="https://github.com/carlos-olivera/a2aviary/blob/main/${escape(source.path)}${source.line?'#L'+source.line:''}">${escape(source.path)}</a>`).join(' · ');
const overviewSvg = await drawing(overview, 'docs/architecture/map.json', 'overview', true);
const panels = [];
for (const stage of manifest.stages) {
  const model = JSON.parse(await read(stage.diagram));
  if (JSON.stringify(stage.nodes) !== JSON.stringify(model.components.map(node => node.id))) throw new Error('Stage membership differs from diagram');
  const svg = await drawing(model, stage.diagram, stage.id);
  const evidence = model.components.map(node => {
    const info = coverage[node.id];
    return `<details id="detail-${escape(node.id)}" data-component="${escape(node.id)}"><summary>${escape(node.label)} <span class="badge">${escape(info.status)}</span></summary><p class="coverage-label">Local coverage: ${escape(info.mode)}</p><p>${escape(info.note)}</p>${info.targetStage?`<p><button type="button" data-stage-trigger="${escape(info.targetStage)}" disabled>Explore the next stage →</button></p>`:''}<p>${sourceLinks(node)}</p></details>`;
  }).join('\n');
  panels.push({ ...stage, content: `<div class="stage-content" data-active-stage="${stage.id}"><h2 id="stage-title-${stage.id}" tabindex="-1">${manifest.stages.indexOf(stage)+1}. ${escape(stage.title)}</h2><p class="stage-summary">${escape(stage.summary)}</p>${stage.id==='hosting'?'<p class="status-note"><strong>Catalog websites: implementation ready for review.</strong> No registered client sites. The hosted tester attempt stopped at upload failure; verification and deployment remain blocked.</p>':''}<div class="diagram-region" role="region" aria-label="${escape(stage.title)} technical diagram" tabindex="0">${svg}</div><p class="stage-sources">Stage sources: ${sourceLinks(overview.components.find(node=>node.id===stage.id))}</p><h3>Nodes and source evidence</h3><div class="node-list">${evidence}</div></div>` });
}
const revision = manifest.sourceRevision;
const html = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0B1220">
<title>Architecture | a2aviary</title>
<meta name="description" content="Explore five stages of a2aviary, from server drafts to verified previews, browser approval, hosting, CMS and governance, with focused source-backed details.">
<link rel="canonical" href="https://a2aviary.io/architecture">
<meta property="og:type" content="website"><meta property="og:title" content="Architecture | a2aviary"><meta property="og:description" content="Five stages, focused technical details and explicit deployment and local-verification boundaries."><meta property="og:url" content="https://a2aviary.io/architecture"><meta property="og:image" content="https://a2aviary.io/social-preview.png"><meta property="og:site_name" content="a2aviary">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/architecture.css?v=${assetSha256['architecture.css'].slice(0,16)}"><script src="/architecture.js?v=${assetSha256['architecture.js'].slice(0,16)}" defer></script>
</head><body>
<a class="skip-link" href="#content">Skip to content</a><div class="page">
<header><a class="brand" href="/" aria-label="a2aviary homepage"><img src="/brand/a2aviary-logo-inverse.svg" width="1923" height="456" alt="a2aviary"></a><nav aria-label="Project resources"><a href="/costs">What it costs</a><a href="/architecture" aria-current="page">Architecture</a></nav></header>
<main id="content" tabindex="-1"><p class="eyebrow">Source-backed · owner controlled</p><h1>Architecture</h1><p class="intro">From incremental draft content and uploads to verified previews, browser approval and site operations. Start with five stages; open one to explore its implementation.</p>
<p class="status-note"><strong>Catalog websites: implementation ready for review.</strong> No registered client sites. The hosted tester attempt stopped at upload failure; verification and deployment remain blocked.</p>
<section aria-labelledby="overview-title"><h2 id="overview-title">The system at a glance</h2><p id="map-help">Select a stage in the map or the cards below. Only its technical diagram and source evidence will open.</p>
<div class="diagram-region overview" role="region" aria-label="Five-stage architecture overview" aria-describedby="map-help" tabindex="0">${overviewSvg}</div>
<div class="stage-tabs" role="tablist" aria-label="Architecture stages">${manifest.stages.map((stage,index)=>`<button type="button" role="tab" id="tab-${stage.id}" data-stage-tab="${stage.id}" aria-controls="stage-panel" aria-selected="false" tabindex="${index===0?'0':'-1'}" disabled><span class="stage-number">0${index+1}</span><strong>${escape(stage.title)}</strong><span>${escape(stage.summary)}</span></button>`).join('\n')}</div></section>
<p class="sr-only" id="stage-announcement" role="status" aria-live="polite"></p>
<section id="stage-panel" role="tabpanel" hidden><div class="panel-controls"><button type="button" id="back-overview">← Back to overview</button><label><input type="checkbox" id="local-toggle"> Highlight LocalStack coverage</label></div><div id="stage-body"></div></section>
${panels.map(stage=>`<template id="template-${stage.id}" data-stage-template="${stage.id}">${stage.content}</template>`).join('\n')}
<noscript><section aria-label="Stage details without JavaScript"><h2>Explore a stage</h2>${panels.map(stage=>`<details class="fallback-stage"><summary>${escape(stage.title)}</summary>${stage.content}</details>`).join('\n')}</section></noscript>
<details class="local-setup" id="local-setup"><summary>Run the same foundation locally</summary><p>With Docker and Node.js 22, run <code>npm --prefix infra run local:quickstart</code>. The LocalStack environment runs the AWS signed-email foundation and serves the normal project website build.</p><p>The auth/MCP platform, Astro generator and PocketBase/Caddy have <strong>separate local tooling</strong>; they are not started by this LocalStack quickstart. See <a href="https://github.com/carlos-olivera/a2aviary/blob/main/docs/platform.md">platform setup</a> and <a href="https://github.com/carlos-olivera/a2aviary/blob/main/docs/sites.md">site/CMS checks</a>.</p>
<ul class="legend"><li><strong>Local emulation</strong> — shared AWS resources/workers</li><li><strong>Mock</strong> — fixed external-service responses</li><li><strong>Adapter</strong> — explicit protocol boundary</li><li><strong>Separate local tooling</strong> — not in this quickstart</li><li><strong>Cloud-only</strong> — skipped by this local setup</li><li><strong>Planned</strong> — future customer products</li></ul>
<p>CloudFront, public DNS/TLS, production OIDC, provider hosting, AWS billing budgets, real mailbox delivery and owner notifications are cloud-only here. A local pass does not establish production delivery or IAM enforcement. TTL/lifecycle expiration is asynchronous; billing notifications are not hard spending caps.</p><p><a href="https://github.com/carlos-olivera/a2aviary/blob/main/docs/local-development.md">Quickstart, cleanup, coverage and troubleshooting →</a></p></details>
<p class="map-credit">Generated with <a href="https://github.com/tt-a1i/archify">Archify 3.0.1</a> (<a href="/licenses/archify-MIT.txt">MIT</a>). <a href="https://github.com/carlos-olivera/a2aviary/tree/${revision}">Pinned source ${revision.slice(0,8)}</a>; node links target main. <a href="https://github.com/carlos-olivera/a2aviary/blob/main/docs/release-verification.md">Release evidence</a>. This page is prepared for review and release.</p>
</main><footer>${publicNavigation()}<p>Created by Carlos Olivera Terrazas. <a href="https://github.com/carlos-olivera/a2aviary/blob/main/LICENSE">Apache 2.0 source</a>. Open source. Building in public.</p></footer></div></body></html>\n`;
await writeFile(resolve(root, 'website/architecture/index.html'), html);
await writeFile(resolve(root, 'docs/architecture/provenance.json'), JSON.stringify({schemaVersion:2,generator:'Archify',version:'3.0.1',sourceRevision:revision,manifestSha256:digest(await read('docs/architecture/stages.json')),coverageSha256:digest(await read('docs/architecture/coverage.json')),diagrams:records,integratedPageSha256:digest(html),assetSha256,sourceFingerprints:await sourceFingerprints()}, null, 2)+'\n');
console.log('Integrated five-stage overview and scoped templates from six passing Archify drawings.');
