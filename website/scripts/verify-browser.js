// Run with playwright-cli run-code --filename=website/scripts/verify-browser.js.
// The CLI supplies `page`; no browser testing library is bundled into the site.
async (page) => {
  const base = page.url().split('/').slice(0, 3).join('/');
  const report = { browser: await page.context().browser().version(), base, layouts: [], checks: [] };
  const errors = [];
  const missing = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) missing.push(`${response.status()} ${response.url()}`); });
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const diagnostics = () => page.evaluate(() => document.querySelector('#visual').sceneDiagnostics());
  const ready = () => page.waitForFunction(() => document.querySelector('#visual').dataset.sceneState === 'ready');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const [width, height] of [[1440, 900], [1280, 720], [390, 844], [360, 640]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base);
    await ready();
    await page.waitForFunction(() => document.querySelector('#visual').sceneDiagnostics().elapsed >= 3);
    const layout = await page.evaluate(() => {
      const heading = document.querySelector('h1').getBoundingClientRect();
      const copy = document.querySelector('.description').getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, headingBottom: heading.bottom, copyBottom: copy.bottom, scene: document.querySelector('#visual').sceneDiagnostics() };
    });
    assert(layout.scrollWidth <= width, `Horizontal overflow at ${width}`);
    assert(layout.headingBottom < height && layout.copyBottom < height, `Initial copy clipped at ${width}`);
    if (width > 900) assert(layout.scrollHeight === height, `Desktop does not fit at ${width}`);
    assert(layout.scene.componentOffsets.every((offset) => offset === 0), 'Bird failed to settle');
    assert(JSON.stringify(layout.scene.holes) === JSON.stringify({ 'bird-head': 1, 'bird-lower-wing': 2, 'bird-middle-wing': 1, 'bird-upper-wing': 1, 'bird-eye': 0 }), 'SVG holes changed');
    assert(layout.scene.extrusionDepth > 0.3, 'Bird is not extruded');
    assert(layout.scene.pixelRatio <= (width <= 900 ? 1.5 : 2), 'Pixel ratio exceeds cap');
    await page.screenshot({ path: `output/playwright/landing-${width}x${height}.png`, fullPage: true });
    report.layouts.push(layout);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base);
  await ready();
  await page.keyboard.press('Tab');
  assert(await page.getByRole('button', { name: 'Pause animation', exact: true }).evaluate((button) => document.activeElement === button && getComputedStyle(button).outlineStyle !== 'none'), 'Pause control is not keyboard focusable');
  await page.keyboard.press('Enter');
  const frozen = await diagnostics();
  await page.waitForTimeout(300);
  const frozenAfter = await diagnostics();
  assert(frozenAfter.paused && !frozenAfter.scheduled && frozen.renderedFrames === frozenAfter.renderedFrames && frozen.elapsed === frozenAfter.elapsed, 'Pause does not freeze rendering and animation');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#visual').sceneDiagnostics().elapsed >= 3);
  report.checks.push('Keyboard focus; pause freezes entrance, animation, and render loop; resume completes entrance');

  const bounds = await page.locator('#scene').boundingBox();
  await page.mouse.move(bounds.x + bounds.width - 2, bounds.y + 2);
  await page.waitForTimeout(700);
  const pointer = await diagnostics();
  assert(Math.hypot(pointer.rotation[0] + 0.08, pointer.rotation[1] + 0.28) <= Math.PI / 45 + 0.0001, 'Pointer rotation exceeds four degrees');
  assert(Math.hypot(pointer.rotation[0] + 0.08, pointer.rotation[1] + 0.28) > 0.02, 'Fine-pointer interaction absent');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1000);
  const resting = await diagnostics();
  assert(Math.hypot(resting.rotation[0] + 0.08, resting.rotation[1] + 0.28) < 0.001, 'Pointer did not return to rest');
  report.checks.push('Pointer damping, combined four-degree cap, and return to rest');

  // Exercise the actual visibility handler without exposing application controls.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hidden = await diagnostics();
  await page.waitForTimeout(200);
  assert((await diagnostics()).renderedFrames === hidden.renderedFrames && !hidden.scheduled, 'Hidden page keeps rendering');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => document.querySelector('#visual').sceneDiagnostics().scheduled);
  report.checks.push('Visibility event suspends rendering and resumes without replaying entrance (synthetic visibility state)');

  const timing = await page.evaluate(async () => {
    const samples = [];
    let last = performance.now();
    for (let index = 0; index < 120; index++) {
      const now = await new Promise(requestAnimationFrame);
      samples.push(now - last);
      last = now;
    }
    samples.sort((a, b) => a - b);
    return { frames: samples.length, medianIntervalMs: samples[60], p95IntervalMs: samples[114], diagnostics: document.querySelector('#visual').sceneDiagnostics(), userAgent: navigator.userAgent };
  });
  report.timing = timing;

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  await ready();
  const still = await diagnostics();
  await page.waitForTimeout(250);
  assert(still.elapsed === 2.8 && !still.scheduled && (await diagnostics()).renderedFrames === still.renderedFrames, 'Reduced motion renders continuously or plays entrance');
  assert(still.componentOffsets.every((offset) => offset === 0), 'Reduced motion bird is not composed');
  await page.mouse.move(bounds.x + bounds.width - 2, bounds.y + 2);
  assert(JSON.stringify((await diagnostics()).rotation) === JSON.stringify(still.rotation), 'Reduced motion responds to pointer');
  assert(await page.getByRole('button', { name: 'Animation disabled by reduced motion preference' }).isDisabled(), 'Reduced motion control state incorrect');
  await page.screenshot({ path: 'output/playwright/reduced-motion.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.querySelector('#visual').sceneDiagnostics().scheduled);
  report.checks.push('Reduced-motion still scene, no pointer response, no continuous loop, and live preference changes');

  assert(errors.length === 0, `Unexpected console/page errors: ${errors.join('; ')}`);
  assert(missing.length === 0, `Missing assets: ${missing.join('; ')}`);
  report.checks.push('No console warnings/errors or missing assets on normal production path');

  // Context loss is a terminal fallback for this load; no restoration loop.
  await page.evaluate(() => {
    const canvas = document.querySelector('#scene canvas');
    const context = canvas.getContext('webgl2');
    const extension = context.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context loss extension unavailable');
    extension.loseContext();
  });
  await page.waitForFunction(() => document.querySelector('#visual').dataset.sceneState === 'fallback');
  assert(await page.locator('#scene canvas').count() === 0, 'Lost context canvas retained');
  assert(await page.locator('.scene-fallback').isVisible(), 'Context loss fallback hidden');
  await page.screenshot({ path: 'output/playwright/context-loss.png' });
  report.checks.push('Real WEBGL_lose_context extension produces static fallback and removes canvas');

  // New contexts isolate failure injection from the normal-path measurements.
  const browser = page.context().browser();
  const failedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await failedContext.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl') ? null : getContext.call(this, type, ...args);
    };
  });
  const failedPage = await failedContext.newPage();
  await failedPage.goto(base);
  await failedPage.waitForFunction(() => document.querySelector('#visual').dataset.sceneState === 'fallback');
  assert(await failedPage.locator('.scene-fallback').isVisible(), 'WebGL-unavailable fallback hidden');
  assert(await failedPage.locator('#motion-toggle').isHidden(), 'Broken scene exposes pause control');
  await failedPage.screenshot({ path: 'output/playwright/webgl-unavailable.png', fullPage: true });
  await failedContext.close();
  report.checks.push('WebGL unavailable: SVG fallback, readable copy, no inert control');

  const failureContext = await browser.newContext();
  const failurePage = await failureContext.newPage();
  await failurePage.route('**/brand/a2aviary-bird.svg', (route) => route.abort());
  await failurePage.goto(base);
  await failurePage.waitForFunction(() => document.querySelector('#visual').dataset.sceneState === 'fallback');
  assert(await failurePage.locator('.scene-fallback').isVisible(), 'SVG load failure fallback hidden');
  await failureContext.close();
  report.checks.push('Failed scene asset request: attractive static fallback and no canvas');

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(base);
  await touchPage.waitForFunction(() => document.querySelector('#visual').dataset.sceneState === 'ready');
  const touch = await touchPage.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, diagnostics: document.querySelector('#visual').sceneDiagnostics() }));
  await touchPage.locator('#scene').dispatchEvent('pointermove', { clientX: 350, clientY: 500, pointerType: 'touch' });
  await touchPage.waitForTimeout(300);
  const touchAfter = await touchPage.evaluate(() => document.querySelector('#visual').sceneDiagnostics());
  assert(touch.coarse && JSON.stringify(touch.diagnostics.rotation) === JSON.stringify(touchAfter.rotation), 'Touch device reacts to pointer movement');
  assert(touchAfter.pixelRatio <= 1.5, 'Mobile pixel ratio is not capped');
  await touchContext.close();
  report.checks.push('Coarse-pointer mobile emulation disables pointer rotation and caps DPR 2 at 1.5');
  return report;
}
