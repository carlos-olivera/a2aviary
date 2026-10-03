import { MathUtils } from 'three';

const INTRO_DURATION = 2.8;
const clamp = MathUtils.clamp;
const easeOut = (t) => 1 - (1 - t) ** 3;

export function createAnimation(model) {
  let elapsed = 0;
  let pointerX = 0;
  let pointerY = 0;
  let dampedX = 0;
  let dampedY = 0;

  function update(delta, still = false) {
    if (!still) elapsed += delta;
    const time = still ? INTRO_DURATION : elapsed;
    const intro = time < INTRO_DURATION;
    for (const part of model.parts) {
      const progress = easeOut(clamp((time - 0.65 - part.delay) / 1.55, 0, 1));
      part.mesh.position.copy(part.final).addScaledVector(part.offset, 1 - progress);
      part.mesh.scale.setScalar(0.96 + 0.04 * progress);
    }
    model.nodeMaterial.opacity = clamp(time / 0.55, 0, 1) * 0.8;
    model.edgeMaterial.opacity = clamp((time - 0.28) / 0.65, 0, 1) * 0.21;
    const idle = !still && !intro;
    const idleTime = Math.max(0, time - INTRO_DURATION);
    const settle = Math.min(idleTime / 2, 1);
    const damping = 1 - Math.exp(-delta * 5);
    dampedX = still ? 0 : MathUtils.lerp(dampedX, pointerX, damping);
    dampedY = still ? 0 : MathUtils.lerp(dampedY, pointerY, damping);
    model.bird.rotation.set(-0.08 + dampedY, -0.28 + dampedX, -0.07);
    model.bird.position.y = 0.12 + (idle ? Math.sin(idleTime * 0.55) * 0.035 * settle : 0);
    model.rim.intensity = 2.3 + (idle ? Math.sin(idleTime * 0.4) * 0.12 * settle : 0);
    model.materials.tealFace.emissiveIntensity = 0.13 + (idle ? Math.sin(idleTime * 0.6) * 0.025 * settle : 0);
    const phase = idleTime % 9;
    model.pulse.visible = idle && phase > 4 && phase < 6;
    if (model.pulse.visible) {
      model.pulse.position.lerpVectors(model.nodes[6].position, model.nodes[7].position, (phase - 4) / 2);
      model.pulseMaterial.opacity = Math.sin((phase - 4) / 2 * Math.PI) * 0.75;
    }
  }

  return {
    update,
    pointer(x, y) {
      // The combined vector, rather than each axis, is capped at four degrees.
      const length = Math.max(1, Math.hypot(x, y));
      const angle = MathUtils.degToRad(4);
      pointerX = x / length * angle;
      pointerY = y / length * angle;
    },
    resetPointer() { pointerX = 0; pointerY = 0; },
    finishIntro() { elapsed = Math.max(elapsed, INTRO_DURATION); },
    get elapsed() { return elapsed; },
  };
}
