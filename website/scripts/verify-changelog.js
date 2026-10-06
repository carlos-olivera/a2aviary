// Run against local dev or production preview with playwright-cli run-code.
async (page) => {
  const base = new URL(page.url()).origin;
  const browser = page.context().browser();
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
  const report = { browser: await browser.version(), base, layouts: [], checks: [] };
  const development = (await (await page.request.get(base)).text()).includes('/@vite/client');
  const data = await (await page.request.get(base + '/changelog.json')).json();
  const ids = data.posts.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(post => post.id);
  for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ javaScriptEnabled, reducedMotion: 'reduce' });
    const view = await context.newPage(), errors = [], requests = [];
    view.on('pageerror', error => errors.push(error.message));
    view.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
    view.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    view.on('request', request => requests.push(request.url()));
    if (!development) await context.route('**/*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });
    try {
      for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [360, 640]]) {
        await view.setViewportSize({ width, height });
        const response = await view.goto(base);
        if (!development) assert(response.headers()['content-security-policy'] === csp, 'Local production CSP');
        const direction = view.getByRole('link', { name: 'A shared direction.' });
        assert(await direction.isVisible(), 'Direction link visible at every breakpoint');
        await view.keyboard.press('Tab');
        await view.waitForFunction(() => document.activeElement?.matches('.direction-link') && getComputedStyle(document.activeElement).outlineStyle !== 'none');
        await view.evaluate(() => document.fonts.ready);
        await view.keyboard.press('Enter');
        assert(new URL(view.url()).hash === '#changelog', 'Keyboard hash navigation');
        await view.waitForFunction(() => Math.abs(document.querySelector('#changelog').getBoundingClientRect().top - 24) < 4);
        assert(await view.locator('main > .hero + #changelog').count() === 1, 'Section directly after hero within main');
        assert(await view.locator('.post-card:visible').count() === 3, 'Three initial cards');
        await view.locator('.more-posts summary').click();
        assert(await view.locator('.post-card:visible').count() === 5, 'Disclosure exposes five real posts');
        await view.locator('.more-posts summary').press('Enter');
        assert(await view.locator('.post-card:visible').count() === 3, 'Keyboard closes disclosure');
        await view.locator('.more-posts summary').press('Enter');
        assert(await view.locator('.post-card:visible').count() === 5, 'Keyboard opens disclosure');
        const links = await view.locator('.post-x').evaluateAll(elements => elements.map(element => element.href));
        assert(links.every((link, index) => link.endsWith('/' + ids[index])), 'Newest-first canonical post links');
        const dates = await view.locator('.post-card time').evaluateAll(elements => elements.map(element => ({ date: element.dateTime, text: element.textContent })));
        assert(dates.every(date => date.date.endsWith('Z') && date.text.endsWith(' UTC')), 'Explicit UTC timestamps');
        assert(await view.locator('.post-reply').count() === 2, 'Thread context retained');
        assert(await view.locator('.post-text a[href="https://a2aviary.io/costs"]').count() === 1, 'Expanded costs URL');
        const badLinks = await view.locator('#changelog a').evaluateAll(elements => elements.filter(element => element.target !== '_blank' || !element.rel.includes('noopener') || !element.rel.includes('noreferrer')).length);
        assert(badLinks === 0, 'External link isolation');
        const portrait = view.locator('.author-portrait');
        await portrait.scrollIntoViewIfNeeded();
        await view.waitForFunction(() => document.querySelector('.author-portrait').complete);
        assert(await portrait.evaluate(element => element.naturalWidth === 227 && element.naturalHeight === 310), 'Self-hosted portrait decoded');
        const expectedBio = "Carlos Olivera Terrazas is a Bolivia-based software architect and serial entrepreneur with 25+ years in technology. He built Supay, reported as Bolivia's first mobile game. He has served as CTO at DeltaX, Mobi Latam, DATEC, and Presta Ya, co-founded ValidMe and KAIA Latam ...and is building a2aviary.";
        assert(await view.locator('.author-bio').textContent() === expectedBio, 'Verbatim biography');
        const layout = await view.evaluate(() => {
          const section = document.querySelector('#changelog'), feed = document.querySelector('.journal-feed'), author = document.querySelector('.author-card');
          const a = feed.getBoundingClientRect(), b = author.getBoundingClientRect();
          return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, columns: getComputedStyle(section).gridTemplateColumns, equal: Math.abs(a.width - b.width) < 2, stacked: b.top >= a.bottom - 2, sticky: getComputedStyle(author).position, scroll: getComputedStyle(document.documentElement).scrollBehavior, animation: getComputedStyle(document.querySelector('.builder-dot')).animationName };
        });
        assert(layout.scrollWidth <= width, `No horizontal overflow at ${width}`);
        assert(width > 900 ? layout.equal && layout.sticky === 'sticky' : layout.stacked && layout.sticky === 'static', 'Equal columns or stacked mobile layout');
        assert(layout.scroll === 'auto' && layout.animation === 'none', 'Reduced motion disables scrolling and pulse');
        await view.evaluate(() => window.scrollTo(0, 0));
        await view.screenshot({ path: `output/playwright/changelog-${javaScriptEnabled ? 'js' : 'nojs'}-${width}.png`, fullPage: true });
        report.layouts.push({ javaScriptEnabled, ...layout });
      }
      if (javaScriptEnabled) {
        await view.emulateMedia({ reducedMotion: 'no-preference' });
        await view.setViewportSize({ width: 1440, height: 900 });
        await view.goto(base);
        await view.getByRole('link', { name: 'A shared direction.' }).click();
        for (const card of await view.locator('.timeline > .post-card').all()) {
          await card.scrollIntoViewIfNeeded();
          await card.evaluate(element => new Promise(resolve => {
            const check = () => getComputedStyle(element).opacity === '1' ? resolve() : requestAnimationFrame(check);
            check();
          }));
        }
        assert(await view.locator('html').evaluate(element => getComputedStyle(element).scrollBehavior === 'smooth'), 'Normal smooth scrolling');
        await view.emulateMedia({ reducedMotion: 'reduce' });
        assert(await view.locator('.reveal-pending').count() === 0, 'Live reduced-motion change reveals pending content');
        await view.emulateMedia({ reducedMotion: 'no-preference' });
        await view.goto(base + '#changelog');
        await view.waitForFunction(() => getComputedStyle(document.querySelector('.timeline > .post-card')).opacity === '1');
        report.checks.push('Entrance reveal, direct hash loading, smooth scrolling, live reduced motion');
      }
      assert(requests.every(url => new URL(url).origin === base), 'Only same-origin browser requests');
      assert(errors.length === 0, `Clean browser/network diagnostics: ${errors.join('; ')}`);
      report.checks.push(`JS ${javaScriptEnabled}: responsive layout, anchor/focus, disclosure, real posts/links/dates, portrait, biography, ${development ? 'Vite development' : 'production CSP'}`);
    } finally { await context.unrouteAll({ behavior: 'wait' }); await context.close(); }
  }
  return report;
}
