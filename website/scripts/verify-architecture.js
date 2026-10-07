// Run with playwright-cli run-code --filename against the local S3 website server.
async (page) => {
  const origin = new URL(page.url()).origin;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const requests = [], errors = [];
  const record = request => requests.push(request.url());
  const diagnostic = message => { if (message.type() === 'error') errors.push(message.text()); };
  const stages = ['client', 'gate', 'engine', 'hosting', 'ops'];
  const counts = [6, 8, 10, 8, 12];
  page.on('request', record); page.on('console', diagnostic);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await page.goto(origin + '/architecture');
    assert(response.headers()['content-type'].startsWith('text/html'), 'Extensionless HTML MIME');
    assert(response.headers()['content-security-policy'].includes("script-src 'self'"), 'Production CSP present');
    assert(await page.title() === 'Architecture | a2aviary', 'Title');
    assert(await page.locator('[data-node-id]').count() === 5, 'Exactly five initial macro nodes');
    assert(await page.getByRole('tab').count() === 5, 'Five matching stage tabs');
    assert(await page.locator('#stage-panel').isHidden(), 'No initial technical panel');
    assert(await page.locator('.node-list').count() === 0, 'No global source grid');
    assert(await page.locator('#local-setup').getAttribute('open') === null, 'Local setup initially collapsed');
    await page.screenshot({ path: 'output/playwright/architecture-desktop.png', fullPage: true });
    await page.locator('.overview').screenshot({ path: 'output/playwright/architecture-map.png' });
    let sourceCount = 0;
    for (const [index, stage] of stages.entries()) {
      await page.locator('#tab-' + stage).click();
      assert(await page.locator('.stage-content').count() === 1, 'Only one focused panel');
      assert(await page.locator('.stage-content').getAttribute('data-active-stage') === stage, 'Selected panel matches tab');
      assert(await page.locator('#tab-' + stage).getAttribute('aria-selected') === 'true', 'Selected tab announced');
      assert((await page.locator('#stage-announcement').textContent()).includes('details opened'), 'Selection live announcement');
      const nodes = await page.locator('#stage-body [data-node-id]').evaluateAll(nodes => nodes.map(node => node.dataset.nodeId));
      const evidence = await page.locator('.node-list details').evaluateAll(nodes => nodes.map(node => node.dataset.component));
      assert(nodes.length === counts[index] && JSON.stringify(nodes) === JSON.stringify(evidence), 'Only matching technical evidence');
      assert(nodes.every(id => id.startsWith(stage + '-')), 'Evidence belongs to selected stage');
      const links = await page.locator('.node-list details').evaluateAll(details => details.map(detail => [...detail.querySelectorAll('a')].map(a => a.href)));
      assert(links.every(group => group.length > 0 && group.every(url => url.startsWith('https://github.com/carlos-olivera/a2aviary/blob/main/'))), 'Every technical node links to main sources');
      sourceCount += nodes.length;
      for (const id of nodes) {
        await page.locator(`#stage-body [data-node-id="${id}"]`).focus();
        await page.keyboard.press('Enter');
        assert(await page.locator('#detail-' + id).getAttribute('open') !== null, 'Keyboard technical node opens matching evidence');
        assert(await page.locator('#detail-' + id + ' summary').evaluate(node => document.activeElement === node), 'Evidence receives focus');
      }
      await page.locator('.node-list details').evaluateAll(details => details.forEach(detail => { detail.open = false; }));
      await page.locator('#stage-body .diagram-region').screenshot({ path: `output/playwright/architecture-${stage}-diagram.png` });
      if (stage === 'hosting') {
        assert((await page.locator('#detail-hosting-customer').textContent()).includes('In progress · deployed'), 'Customer hosting status');
        assert(await page.locator('[data-node-id="hosting-customer"]').getAttribute('data-status') !== 'Planned', 'Customer hosting not planned');
        await page.locator('.node-list details').evaluateAll(details => details.forEach(detail => { detail.open = false; }));
        await page.screenshot({ path: 'output/playwright/architecture-hosting.png', fullPage: true });
      }
    }
    for (const stage of stages) {
      await page.locator(`.overview [data-stage-trigger="${stage}"]`).click();
      assert(await page.locator('.stage-content').getAttribute('data-active-stage') === stage, 'Macro selects matching panel');
      assert(await page.locator('.node-list details[open]').count() === 0, 'Switching resets evidence');
    }
    await page.locator('#tab-client').focus();
    await page.keyboard.press('ArrowRight');
    assert(await page.locator('#tab-gate').evaluate(node => document.activeElement === node), 'Arrow key moves tab focus');
    assert(await page.locator('.stage-content').getAttribute('data-active-stage') === 'gate', 'Arrow key selects stage');
    await page.keyboard.press('End');
    assert(await page.locator('.stage-content').getAttribute('data-active-stage') === 'ops', 'End selects final stage');
    await page.keyboard.press('Home');
    assert(await page.locator('.stage-content').getAttribute('data-active-stage') === 'client', 'Home selects first stage');
    await page.locator('#detail-client-submit > summary').click();
    await page.locator('#stage-body [data-stage-trigger="gate"]').click();
    assert(await page.locator('.stage-content').getAttribute('data-active-stage') === 'gate', 'Boundary link drills into next stage');
    await page.getByRole('checkbox', { name: 'Highlight LocalStack coverage' }).check();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-node-id="gate-auth"]')).opacity === '0.35');
    await page.getByRole('checkbox', { name: 'Highlight LocalStack coverage' }).uncheck();
    await page.getByRole('button', { name: 'Back to overview' }).click();
    assert(await page.locator('#stage-panel').isHidden() && await page.locator('.node-list').count() === 0, 'Close removes technical content');
    assert(await page.locator('#tab-gate').evaluate(node => document.activeElement === node), 'Close restores opener focus');
    await page.locator('.overview [data-stage-trigger="hosting"]').focus();
    await page.keyboard.press('Space');
    assert(await page.locator('.stage-content').getAttribute('data-active-stage') === 'hosting', 'Macro keyboard selection');
    await page.getByRole('button', { name: 'Back to overview' }).click();
    await page.locator('#local-setup summary').click();
    assert(await page.locator('#local-setup a').last().isVisible(), 'Local quickstart links disclosed');
    await page.locator('#local-setup summary').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'output/playwright/architecture-mobile.png', fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page has no horizontal overflow');
    assert(await page.locator('.stage-tabs').getAttribute('aria-orientation') === 'vertical', 'Mobile tab orientation');
    await page.locator('#tab-engine').click();
    assert(await page.locator('.stage-content').getAttribute('data-active-stage') === 'engine', 'Mobile stage selection');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Technical scrolling contained on mobile');
    await page.screenshot({ path: 'output/playwright/architecture-mobile-detail.png', fullPage: true });
    await page.getByRole('button', { name: 'Back to overview' }).click();
    assert(requests.every(url => new URL(url).origin === origin), 'Zero automatic requests to other domains');
    assert(errors.length === 0, 'No CSP/console errors');
    const context = await page.context().browser().newContext({ javaScriptEnabled: false });
    try {
      const fallback = await context.newPage();
      fallback.on('request', record); fallback.on('console', diagnostic);
      await fallback.goto(origin + '/architecture');
      assert(await fallback.locator('.fallback-stage').count() === 5, 'Five native fallback stages');
      assert(await fallback.locator('.fallback-stage[open]').count() === 0, 'Fallback details initially collapsed');
      const stage = fallback.locator('.fallback-stage').nth(3);
      await stage.locator(':scope > summary').click();
      await fallback.locator('#detail-hosting-customer > summary').click();
      assert(await fallback.locator('#detail-hosting-customer a').first().isVisible(), 'Source evidence works without JavaScript');
    } finally { await context.close(); }
    assert(requests.every(url => new URL(url).origin === origin), 'No automatic cross-domain requests in either JavaScript mode');
    assert(errors.length === 0, 'No browser diagnostics in either JavaScript mode');
    return { result: 'PASS', macroStages: 5, technicalNodes: sourceCount, automaticOtherDomainRequests: 0, checks: ['HTML MIME and production CSP', 'initial overview only', 'all tabs/macros and 44 technical nodes', 'exclusive evidence and reset', 'keyboard, announcements and focus', 'boundary links and local highlighting', 'collapsed local setup', 'desktop/mobile', 'JavaScript-free access', 'main source links'] };
  } finally { page.off('request', record); page.off('console', diagnostic); }
}
