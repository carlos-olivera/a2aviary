// Run against a running preview with playwright-cli run-code --filename=...
async (page) => {
  const base = page.url().split('/').slice(0, 3).join('/');
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#visual').dataset.sceneState === 'ready');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '.landing { min-height: 630px; padding: 32px 54px 24px; } .hero { padding: 20px 0; } .visual { height: 420px; } h1 { font-size: 80px; } .description { font-size: 15px; } .eyebrow { margin-bottom: 24px; } .motion-toggle { display: none; }' });
  await page.screenshot({ path: 'website/public/social-preview.png', scale: 'css' });
}
