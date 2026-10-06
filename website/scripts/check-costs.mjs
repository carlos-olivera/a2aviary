import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCosts, formatUsd } from '../src/costs-page.js';

const data = JSON.parse(await readFile(new URL('../public/costs.json', import.meta.url), 'utf8'));
const html = renderCosts(data);
assert.equal((html.match(/<tr id=/g) ?? []).length, data.items.length, 'Every JSON item gets a row');
assert(!/<script\b|<style\b|\sstyle=|\son\w+=/i.test(html), 'No script, inline style, or handler');
assert.equal(formatUsd(0), '$0.00');
assert.equal(formatUsd(0.001998), '$0.001998', 'Small usage amounts retain precision');
assert.equal(formatUsd(72.02903), '$72.02903', 'Supplied total is not rounded or recomputed');

// Fictional content exercises the data boundary, rather than documentation wording.
const fixture = structuredClone(data);
fixture.items = [
  { id: 'unknown', name: '<img src=x onerror=alert(1)>', provider: 'A & B', kind: 'usage', period: 'one-time', amountUsd: null, status: 'to-confirm', source: '<script>alert(1)</script>', note: '"quoted" <note>' },
  { id: 'range', name: 'Range', provider: 'Fictional', kind: 'usage', period: 'month', amountUsd: null, amountUsdMin: 0.2, amountUsdMax: 3.6, status: 'estimated', source: 'docs/costs.md; https://example.com/prices?a=1&b=2' },
  { id: 'zero', name: 'Free', provider: 'Fictional', kind: 'monthly', period: 'month', amountUsd: 0, status: 'confirmed', source: 'Fictional evidence' },
];
fixture.totals.spentToDateExcludes = ['unknown'];
const rendered = renderCosts(fixture);
assert(rendered.includes('&lt;img src=x onerror=alert(1)&gt;') && !rendered.includes('<img src=x'), 'Names are escaped');
assert(rendered.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !rendered.includes('<script>'), 'Sources are escaped');
assert(rendered.includes('&quot;quoted&quot; &lt;note&gt;') && rendered.includes('A &amp; B'), 'Notes and providers are escaped');
assert(rendered.includes('Not yet known / no dollar figure recorded'), 'Unknown dollars stay unknown');
assert(rendered.includes('$0.20–$3.60') && rendered.includes('$0.00'), 'Ranges and confirmed zero remain distinct');
assert(rendered.includes('href="https://github.com/carlos-olivera/a2aviary/blob/main/docs/costs.md"'), 'Repository source links');
assert(rendered.includes('href="https://example.com/prices?a=1&amp;b=2"'), 'Provider URL attributes are escaped');
assert(rendered.includes('href="#unknown"'), 'Exclusions link to evidence rows');
const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), ['https://a2aviary.io/', 'https://a2aviary.io/costs', 'https://a2aviary.io/terms', 'https://a2aviary.io/privacy', 'https://a2aviary.io/refunds', 'https://a2aviary.io/pricing', 'https://a2aviary.io/architecture']);
assert(!sitemap.includes('<lastmod>'), 'No invented modification dates');
console.log('Costs JSON, rendering, precision, escaping, source links, and sitemap verified.');
