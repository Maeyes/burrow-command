// Map editor: paint intent (terrain level / water / road / forest density / objects) on the same iso
// orientation as the game. The engine derives every edge (cliffs, banks, foam, falls, road borders);
// scenes/custom.js adds stairs where roads meet cliffs and bridges where roads cross water.
import { T, S, clamp } from './engine/util.js';
import { BIOMES } from './engine/biomes.js';
import { rabbitBurrowSprite } from './engine/sprites.js';
import { COBBLE, WOOD, MARBLE } from './engine/palettes.js';
import { emptyMap, MAP_N, MAP_CELL, OBJECT_TYPES, ROOFS, SLOPE_STYLES, slopeStyleOf, autoStairs, settleWater, bridgesFromMask } from './scenes/custom.js';

const N = MAP_N, CELL = MAP_CELL;
const $ = id => document.getElementById(id);
const canvas = $('edit'), ctx = canvas.getContext('2d');
const burrowArt = rabbitBurrowSprite();

// ---------- state ----------
let map = upgrade(loadDraft() || emptyMap('my-map'));
let level, water, road, forest, bridge;
function upgrade(m) { const z = '0'.repeat(N * N); m.forest ||= z; m.bridge ||= z; m.objects ||= []; m.roster ??= ''; m.version = 2; return m; }
const dec = s => Uint8Array.from(s, c => c.charCodeAt(0) - 48);
function unpack() { level = dec(map.level); water = dec(map.water); road = dec(map.road); forest = dec(map.forest); bridge = dec(map.bridge); derive(); }
function pack() {
  const s = a => { let out = ''; for (let i = 0; i < a.length; i += 8192) out += String.fromCharCode(...Array.from(a.subarray(i, i + 8192), v => v + 48)); return out; };
  map.level = s(level); map.water = s(water); map.road = s(road); map.forest = s(forest); map.bridge = s(bridge);
  return map;
}
function loadDraft() { try { return JSON.parse(localStorage.getItem('bw-map-draft')); } catch { return null; } }
function saveDraft() { try { localStorage.setItem('bw-map-draft', JSON.stringify(pack())); } catch {} }

// derived previews (stairs/bridges the game will build), refreshed after each stroke
let stairCells = new Uint8Array(N * N), bridgeCells = new Uint8Array(N * N), settled = null;
function derive() {
  settled = settleWater(level, water, N); // how the game will level water painted along cliffs
  const { taken } = autoStairs(level.slice(), road, water, N, CELL, slopeStyleOf(map)); stairCells = taken;
  bridgeCells = new Uint8Array(N * N);
  for (const b of bridgesFromMask(bridge, water, N, CELL)) {
    const x0 = b.x0 / CELL, x1 = b.x1 / CELL, y0 = b.y0 / CELL, y1 = b.y1 / CELL;
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) bridgeCells[j * N + i] = 1;
  }
}
unpack();

const undoStack = [], redoStack = [];
const snapshot = () => ({ level: level.slice(), water: water.slice(), road: road.slice(), forest: forest.slice(), bridge: bridge.slice(), spawn: { ...map.spawn }, objects: JSON.parse(JSON.stringify(map.objects)) });
const restore = s => { level = s.level.slice(); water = s.water.slice(); road = s.road.slice(); forest = s.forest.slice(); bridge = s.bridge.slice(); map.spawn = { ...s.spawn }; map.objects = s.objects; derive(); draw(); saveDraft(); };
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; }

// ---------- tools ----------
const TOOLS = [
  { id: 'l0', label: 'พื้นต่ำ', key: '1', lvl: 0 }, { id: 'l1', label: 'เนิน 1', key: '2', lvl: 1 },
  { id: 'l2', label: 'เนิน 2', key: '3', lvl: 2 }, { id: 'l3', label: 'เนิน 3', key: '4', lvl: 3 },
  { id: 'water', label: 'น้ำ', key: 'w' }, { id: 'lava', label: 'ลาวา', key: 'v' }, { id: 'road', label: 'ถนนหิน', key: 'r' }, { id: 'trail', label: 'ทางดิน', key: 't' }, { id: 'bridge', label: 'สะพาน', key: 'b' },
  { id: 'fDense', label: 'ป่าทึบ', key: 'f', forest: 4 }, { id: 'fSparse', label: 'ป่าโปร่ง', key: 'g', forest: 2 }, { id: 'fClear', label: 'ลานโล่ง', key: 'c', forest: 1 },
  { id: 'erase', label: 'ยางลบ', key: 'e' }, { id: 'obj', label: 'วางของ', key: 'o' }, { id: 'spawn', label: 'จุดเกิด', key: 's' },
];
let tool = 'l1', objType = 'tree', selectedPortal = null, availableMaps = [];
const kit = () => BIOMES[map.biome] || BIOMES.forest;
function swatch(t) {
  const K = kit();
  if (t.lvl !== undefined) return `rgb(${K.ground[clamp(1 + t.lvl, 0, 5)]})`;
  if (t.id === 'water') return `rgb(${K.liquid[3]})`;
  if (t.id === 'lava') return `rgb(${BIOMES.magma.liquid[3]})`;
  if (t.id === 'road') return `rgb(${COBBLE[3]})`;
  if (t.id === 'trail') return `rgb(${K.dirt[3]})`;
  if (t.id === 'bridge') return `rgb(${WOOD[3]})`;
  if (t.forest) return ['', '#d8e8b0', '#8fbf5a', '', '#2c5a2a'][t.forest];
  if (t.id === 'obj') return OBJECT_TYPES[objType].color;
  if (t.id === 'spawn') return '#fff2a8';
  return '#222';
}
function buildToolbar() {
  const bar = $('tools'); bar.innerHTML = '';
  for (const t of TOOLS) {
    const b = document.createElement('button');
    b.innerHTML = `<span class="sw" style="background:${swatch(t)}"></span>${t.label}`;
    b.title = `ปุ่ม ${t.key}`; b.className = tool === t.id ? 'on' : '';
    b.onclick = () => { tool = t.id; buildToolbar(); };
    bar.appendChild(b);
  }
  $('objBar').style.display = tool === 'obj' ? 'flex' : 'none';
  $('houseOpts').style.display = tool === 'obj' && objType === 'house' ? 'flex' : 'none';
  const field = OBJECT_TYPES[objType]?.kind === 'field';
  $('farmOpts').style.display = tool === 'obj' && field ? 'flex' : 'none';
  $('cropWrap').style.display = objType === 'flowerMeadow' ? 'none' : '';
  $('buildOpts').style.display = tool === 'obj' && OBJECT_TYPES[objType]?.kind === 'building' ? 'flex' : 'none';
  $('lineOpts').style.display = tool === 'obj' && (objType === 'fence' || objType === 'stoneWall' || objType === 'stoneGate' || objType === 'log') ? 'flex' : 'none';
  $('lenWrap').style.display = objType === 'fence' || objType === 'stoneWall' ? '' : 'none';
  $('portalOpts').style.display = tool === 'obj' && objType === 'portal' && selectedPortal ? 'flex' : 'none';
}
$('objType').innerHTML = Object.entries(OBJECT_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
$('objType').onchange = e => { objType = e.target.value; selectedPortal=null; buildToolbar(); };
function syncPortalForm(){if(!selectedPortal)return;$('portalId').value=selectedPortal.id||'';$('portalTo').innerHTML='<option value="">—</option>'+availableMaps.map(n=>`<option value="${n}">${n}</option>`).join('');$('portalTo').value=selectedPortal.to||'';$('portalToPortal').value=selectedPortal.toPortal||'';buildToolbar();}
for(const id of ['portalId','portalTo','portalToPortal'])$(id).addEventListener('change',()=>{if(!selectedPortal)return;selectedPortal.id=$('portalId').value.trim();selectedPortal.to=$('portalTo').value;selectedPortal.toPortal=$('portalToPortal').value.trim();saveDraft();draw();});
$('roof').innerHTML = Object.keys(ROOFS).map(k => `<option>${k}</option>`).join('');
$('biome').innerHTML = Object.keys(BIOMES).map(k => `<option value="${k}">${k}</option>`).join('');
$('roster').innerHTML = [['','Auto (ตามธีม)'],['forest','Forest'],['desert','Desert'],['mine','Mine']].map(([k,label]) => `<option value="${k}">${label}</option>`).join('');
$('biome').value = map.biome; $('roster').value = map.roster || ''; $('name').value = map.name;
$('biome').onchange = e => { map.biome = e.target.value; buildToolbar(); derive(); draw(); saveDraft(); };
$('roster').onchange = e => { map.roster = e.target.value; saveDraft(); };
$('slope').innerHTML = Object.entries(SLOPE_STYLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('slope').value = map.slopeStyle || 'auto';
$('slope').onchange = e => { map.slopeStyle = e.target.value; derive(); draw(); saveDraft(); };
$('name').onchange = e => { map.name = e.target.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'); e.target.value = map.name; saveDraft(); };
$('size').oninput = e => { $('sizeV').textContent = e.target.value; };

// ---------- view (iso, same orientation as the game, flat) ----------
let E = .3, OX = 0, OY = 0;
function layout() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(200, Math.floor(r.width)); canvas.height = Math.max(200, Math.floor(r.height));
  E = Math.min(canvas.width / (S * 1.04), canvas.height / (S * .52));
  OX = canvas.width / 2; OY = (canvas.height - S * .5 * E) / 2;
  draw();
}
const toScreen = (x, y) => [OX + (x - y) / 2 * E, OY + (x + y) / 4 * E];
const toWorld = (px, py) => { const sx = (px - OX) / E, sy = (py - OY) / E; return [sx + 2 * sy, 2 * sy - sx]; };
const cellOf = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
const edgeOf = (a, k, i, j) => (i > 0 && !a[k - 1]) || (j > 0 && !a[k - N]) || (i < N - 1 && !a[k + 1]) || (j < N - 1 && !a[k + N]);

let img = null;
function draw() {
  const w = canvas.width, h = canvas.height;
  if (!img || img.width !== w || img.height !== h) img = ctx.createImageData(w, h);
  const d = img.data, K = kit();
  const lvlCol = [0, 1, 2, 3].map(l => K.ground[clamp(1 + l, 0, 5)]), cliffCol = K.cliff[1], wCol = K.liquid[3], wDeep = K.liquid[1];
  const treeDark = K.moss[1], rCol = COBBLE[3], rEdge = COBBLE[1], wood = WOOD[3], stairC = COBBLE[4];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const o = (py * w + px) * 4, [x, y] = toWorld(px + .5, py + .5), k = cellOf(x, y);
    if (k < 0) { d[o] = 10; d[o + 1] = 11; d[o + 2] = 9; d[o + 3] = 255; continue; }
    const i = k % N, j = (k / N) | 0, L = level[k];
    let c = lvlCol[L];
    // forest brush: dots (dense = many dark dots, sparse = few, clearing = pale wash)
    const f = forest[k];
    if (f === 4 && ((px + py * 3) % 5 === 0 || (px * 7 + py) % 11 === 0)) c = treeDark;
    else if (f === 2 && (px * 3 + py * 5) % 17 === 0) c = treeDark;
    else if (f === 1) c = [c[0] * .8 + 50, c[1] * .8 + 50, c[2] * .8 + 40];
    const fx = x / CELL - i, fy = y / CELL - j;
    if ((i < N - 1 && level[k + 1] < L && fx > .55) || (j < N - 1 && level[k + N] < L && fy > .55)) c = cliffCol;
    if (road[k]) c = road[k] === 2 ? K.dirt[edgeOf(road, k, i, j) ? 1 : 3] : edgeOf(road, k, i, j) ? rEdge : rCol;
    if (water[k]) {
      const lava = water[k] === 2, edge = edgeOf(water, k, i, j);
      c = lava ? (edge ? BIOMES.magma.liquid[4] : BIOMES.magma.liquid[2]) : edge ? wCol : wDeep;
      // waterfalls: liquid stepping down toward the camera (+x / +y) = visible fall (striped);
      // stepping down away from the camera is hidden behind the cliff (red warning dots)
      const SL = settled, LS = SL[k];
      const fallVis = (i < N - 1 && water[k + 1] && SL[k + 1] < LS && fx > .5) || (j < N - 1 && water[k + N] && SL[k + N] < LS && fy > .5);
      const fallHid = (i > 0 && water[k - 1] && SL[k - 1] < LS && fx < .3) || (j > 0 && water[k - N] && SL[k - N] < LS && fy < .3);
      if (fallVis) c = (Math.floor((x - y) / 5) & 1) ? [250, 252, 255] : lava ? BIOMES.magma.liquid[5] : K.liquid[4];
      else if (fallHid && ((px + py) & 3) === 0) c = [230, 60, 60];
    }
    if (bridgeCells[k]) c = edgeOf(bridgeCells, k, i, j) ? WOOD[1] : (Math.floor(x / 6) & 1) ? wood : WOOD[2];
    if (stairCells[k]) { const st = slopeStyleOf(map); c = st === 'marble' ? MARBLE[(Math.floor((x + y) / 7) & 1) ? 4 : 2] : st === 'ramp' || st === 'slope' ? K.dirt[(Math.floor((x + y) / 9) & 1) ? 3 : 2] : st === 'wood' ? WOOD[(Math.floor((x + y) / 7) & 1) ? 3 : 1] : (Math.floor((x + y) / 7) & 1) ? stairC : COBBLE[2]; }
    const tx = x / T, ty = y / T, gl = (Math.abs(tx - Math.round(tx)) < .03 || Math.abs(ty - Math.round(ty)) < .03) ? .88 : 1;
    const shade = 1 + L * .06;
    d[o] = c[0] * gl * shade; d[o + 1] = c[1] * gl * shade; d[o + 2] = c[2] * gl * shade; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = '#c9a86a'; ctx.lineWidth = 1.5; ctx.beginPath();
  [[0, 0], [S, 0], [S, S], [0, S]].forEach(([x, y], n) => { const [sx, sy] = toScreen(x, y); n ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath(); ctx.stroke();
  for (const ob of map.objects) {
    const def = OBJECT_TYPES[ob.type]; if (!def) continue;
    const [sx, sy] = toScreen(ob.x * T, ob.y * T);
    if (ob.type === 'rabbitBurrow' && burrowArt) {
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(burrowArt.img, sx - burrowArt.ox * E, sy - burrowArt.oy * E, burrowArt.img.width * E, burrowArt.img.height * E);
      ctx.restore();
      continue;
    }
    if (ob.type === 'house' || def.kind === 'building') {
      const hw = (ob.w || def.w || 3.5) / 2 * T, hd = (ob.d || def.d || 2.75) / 2 * T;
      ctx.fillStyle = ob.type === 'house' ? `rgb(${(ROOFS[ob.roof] || ROOFS.red)[3]})` : def.color; ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 1; ctx.beginPath();
      [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].forEach(([dx, dy], n) => { const [a, b] = toScreen(ob.x * T + dx, ob.y * T + dy); n ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('⌂' + (ob.floors > 1 ? ob.floors : ''), sx, sy + 4);
      continue;
    }
    if (def.kind === 'field') {
      const half = (ob.size || 3) / 2 * T;
      ctx.fillStyle = def.color + 'aa'; ctx.strokeStyle = def.color; ctx.lineWidth = 1.5; ctx.beginPath();
      [[-half, -half], [half, -half], [half, half], [-half, half]].forEach(([dx, dy], n) => { const [a, b] = toScreen(ob.x * T + dx, ob.y * T + dy); n ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(ob.type === 'flowerMeadow' ? '✿' : `${ob.stage || 4}`, sx, sy + 3);
      continue;
    }
    if (ob.type === 'fence' || ob.type === 'stoneWall' || ob.type === 'stoneGate' || ob.type === 'log') { // draw as a line along its axis
      const L = (ob.type === 'fence' || ob.type === 'stoneWall' || ob.type === 'stoneGate' ? (ob.len || (ob.type === 'stoneGate' ? 2 : 3)) : .9) * T / 2, [ax, ay] = ob.axis === 'y' ? [0, L] : [L, 0];
      const [a1, b1] = toScreen(ob.x * T - ax, ob.y * T - ay), [a2, b2] = toScreen(ob.x * T + ax, ob.y * T + ay);
      ctx.strokeStyle = '#120e08'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke();
      ctx.strokeStyle = def.color; ctx.lineWidth = 3; ctx.stroke();
      if ((ob.type === 'stoneWall' || ob.type === 'stoneGate') && tool === 'obj' && (objType === 'stoneWall' || objType === 'stoneGate')) {
        ctx.fillStyle = '#f0c878';
        for (const [px, py] of [[a1, b1], [a2, b2]]) { ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); }
      }
      continue;
    }
    const rr = Math.max(3, def.r * T * E * .6);
    ctx.fillStyle = def.color; ctx.strokeStyle = '#120e08'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(sx, sy, rr, rr * .6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (ob.type === 'monster') { ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('M', sx, sy + 3); }
  }
  if (hover && tool === 'obj' && (objType === 'stoneWall' || objType === 'stoneGate')) {
    const ghost = { type: objType, axis: $('axis').value, len: objType === 'stoneGate' ? 2 : +$('flen').value };
    const p = snapStoneWall(ghost, hover[0] / T, hover[1] / T);
    const L = ghost.len * T / 2, [ax, ay] = ghost.axis === 'y' ? [0, L] : [L, 0];
    const [a1, b1] = toScreen(p.x * T - ax, p.y * T - ay), [a2, b2] = toScreen(p.x * T + ax, p.y * T + ay);
    ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = '#fff2a8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); ctx.restore();
  }
  if (drag) { const [sx, sy] = toScreen(drag.ob.x * T, drag.ob.y * T); ctx.strokeStyle = '#fff'; ctx.strokeRect(sx - 6, sy - 5, 12, 10); }
  const [spx, spy] = toScreen(map.spawn.x * T, map.spawn.y * T);
  ctx.fillStyle = '#fff2a8'; ctx.strokeStyle = '#2a1c10'; ctx.beginPath(); ctx.arc(spx, spy - 6, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillRect(spx - 1, spy - 6, 2, 8);
  if (hover && tool !== 'obj' && tool !== 'spawn') {
    const r = (+$('size').value) * CELL;
    ctx.strokeStyle = 'rgba(255,240,190,.9)'; ctx.beginPath();
    for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2, [sx, sy] = toScreen(hover[0] + Math.cos(t) * r, hover[1] + Math.sin(t) * r); a ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }
    ctx.stroke();
  }
}

// ---------- painting ----------
let painting = false, erasing = false, last = null, hover = null, dirty = false, drag = null;
function stamp(x, y) {
  const r = (+$('size').value) * CELL, t = TOOLS.find(q => q.id === tool);
  for (let j = Math.floor((y - r) / CELL); j <= Math.floor((y + r) / CELL); j++) for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
    if (i < 0 || j < 0 || i >= N || j >= N || Math.hypot((i + .5) * CELL - x, (j + .5) * CELL - y) > r) continue;
    const k = j * N + i;
    if (erasing) { if (t.lvl !== undefined) level[k] = 0; else if (t.forest) forest[k] = 0; else if (tool === 'water' || tool === 'lava') water[k] = 0; else if (tool === 'road' || tool === 'trail') road[k] = 0; else if (tool === 'bridge') bridge[k] = 0; else { water[k] = 0; road[k] = 0; } continue; }
    if (tool === 'erase') { water[k] = 0; road[k] = 0; forest[k] = 0; bridge[k] = 0; continue; }
    if (t.lvl !== undefined) level[k] = t.lvl;
    else if (t.forest) forest[k] = t.forest;
    else if (tool === 'water') water[k] = 1;   // painting water over a road makes a bridge
    else if (tool === 'lava') water[k] = 2;
    else if (tool === 'road') road[k] = 1;     // painting a road over water makes a bridge
    else if (tool === 'trail') road[k] = 2;
    else if (tool === 'bridge') bridge[k] = 1;
  }
  dirty = true;
}
function strokeTo(x, y) {
  if (!last) { stamp(x, y); last = [x, y]; return; }
  const [lx, ly] = last, dist = Math.hypot(x - lx, y - ly), step = Math.max(4, (+$('size').value) * CELL * .4);
  for (let s = step; s <= dist; s += step) stamp(lx + (x - lx) * s / dist, ly + (y - ly) * s / dist);
  stamp(x, y); last = [x, y];
}
function objectAt(x, y) {
  let best = null, bd = 1e9;
  const tx = x / T, ty = y / T;
  for (const ob of map.objects) {
    const def = OBJECT_TYPES[ob.type]; if (!def) continue;
    let dd = Math.hypot(ob.x - tx, ob.y - ty);
    if (ob.type === 'stoneWall' || ob.type === 'stoneGate') {
      const along = ob.axis === 'y' ? Math.abs(ty - ob.y) : Math.abs(tx - ob.x);
      const across = ob.axis === 'y' ? Math.abs(tx - ob.x) : Math.abs(ty - ob.y);
      dd = Math.hypot(Math.max(0, along - (ob.len || 3) / 2), across);
    }
    if (dd < Math.max(.45, def.r) && dd < bd) { bd = dd; best = ob; }
  }
  return best;
}
function wallEnds(ob) {
  const h = (ob.len || 3) / 2;
  return ob.axis === 'y'
    ? [{ x: ob.x, y: ob.y - h }, { x: ob.x, y: ob.y + h }]
    : [{ x: ob.x - h, y: ob.y }, { x: ob.x + h, y: ob.y }];
}
function snapStoneWall(ob, x, y) {
  let best = { x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 }, bestD = 1.25;
  const h = (ob.len || 3) / 2;
  for (const other of map.objects) {
    if (other === ob || (other.type !== 'stoneWall' && other.type !== 'stoneGate')) continue;
    for (const end of wallEnds(other)) {
      const candidates = ob.axis === 'y'
        ? [{ x: end.x, y: end.y - h }, { x: end.x, y: end.y + h }]
        : [{ x: end.x - h, y: end.y }, { x: end.x + h, y: end.y }];
      for (const p of candidates) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) { best = p; bestD = d; }
      }
    }
  }
  return { x: +best.x.toFixed(2), y: +best.y.toFixed(2) };
}
const evWorld = e => { const r = canvas.getBoundingClientRect(); return toWorld((e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height); };
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  const [x, y] = evWorld(e);
  if (tool === 'spawn' && e.button === 0) { pushUndo(); map.spawn = { x: +(x / T).toFixed(2), y: +(y / T).toFixed(2) }; draw(); saveDraft(); return; }
  if (tool === 'obj') {
    const hit = objectAt(x, y);
    pushUndo();
    if (e.button === 2) { if (hit) map.objects.splice(map.objects.indexOf(hit), 1); draw(); saveDraft(); return; }
    if (hit) { if(hit.type==='portal'){selectedPortal=hit;syncPortalForm();}else selectedPortal=null; drag = { ob: hit }; canvas.setPointerCapture(e.pointerId); return; }
    const ob = { type: objType, x: +(x / T).toFixed(2), y: +(y / T).toFixed(2) };
    if (objType === 'house') { ob.roof = $('roof').value; ob.floors = +$('floors').value; ob.ridge = $('ridge').value; }
    if (OBJECT_TYPES[objType]?.kind === 'building') { ob.ridge = 'x'; ob.stage = $('buildStage').value; }
    if (OBJECT_TYPES[objType]?.kind === 'field') {
      ob.x = Math.round(ob.x * 2) / 2; ob.y = Math.round(ob.y * 2) / 2;
      ob.size = +$('farmSize').value; ob.stage = +$('cropStage').value;
      if (objType === 'farmPlot') ob.crop = $('crop').value;
    }
    if (objType === 'fence' || objType === 'stoneWall' || objType === 'stoneGate' || objType === 'log') ob.axis = $('axis').value;
    if (objType === 'fence' || objType === 'stoneWall') ob.len = +$('flen').value;
    if (objType === 'stoneGate') ob.len = 2;
    if (objType === 'stoneWall' || objType === 'stoneGate') Object.assign(ob, snapStoneWall(ob, x / T, y / T));
    if (objType === 'pillar') ob.broken = Math.random() < .4;
    if (objType === 'portal') { ob.id=''; ob.to=''; ob.toPortal=''; selectedPortal=ob; }
    map.objects.push(ob); if(objType==='portal')syncPortalForm(); draw(); saveDraft(); return;
  }
  pushUndo(); painting = true; erasing = e.button === 2; last = null; canvas.setPointerCapture(e.pointerId); strokeTo(x, y);
});
canvas.addEventListener('pointermove', e => {
  hover = evWorld(e);
  if (drag) {
    const p = drag.ob.type === 'stoneWall' || drag.ob.type === 'stoneGate'
      ? snapStoneWall(drag.ob, hover[0] / T, hover[1] / T)
      : { x: +(hover[0] / T).toFixed(2), y: +(hover[1] / T).toFixed(2) };
    drag.ob.x = p.x; drag.ob.y = p.y; dirty = true;
  }
  else if (painting) strokeTo(...hover);
});
canvas.addEventListener('pointerleave', () => { hover = null; dirty = true; });
canvas.addEventListener('pointerup', () => {
  if (drag) { drag = null; saveDraft(); dirty = true; }
  if (painting) { painting = false; derive(); saveDraft(); dirty = true; status('บันทึกร่างแล้ว (กด ▶ เพื่อดูภาพ iso)'); }
});
(function loop() { if (dirty || hover) { draw(); dirty = false; } requestAnimationFrame(loop); })();

// ---------- keys ----------
window.addEventListener('keydown', e => {
  if (e.target.matches?.('input,select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); } return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); if (redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); } return; }
  const t = TOOLS.find(q => q.key === e.key.toLowerCase()); if (t) { tool = t.id; buildToolbar(); }
  if (e.key === '[' || e.key === ']') { const s = $('size'); s.value = clamp(+s.value + (e.key === ']' ? 1 : -1), 1, 14); $('sizeV').textContent = s.value; }
});
$('undo').onclick = () => { if (undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); } };
$('redo').onclick = () => { if (redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); } };

// ---------- preview / files ----------
const status = t => { $('status').textContent = t; };
function preview(fast) { saveDraft(); $('view').src = `./index.html?map=draft${fast ? '&fast=1' : ''}&t=${Date.now()}`; status(fast ? 'กำลังสร้างภาพ iso (โหมดเร็ว)…' : 'กำลังสร้างภาพ iso เต็มความละเอียด…'); }
$('preview').onclick = () => preview(true);
$('previewFull').onclick = () => preview(false);
$('play').onclick = () => { saveDraft(); window.open('./index.html?map=draft', '_blank'); };
$('new').onclick = () => { if (!confirm('เริ่มแมพใหม่? (ของที่วาดอยู่จะหาย ถ้ายังไม่ได้ Save)')) return; pushUndo(); map = emptyMap(map.name, map.biome); unpack(); $('roster').value = map.roster || ''; draw(); saveDraft(); };
$('save').onclick = async () => {
  saveDraft();
  const r = await fetch('/__maps/save', { method: 'POST', body: JSON.stringify(pack()) }).then(r => r.json()).catch(e => ({ error: String(e) }));
  if (r.ok) { status(`บันทึกแล้ว → maps/${r.name}.json · เปิดเล่น: ?map=custom&file=${r.name}`); refreshList(); }
  else status('บันทึกไม่สำเร็จ: ' + r.error);
};
async function refreshList() {
  const names = await fetch('/__maps/list').then(r => r.json()).catch(() => []); availableMaps=names;
  $('load').innerHTML = '<option value="">เปิดแมพ…</option>' + names.map(n => `<option>${n}</option>`).join('');
  if(selectedPortal)syncPortalForm();
}
$('load').onchange = async e => {
  const n = e.target.value; if (!n) return;
  const data = await fetch(`./maps/${n}.json`, { cache: 'no-store' }).then(r => r.json());
  pushUndo(); map = upgrade(data); unpack(); $('slope').value = map.slopeStyle || 'auto'; $('biome').value = map.biome; $('roster').value = map.roster || ''; $('name').value = map.name; buildToolbar(); draw(); saveDraft(); e.target.value = '';
  status(`เปิด ${n} แล้ว`);
};
$('view').addEventListener('load', () => status('ภาพ iso พร้อม — เดินดูได้ในกรอบนี้ (คลิกในกรอบก่อนกด WASD)'));

buildToolbar(); refreshList();
window.addEventListener('resize', layout); layout();
