import * as THREE from 'three';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
  metrics: { triangles: number; drawMeshes: number; heightMeters: number };
};

const CREAM = 0xf3e9de;
const LIGHT_CREAM = 0xfff7f0;
const EAR_PINK = 0xeca8aa;
const IRIS_BROWN = 0x9c351d;
const EYE_DARK = 0x281817;
const NOSE_PINK = 0xd98286;
const MOUTH_DARK = 0x5a2d31;

function material(color: number, roughness: number, clearcoat = 0): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat,
    clearcoatRoughness: Math.max(0.08, roughness * 0.45),
    sheen: color === CREAM || color === LIGHT_CREAM ? 0.18 : 0,
    sheenColor: new THREE.Color(0xf6dfe2),
  });
}

function ellipsoidGeometry(segments = 20): THREE.SphereGeometry {
  return new THREE.SphereGeometry(0.5, segments, Math.max(10, Math.floor(segments * 0.7)));
}

function addMesh(
  parent: THREE.Object3D,
  name: string,
  geometry: THREE.BufferGeometry,
  meshMaterial: THREE.Material,
  scale: [number, number, number],
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  options: ProceduralModelOptions = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.name = name;
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  mesh.userData.partId = name;
  parent.add(mesh);
  return mesh;
}

function makeGroup(parent: THREE.Object3D, id: string, position: [number, number, number]): THREE.Group {
  const group = new THREE.Group();
  group.name = id;
  group.position.set(...position);
  group.userData.partId = id;
  parent.add(group);
  return group;
}

function createEarGeometry(inner = false): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const inset = inner ? 0.78 : 1;
  shape.moveTo(0.00 * inset, 0.12 * inset);
  shape.bezierCurveTo(0.07 * inset, 0.18 * inset, 0.17 * inset, 0.11 * inset, 0.19 * inset, 0.02 * inset);
  shape.bezierCurveTo(0.23 * inset, -0.11 * inset, 0.23 * inset, -0.29 * inset, 0.15 * inset, -0.40 * inset);
  shape.bezierCurveTo(0.11 * inset, -0.46 * inset, 0.055 * inset, -0.43 * inset, 0.043 * inset, -0.35 * inset);
  shape.bezierCurveTo(0.061 * inset, -0.22 * inset, 0.083 * inset, -0.055 * inset, 0.00 * inset, 0.12 * inset);
  shape.closePath();
  const depth = inner ? 0.009 : 0.052;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 18,
    bevelEnabled: !inner,
    bevelThickness: inner ? 0 : 0.009,
    bevelSize: inner ? 0 : 0.008,
    bevelSegments: inner ? 0 : 3,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createPearGeometry(): THREE.LatheGeometry {
  const profile = [
    new THREE.Vector2(0.075, -0.235),
    new THREE.Vector2(0.145, -0.205),
    new THREE.Vector2(0.185, -0.105),
    new THREE.Vector2(0.195, 0.015),
    new THREE.Vector2(0.172, 0.135),
    new THREE.Vector2(0.112, 0.225),
  ];
  return new THREE.LatheGeometry(profile, 24);
}

function tubeCurve(points: THREE.Vector3[], radius: number): THREE.TubeGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, radius, 6, false);
}

function register(runtime: ProceduralModelRuntime, id: string, group: THREE.Object3D, mesh?: THREE.Mesh): void {
  runtime.nodes[id] = group;
  if (mesh) runtime.meshes[id] = mesh;
}

function createEye(
  parent: THREE.Object3D,
  side: 'l' | 'r',
  x: number,
  mats: Record<string, THREE.Material>,
  runtime: ProceduralModelRuntime,
  options: ProceduralModelOptions,
): void {
  const group = makeGroup(parent, `eye-${side}`, [x, 0.028, 0.174]);
  const white = addMesh(group, `eye-${side}`, ellipsoidGeometry(24), mats.eyeWhite, [0.145, 0.174, 0.060], [0, 0, 0], [0, 0, side === 'l' ? -0.04 : 0.04], options);
  register(runtime, `eye-${side}`, group, white);
  const irisGroup = makeGroup(group, `iris-${side}`, [0, -0.004, 0.031]);
  const iris = addMesh(irisGroup, `iris-${side}`, ellipsoidGeometry(22), mats.iris, [0.102, 0.136, 0.024], [0, 0, 0], [0, 0, 0], options);
  register(runtime, `iris-${side}`, irisGroup, iris);
  const pupilGroup = makeGroup(irisGroup, `pupil-${side}`, [0, 0.002, 0.015]);
  const pupil = addMesh(pupilGroup, `pupil-${side}`, ellipsoidGeometry(20), mats.eyeDark, [0.055, 0.086, 0.014], [0, 0, 0], [0, 0, 0], options);
  register(runtime, `pupil-${side}`, pupilGroup, pupil);
  const catchGroup = makeGroup(pupilGroup, `catchlight-${side}`, [side === 'l' ? -0.019 : 0.019, 0.036, 0.010]);
  const catchlight = addMesh(catchGroup, `catchlight-${side}`, ellipsoidGeometry(14), mats.catchlight, [0.023, 0.027, 0.012], [0, 0, 0], [0, 0, 0], options);
  register(runtime, `catchlight-${side}`, catchGroup, catchlight);
  const small = addMesh(group, `catchlight-small-${side}`, ellipsoidGeometry(12), mats.catchlight, [0.010, 0.012, 0.007], [side === 'l' ? 0.018 : -0.018, 0.006, 0.061], [0, 0, 0], options);
  small.userData.explodeWithParent = true;
}

function createEar(
  head: THREE.Object3D,
  side: 'l' | 'r',
  mats: Record<string, THREE.Material>,
  runtime: ProceduralModelRuntime,
  options: ProceduralModelOptions,
): void {
  const sign = side === 'l' ? 1 : -1;
  const group = makeGroup(head, `ear-${side}`, [0.145 * sign, 0.125, -0.018]);
  group.scale.x = sign;
  group.rotation.y = -0.06 * sign;
  const outer = addMesh(group, `ear-${side}`, createEarGeometry(false), mats.cream, [1, 1, 1], [0, 0, 0], [0, 0, 0], options);
  outer.receiveShadow = false;
  register(runtime, `ear-${side}`, group, outer);
  const innerGroup = makeGroup(group, `inner-ear-${side}`, [0.025, -0.025, 0.034]);
  const inner = addMesh(innerGroup, `inner-ear-${side}`, createEarGeometry(true), mats.pink, [0.86, 0.89, 1], [0, 0, 0], [0, 0, 0], options);
  inner.receiveShadow = false;
  inner.userData.explodeWithParent = true;
  register(runtime, `inner-ear-${side}`, innerGroup, inner);
}

function createArm(
  body: THREE.Object3D,
  side: 'l' | 'r',
  mats: Record<string, THREE.Material>,
  runtime: ProceduralModelRuntime,
  options: ProceduralModelOptions,
): void {
  const sign = side === 'l' ? 1 : -1;
  const arm = makeGroup(body, `arm-${side}`, [0.185 * sign, 0.058, 0.025]);
  arm.rotation.z = -0.12 * sign;
  const armMesh = addMesh(arm, `arm-${side}`, ellipsoidGeometry(18), mats.cream, [0.078, 0.205, 0.080], [0, -0.045, 0], [0, 0, 0], options);
  register(runtime, `arm-${side}`, arm, armMesh);
  const hand = makeGroup(arm, `hand-${side}`, [0.012 * sign, -0.153, 0.022]);
  const handMesh = addMesh(hand, `hand-${side}`, ellipsoidGeometry(18), mats.cream, [0.095, 0.090, 0.086], [0, 0, 0], [0, 0, 0], options);
  register(runtime, `hand-${side}`, hand, handMesh);
  const socket = new THREE.Object3D();
  socket.name = `weapon-socket-${side}`;
  socket.position.set(0, -0.018, 0.070);
  socket.userData.socketType = 'weapon';
  socket.userData.forward = [0, 0, 1];
  hand.add(socket);
  runtime.sockets[socket.name] = socket;
}

function createLeg(
  body: THREE.Object3D,
  side: 'l' | 'r',
  mats: Record<string, THREE.Material>,
  runtime: ProceduralModelRuntime,
  options: ProceduralModelOptions,
): void {
  const sign = side === 'l' ? 1 : -1;
  const leg = makeGroup(body, `leg-${side}`, [0.098 * sign, -0.195, 0.005]);
  const legMesh = addMesh(leg, `leg-${side}`, ellipsoidGeometry(18), mats.cream, [0.118, 0.178, 0.115], [0, 0, 0], [0, 0, 0], options);
  register(runtime, `leg-${side}`, leg, legMesh);
  const foot = makeGroup(leg, `foot-${side}`, [0.008 * sign, -0.120, 0.075]);
  const footMesh = addMesh(foot, `foot-${side}`, ellipsoidGeometry(20), mats.cream, [0.163, 0.120, 0.225], [0, 0, 0], [0.08, 0, 0], options);
  register(runtime, `foot-${side}`, foot, footMesh);
}

function triangleCount(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const geometry = mesh.geometry;
    if (!geometry) return;
    triangles += geometry.index ? geometry.index.count / 3 : (geometry.getAttribute('position')?.count ?? 0) / 3;
  });
  return Math.round(triangles);
}

export function createBunnyWorldHeroModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'BunnyWorldHero';
  const runtime: ProceduralModelRuntime = {
    nodes: { root }, meshes: {}, sockets: {}, colliders: {}, destructionGroups: {},
    metrics: { triangles: 0, drawMeshes: 0, heightMeters: 1.0 },
  };
  const mats: Record<string, THREE.Material> = {
    cream: material(CREAM, 0.78, 0.06),
    lightCream: material(LIGHT_CREAM, 0.82, 0.04),
    pink: material(EAR_PINK, 0.68, 0.08),
    eyeWhite: material(0xfff8f0, 0.20, 0.55),
    iris: material(IRIS_BROWN, 0.15, 0.70),
    eyeDark: material(EYE_DARK, 0.12, 0.72),
    catchlight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    nose: material(NOSE_PINK, 0.40, 0.24),
    mouth: material(MOUTH_DARK, 0.52, 0.02),
  };
  if (options.wireframe) Object.values(mats).forEach((entry) => { if ('wireframe' in entry) (entry as THREE.MeshBasicMaterial).wireframe = true; });

  const body = makeGroup(root, 'body', [0, 0.345, 0]);
  const bodyMesh = addMesh(body, 'body', createPearGeometry(), mats.cream, [1, 1, 0.82], [0, 0, 0], [0, 0, 0], options);
  register(runtime, 'body', body, bodyMesh);
  const head = makeGroup(root, 'head', [0, 0.705, 0.010]);
  const headMesh = addMesh(head, 'head', ellipsoidGeometry(28), mats.cream, [0.47, 0.415, 0.385], [0, 0, 0], [0, 0, 0], options);
  register(runtime, 'head', head, headMesh);
  createEar(head, 'l', mats, runtime, options);
  createEar(head, 'r', mats, runtime, options);

  const muzzleL = makeGroup(head, 'muzzle-l', [0.052, -0.072, 0.178]);
  register(runtime, 'muzzle-l', muzzleL, addMesh(muzzleL, 'muzzle-l', ellipsoidGeometry(18), mats.lightCream, [0.145, 0.102, 0.088], [0, 0, 0], [0, 0, 0], options));
  const muzzleR = makeGroup(head, 'muzzle-r', [-0.052, -0.072, 0.178]);
  register(runtime, 'muzzle-r', muzzleR, addMesh(muzzleR, 'muzzle-r', ellipsoidGeometry(18), mats.lightCream, [0.145, 0.102, 0.088], [0, 0, 0], [0, 0, 0], options));
  createEye(head, 'l', 0.116, mats, runtime, options);
  createEye(head, 'r', -0.116, mats, runtime, options);

  const browGeometry = ellipsoidGeometry(14);
  addMesh(head, 'brow-l', browGeometry, mats.pink, [0.041, 0.021, 0.012], [0.110, 0.128, 0.193], [0, 0, -0.08], options).userData.explodeWithParent = true;
  addMesh(head, 'brow-r', browGeometry, mats.pink, [0.041, 0.021, 0.012], [-0.110, 0.128, 0.193], [0, 0, 0.08], options).userData.explodeWithParent = true;
  const nose = makeGroup(head, 'nose', [0, -0.067, 0.238]);
  register(runtime, 'nose', nose, addMesh(nose, 'nose', ellipsoidGeometry(16), mats.nose, [0.050, 0.034, 0.028], [0, 0, 0], [0, 0, 0], options));
  const mouthL = makeGroup(head, 'mouth-l', [0, -0.105, 0.232]);
  register(runtime, 'mouth-l', mouthL, addMesh(mouthL, 'mouth-l', tubeCurve([new THREE.Vector3(0, 0.014, 0), new THREE.Vector3(0.020, -0.002, 0), new THREE.Vector3(0.046, 0.011, 0)], 0.006), mats.mouth, [1, 1, 1], [0, 0, 0], [0, 0, 0], options));
  const mouthR = makeGroup(head, 'mouth-r', [0, -0.105, 0.232]);
  register(runtime, 'mouth-r', mouthR, addMesh(mouthR, 'mouth-r', tubeCurve([new THREE.Vector3(0, 0.014, 0), new THREE.Vector3(-0.020, -0.002, 0), new THREE.Vector3(-0.046, 0.011, 0)], 0.006), mats.mouth, [1, 1, 1], [0, 0, 0], [0, 0, 0], options));

  for (const [x, y, rz, s] of [[0, 0.219, 0, 1], [0.030, 0.208, -0.42, 0.78], [-0.030, 0.208, 0.42, 0.78]] as [number, number, number, number][]) {
    const tuft = addMesh(head, `head-tuft-${x}`, new THREE.ConeGeometry(0.027, 0.075, 7), mats.cream, [s, s, s], [x, y, -0.012], [0, 0, rz], options);
    tuft.userData.explodeWithParent = true;
  }
  createArm(body, 'l', mats, runtime, options);
  createArm(body, 'r', mats, runtime, options);
  createLeg(body, 'l', mats, runtime, options);
  createLeg(body, 'r', mats, runtime, options);

  const tail = makeGroup(body, 'tail', [0, -0.020, -0.185]);
  register(runtime, 'tail', tail, addMesh(tail, 'tail', ellipsoidGeometry(16), mats.lightCream, [0.128, 0.128, 0.128], [0, 0, 0], [0, 0, 0], options));
  for (const [x, y, z] of [[0.045, 0.025, -0.010], [-0.045, 0.018, -0.006], [0.0, 0.050, 0.002], [0.030, -0.035, 0.005], [-0.032, -0.036, 0.002]] as [number, number, number][]) {
    const puff = addMesh(tail, `tail-puff-${x}-${y}`, ellipsoidGeometry(12), mats.lightCream, [0.074, 0.074, 0.074], [x, y, z], [0, 0, 0], options);
    puff.userData.explodeWithParent = true;
  }

  runtime.colliders.body = { type: 'capsule', radius: 0.18, height: 0.46, center: [0, 0.345, 0] };
  runtime.colliders.head = { type: 'sphere', radius: 0.235, center: [0, 0.705, 0.01] };
  runtime.destructionGroups.character = Object.values(runtime.nodes);
  root.updateMatrixWorld(true);
  const authoredBounds = new THREE.Box3().setFromObject(root);
  const authoredHeight = authoredBounds.max.y - authoredBounds.min.y;
  const meterScale = authoredHeight > 0 ? 1 / authoredHeight : 1;
  root.scale.setScalar(meterScale);
  root.updateMatrixWorld(true);
  const normalizedBounds = new THREE.Box3().setFromObject(root);
  root.position.y -= normalizedBounds.min.y;
  root.updateMatrixWorld(true);
  runtime.metrics.triangles = triangleCount(root);
  runtime.metrics.drawMeshes = Object.values(runtime.meshes).length;
  root.userData.sculptRuntime = runtime;
  root.userData.profile = 'character';
  root.userData.subjectName = 'BunnyWorldHero';
  root.userData.realHeightMeters = 1.0;
  root.userData.staticOnly = true;
  root.userData.noRig = true;
  return root;
}

export function configureBunnyWorldHeroRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
