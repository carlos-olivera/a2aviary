import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicPages } from '../src/site-navigation.js';
import { renderPolicyPage } from '../src/policy-pages.js';
import { renderCosts } from '../src/costs-page.js';
import { websiteContentType } from '../../services/scripts/website-content-type.mjs';

const root = new URL('../', import.meta.url);
const documents = new Map([
  ['/', await readFile(new URL('index.html', root), 'utf8')],
  ['/costs', renderCosts(JSON.parse(await readFile(new URL('public/costs.json', root), 'utf8')))],
  ...publicPages.map(path => ['/' + path, renderPolicyPage(path)]),
]);
const sitemap = await readFile(new URL('public/sitemap.xml', root), 'utf8');
assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), [...documents.keys()].map(path => 'https://a2aviary.io' + path));
for (const [path, html] of documents) {
  for (const target of publicPages.map(path => '/' + path).concat('/#contact')) assert(html.includes(`href="${target}"`), `${path}: public navigation`);
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (!href.startsWith('/') && !href.startsWith('#')) continue;
    const url = new URL(href, 'https://a2aviary.io' + path);
    const target = documents.get(url.pathname);
    if (target) {
      if (url.hash) assert(target.includes(`id="${url.hash.slice(1)}"`), `${path}: anchor ${href}`);
    } else assert((await readFile(new URL('public' + url.pathname, root))).length > 0, `${path}: asset ${href}`);
  }
}
for (const path of publicPages) {
  const html = documents.get('/' + path), canonical = 'https://a2aviary.io/' + path;
  const title = html.match(/<title>(.*?)<\/title>/)[1];
  const metas = new Map([...html.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]+)"/g)].map(match => [match[1], match[2]]));
  assert(html.includes(`rel="canonical" href="${canonical}"`));
  assert.equal(metas.get('og:url'), canonical);
  assert.equal(metas.get('og:title'), title);
  for (const field of ['title', 'description', 'image', 'image:alt']) assert.equal(metas.get('og:' + field), metas.get('twitter:' + field));
  assert.equal(metas.get('description'), metas.get('og:description'));
  assert(!/<script(?! type="application\/ld\+json")\b|<style\b|\sstyle=|\son\w+=/i.test(html), 'No executable browser scripts or inline styling/handlers');
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  const graph = new Map(data['@graph'].map(entity => [entity['@id'], entity]));
  assert.equal(graph.size, data['@graph'].length);
  const check = value => {
    if (!value || typeof value !== 'object') return;
    if ('@id' in value) assert(graph.has(value['@id']), 'Structured entity resolves');
    assert(!('logo' in value) && !('offers' in value) && value['@type'] !== 'Offer', 'No logo or purchasable offers');
    for (const child of Object.values(value)) check(child);
  };
  check(data);
  assert.equal(graph.get(canonical + '#page').description, metas.get('description'));
  assert.equal(websiteContentType(path), 'text/html; charset=utf-8');
  if (process.argv.includes('--built')) assert.equal(await readFile(new URL('dist/' + path, root), 'utf8'), html, 'Exact emitted HTML object');
  const originIndex = process.argv.indexOf('--origin');
  if (originIndex !== -1) {
    const origin = process.argv[originIndex + 1];
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(origin + '/' + path + '?verify=1', { method });
      assert.equal(response.status, 200, `${path}: ${method} status`);
      assert.equal(response.headers.get('content-type'), websiteContentType(path), `${path}: ${method} MIME`);
      assert.equal(await response.text(), method === 'GET' ? html : '', `${path}: ${method} body`);
    }
  }
}
console.log('Public routes, navigation, assets/anchors, sitemap, metadata, JSON-LD, and HTML MIME verified' + (process.argv.includes('--built') ? '; emitted objects verified' : '') + (process.argv.includes('--origin') ? '; GET/HEAD delivery verified.' : '.'));
