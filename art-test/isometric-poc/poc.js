const canvas = document.querySelector('#scene');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;
const HORIZON = 0;
const GROUND_Y = 382;
const WORLD = { minX: -980, maxX: 980, minY: -720, maxY: 1120 };
const ASSET_ROOT = '../isometric-player';
const MOVE_SPEED = 168;
const HYSTERESIS = 7;
const qaMode = new URLSearchParams(window.location.search).get('qa');
const qaStartTime = performance.now();

const directionNames = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const sprites = {};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

await Promise.all(directionNames.map(async (direction) => {
  sprites[direction] = await loadImage(`${ASSET_ROOT}/${direction}.png`);
}));

const state = {
  time: 0,
  player: { x: -90, y: 290, vx: 0, vy: 0, radiusX: 10, radiusY: 7, heading: 0, directionIndex: 0 },
  camera: { x: -20, y: 160 },
  target: null,
  keys: new Set(),
  attackTimer: 0,
  damageTimer: 0,
  debug: {
    grid: false,
    pivots: false,
    labels: false,
    collisions: false,
    depth: false,
    range: true,
    hitboxes: false,
    composition: false,
  },
};

if (qaMode === 'behind-tree') Object.assign(state.player, { x: 405, y: 30, heading: 180, directionIndex: 4 });
if (qaMode === 'front-tree') Object.assign(state.player, { x: 405, y: 135, heading: 0, directionIndex: 0 });
if (qaMode === 'ruin-side') Object.assign(state.player, { x: -500, y: 150, heading: 90, directionIndex: 2 });
if (qaMode === 'combat') Object.assign(state.player, { x: 20, y: 315, heading: 0, directionIndex: 0 });
if (qaMode === 'circle') Object.assign(state.player, { x: 500, y: 80, heading: 180, directionIndex: 4 });
if (qaMode && qaMode !== 'blockout') Object.assign(state.camera, { x: state.player.x - 30, y: state.player.y - 90 });

const sceneMetadata = {
  projection: '2:1 isometric camera plane', light: 'upper-left', shadow: 'lower-right',
  spawn: { x: -90, y: 290 }, eventSocket: { x: 10, y: -328 },
  clearings: [
    { id: 'SMALL COMBAT', x: -390, y: -40, rx: 175, ry: 105 },
    { id: 'MEDIUM COMBAT', x: 30, y: 280, rx: 280, ry: 165 },
    { id: 'LANDMARK / EVENT', x: 10, y: -310, rx: 190, ry: 105 },
  ],
  occlusionTests: [{ x: 405, y: 80 }, { x: -510, y: 170 }, { x: 250, y: 480 }],
};
window.__GOLDEN_SCENE__ = sceneMetadata;

const props = [
  { type:'tree', family:'moonroot', x:-250,y:-430,size:1.18,seed:1 }, { type:'tree',family:'broad',x:270,y:-445,size:1.14,seed:2 },
  { type:'tree', family:'spire',x:-500,y:-330,size:1.08,seed:3 }, { type:'tree',family:'broad',x:530,y:-330,size:1.22,seed:4 },
  { type:'shrine',x:10,y:-302,size:1.08,seed:70,landmark:true }, { type:'ruin',x:-175,y:-245,size:.95,seed:71 }, { type:'ruin',x:185,y:-225,size:1.05,seed:72 },
  { type:'tree',family:'broad',x:-690,y:-120,size:1.14,seed:5 }, { type:'tree',family:'spire',x:-685,y:150,size:1.05,seed:6 },
  { type:'tree',family:'moonroot',x:-520,y:330,size:1.2,seed:7 }, { type:'ruin',x:-510,y:170,size:1.05,seed:73 },
  { type:'rock',variant:'large',x:-590,y:425,size:1.1,seed:31 }, { type:'rock',variant:'medium',x:-310,y:100,size:.9,seed:32 },
  { type:'tree',family:'moonroot',x:405,y:80,size:1.28,seed:8,heroTree:true }, { type:'tree',family:'spire',x:700,y:135,size:1.14,seed:9 },
  { type:'tree',family:'broad',x:660,y:430,size:1.22,seed:10 }, { type:'ruin',x:520,y:365,size:1.18,seed:75 },
  { type:'rock',variant:'large',x:590,y:-80,size:1.08,seed:33 }, { type:'rock',variant:'small',x:315,y:300,size:.72,seed:34 },
  { type:'tree',family:'broad',x:-760,y:610,size:1.3,seed:11 }, { type:'tree',family:'spire',x:-410,y:760,size:1.12,seed:12 },
  { type:'tree',family:'moonroot',x:430,y:770,size:1.25,seed:13 }, { type:'tree',family:'broad',x:790,y:650,size:1.34,seed:14 },
  { type:'log',x:-255,y:565,size:.95,seed:50 }, { type:'rock',variant:'medium',x:165,y:635,size:.92,seed:35 },
  { type:'bush',x:-245,y:-120,size:.92,seed:40 }, { type:'bush',x:230,y:-92,size:1.04,seed:41 }, { type:'bush',x:-340,y:390,size:.85,seed:42 },
  { type:'bush',x:250,y:480,size:.92,seed:43 }, { type:'bush',x:515,y:565,size:1.04,seed:44 },
];

for (const prop of props) {
  if (prop.type === 'tree') prop.collider = { rx: 15 * prop.size, ry: 9 * prop.size };
  if (prop.type === 'rock') prop.collider = { rx: (prop.variant === 'large' ? 31 : prop.variant === 'small' ? 14 : 23) * prop.size, ry: (prop.variant === 'large' ? 17 : prop.variant === 'small' ? 8 : 13) * prop.size };
  if (prop.type === 'log') prop.collider = { rx: 39 * prop.size, ry: 10 * prop.size };
  if (prop.type === 'ruin') prop.collider = { rx: 34 * prop.size, ry: 12 * prop.size };
  if (prop.type === 'shrine') prop.collider = { rx: 34 * prop.size, ry: 16 * prop.size };
}

const monsters = [
  {kind:'small',name:'Thornling',x:-430,y:-40,size:34,speed:18,color:'#bd806f',targetX:-350,targetY:5,phase:1.2,radiusX:10,radiusY:6,hp:.72},
  {kind:'small',name:'Thornling',x:-330,y:15,size:34,speed:17,color:'#bd806f',targetX:-430,targetY:45,phase:2.4,radiusX:10,radiusY:6,hp:.55},
  {kind:'small',name:'Thornling',x:-90,y:190,size:34,speed:17,color:'#bd806f',targetX:30,targetY:225,phase:3.1,radiusX:10,radiusY:6,hp:.88},
  {kind:'small',name:'Thornling',x:150,y:205,size:34,speed:17,color:'#bd806f',targetX:210,targetY:270,phase:3.8,radiusX:10,radiusY:6,hp:.62},
  {kind:'medium',name:'Mossback',x:-170,y:350,size:48,speed:13,color:'#72a379',targetX:-65,targetY:390,phase:4.3,radiusX:15,radiusY:9,hp:.8},
  {kind:'medium',name:'Mossback',x:220,y:370,size:48,speed:13,color:'#72a379',targetX:125,targetY:430,phase:5.1,radiusX:15,radiusY:9,hp:.68},
  {kind:'elite',name:'Gloam Guardian',x:35,y:505,size:72,speed:9,color:'#9074a3',targetX:-55,targetY:500,phase:6.1,radiusX:22,radiusY:12,hp:.92},
];

const groundBits = Array.from({ length: 520 }, (_, i) => ({
  x: WORLD.minX + hash(i * 3.1) * (WORLD.maxX - WORLD.minX),
  y: WORLD.minY + hash(i * 7.7 + 4) * (WORLD.maxY - WORLD.minY),
  type: i % 11 === 0 ? 'stone' : i % 17 === 0 ? 'magic' : 'grass',
  tone: Math.floor(hash(i * 9.4) * 3),
}));

const mossPatches = Array.from({ length: 34 }, (_, i) => ({
  x: WORLD.minX + hash(i * 13 + 2) * (WORLD.maxX - WORLD.minX),
  y: WORLD.minY + hash(i * 19 + 8) * (WORLD.maxY - WORLD.minY),
  width: 45 + hash(i * 5) * 90,
  height: 12 + hash(i * 11) * 24,
}));

function hash(value) {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function worldToScreen(x, y) {
  return { x: Math.round(W / 2 + x - state.camera.x), y: Math.round(GROUND_Y + (y - state.camera.y) * .5) };
}

function screenToWorld(x, y) {
  return { x: state.camera.x + x - W / 2, y: state.camera.y + (y - GROUND_Y) * 2 };
}

function angularDifference(a, b) {
  return ((a - b + 540) % 360) - 180;
}

function setFacing(vx, vy) {
  if (Math.hypot(vx, vy) < .01) return;
  const heading = (Math.atan2(vx, -vy) * 180 / Math.PI + 360) % 360;
  const currentCenter = state.player.directionIndex * 45;
  if (Math.abs(angularDifference(heading, currentCenter)) > 22.5 + HYSTERESIS) {
    state.player.directionIndex = Math.round(heading / 45) % 8;
  }
  state.player.heading = heading;
}

function resolveCollisions(entity) {
  entity.x = Math.max(WORLD.minX + 34, Math.min(WORLD.maxX - 34, entity.x));
  entity.y = Math.max(WORLD.minY + 24, Math.min(WORLD.maxY - 24, entity.y));
  for (let pass = 0; pass < 2; pass += 1) {
    for (const prop of props) {
      if (!prop.collider) continue;
      const rx = prop.collider.rx + entity.radiusX;
      const ry = prop.collider.ry + entity.radiusY;
      const nx = (entity.x - prop.x) / rx;
      const ny = (entity.y - prop.y) / ry;
      const distance = Math.hypot(nx, ny);
      if (distance >= 1) continue;
      const safe = distance || .001;
      entity.x = prop.x + nx / safe * rx;
      entity.y = prop.y + ny / safe * ry;
    }
  }
}

function updatePlayer(dt) {
  if (qaMode === 'circle') {
    const angle = (performance.now() - qaStartTime) / 1000 * .82;
    state.player.x = 405 + Math.cos(angle) * 108;
    state.player.y = 80 + Math.sin(angle) * 70;
    state.player.vx = -Math.sin(angle) * 108 * .82;
    state.player.vy = Math.cos(angle) * 70 * .82;
    setFacing(state.player.vx, state.player.vy);
    return;
  }
  let vx = Number(state.keys.has('right')) - Number(state.keys.has('left'));
  let vy = Number(state.keys.has('down')) - Number(state.keys.has('up'));
  if (vx || vy) {
    state.target = null;
    const length = Math.hypot(vx, vy);
    vx = vx / length * MOVE_SPEED;
    vy = vy / length * MOVE_SPEED;
  } else if (state.target) {
    const dx = state.target.x - state.player.x;
    const dy = state.target.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) {
      state.target = null;
    } else {
      vx = dx / distance * MOVE_SPEED;
      vy = dy / distance * MOVE_SPEED;
    }
  }

  const startedWithTarget = Boolean(state.target);
  const beforeX = state.player.x;
  const beforeY = state.player.y;
  setFacing(vx, vy);
  state.player.x += vx * dt;
  state.player.y += vy * dt;
  resolveCollisions(state.player);
  state.player.vx = (state.player.x - beforeX) / dt;
  state.player.vy = (state.player.y - beforeY) / dt;
  if (startedWithTarget && Math.hypot(vx, vy) > 0 && Math.hypot(state.player.vx, state.player.vy) < 4) state.target = null;
}

function updateMonsters(dt) {
  for (const monster of monsters) {
    const dx = monster.targetX - monster.x;
    const dy = monster.targetY - monster.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 10) {
      monster.phase += 1.7;
      monster.targetX = Math.max(WORLD.minX + 80, Math.min(WORLD.maxX - 80, monster.x + (hash(monster.phase) - .5) * 360));
      monster.targetY = Math.max(WORLD.minY + 70, Math.min(WORLD.maxY - 70, monster.y + (hash(monster.phase + 8) - .5) * 220));
    } else {
      monster.x += dx / distance * monster.speed * dt;
      monster.y += dy / distance * monster.speed * dt;
      resolveCollisions(monster);
    }
  }
}

function update(dt) {
  state.time += dt;
  updatePlayer(dt);
  updateMonsters(dt);
  state.attackTimer = Math.max(0, state.attackTimer - dt);
  state.damageTimer = Math.max(0, state.damageTimer - dt);
  const follow = 1 - Math.exp(-4.7 * dt);
  state.camera.x += (state.player.x - 70 - state.camera.x) * follow;
  state.camera.y += (state.player.y - 130 - state.camera.y) * follow;
}

function drawSky() {
  ctx.fillStyle = '#182a2c'; ctx.fillRect(0, 0, W, HORIZON);
  ctx.fillStyle = '#20383a'; ctx.fillRect(0, 62, W, 72);
  ctx.fillStyle = '#2b4745'; ctx.fillRect(0, 134, W, 68);
  ctx.fillStyle = '#38534d'; ctx.fillRect(0, 202, W, 62);
  ctx.fillStyle = 'rgba(202,207,164,.08)';
  for (let i = 0; i < 70; i += 1) {
    const x = Math.floor(hash(i * 3) * W / 4) * 4;
    const y = Math.floor(hash(i * 8) * HORIZON / 4) * 4;
    ctx.fillRect(x, y, 4, 4);
  }
  const moonX = 1035 - state.camera.x * .035;
  ctx.fillStyle = '#b7d4c7';
  ctx.fillRect(Math.round(moonX - 24), 66, 48, 48);
  ctx.fillStyle = '#182a2c';
  ctx.fillRect(Math.round(moonX - 30), 58, 28, 52);
}

function steppedMountain(x, base, width, height, color) {
  ctx.fillStyle = color;
  const steps = 10;
  for (let i = 0; i < steps; i += 1) {
    const ratio = i / steps;
    const bandWidth = width * (1 - ratio);
    ctx.fillRect(Math.round(x - bandWidth / 2), Math.round(base - height * ratio), Math.round(bandWidth), Math.ceil(height / steps) + 2);
  }
}

function drawMountains() {
  const shift = -state.camera.x * .075;
  for (let i = -2; i < 7; i += 1) steppedMountain(i * 310 + 85 + shift, 280, 360, 155 + (i % 2) * 35, i % 2 ? '#213a39' : '#284443');
}

function drawCastle() {
  const x = 850 - state.camera.x * .17;
  ctx.fillStyle = '#172c2d';
  ctx.fillRect(Math.round(x - 124), 164, 250, 116);
  for (const tower of [-112, -38, 47, 107]) {
    const h = tower === -38 ? 96 : 64;
    ctx.fillRect(Math.round(x + tower - 16), 164 - h, 32, h + 116);
    ctx.fillRect(Math.round(x + tower - 22), 164 - h, 10, 13);
    ctx.fillRect(Math.round(x + tower + 12), 164 - h, 10, 13);
  }
  ctx.fillStyle = '#b2c98f';
  for (let i = -1; i <= 2; i += 1) ctx.fillRect(Math.round(x + i * 48), 218, 5, 10);
}

function drawFarForest() {
  const shift = -state.camera.x * .3;
  for (let i = -4; i < 20; i += 1) {
    const x = i * 92 + shift % 92;
    const height = 68 + hash(i + 30) * 65;
    ctx.fillStyle = i % 3 ? '#18342d' : '#1d3b31';
    ctx.fillRect(Math.round(x - 8), Math.round(HORIZON - height + 33), 16, Math.round(height));
    for (let b = 0; b < 5; b += 1) {
      const width = 58 - b * 8;
      ctx.fillRect(Math.round(x - width / 2), Math.round(HORIZON - height + b * 16), width, 18);
    }
  }
}

function drawMist() {
  const drift = (state.time * 6 - state.camera.x * .08) % 220;
  ctx.fillStyle = 'rgba(147, 188, 174, .08)';
  for (let i = -2; i < 8; i += 1) {
    const x = i * 220 + drift;
    ctx.fillRect(Math.round(x), 225 + (i % 2) * 12, 142, 10);
    ctx.fillRect(Math.round(x + 36), 237 + (i % 2) * 12, 176, 7);
  }
}

function drawGround() {
  ctx.fillStyle = '#183c2d'; ctx.fillRect(0, 0, W, H);

  const visibleLeft = state.camera.x - W / 2 - 100;
  const visibleRight = state.camera.x + W / 2 + 100;
  const visibleTop = state.camera.y - GROUND_Y * 2 - 180;
  const visibleBottom = state.camera.y + (H - GROUND_Y) * 2 + 180;

  for (const patch of mossPatches) {
    if (patch.x < visibleLeft || patch.x > visibleRight || patch.y < visibleTop || patch.y > visibleBottom) continue;
    const p = worldToScreen(patch.x, patch.y);
    ctx.fillStyle = '#28553a';
    ctx.fillRect(Math.round(p.x - patch.width / 2), Math.round(p.y - patch.height / 4), Math.round(patch.width), Math.round(patch.height / 2));
    ctx.fillStyle = '#3a6040';
    ctx.fillRect(Math.round(p.x - patch.width * .3), Math.round(p.y - patch.height * .6), Math.round(patch.width * .46), 4);
  }

  drawTrail();

  for (const zone of sceneMetadata.clearings) {
    const p = worldToScreen(zone.x, zone.y);
    ctx.fillStyle = zone.id.startsWith('LANDMARK') ? '#294f39' : '#244f36';
    for (let yy = -zone.ry / 2; yy <= zone.ry / 2; yy += 4) {
      const ww = zone.rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / ((zone.ry / 2) ** 2)));
      ctx.fillRect(Math.round(p.x - ww), Math.round(p.y + yy), Math.round(ww * 2), 4);
    }
  }

  for (const bit of groundBits) {
    if (bit.x < visibleLeft || bit.x > visibleRight || bit.y < visibleTop || bit.y > visibleBottom) continue;
    const p = worldToScreen(bit.x, bit.y);
    if (bit.type === 'stone') {
      ctx.fillStyle = bit.tone ? '#557061' : '#486355';
      ctx.fillRect(p.x - 4, p.y - 2, 9, 4);
      ctx.fillStyle = '#789180'; ctx.fillRect(p.x - 2, p.y - 3, 5, 2);
    } else if (bit.type === 'magic') {
      const glow = .42 + Math.sin(state.time * 2 + bit.x) * .16;
      ctx.fillStyle = `rgba(152, 227, 181, ${glow})`;
      ctx.fillRect(p.x, p.y - 8, 3, 8); ctx.fillRect(p.x - 3, p.y - 5, 3, 3); ctx.fillRect(p.x + 3, p.y - 6, 3, 3);
    } else {
      ctx.fillStyle = bit.tone === 0 ? '#355941' : bit.tone === 1 ? '#2c5038' : '#3a6044';
      ctx.fillRect(p.x, p.y, 3, 7); ctx.fillRect(p.x + 4, p.y + 2, 2, 5);
    }
  }

  const socket = worldToScreen(sceneMetadata.eventSocket.x, sceneMetadata.eventSocket.y);
  ctx.strokeStyle = '#d7be68'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(socket.x, socket.y, 23, 8, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f0d982'; ctx.fillRect(socket.x - 2, socket.y - 3, 4, 4);
  if (state.debug.grid) drawGrid();
  if (state.debug.composition || qaMode === 'map') {
    for (const zone of sceneMetadata.clearings) { const p = worldToScreen(zone.x, zone.y); ctx.strokeStyle='#e9cf7a'; ctx.setLineDash([8,6]); ctx.beginPath(); ctx.ellipse(p.x,p.y,zone.rx,zone.ry/2,0,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); drawLabel(zone.id,p.x,p.y-zone.ry/2-8,'#f0d982'); }
    const spawn = worldToScreen(sceneMetadata.spawn.x, sceneMetadata.spawn.y); drawLabel('BUNNY SPAWN',spawn.x,spawn.y+25,'#a9e1bd'); drawLabel('EVENT SOCKET',socket.x,socket.y+22,'#f0d982');
  }
}

function drawTrail() {
  const points = [
    { x: -210, y: 1120 }, { x: -180, y: 760 }, { x: -40, y: 520 }, { x: 30, y: 270 },
    { x: -80, y: 80 }, { x: -15, y: -125 }, { x: 10, y: -335 },
  ];
  ctx.fillStyle = '#6b5a3b';
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]; const b = points[i + 1];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(distance / 22);
    for (let j = 0; j <= steps; j += 1) {
      const t = j / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const p = worldToScreen(x, y);
      const width = 70 + hash(i * 100 + j) * 28;
      ctx.fillRect(Math.round(p.x - width / 2), Math.round(p.y - 7), Math.round(width), 14);
      if (j % 4 === 0) {
        ctx.fillStyle = '#806b46'; ctx.fillRect(p.x - 18, p.y - 7, 23, 3); ctx.fillStyle = '#6b5a3b';
      }
    }
  }
  const branch = [{x:22,y:275},{x:260,y:310},{x:520,y:360},{x:900,y:380}];
  for (let i=0;i<branch.length-1;i+=1) for(let j=0;j<=18;j+=1){const t=j/18;const p=worldToScreen(branch[i].x+(branch[i+1].x-branch[i].x)*t,branch[i].y+(branch[i+1].y-branch[i].y)*t);ctx.fillStyle='#65583c';ctx.fillRect(p.x-32,p.y-6,64,12);}
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(193, 221, 180, .18)';
  ctx.lineWidth = 1;
  const spacingX = 96;
  const spacingY = 48;
  const origin = worldToScreen(0,0);
  for(let k=-18;k<=18;k+=1){const o=k*spacingX;ctx.beginPath();ctx.moveTo(origin.x+o-H*2,origin.y-H);ctx.lineTo(origin.x+o+H*2,origin.y+H);ctx.stroke();ctx.beginPath();ctx.moveTo(origin.x+o-H*2,origin.y+H);ctx.lineTo(origin.x+o+H*2,origin.y-H);ctx.stroke();}
}

function drawTree(prop, p) {
  const s = prop.size;
  ctx.fillStyle = 'rgba(7,15,10,.4)'; ctx.fillRect(p.x - 28 * s, p.y - 4, 56 * s, 8);
  ctx.fillStyle = '#3c2f22'; ctx.fillRect(p.x - 9 * s, p.y - 79 * s, 18 * s, 79 * s);
  ctx.fillStyle = '#59422a'; ctx.fillRect(p.x - 4 * s, p.y - 75 * s, 6 * s, 68 * s);
  const clusters = prop.family === 'spire'
    ? [[-34,-80,68,30],[-29,-105,58,31],[-24,-130,48,32],[-17,-153,34,28]]
    : prop.family === 'moonroot'
      ? [[-62,-88,60,47],[-22,-117,64,54],[26,-91,57,47],[-44,-143,62,49],[8,-153,65,51]]
      : [[-54,-91,62,48],[-15,-121,68,58],[28,-92,55,45],[-41,-145,64,48],[9,-153,55,45]];
  for (let i = 0; i < clusters.length; i += 1) {
    const [ox, oy, w, h] = clusters[i];
    ctx.fillStyle = prop.family === 'spire' ? (i%2?'#235347':'#173d35') : prop.family === 'moonroot' ? (i%2?'#2c5c45':'#1d493a') : (i%2?'#2c5b3d':'#204934');
    ctx.fillRect(Math.round(p.x + ox * s), Math.round(p.y + oy * s), Math.round(w * s), Math.round(h * s));
    ctx.fillStyle = prop.family === 'spire' ? '#37705b' : '#47764d';
    ctx.fillRect(Math.round(p.x + (ox + 6) * s), Math.round(p.y + (oy + 5) * s), Math.round(w * .48 * s), Math.round(7 * s));
  }
  if (prop.family === 'moonroot') {
    const pulse = .55 + Math.sin(state.time * 2) * .22;
    ctx.fillStyle = `rgba(184, 235, 157, ${pulse})`;
    ctx.fillRect(p.x - 4, p.y - 122 * s, 8, 8); ctx.fillRect(p.x + 24, p.y - 91 * s, 5, 5); ctx.fillRect(p.x - 31, p.y - 83 * s, 5, 5);
  }
}

function drawRock(prop, p) {
  const s = prop.size;
  ctx.fillStyle = 'rgba(7,15,10,.32)'; ctx.fillRect(p.x - 30 * s, p.y - 4, 60 * s, 8);
  ctx.fillStyle = '#3c5146'; ctx.fillRect(p.x - 27 * s, p.y - 29 * s, 54 * s, 29 * s);
  ctx.fillStyle = '#536d5e'; ctx.fillRect(p.x - 18 * s, p.y - 37 * s, 33 * s, 12 * s);
  ctx.fillStyle = '#759079'; ctx.fillRect(p.x - 12 * s, p.y - 33 * s, 20 * s, 5 * s);
  ctx.fillStyle = '#31523c'; ctx.fillRect(p.x + 3 * s, p.y - 8 * s, 20 * s, 6 * s);
}

function drawBush(prop, p) {
  const s = prop.size;
  ctx.fillStyle = 'rgba(7,15,10,.28)'; ctx.fillRect(p.x - 28 * s, p.y - 3, 56 * s, 7);
  ctx.fillStyle = '#1e4a34';
  ctx.fillRect(p.x - 31 * s, p.y - 30 * s, 28 * s, 28 * s); ctx.fillRect(p.x - 5 * s, p.y - 38 * s, 31 * s, 36 * s); ctx.fillRect(p.x + 18 * s, p.y - 25 * s, 22 * s, 23 * s);
  ctx.fillStyle = '#3b714d'; ctx.fillRect(p.x - 22 * s, p.y - 25 * s, 13 * s, 6 * s); ctx.fillRect(p.x + 2 * s, p.y - 32 * s, 14 * s, 6 * s);
}

function drawLog(prop, p) {
  const s = prop.size;
  ctx.fillStyle = 'rgba(7,15,10,.28)'; ctx.fillRect(p.x - 46 * s, p.y - 3, 92 * s, 7);
  ctx.fillStyle = '#513823'; ctx.fillRect(p.x - 43 * s, p.y - 18 * s, 86 * s, 18 * s);
  ctx.fillStyle = '#735034'; ctx.fillRect(p.x - 37 * s, p.y - 18 * s, 62 * s, 5 * s);
  ctx.fillStyle = '#33543b'; ctx.fillRect(p.x - 13 * s, p.y - 23 * s, 30 * s, 7 * s);
}

function drawRuin(prop, p) {
  const s = prop.size;
  ctx.fillStyle = 'rgba(7,15,10,.3)'; ctx.fillRect(p.x - 36 * s, p.y - 4, 72 * s, 8);
  ctx.fillStyle = '#465950'; ctx.fillRect(p.x - 31 * s, p.y - 47 * s, 22 * s, 47 * s); ctx.fillRect(p.x - 7 * s, p.y - 28 * s, 39 * s, 28 * s);
  ctx.fillStyle = '#68796d'; ctx.fillRect(p.x - 26 * s, p.y - 42 * s, 13 * s, 7 * s); ctx.fillRect(p.x, p.y - 23 * s, 25 * s, 6 * s);
  ctx.fillStyle = '#31553c'; ctx.fillRect(p.x - 31 * s, p.y - 9 * s, 27 * s, 6 * s);
}

function drawShrine(prop, p) {
  const s=prop.size;
  ctx.fillStyle='rgba(5,14,11,.38)';ctx.fillRect(p.x-88*s,p.y-5,176*s,10);
  ctx.fillStyle='#3e514d';ctx.fillRect(p.x-79*s,p.y-80*s,25*s,80*s);ctx.fillRect(p.x+54*s,p.y-80*s,25*s,80*s);
  ctx.fillStyle='#596c64';ctx.fillRect(p.x-73*s,p.y-76*s,12*s,66*s);ctx.fillRect(p.x+60*s,p.y-76*s,12*s,66*s);
  ctx.fillStyle='#465b55';ctx.fillRect(p.x-78*s,p.y-103*s,156*s,28*s);ctx.fillRect(p.x-61*s,p.y-123*s,122*s,26*s);
  ctx.fillStyle='#75867a';ctx.fillRect(p.x-50*s,p.y-116*s,100*s,7*s);ctx.fillRect(p.x-68*s,p.y-96*s,56*s,6*s);
  ctx.fillStyle='#c8d9bd';ctx.fillRect(p.x-10,p.y-108*s,20,27);ctx.fillStyle='#465b55';ctx.fillRect(p.x-3,p.y-112*s,17,25);
  const glow=.72+Math.sin(state.time*2.2)*.18;ctx.fillStyle=`rgba(245,196,92,${glow})`;ctx.fillRect(p.x-61*s,p.y-55*s,7,12);ctx.fillRect(p.x+55*s,p.y-55*s,7,12);
  ctx.fillStyle='#315a3f';ctx.fillRect(p.x-80*s,p.y-15*s,50*s,10*s);ctx.fillRect(p.x+29*s,p.y-20*s,48*s,10*s);
}

function drawProp(prop) {
  const p = worldToScreen(prop.x, prop.y);
  if (prop.type === 'tree') drawTree(prop, p);
  if (prop.type === 'rock') drawRock(prop, p);
  if (prop.type === 'bush') drawBush(prop, p);
  if (prop.type === 'log') drawLog(prop, p);
  if (prop.type === 'ruin') drawRuin(prop, p);
  if (prop.type === 'shrine') drawShrine(prop, p);
  drawEntityDebug(prop, p, prop.type.toUpperCase());
}

function drawCastShadow(prop) {
  if (prop.type === 'bush') return;
  const p=worldToScreen(prop.x,prop.y);const s=prop.size||1;const large=prop.type==='tree'||prop.type==='shrine';
  const length=(large?86:48)*s;ctx.fillStyle=large?'rgba(5,18,22,.28)':'rgba(5,18,22,.2)';
  for(let i=0;i<4;i+=1)ctx.fillRect(Math.round(p.x+8+i*length/4),Math.round(p.y+3+i*5),Math.round(length/3),Math.max(3,Math.round((large?8:6)-i)));
}

function nearestMonster() {
  return monsters.reduce((best, monster) => {
    const distance = Math.hypot(monster.x - state.player.x, monster.y - state.player.y);
    return !best || distance < best.distance ? { monster, distance } : best;
  }, null);
}

function drawMonster(monster) {
  const p = worldToScreen(monster.x, monster.y);
  const target = nearestMonster()?.monster === monster;
  if (target) drawTargetIndicator(p.x, p.y, monster.size);
  ctx.fillStyle = 'rgba(7,15,10,.34)'; ctx.fillRect(p.x - monster.size * .36, p.y - 4, monster.size * .72, 8);
  ctx.fillStyle = monster.color;
  if (monster.kind === 'small') {
    ctx.fillRect(p.x - 14, p.y - 25, 28, 24); ctx.fillRect(p.x - 10, p.y - 32, 7, 10); ctx.fillRect(p.x + 4, p.y - 32, 7, 10);
  } else if (monster.kind === 'medium') {
    ctx.fillRect(p.x - 20, p.y - 37, 40, 36); ctx.fillRect(p.x - 27, p.y - 28, 10, 20); ctx.fillRect(p.x + 17, p.y - 28, 10, 20);
  } else {
    ctx.fillRect(p.x - 30, p.y - 54, 60, 53); ctx.fillRect(p.x - 41, p.y - 40, 14, 31); ctx.fillRect(p.x + 27, p.y - 40, 14, 31); ctx.fillRect(p.x - 18, p.y - 67, 36, 15);
  }
  ctx.fillStyle = '#e7d98a'; ctx.fillRect(p.x - 8, p.y - monster.size * .55, 4, 4); ctx.fillRect(p.x + 5, p.y - monster.size * .55, 4, 4);
  const barWidth=monster.kind==='elite'?62:monster.kind==='medium'?46:34;const barY=p.y-monster.size-9;
  ctx.fillStyle='#171c19';ctx.fillRect(p.x-barWidth/2-2,barY-2,barWidth+4,7);ctx.fillStyle=target?'#e6c66d':'#9d4f4c';ctx.fillRect(p.x-barWidth/2,barY,Math.round(barWidth*(monster.hp||1)),3);
  if(monster.kind==='elite'){ctx.fillStyle='#ead38a';ctx.font='8px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText('ELITE',p.x,barY-4);}
  if (state.debug.labels) drawLabel(`${monster.name} · ${monster.kind}`, p.x, p.y - monster.size - 9, '#e7bd9d');
  if (state.debug.hitboxes) drawEllipse(p.x, p.y, monster.radiusX, monster.radiusY, '#f08376');
  drawAnchor(p.x, p.y, monster.y, '#ee8f7d');
  if (state.damageTimer > 0 && target) drawDamageNumber(p.x, p.y - monster.size - 18);
}

function drawPlayer() {
  const player = state.player;
  const p = worldToScreen(player.x, player.y);
  const direction = directionNames[player.directionIndex];
  ctx.fillStyle = 'rgba(7,15,10,.34)'; ctx.fillRect(p.x - 18, p.y - 4, 36, 8);
  ctx.drawImage(sprites[direction], p.x - 32, p.y - 64, 64, 64);
  if (state.debug.labels) drawLabel(`${Math.round(player.heading)}° · ${direction.toUpperCase()}`, p.x, p.y - 76, '#f3dc82');
  if (state.debug.hitboxes) drawEllipse(p.x, p.y, player.radiusX, player.radiusY, '#72d8be');
  drawAnchor(p.x, p.y, player.y, '#f3dc82');
}

function drawCombatGround() {
  if (!state.debug.range) return;
  const p = worldToScreen(state.player.x, state.player.y);
  ctx.strokeStyle = state.attackTimer > 0 ? 'rgba(247,218,112,.8)' : 'rgba(247,218,112,.25)';
  ctx.lineWidth = state.attackTimer > 0 ? 2 : 1;
  ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.ellipse(p.x, p.y, 96, 48, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
}

function drawSlash() {
  if (state.attackTimer <= 0) return;
  const p = worldToScreen(state.player.x, state.player.y);
  const angle = state.player.heading * Math.PI / 180;
  for (let i = -3; i <= 3; i += 1) {
    const a = angle + i * .12;
    const distance = 48 + (3 - Math.abs(i)) * 4;
    ctx.fillStyle = i === 0 ? '#fff2b0' : '#d9b85f';
    ctx.fillRect(Math.round(p.x + Math.sin(a) * distance), Math.round(p.y - Math.cos(a) * distance * .55 - 18), 8, 4);
  }
}

function drawTargetIndicator(x, y, size) {
  ctx.strokeStyle = '#e9cf7a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 18, y + 8); ctx.lineTo(x, y + 14); ctx.lineTo(x + 18, y + 8); ctx.stroke();
  ctx.fillStyle = '#e9cf7a'; ctx.fillRect(x - 2, y + 11, 4, 4);
}

function drawDamageNumber(x, y) {
  const lift = (1 - state.damageTimer / .65) * 20;
  ctx.font = 'bold 16px ui-monospace, monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#3b2018'; ctx.fillText('128', x + 2, y - lift + 2);
  ctx.fillStyle = '#ffe08a'; ctx.fillText('128', x, y - lift);
}

function drawForeground() {
  const shift = -state.camera.x * 1.1;
  ctx.fillStyle = '#10291e';
  const positions = [-110, 175, 1040, 1310];
  for (let i = 0; i < positions.length; i += 1) {
    const x = positions[i] + (shift % 80);
    const y = H - 14;
    ctx.fillRect(x, y - 88, 12, 92); ctx.fillRect(x + 28, y - 62, 9, 66);
    ctx.fillRect(x - 24, y - 82, 48, 18); ctx.fillRect(x + 9, y - 58, 55, 16);
    ctx.fillStyle = '#173626'; ctx.fillRect(x - 14, y - 91, 32, 12); ctx.fillStyle = '#10291e';
  }
}

function drawParallaxLabels() {
  if (!state.debug.parallax) return;
  drawLayerTag('L0 SKY · 0×', 20, 48, '#9bc9c0');
  drawLayerTag('L1 FAR MOUNTAINS · 0.075×', 20, 82, '#8bbab3');
  drawLayerTag('L2 ANCIENT CASTLE · 0.17×', 20, 116, '#d2c783');
  drawLayerTag('L3 FAR FOREST · 0.30×', 20, 150, '#74ad8c');
  drawLayerTag('L4 GAMEPLAY PLANE · 1.0×', 20, 184, '#a8d28f');
  drawLayerTag('L5 FOREGROUND · 1.10×', 20, 218, '#65a77a');
}

function drawParticles() {
  for (let i = 0; i < 24; i += 1) {
    const x = (hash(i * 4) * W + state.time * (5 + i % 4) - state.camera.x * .12) % W;
    const y = HORIZON + 15 + hash(i * 9) * (H - HORIZON - 45);
    const pulse = .25 + Math.sin(state.time * 1.8 + i) * .18;
    ctx.fillStyle = `rgba(166, 230, 168, ${pulse})`; ctx.fillRect(Math.round(x), Math.round(y), i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
  }
  for (let i = 0; i < 10; i += 1) {
    const x = (hash(i * 12) * W - state.time * (9 + i) - state.camera.x * .2 + W * 2) % W;
    const y = HORIZON + 20 + ((hash(i * 3) * 240 + state.time * 7) % 250);
    ctx.fillStyle = i % 2 ? '#7d8f58' : '#9b8a4d'; ctx.fillRect(Math.round(x), Math.round(y), 5, 3);
  }
}

function drawEntityDebug(entity, p, label) {
  if (state.debug.collisions && entity.collider) drawEllipse(p.x, p.y, entity.collider.rx, entity.collider.ry * .5, '#ec766b');
  if (state.debug.labels) drawLabel(label, p.x, p.y + 18, '#b8cfb3');
  drawAnchor(p.x, p.y, entity.y, '#7bd2ad');
}

function drawAnchor(x, y, depth, color) {
  if (state.debug.pivots) {
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
  }
  if (state.debug.depth) {
    ctx.fillStyle = color; ctx.fillRect(x - 2, y - 2, 4, 4);
    ctx.font = '8px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.fillText(`z ${depth.toFixed(0)}`, x + 6, y + 3);
  }
}

function drawEllipse(x, y, rx, ry, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
}

function drawLabel(text, x, y, color) {
  ctx.font = '8px ui-monospace, monospace'; ctx.textAlign = 'center';
  const width = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(8,14,11,.82)'; ctx.fillRect(Math.round(x - width / 2), Math.round(y - 8), Math.round(width), 14);
  ctx.fillStyle = color; ctx.fillText(text, Math.round(x), Math.round(y + 2));
}

function drawLayerTag(text, x, y, color) {
  ctx.font = '8px ui-monospace, monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(6,12,9,.72)'; ctx.fillRect(x, y - 10, ctx.measureText(text).width + 10, 15);
  ctx.fillStyle = color; ctx.fillText(text, x + 5, y);
}

function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  drawGround();
  for (const prop of props) drawCastShadow(prop);
  drawCombatGround();

  const entities = [
    ...props.map((entity) => ({ kind: 'prop', entity })),
    ...monsters.map((entity) => ({ kind: 'monster', entity })),
    { kind: 'player', entity: state.player },
  ].filter(({ entity }) => {
    const p = worldToScreen(entity.x, entity.y);
    const margin = entity.type === 'tree' ? 180 : 100;
    return p.x > -margin && p.x < W + margin && p.y > -margin && p.y < H + margin;
  }).sort((a, b) => a.entity.y - b.entity.y);

  for (const item of entities) {
    if (item.kind === 'prop') drawProp(item.entity);
    if (item.kind === 'monster') drawMonster(item.entity);
    if (item.kind === 'player') drawPlayer();
  }
  drawSlash(); drawParticles();
  ctx.fillStyle='rgba(4,15,15,.18)';ctx.fillRect(0,0,W,18);ctx.fillRect(0,H-20,W,20);ctx.fillRect(0,0,16,H);ctx.fillRect(W-16,0,16,H);
}

function syncReadout() {
  const player = state.player;
  const direction = directionNames[player.directionIndex];
  const speed = Math.hypot(player.vx, player.vy);
  document.querySelector('#direction-chip').textContent = `${Math.round(player.heading)}° · ${direction.toUpperCase()}`;
  document.querySelector('#scene-coordinates').textContent = `WORLD ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`;
  document.querySelector('#player-position').textContent = `${player.x.toFixed(1)} / ${player.y.toFixed(1)}`;
  document.querySelector('#active-heading').textContent = `${Math.round(player.heading)}°`;
  document.querySelector('#active-rotation').textContent = `${direction}.png`;
  document.querySelector('#player-velocity').textContent = `${speed.toFixed(1)} px/s`;
  document.querySelector('#depth-value').textContent = player.y.toFixed(1);
}

function triggerAttack() {
  state.attackTimer = .34;
  state.damageTimer = .65;
}

const keyNames = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
};

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') { event.preventDefault(); triggerAttack(); return; }
  if (!keyNames[event.key]) return;
  event.preventDefault(); state.keys.add(keyNames[event.key]);
});
window.addEventListener('keyup', (event) => { if (keyNames[event.key]) state.keys.delete(keyNames[event.key]); });
window.addEventListener('blur', () => state.keys.clear());

canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * W / rect.width;
  const y = (event.clientY - rect.top) * H / rect.height;
  if (y < HORIZON + 8) return;
  state.target = screenToWorld(x, y);
  state.target.x = Math.max(WORLD.minX + 30, Math.min(WORLD.maxX - 30, state.target.x));
  state.target.y = Math.max(WORLD.minY + 20, Math.min(WORLD.maxY - 20, state.target.y));
});

const debugBindings = [
  ['toggle-grid', 'grid'], ['toggle-pivots', 'pivots'], ['toggle-labels', 'labels'],
  ['toggle-collisions', 'collisions'], ['toggle-depth', 'depth'], ['toggle-range', 'range'],
  ['toggle-hitboxes', 'hitboxes'], ['toggle-composition', 'composition'],
];
for (const [id, key] of debugBindings) {
  document.querySelector(`#${id}`).addEventListener('change', (event) => { state.debug[key] = event.currentTarget.checked; });
}
document.querySelector('#attack-test').addEventListener('click', triggerAttack);

let previousTime = performance.now();
let readoutAccumulator = 0;
function frame(now) {
  const dt = Math.min(.05, (now - previousTime) / 1000);
  previousTime = now;
  update(dt);
  render();
  readoutAccumulator += dt;
  if (readoutAccumulator > .08) { syncReadout(); readoutAccumulator = 0; }
  requestAnimationFrame(frame);
}

syncReadout();
requestAnimationFrame(frame);
