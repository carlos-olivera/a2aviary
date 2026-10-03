import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const BIRD_WIDTH = 6.2;
const SOURCE_WIDTH = 1122;
const SOURCE_HEIGHT = 740;
const DEPTH = BIRD_WIDTH * 0.05;

// Normalize before extrusion, including the SVG's downward-positive Y axis.
// Rebuilding the curves as contours avoids reflecting finished mesh normals.
function normalizedShape(source, segments) {
  const scale = BIRD_WIDTH / SOURCE_WIDTH;
  const points = (path) => path.getPoints(segments).map((p) => new THREE.Vector2(
    (p.x - SOURCE_WIDTH / 2) * scale,
    (SOURCE_HEIGHT / 2 - p.y) * scale,
  ));
  const shape = new THREE.Shape(points(source));
  shape.holes = source.holes.map((hole) => new THREE.Path(points(hole)));
  return shape;
}

export async function buildScene(compact) {
  // Load first so a failed request cannot leave allocated GPU resources behind.
  const loader = new SVGLoader();
  const svg = await loader.loadAsync(`${import.meta.env.BASE_URL}brand/a2aviary-bird.svg`);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
  const bird = new THREE.Group();
  bird.position.y = 0.12;
  bird.rotation.set(-0.08, -0.28, -0.07);
  scene.add(bird);

  const materials = {
    darkFace: new THREE.MeshStandardMaterial({ color: '#28384a', metalness: 0.48, roughness: 0.32 }),
    darkEdge: new THREE.MeshStandardMaterial({ color: '#354b5b', metalness: 0.52, roughness: 0.28 }),
    tealFace: new THREE.MeshStandardMaterial({ color: '#0aba82', metalness: 0.65, roughness: 0.40, emissive: '#14f1c8', emissiveIntensity: 0.13, toneMapped: false }),
    tealEdge: new THREE.MeshStandardMaterial({ color: '#108773', metalness: 0.42, roughness: 0.30 }),
  };
  const parts = [];
  const levels = { 'bird-head': 0.02, 'bird-lower-wing': -0.04, 'bird-middle-wing': 0.015, 'bird-upper-wing': 0.065, 'bird-eye': 0.024 };
  const offsets = {
    'bird-head': [0.32, 0.23, 0.28],
    'bird-lower-wing': [-0.19, -0.28, -0.30],
    'bird-middle-wing': [-0.30, -0.12, 0.36],
    'bird-upper-wing': [-0.38, 0.25, 0.21],
    'bird-eye': [0.32, 0.23, 0.28],
  };
  const holeCounts = {};
  for (const path of svg.paths) {
    const id = path.userData.node.id;
    const shapes = path.toShapes().map((shape) => normalizedShape(shape, compact ? 4 : 6));
    holeCounts[id] = shapes.reduce((total, shape) => total + shape.holes.length, 0);
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: DEPTH,
      steps: 1,
      curveSegments: 1,
      bevelEnabled: id !== 'bird-eye',
      bevelThickness: 0.013,
      bevelSize: 0.009,
      bevelSegments: compact ? 1 : 2,
    });
    const teal = id === 'bird-upper-wing' || id === 'bird-eye';
    const mesh = new THREE.Mesh(geometry, teal
      ? [materials.tealFace, materials.tealEdge]
      : [materials.darkFace, materials.darkEdge]);
    mesh.name = id;
    const final = new THREE.Vector3(0, 0, levels[id]);
    const offset = new THREE.Vector3(...offsets[id]);
    mesh.position.copy(final);
    bird.add(mesh);
    parts.push({ mesh, final, offset, delay: id === 'bird-eye' ? 0.1 : parts.length * 0.085 });
  }

  const key = new THREE.DirectionalLight('#f5f7fa', 3.2);
  key.position.set(-3, 5, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#a5bfd7', 1.5);
  fill.position.set(4, -1, 5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#63f5d5', 2.3);
  rim.position.set(3, 3, -3);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight('#b4c6d3', '#0b1220', 1.1));

  const network = new THREE.Group();
  scene.add(network);
  const nodeGeometry = new THREE.SphereGeometry(0.033, compact ? 8 : 12, 8);
  const nodeMaterial = new THREE.MeshStandardMaterial({ color: '#63f5d5', emissive: '#14f1c8', emissiveIntensity: 0.65, transparent: true });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: '#429185', transparent: true, opacity: 0.25 });
  const positions = [
    [-3.25, 1.60, -0.7], [-3.5, -0.35, 0.3], [-2.1, -1.95, -0.8],
    [-0.4, -2.38, 0.15], [1.55, -1.8, -0.9], [3.28, -0.5, -0.7],
    [3.4, 1.2, -1.2], [1.55, 2.25, 0.2], [-0.3, 2.55, -0.6],
  ];
  const nodes = positions.map((position) => {
    const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
    node.position.set(...position);
    network.add(node);
    return node;
  });
  const edges = [];
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [8, 0]]) {
    direction.subVectors(nodes[b].position, nodes[a].position);
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, direction.length(), 5), edgeMaterial);
    edge.position.copy(nodes[a].position).add(nodes[b].position).multiplyScalar(0.5);
    edge.quaternion.setFromUnitVectors(up, direction.normalize());
    network.add(edge);
    edges.push(edge);
  }
  const pulseGeometry = new THREE.SphereGeometry(0.019, 8, 6);
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: '#63f5d5', transparent: true });
  const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
  network.add(pulse);

  function fit(width, height) {
    camera.aspect = width / height;
    // Fit both axes with breathing room, rather than cropping mobile scenes.
    const vertical = 6.45;
    const horizontal = 8.5 / camera.aspect;
    const distance = Math.max(vertical, horizontal) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(0, 0.10, distance);
    camera.lookAt(0, 0.10, 0);
    camera.updateProjectionMatrix();
  }

  function dispose() {
    const geometries = new Set();
    const disposableMaterials = new Set(Object.values(materials));
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) disposableMaterials.add(material);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    disposableMaterials.forEach((material) => material.dispose());
  }

  return { scene, camera, bird, parts, network, nodes, edges, rim, materials, nodeMaterial, edgeMaterial, pulse, pulseMaterial, fit, dispose, holeCounts };
}
