import { mountChangelogMotion } from './changelog-motion.js';
const disposeChangelog = mountChangelogMotion();
if (import.meta.hot) import.meta.hot.dispose(disposeChangelog);
const visual = document.querySelector('#visual');
try {
  // HTML and styles stay useful while the separate 3D modules download.
  const { mountScene } = await import('./renderer.js');
  const dispose = await mountScene(
    document.querySelector('#scene'),
    visual,
    document.querySelector('#motion-toggle'),
    document.querySelector('#motion-label'),
  );
  if (import.meta.hot) import.meta.hot.dispose(dispose);
} catch {
  visual.dataset.sceneState = 'fallback';
}
