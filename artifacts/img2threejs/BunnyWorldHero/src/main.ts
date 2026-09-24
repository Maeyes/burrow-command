import * as THREE from 'three';
import {
  configureBunnyWorldHeroRenderer,
  createBunnyWorldHeroModel,
} from './createObjectModel';

const app = document.querySelector<HTMLDivElement>('#app')!;
const label = document.querySelector<HTMLDivElement>('#label')!;
const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'three-quarter';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
configureBunnyWorldHeroRenderer(renderer);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xaaa8b1, 1);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaa8b1);

const model = createBunnyWorldHeroModel({ castShadow: true, receiveShadow: true });
scene.add(model);
const runtime = model.userData.sculptRuntime;
const bounds = new THREE.Box3().setFromObject(model);
const size = bounds.getSize(new THREE.Vector3());
(window as any).__BUNNY_MODEL__ = model;
(window as any).__BUNNY_METRICS__ = {
  bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() },
  triangles: runtime.metrics.triangles,
  drawMeshes: runtime.metrics.drawMeshes,
  sockets: Object.keys(runtime.sockets),
};
(window as any).__BUNNY_PARTS__ = {
  model: 'BunnyWorldHero',
  parts: Object.entries(runtime.nodes).map(([name]) => {
    const mesh = runtime.meshes[name] as THREE.Mesh | undefined;
    const geometry = mesh?.geometry;
    const triangles = geometry ? (geometry.index ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3) : 0;
    return { name, kind: mesh ? 'part' : 'group', module: name, triangles: Math.round(triangles) };
  }),
  unnamedMeshes: 0,
  integralMeshes: Object.keys(runtime.meshes).length,
};

const groundMat = new THREE.MeshStandardMaterial({ color: 0xb7b0b7, roughness: 0.96, metalness: 0 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.005;
ground.receiveShadow = true;
scene.add(ground);

const hemi = new THREE.HemisphereLight(0xdce5ff, 0x756173, 1.35);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff4ea, 2.35);
key.position.set(-2.8, 4.4, 3.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -1.2;
key.shadow.camera.right = 1.2;
key.shadow.camera.top = 1.4;
key.shadow.camera.bottom = -0.4;
key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.DirectionalLight(0xf4dfff, 1.15);
rim.position.set(3.2, 3.5, -3.5);
scene.add(rim);

const aspect = innerWidth / innerHeight;
const orthoHeight = view === 'gameplay' ? 1.55 : 1.26;
const camera = new THREE.OrthographicCamera(-orthoHeight * aspect / 2, orthoHeight * aspect / 2, orthoHeight / 2, -orthoHeight / 2, 0.01, 20);
const target = new THREE.Vector3(0, 0.49, 0);
const positions: Record<string, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0.56, 3.2),
  'three-quarter': new THREE.Vector3(2.25, 1.25, 3.0),
  right: new THREE.Vector3(3.25, 0.62, 0),
  rear: new THREE.Vector3(0, 0.62, -3.25),
  'rear-three-quarter': new THREE.Vector3(-2.4, 1.2, -2.8),
  gameplay: new THREE.Vector3(2.8, 2.45, 3.2),
};
camera.position.copy(positions[view] ?? positions['three-quarter']);
camera.lookAt(target);
camera.updateProjectionMatrix();

label.textContent = `BunnyWorldHero · ${view.replaceAll('-', ' ')}`;

function render() {
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  const nextAspect = innerWidth / innerHeight;
  camera.left = -orthoHeight * nextAspect / 2;
  camera.right = orthoHeight * nextAspect / 2;
  camera.top = orthoHeight / 2;
  camera.bottom = -orthoHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  render();
});

renderer.compileAsync(scene, camera).then(() => {
  render();
  (window as any).__IMG2THREEJS_READY__ = true;
  (window as any).__IMG2THREEJS_CAPTURE__ = {
    setCamera() {},
    setReferenceMode() {},
    async capturePass() { render(); return { ok: true, selector: 'canvas' }; },
  };
});
