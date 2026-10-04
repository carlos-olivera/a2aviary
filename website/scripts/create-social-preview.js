// Run against a running preview with playwright-cli run-code --filename=...
async (page) => {
  const base = page.url().split('/').slice(0, 3).join('/');
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  // Retain the landing's local font styles; compose a card rather than a screenshot.
  await page.evaluate(() => {
    document.body.innerHTML = `<main class="share-card">
      <div class="share-safe">
        <div class="share-name">a2aviary</div>
        <img class="share-bird" src="/brand/a2aviary-bird-inverse.svg" alt="" />
        <h1>Your agent.<br /><span>Our agency.</span></h1>
        <p class="share-creator">Created by Carlos Olivera</p>
      </div>
    </main>`;
  });
  await page.addStyleTag({ content: `
    body { margin: 0; }
    .share-card { width: 1200px; height: 630px; overflow: hidden; position: relative;
      background: radial-gradient(ellipse at 50% 36%, #143a34 0, #0b1220 56%); }
    .share-safe { position: absolute; left: 325px; top: 32px; width: 550px; height: 566px;
      display: flex; flex-direction: column; align-items: center; text-align: center; }
    .share-name { font: 500 40px/1.2 'Space Grotesk', sans-serif; letter-spacing: -.04em; }
    .share-bird { display: block; width: 280px; height: 185px; object-fit: contain; margin: 24px 0 28px; }
    .share-card h1 { font: 500 70px/1.06 'Space Grotesk', sans-serif; letter-spacing: -.06em; margin: 0; }
    .share-card h1 span { color: #14f1c8; }
    .share-creator { font: 400 32px/1.4 'Inter', sans-serif; color: #b8c3cf; margin: 38px 0 0; }
  ` });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  const safe = await page.locator('.share-safe > *').evaluateAll(elements => elements.map(element => {
    const { left, right, top, bottom } = element.getBoundingClientRect();
    return { left, right, top, bottom };
  }));
  if (safe.some(box => box.left < 325 || box.right > 875 || box.top < 32 || box.bottom > 598)) {
    throw new Error('Essential share content escapes the padded central square');
  }
  const preview = await page.screenshot({ path: 'website/public/social-preview.png', scale: 'css' });
  // Local review outputs demonstrate the delivered image at card and thumbnail sizes.
  await page.evaluate(dataUrl => {
    document.body.innerHTML = '<img class="share-review" alt="" />';
    document.querySelector('.share-review').src = dataUrl;
  }, 'data:image/png;base64,' + preview.toString('base64'));
  await page.addStyleTag({ content: `
    html, body { width: 100%; height: 100%; overflow: hidden; }
    .share-review { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
  ` });
  await page.locator('.share-review').evaluate(image => image.decode());
  for (const [width, height, name] of [[600, 315, 'wide'], [160, 160, 'square']]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `output/playwright/social-${name}.png`, scale: 'css' });
  }
}
