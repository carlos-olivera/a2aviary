import * as THREE from 'three';
import { buildScene } from './scene.js';
import { createAnimation } from './animation.js';

export async function mountScene(container, visual, button, label) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const compact = matchMedia('(max-width: 900px)').matches;
  const controller = new AbortController();
  const events = { signal: controller.signal };
  let renderer;
  let model;
  let animation;
  let observer;
  let frame = 0;
  let lastTime = 0;
  let paused = false;
  let failed = false;
  let disposed = false;
  let renderedFrames = 0;
  let scale = compact ? 1.5 : 2;
  let slowFrames = 0;
  let measuredFrames = 0;

  function setControl() {
    const stopped = paused || motion.matches;
    button.hidden = failed || !model;
    button.disabled = motion.matches;
    button.setAttribute('aria-pressed', String(stopped));
    button.setAttribute('aria-label', motion.matches ? 'Animation disabled by reduced motion preference' : stopped ? 'Resume animation' : 'Pause animation');
    label.textContent = motion.matches ? 'Motion reduced' : stopped ? 'Resume motion' : 'Pause motion';
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function release() {
    stop();
    observer?.disconnect();
    controller.abort();
    motion.removeEventListener('change', onMotionChange);
    finePointer.removeEventListener('change', onPointerChange);
    model?.dispose();
    renderer?.dispose();
    renderer?.domElement.remove();
  }
  function fallback() {
    if (failed || disposed) return;
    failed = true;
    visual.dataset.sceneState = 'fallback';
    setControl();
    release();
  }
  function render() {
    if (failed || disposed) return;
    try {
      renderer.render(model.scene, model.camera);
      renderedFrames += 1;
    } catch {
      fallback();
    }
  }
  function resize() {
    if (failed || disposed || !model) return;
    const { width, height } = container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, scale));
    renderer.setSize(width, height, false);
    model.fit(width, height);
    render();
  }
  function tick(now) {
    frame = 0;
    if (failed || disposed || paused || motion.matches || document.hidden) return;
    const rawDelta = lastTime ? (now - lastTime) / 1000 : 0;
    lastTime = now;
    if (animation.elapsed > 3 && rawDelta > 0 && measuredFrames < 120) {
      measuredFrames += 1;
      if (rawDelta > 0.03) slowFrames += 1;
      if (measuredFrames === 120 && slowFrames > 40 && scale > 1) {
        scale = 1;
        resize();
      }
    }
    animation.update(rawDelta);
    render();
    if (!failed) frame = requestAnimationFrame(tick);
  }
  function start() {
    if (!frame && !failed && !disposed && !paused && !motion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function onMotionChange() {
    stop();
    animation.resetPointer();
    animation.finishIntro();
    animation.update(0, true);
    setControl();
    render();
    start();
  }
  function onPointerChange() { animation.resetPointer(); }

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor('#0b1220', 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      fallback();
    }, events);
    model = await buildScene(compact);
    if (disposed || failed) { model.dispose(); return () => {}; }
    animation = createAnimation(model);
    container.append(renderer.domElement);
    if (motion.matches) animation.finishIntro();
    animation.update(0, motion.matches);
    resize();
    if (failed) return () => {};
    visual.dataset.sceneState = 'ready';
    setControl();
    observer = new ResizeObserver(resize);
    observer.observe(container);
    button.addEventListener('click', () => {
      paused = !paused;
      setControl();
      if (paused) stop(); else start();
    }, events);
    container.addEventListener('pointermove', (event) => {
      if (paused || motion.matches || !finePointer.matches) return;
      const bounds = container.getBoundingClientRect();
      animation.pointer((event.clientX - bounds.left) / bounds.width * 2 - 1, (event.clientY - bounds.top) / bounds.height * 2 - 1);
    }, events);
    container.addEventListener('pointerleave', () => animation.resetPointer(), events);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start(), events);
    motion.addEventListener('change', onMotionChange);
    finePointer.addEventListener('change', onPointerChange);
    // Retain the canvas across back/forward cache restores; release on real exits.
    window.addEventListener('pagehide', (event) => {
      stop();
      if (!event.persisted) { disposed = true; release(); }
    }, events);
    window.addEventListener('pageshow', start, events);

    // Read-only diagnostics for browser verification, scoped to the scene element.
    visual.sceneDiagnostics = () => ({
      state: visual.dataset.sceneState,
      elapsed: animation.elapsed,
      renderedFrames,
      scheduled: Boolean(frame),
      paused,
      reducedMotion: motion.matches,
      pixelRatio: renderer.getPixelRatio(),
      triangles: renderer.info.render.triangles,
      drawCalls: renderer.info.render.calls,
      holes: model.holeCounts,
      extrusionDepth: model.parts[0].mesh.geometry.parameters.options.depth,
      componentOffsets: model.parts.map((part) => part.mesh.position.distanceTo(part.final)),
      rotation: [model.bird.rotation.x, model.bird.rotation.y, model.bird.rotation.z],
    });
    start();
  } catch {
    fallback();
  }

  return () => { disposed = true; release(); };
}
