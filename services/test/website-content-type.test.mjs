import test from 'node:test';
import assert from 'node:assert/strict';
import { websiteContentType } from '../scripts/website-content-type.mjs';

test('exact extensionless page keys are HTML; unrelated keys remain binary', () => {
  for (const key of ['costs', 'terms', 'privacy', 'refunds', 'pricing']) {
    assert.equal(websiteContentType(key), 'text/html; charset=utf-8');
    for (const unrelated of ['nested/' + key, key + '.backup']) assert.equal(websiteContentType(unrelated), 'application/octet-stream');
  }
  assert.equal(websiteContentType('other'), 'application/octet-stream');
});

test('existing website asset MIME types remain intact', () => {
  for (const [key, expected] of Object.entries({
    'index.html': 'text/html; charset=utf-8', 'assets/main.js': 'application/javascript; charset=utf-8',
    'costs.css': 'text/css; charset=utf-8', 'costs.json': 'application/json',
    'sitemap.xml': 'application/xml; charset=utf-8', 'favicon.ico': 'image/vnd.microsoft.icon',
  })) assert.equal(websiteContentType(key), expected);
});
