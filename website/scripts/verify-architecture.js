// Run with playwright-cli run-code --filename against the local S3 website server.
async (page) => {
  const origin = new URL(page.url()).origin;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const requests = [], errors = [];
  const record = request => requests.push(request.url());
  const diagnostic = message => { if (message.type() === 'error') errors.push(message.text()); };
  page.on('request', record); page.on('console', diagnostic);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await page.goto(origin + '/architecture');
    assert(response.headers()['content-type'].startsWith('text/html'), 'Extensionless HTML MIME');
    assert(response.headers()['content-security-policy'].includes("script-src 'self'"), 'Production CSP present');
    assert(await page.title() === 'Architecture | a2aviary', 'Title');
    await page.getByRole('button', { name: 'Signed email', exact: true }).click();
    assert(await page.locator('.canvas svg').getAttribute('viewBox') === '0 210 1220 1015', 'Flow navigation');
    await page.getByRole('checkbox', { name: 'Highlight local coverage' }).check();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#node-cdn')).opacity === '0.35');
    await page.locator('#node-runtime').focus();
    await page.keyboard.press('Enter');
    assert(await page.locator('#detail-runtime').getAttribute('open') !== null, 'Keyboard node opens details');
    assert(await page.locator('#detail-runtime summary').evaluate(node => document.activeElement === node), 'Details receive focus');
    const sourceLinks = await page.locator('.node-list details').evaluateAll(details => details.map(detail => detail.querySelector('a')?.href));
    assert(sourceLinks.every(url => url?.startsWith('https://github.com/carlos-olivera/a2aviary/blob/main/')), 'Every node links to main source');
    assert(sourceLinks.length === await page.locator('[data-node-id]').count(), 'All nodes have details and evidence');
    await page.locator('#detail-runtime summary').click();
    await page.getByRole('checkbox', { name: 'Highlight local coverage' }).uncheck();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.screenshot({ path: 'output/playwright/architecture-desktop.png', fullPage: true });
    await page.locator('.canvas').screenshot({ path: 'output/playwright/architecture-map.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'output/playwright/architecture-mobile.png', fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow contained inside map');
    assert(requests.every(url => new URL(url).origin === origin), 'Zero automatic requests to other domains');
    assert(errors.length === 0, 'No CSP/console errors');
    const context = await page.context().browser().newContext({ javaScriptEnabled: false });
    try {
      const fallback = await context.newPage();
      await fallback.goto(origin + '/architecture');
      await fallback.locator('#detail-runtime summary').click();
      assert(await fallback.locator('#detail-runtime a').isVisible(), 'Evidence readable without JavaScript');
    } finally { await context.close(); }
    return { result: 'PASS', nodes: sourceLinks.length, automaticOtherDomainRequests: 0, checks: ['HTML MIME and production CSP', 'desktop/mobile rendering', 'flow views and local highlighting', 'keyboard activation and focus', 'main evidence links', 'JavaScript-free details'] };
  } finally { page.off('request', record); page.off('console', diagnostic); }
}
