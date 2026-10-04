// Run against a rebuilt production preview with playwright-cli run-code --filename=...
async (page) => {
  const base = new URL(page.url()).origin;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const raw = await page.request.get(base + '/costs.json');
  assert(raw.ok() && raw.headers()['content-type'].startsWith('application/json'), 'JSON delivery');
  const data = await raw.json();
  const browser = page.context().browser();
  const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
  const report = { browser: await browser.version(), base, checks: [] };
  const usd = value => '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 20 });
  for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ javaScriptEnabled });
    const view = await context.newPage();
    const diagnostics = [], requests = [];
    view.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text()); });
    view.on('pageerror', error => diagnostics.push(error.message));
    view.on('response', result => { if (result.status() >= 400) diagnostics.push(`${result.status()} ${result.url()}`); });
    view.on('request', request => requests.push(request.url()));
    await context.route('**/*', async route => {
      const result = await route.fetch();
      await route.fulfill({ response: result, headers: { ...result.headers(), 'content-security-policy': csp } });
    });
    try {
      for (const [width, height] of [[1280, 900], [390, 844], [360, 640]]) {
        await view.setViewportSize({ width, height });
        const result = await view.goto(base + '/costs');
        assert(result.status() === 200 && result.headers()['content-type'].startsWith('text/html'), 'Exact /costs returns HTML');
        assert(result.headers()['content-security-policy'] === csp, 'Production CSP applied locally');
        assert(await view.getByRole('heading', { name: 'What a2aviary costs' }).isVisible(), 'Costs heading');
        assert(await view.locator('link[rel="canonical"]').getAttribute('href') === 'https://a2aviary.io/costs', 'Canonical URL');
        assert(await view.locator('time').textContent() === data.updatedAt, 'Supplied date');
        assert(await view.locator('script').count() === 0, 'No browser scripts');
        const rows = await view.locator('tbody tr').evaluateAll(rows => rows.map(row => {
          const cells = row.querySelectorAll('th, td'), source = cells[5].cloneNode(true);
          source.querySelector('.note')?.remove();
          return { id: row.id, name: cells[0].textContent, provider: cells[1].textContent,
            kind: cells[2].childNodes[0].textContent, period: cells[2].querySelector('.period').textContent,
            status: cells[4].textContent, source: source.textContent,
            note: cells[5].querySelector('.note')?.textContent, amount: cells[3].textContent };
        }));
        assert(rows.length === data.items.length, 'Every item is rendered');
        for (const [index, item] of data.items.entries()) {
          for (const key of ['id', 'name', 'provider', 'kind', 'period', 'status', 'source', 'note']) assert(rows[index][key] === item[key], `${item.id}: unchanged ${key}`);
          const expected = item.amountUsd != null ? usd(item.amountUsd) : item.amountUsdMin != null ? `${usd(item.amountUsdMin)}–${usd(item.amountUsdMax)}` : 'Not yet known / no dollar figure recorded';
          assert(rows[index].amount === expected, `${item.id}: amount or unknown`);
        }
        assert(rows.find(row => row.id === 'openai-final-no-research').amount === '$0.001998', 'Tiny amount remains precise');
        const totals = await view.locator('.totals dd').allTextContents();
        assert(totals[0] === usd(data.totals.spentOrCommittedToDateKnownUsd), 'Known total');
        const project = data.totals.monthlyRunRateProjectUsd, shared = data.totals.monthlyRunRateIncludingSharedToolsUsd, target = data.totals.configuredCeilingMonthlyUsd;
        assert(totals[1].startsWith(`${usd(project.min)}–${usd(project.max)}`) && totals[1].includes(project.basis), 'Project range and basis');
        assert(totals[2] === `${usd(shared.min)}–${usd(shared.max)}`, 'Shared-tools range');
        assert(totals[3].includes(usd(target.operatingTarget)) && totals[3].includes(usd(target.plusDomainAmortized)) && totals[3].includes(target.note), 'Target, domain and alert caveat');
        const exclusions = await view.locator('#totals').evaluate(heading => [...heading.parentElement.querySelectorAll('li code')].map(code => code.textContent));
        assert(JSON.stringify(exclusions) === JSON.stringify(data.totals.spentToDateExcludes), 'Every exclusion');
        const layout = await view.locator('.table-scroll').evaluate(element => ({ width: document.documentElement.scrollWidth,
          background: getComputedStyle(document.documentElement).backgroundColor, scrollable: element.scrollWidth > element.clientWidth, overflow: getComputedStyle(element).overflowX }));
        assert(layout.width <= width && layout.background === 'rgb(11, 18, 32)', 'Styles load without page overflow');
        if (width < 600) assert(layout.scrollable && layout.overflow === 'auto', 'Mobile table scrolls independently');
        await view.keyboard.press('Tab');
        assert(await view.getByRole('link', { name: 'Skip to the cost sheet' }).evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle !== 'none'), 'Visible keyboard focus');
        await view.keyboard.press('Enter');
        assert(await view.locator('#cost-sheet').evaluate(element => element === document.activeElement), 'Skip link reaches heading');
        await view.keyboard.press('Tab');
        assert(await view.locator('.table-scroll').evaluate(element => element === document.activeElement), 'Table is keyboard reachable');
        if (!javaScriptEnabled) await view.screenshot({ path: `output/playwright/costs-${width}x${height}.png`, fullPage: true });
        await view.getByRole('link', { name: 'Raw JSON' }).click();
        assert(new URL(view.url()).pathname === '/costs.json', 'JSON link works');
        await view.goto(base + '/costs');
        await view.getByRole('link', { name: 'Return to the homepage →' }).click();
        assert(new URL(view.url()).pathname === '/', 'Home link works');
        await view.getByRole('link', { name: 'What it costs' }).click();
        assert(new URL(view.url()).pathname === '/costs', 'Landing footer reaches costs');
      }
      assert(requests.every(url => new URL(url).origin === base), 'All requested resources are self-hosted');
      assert(diagnostics.length === 0, `Clean browser/network/CSP diagnostics: ${diagnostics.join('; ')}`);
      report.checks.push(`Desktop and two mobile viewports, JavaScript ${javaScriptEnabled ? 'enabled' : 'disabled'}: CSP, JSON fields/totals, amounts, layout, keyboard access, navigation, and self-hosted requests`);
    } finally { await context.close(); }
  }
  return report;
}
