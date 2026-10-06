export const author = {
  name: 'Carlos Olivera Terrazas',
  handle: 'carlos_olivera',
  portrait: '/assets/carlos-olivera.png',
  x: 'https://x.com/carlos_olivera',
  linkedin: 'https://www.linkedin.com/in/carlos-olivera-terrazas/',
};
const search = 'https://x.com/search?q=from%3Acarlos_olivera%20%23a2aviary&f=live';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const external = 'target="_blank" rel="noopener noreferrer"';
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="journal-icon">${{
  x: '<path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-7.4L5.5 22H2.3l7.9-9L1 2h6.5l4.4 6.7L18.9 2Zm-1.1 18h1.7L6.6 3.9H4.8L17.8 20Z"/>',
  linkedin: '<path fill="currentColor" d="M20.4 2H3.6C2.7 2 2 2.7 2 3.6v16.8c0 .9.7 1.6 1.6 1.6h16.8c.9 0 1.6-.7 1.6-1.6V3.6c0-.9-.7-1.6-1.6-1.6ZM8 19H5V9h3v10ZM6.5 7.7a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6ZM19 19h-3v-4.9c0-1.2 0-2.7-1.6-2.7s-1.9 1.3-1.9 2.6v5h-3V9h2.9v1.4h.1c.4-.8 1.4-1.7 2.8-1.7 3 0 3.7 2 3.7 4.5V19Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
}[name]}</svg>`;

export function selectPosts(data) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.snapshotDate) || !Array.isArray(data.posts)) throw new Error('Invalid changelog snapshot');
  const ids = new Set();
  for (const post of data.posts) {
    if (!post || !/^\d+$/.test(post.id) || ids.has(post.id) || typeof post.author !== 'string' || typeof post.text !== 'string' || !post.text.trim() ||
      typeof post.createdAt !== 'string' || !Number.isFinite(Date.parse(post.createdAt)) || !post.createdAt.endsWith('Z') ||
      post.url !== `https://x.com/${post.author}/status/${post.id}` || !/^[A-Za-z0-9_]+$/.test(post.author) || !Array.isArray(post.urls) ||
      (post.replyTo !== undefined && !/^\d+$/.test(post.replyTo))) throw new Error('Invalid changelog post');
    ids.add(post.id);
    for (const link of post.urls) {
      if (!link || typeof link.text !== 'string' || !link.text || !post.text.includes(link.text) || typeof link.label !== 'string' || !link.label ||
        typeof link.href !== 'string' || !/^https:\/\//.test(link.href)) throw new Error('Invalid changelog URL entity');
      const url = new URL(link.href);
      if (url.username || url.password) throw new Error('Invalid changelog URL credentials');
    }
  }
  return data.posts.filter(post => post.author === author.handle && /(^|\W)#a2aviary\b/i.test(post.text))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function body(post) {
  // Tokenize plain text before adding markup: supplied text never becomes HTML.
  const tokens = post.text.split(/(https:\/\/\S+|#a2aviary\b)/gi);
  return tokens.map(token => {
    const link = post.urls.find(entity => entity.text === token);
    if (link) return `<a href="${escape(link.href)}" ${external}>${escape(link.label)}</a>`;
    if (/^#a2aviary$/i.test(token)) return `<a class="post-hashtag" href="${search}" ${external}>${escape(token)}</a>`;
    return escape(token);
  }).join('');
}

function card(post) {
  const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(post.createdAt));
  return `<article class="post-card reveal" aria-label="Post from ${escape(date)} UTC">
    <header class="post-header"><img src="${author.portrait}" width="36" height="36" alt="" loading="lazy" />
      <div class="post-author"><span>${author.name}</span><span class="post-handle">@${author.handle} <span class="builder-label">Builder</span></span></div>
      <a class="post-x" href="${post.url}" ${external} aria-label="View this post on X">${icon('x')}</a>
    </header>
    ${post.replyTo ? `<a class="post-reply" href="https://x.com/${author.handle}/status/${post.replyTo}" ${external}>Reply in thread ${icon('arrow')}</a>` : ''}
    <p class="post-text">${body(post)}</p>
    <footer class="post-meta"><span>${icon('clock')}<time datetime="${escape(post.createdAt)}">${escape(date)} UTC</time></span><a href="${post.url}" ${external}>View on X ${icon('arrow')}</a></footer>
  </article>`;
}

export function renderChangelog(data) {
  const posts = selectPosts(data);
  return `<section class="changelog" id="changelog" aria-labelledby="changelog-heading">
    <div class="journal-feed"><div class="journal-heading"><span class="journal-kicker"><span aria-hidden="true">#</span> Building in public</span>
      <h2 id="changelog-heading">Change Log</h2><a class="journal-filter" href="${search}" ${external}>@${author.handle} <span>+ #a2aviary</span> ${icon('arrow')}</a>
      <p class="journal-note">A curated snapshot of dated posts from X. Design intentions are not a statement of live capabilities.</p></div>
      ${posts.length ? `<div class="timeline">${posts.slice(0, 3).map(card).join('')}${posts.length > 3 ? `<details class="more-posts"><summary>Earlier posts <span>${posts.length - 3}</span></summary><div class="earlier-posts">${posts.slice(3).map(card).join('')}</div></details>` : ''}</div>` : '<p class="journal-empty">No posts in this snapshot yet. Follow the filtered feed on X for updates.</p>'}
      <p class="snapshot-note">Snapshot: ${escape(data.snapshotDate)} · Updates are curated.</p>
    </div>
    <aside class="author-card reveal" aria-labelledby="author-heading"><span class="journal-kicker"><span class="builder-dot" aria-hidden="true"></span> Builder / Architect</span>
      <div class="author-identity"><div class="portrait-frame"><img class="author-portrait" src="${author.portrait}" width="227" height="310" alt="Portrait of Carlos Olivera Terrazas" loading="lazy" /></div><div><h2 id="author-heading">Carlos Olivera<br />Terrazas</h2><a class="author-handle" href="${author.x}" ${external}>@${author.handle}</a><p class="author-location">Based in Bolivia.<br />Building with intent.</p></div></div>
      <p class="author-bio">Carlos Olivera Terrazas is a Bolivia-based software architect and serial entrepreneur with 25+ years in technology. He built <strong>Supay</strong>, reported as Bolivia's first mobile game. He has served as CTO at <strong>DeltaX</strong>, <strong>Mobi Latam</strong>, <strong>DATEC</strong>, and <strong>Presta Ya</strong>, co-founded <strong>ValidMe</strong> and <strong>KAIA Latam</strong> ...and is building <strong>a2aviary</strong>.</p>
      <nav class="author-socials" aria-label="Carlos Olivera Terrazas social profiles"><a href="${author.x}" ${external}>${icon('x')} @${author.handle} ${icon('arrow')}</a><a href="${author.linkedin}" ${external}>${icon('linkedin')} LinkedIn ${icon('arrow')}</a></nav>
    </aside>
  </section>`;
}
