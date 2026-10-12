export default (element, context) => {
  const scene = element.querySelector('.card-scene');
  scene.style.setProperty('--pkg-tilt-x', 0 + 'deg');
  scene.style.setProperty('--pkg-tilt-y', 0 + 'deg');
  element.addEventListener('pointermove', (event) => {
    if (context.reducedMotion || !context.finePointer) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x =
      ((event.clientY - rect.top) / rect.height - 0.5) *
      -16 *
      context.motionIntensity;
    const y =
      ((event.clientX - rect.left) / rect.width - 0.5) *
      16 *
      context.motionIntensity;
    scene.style.setProperty('--pkg-tilt-x', x + 'deg');
    scene.style.setProperty('--pkg-tilt-y', y + 'deg');
  });
  element.addEventListener('pointerleave', (event) => {
    scene.style.setProperty('--pkg-tilt-x', 0 + 'deg');
    scene.style.setProperty('--pkg-tilt-y', 0 + 'deg');
  });
};
