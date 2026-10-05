// Run against a rebuilt production preview with playwright-cli run-code --filename=...
async (page) => {
  const base = new URL(page.url()).origin, browser = page.context().browser();
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
  const report = { browser: await browser.version(), base, checks: [] };
  for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ javaScriptEnabled, reducedMotion: 'reduce' });
    const view = await context.newPage(), diagnostics = [], requests = [];
    view.on('pageerror', error => diagnostics.push(error.message));
    view.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text()); });
    view.on('response', response => { if (response.status() >= 400) diagnostics.push(`${response.status()} ${response.url()}`); });
    view.on('request', request => requests.push(request.url()));
    await context.route('**/*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });
    try {
      for (const [width, height] of [[1280, 900], [390, 844], [360, 640]]) {
        await view.setViewportSize({ width, height });
        for (const path of ['terms', 'privacy', 'refunds', 'pricing']) {
          const response = await view.goto(base + '/' + path);
          assert(response.status() === 200 && response.headers()['content-type'].startsWith('text/html'), 'Exact route HTML');
          assert(response.headers()['content-security-policy'] === csp, 'Production CSP injected locally');
          assert(await view.locator('h1').isVisible(), 'Heading readable');
          assert(await view.locator('link[rel="canonical"]').getAttribute('href') === 'https://a2aviary.io/' + path, 'Canonical');
          assert(await view.locator('script:not([type="application/ld+json"])').count() === 0, 'No executable script');
          const layout = await view.locator('html').evaluate(element => ({ width: element.scrollWidth, background: getComputedStyle(element).backgroundColor }));
          assert(layout.width <= width && layout.background === 'rgb(11, 18, 32)', 'Styles loaded without horizontal overflow');
          await view.keyboard.press('Tab');
          assert(await view.getByRole('link', { name: 'Skip to content' }).evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle !== 'none'), 'Visible keyboard focus');
          await view.keyboard.press('Enter');
          assert(await view.locator('#content').evaluate(element => element === document.activeElement), 'Skip reaches content');
          if (path === 'pricing') {
            const button = view.getByRole('button', { name: 'Coming soon', exact: true });
            assert(await button.isVisible() && await button.isDisabled(), 'Coming-soon CTA is visible and natively disabled');
            assert(await button.evaluate(element => element.tagName === 'BUTTON' && element.type === 'button' && !element.form && !element.hasAttribute('onclick')), 'CTA has no submission or inline payment handler');
            assert(await button.getAttribute('aria-describedby') === 'basic-status' && await view.locator('#basic-status').isVisible(), 'CTA references visible launch status');
            const before = view.url(), count = requests.length, bounds = await button.boundingBox();
            await view.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await button.evaluate(element => { element.focus(); element.click(); });
            assert(await button.evaluate(element => element !== document.activeElement), 'Disabled CTA cannot receive focus');
            assert(view.url() === before && requests.length === count, 'Pointer and programmatic activation cannot navigate or start checkout');
          }
          if (!javaScriptEnabled) await view.screenshot({ path: `output/playwright/policies-${path}-${width}x${height}.png`, fullPage: true });
          await view.getByRole('link', { name: 'Contact', exact: true }).click();
          assert(new URL(view.url()).pathname === '/' && new URL(view.url()).hash === '#contact', 'Contact reaches homepage block');
          assert(await view.getByRole('link', { name: 'hello@a2aviary.io', exact: true }).getAttribute('href') === 'mailto:hello@a2aviary.io', 'Human contact mailto');
          await view.getByRole('navigation', { name: 'Policies and contact' }).getByRole('link', { name: path === 'refunds' ? 'Refunds' : path[0].toUpperCase() + path.slice(1), exact: true }).click();
          assert(new URL(view.url()).pathname === '/' + path, 'Homepage footer navigation');
        }
        await view.goto(base);
        await view.getByRole('link', { name: 'What it costs', exact: true }).click();
        assert(new URL(view.url()).pathname === '/costs', 'Existing costs link');
        await view.getByRole('link', { name: 'Pricing', exact: true }).click();
        assert(new URL(view.url()).pathname === '/pricing', 'Costs footer navigation');
        await view.goto(base);
        if (!javaScriptEnabled) await view.screenshot({ path: `output/playwright/policies-home-${width}x${height}.png`, fullPage: true });
        assert(await view.locator('html').evaluate(element => element.scrollWidth) <= width, 'Homepage without horizontal overflow');
      }
      assert(requests.every(url => new URL(url).origin === base), 'Only self-hosted network requests');
      assert(diagnostics.length === 0, `Clean browser/network/CSP diagnostics: ${diagnostics.join('; ')}`);
      report.checks.push(`All public pages and homepage: desktop/two mobile viewports, JavaScript ${javaScriptEnabled}, disabled checkout CTA, navigation, mailto, focus, skip links, CSP, and self-hosted requests`);
    } finally { await context.unrouteAll({ behavior: 'wait' }); await context.close(); }
  }
  return report;
}
