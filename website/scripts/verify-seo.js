// Run against a rebuilt local production preview with playwright-cli run-code --filename=...
async (page) => {
  const base = new URL(page.url()).origin;
  const canonical = 'https://a2aviary.io/';
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const report = { browser: await page.context().browser().version(), base, checks: [] };
  for (const path of ['/', '/index.html']) {
    await page.goto(base + path);
    const metadata = await page.evaluate(() => ({
      canonical: [...document.querySelectorAll('link[rel="canonical"]')].map(link => link.href),
      tags: [...document.querySelectorAll('meta[name], meta[property]')].map(tag => [tag.name || tag.getAttribute('property'), tag.content]),
      description: document.querySelector('meta[name="description"]').content,
      title: document.title,
      data: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent),
    }));
    const tags = new Map(metadata.tags);
    assert(metadata.canonical.length === 1 && metadata.canonical[0] === canonical, `Canonical at ${path}`);
    assert(tags.get('og:url') === canonical && tags.get('og:site_name') === 'a2aviary' && tags.get('og:locale') === 'en_US', 'Open Graph identity');
    for (const field of ['title', 'description', 'image', 'image:alt']) {
      const key = 'twitter:' + field;
      assert(metadata.tags.filter(([name]) => name === key).length === 1, `Unique ${key}`);
      assert(tags.get(key) === tags.get('og:' + field), `Consistent ${field} across cards`);
    }
    assert(tags.get('og:title') === metadata.title && tags.get('og:description') === metadata.description, 'Consistent search and share copy');
    assert(tags.get('twitter:creator') === '@carlos_olivera' && tags.get('twitter:card') === 'summary_large_image', 'X creator and card');
    assert(tags.get('og:image:type') === 'image/png', 'Share image MIME metadata');
    const website = metadata.data['@graph'].find(entity => entity['@type'] === 'WebSite');
    assert(website.url === canonical && website.description === metadata.description, 'Structured website matches visible-page metadata');
    const image = await page.request.get(base + new URL(tags.get('og:image')).pathname);
    assert(image.ok() && image.headers()['content-type'].startsWith('image/png'), 'Share image served as PNG');
  }
  report.checks.push('Root and index.html: canonical, search/share metadata, creator, and JSON-LD consistency');

  const robots = await page.request.get(base + '/robots.txt');
  assert(robots.ok() && robots.headers()['content-type'].startsWith('text/plain'), 'Robots text delivery');
  const robotsText = await robots.text();
  assert(/^User-agent: \*$/m.test(robotsText) && /^Allow: \/$/m.test(robotsText) && !/^Disallow: *\/\s*$/m.test(robotsText), 'Robots allows crawling');
  assert(/^Sitemap: https:\/\/a2aviary.io\/sitemap.xml$/m.test(robotsText), 'Robots sitemap discovery');
  const sitemap = await page.request.get(base + '/sitemap.xml');
  assert(sitemap.ok() && /(?:application|text)\/xml/.test(sitemap.headers()['content-type']), 'Sitemap XML delivery');
  const sitemapData = await page.evaluate(xml => {
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    return {
      valid: !document.querySelector('parsererror'),
      namespace: document.documentElement.namespaceURI,
      root: document.documentElement.localName,
      urls: [...document.querySelectorAll('url > loc')].map(element => element.textContent),
      lastmod: document.querySelectorAll('lastmod').length,
    };
  }, await sitemap.text());
  assert(sitemapData.valid && sitemapData.root === 'urlset' && sitemapData.namespace === 'http://www.sitemaps.org/schemas/sitemap/0.9', 'Valid sitemap XML');
  assert(JSON.stringify(sitemapData.urls) === JSON.stringify([canonical, ...['costs', 'terms', 'privacy', 'refunds', 'pricing'].map(path => canonical + path)]) && sitemapData.lastmod === 0, 'Sitemap contains canonical homepage, costs, and public policies without invented dates');
  const icons = await page.evaluate(async () => {
    return Promise.all(['/favicon.ico', '/apple-touch-icon.png'].map(async path => {
      const image = new Image();
      image.src = path;
      await image.decode();
      return { path, width: image.naturalWidth, height: image.naturalHeight };
    }));
  });
  assert(icons[0].width === 48 && icons[0].height === 48 && icons[1].width === 180 && icons[1].height === 180, 'Browser decodes favicon and touch icon');
  report.checks.push('Robots discovery, valid six-URL sitemap, and browser icon decoding');

  const browser = page.context().browser();
  const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
  const secureContext = await browser.newContext();
  const securePage = await secureContext.newPage();
  const secureErrors = [];
  securePage.on('pageerror', error => secureErrors.push(error.message));
  securePage.on('console', message => { if (['error', 'warning'].includes(message.type())) secureErrors.push(message.text()); });
  securePage.on('response', response => { if (response.status() >= 400) secureErrors.push(`${response.status()} ${response.url()}`); });
  await secureContext.route('**/*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
  });
  try {
    await securePage.emulateMedia({ reducedMotion: 'reduce' });
    await securePage.goto(base);
    await securePage.waitForFunction(() => document.querySelector('#visual').dataset.sceneState === 'ready');
    assert(await securePage.locator('script[type="application/ld+json"]').evaluate(element => JSON.parse(element.textContent)['@graph'].length === 4), 'JSON-LD readable under production CSP');
    assert(secureErrors.length === 0, 'Homepage scene, JSON-LD, and asset/CSP diagnostics clean');
  } finally {
    await secureContext.close();
  }
  report.checks.push('Homepage: production CSP injected locally, Three.js ready, JSON-LD readable, no console/network errors');

  const context = await browser.newContext({ javaScriptEnabled: false });
  const missing = [], diagnostics = [];
  const errorPage = await context.newPage();
  errorPage.on('response', response => { if (response.status() >= 400) missing.push(response.url()); });
  errorPage.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text()); });
  await context.route('**/*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
  });
  try {
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      await errorPage.setViewportSize({ width, height });
      const response = await errorPage.goto(base + '/404.html');
      assert(response.headers()['content-security-policy'] === csp, '404 response has production CSP');
      assert(await errorPage.getByRole('heading', {name: 'Page not found'}).isVisible(), '404 heading visible without JavaScript');
      const html = await response.text();
      assert(/<meta name="robots" content="noindex"/.test(html), '404 excluded from indexing');
      assert(!/<script\b|<style\b|\sstyle=|\son\w+=/i.test(html), '404 has no script or inline styles/handlers');
      const brand = errorPage.getByRole('img', {name: 'a2aviary'});
      await brand.evaluate(image => image.decode());
      const layout = await errorPage.locator('body').evaluate(body => ({ width: document.documentElement.scrollWidth, background: getComputedStyle(body).backgroundColor, rootBackground: getComputedStyle(document.documentElement).backgroundColor }));
      assert(layout.width <= width && layout.rootBackground === 'rgb(11, 18, 32)', '404 external stylesheet loads with no horizontal overflow');
      await errorPage.keyboard.press('Tab');
      await errorPage.keyboard.press('Tab');
      const link = errorPage.getByRole('link', {name: 'Return to the homepage →'});
      assert(await link.evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle !== 'none'), '404 return link has keyboard focus');
      await errorPage.screenshot({ path: `output/playwright/404-${width}x${height}.png`, fullPage: true });
      await link.click();
      assert(new URL(errorPage.url()).pathname === '/', '404 link returns home without JavaScript');
    }
    assert(missing.length === 0 && diagnostics.length === 0, '404 and home asset/CSP diagnostics clean');
  } finally {
    await context.close();
  }
  report.checks.push('404 desktop/mobile: JavaScript disabled, production CSP injected locally, assets, noindex, focus, and return link');
  // Vite preview serves unknown paths via its own fallback; HTTP 404 is asserted in CDK tests and requires live release verification.
  return report;
}
