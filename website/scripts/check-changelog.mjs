import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderChangelog, selectPosts } from '../src/changelog-section.js';

const data = JSON.parse(await readFile(new URL('../public/changelog.json', import.meta.url), 'utf8'));
const posts = selectPosts(data);
assert.equal(posts.length, 5);
assert.equal(posts[0].id, '2107114965501108248');
assert.equal(posts.at(-1).id, '2106834409940799691');
assert(posts.every((post, index) => !index || Date.parse(posts[index - 1].createdAt) >= Date.parse(post.createdAt)));
const html = renderChangelog(data);
assert.equal((html.match(/<article /g) || []).length, 5);
assert.equal((html.split('<details')[0].match(/<article /g) || []).length, 3);
assert(html.includes('https://a2aviary.io/costs') && !html.includes('t.co/2532QoYMZi'));
assert(html.includes('href="https://x.com/carlos_olivera/status/2107094837048565960" target="_blank" rel="noopener noreferrer">Reply in thread'));
assert(html.includes('datetime="2026-10-05T14:25:30.000Z"'));
assert(html.includes('No posts in this snapshot') === false);
assert(renderChangelog({ ...data, posts: [] }).includes('No posts in this snapshot'));
const fixture = { ...posts[0], id: '1', url: 'https://x.com/carlos_olivera/status/1', text: '<script>alert("x")</script> & #a2aviary', urls: [] };
const safe = renderChangelog({ ...data, posts: [fixture] });
assert(safe.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp;'));
assert(!safe.includes('<script>') && safe.includes('class="post-hashtag"'));
assert.equal(selectPosts({ ...data, posts: [{ ...fixture, author: 'another_author', url: 'https://x.com/another_author/status/1' }] }).length, 0);
assert.equal(selectPosts({ ...data, posts: [{ ...fixture, text: '#a2aviaryExtra' }] }).length, 0);
assert.equal(selectPosts({ ...data, posts: [{ ...fixture, text: '#A2AVIARY' }] }).length, 1);
for (const change of [{ createdAt: 'bad' }, { url: 'javascript:alert(1)' }, { replyTo: 'bad' }, { urls: [{ text: '#a2aviary', label: 'bad', href: 'javascript:alert(1)' }] }]) {
  assert.throws(() => renderChangelog({ ...data, posts: [{ ...fixture, ...change }] }));
}
assert.throws(() => selectPosts({ ...data, posts: [fixture, fixture] }));
assert.throws(() => selectPosts({ posts: [] }));
const portrait = await readFile(new URL('../public/assets/carlos-olivera.png', import.meta.url));
assert.equal(portrait.readUInt32BE(16), 227);
assert.equal(portrait.readUInt32BE(20), 310);
if (process.argv.includes('--built')) {
  const built = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert(built.includes(html) && !built.includes('<!-- CHANGELOG_SECTION -->'), 'Exact section emitted into production HTML');
  assert.deepEqual(await readFile(new URL('../dist/assets/carlos-olivera.png', import.meta.url)), portrait, 'Portrait copied unchanged');
  assert.deepEqual(JSON.parse(await readFile(new URL('../dist/changelog.json', import.meta.url), 'utf8')), data, 'Snapshot copied unchanged');
}
const originIndex = process.argv.indexOf('--origin');
if (originIndex !== -1) {
  const origin = process.argv[originIndex + 1];
  for (const [path, type] of [['/', 'text/html'], ['/assets/carlos-olivera.png', 'image/png'], ['/changelog.json', 'application/json']]) {
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(origin + path, { method });
      assert.equal(response.status, 200);
      assert(response.headers.get('content-type').startsWith(type));
      const bytes = Buffer.from(await response.arrayBuffer());
      if (method === 'HEAD') assert.equal(bytes.length, 0);
      else if (path === '/') assert(bytes.toString().includes(html), 'Exact rendered section served');
      else if (path.endsWith('.png')) assert.deepEqual(bytes, portrait);
      else assert.deepEqual(JSON.parse(bytes.toString()), data);
    }
  }
}
console.log('Changelog validation, filtering, ordering, escaping, URL entities, replies, disclosure, empty state, and portrait verified.');
