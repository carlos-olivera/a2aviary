import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { installNetworkGuard } from '../template/network-guard.mjs';
test('browser-wide guard blocks and reports external loads and redirects across independent contexts', async () => {
  let hits = 0;
  const external = createServer((req, res) => {
    hits++;
    res.end('forbidden');
  });
  await new Promise((r) => external.listen(0, '127.0.0.1', r));
  const outside = 'http://127.0.0.1:' + external.address().port;
  const site = createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { location: outside + '/redirected' });
      res.end();
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(
      '<!doctype html><html><body><img src="' +
        outside +
        '/image"><script>fetch("/redirect").catch(()=>{})</script></body></html>',
    );
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + site.address().port;
  const reservation = createServer();
  await new Promise((r) => reservation.listen(0, '127.0.0.1', r));
  const port = reservation.address().port;
  await new Promise((r) => reservation.close(r));
  let guard;
  const browser = await chromium.launch({
    headless: true,
    args: ['--remote-debugging-port=' + port],
  });
  try {
    guard = await installNetworkGuard(port, origin);
    for (let n = 0; n < 2; n++) {
      const context = await browser.newContext(),
        page = await context.newPage();
      await page.goto(origin, { waitUntil: 'networkidle', timeout: 10000 });
      await context.close();
    }
    assert.equal(hits, 0);
    assert(guard.failures.length >= 4);
    assert(guard.failures.every((f) => f.origin === outside));
  } finally {
    guard?.close();
    await browser.close();
    await new Promise((r) => site.close(r));
    await new Promise((r) => external.close(r));
  }
});
