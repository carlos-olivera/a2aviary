// Run against a local preview with playwright-cli run-code --filename=...
// Then run node website/scripts/package-icons.mjs from the repository root.
async (page) => {
  const base = new URL(page.url()).origin;
  await page.goto(base);
  await page.evaluate(() => {
    document.body.innerHTML = '<img src="/favicon.svg" alt="" />';
  });
  await page.addStyleTag({ content: `
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #0b1220; }
    body { display: grid; place-items: center; }
    img { display: block; width: 84%; height: 84%; object-fit: contain; }
  ` });
  await page.locator('img').evaluate(image => image.decode());
  for (const size of [16, 32, 48, 180]) {
    await page.setViewportSize({ width: size, height: size });
    await page.screenshot({
      path: size === 180 ? 'website/public/apple-touch-icon.png' : `output/playwright/favicon-${size}.png`,
      scale: 'css',
    });
  }
}
