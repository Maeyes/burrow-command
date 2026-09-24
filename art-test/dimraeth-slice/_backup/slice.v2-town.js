// Dimraeth-style environment slice — visual target for the iso map.
// Same 2:1 projection as iso-arena-draft; everything is procedural pixel art.
// One renderer, several scene configs: ?map=forest (default) | ?map=town

const W = 1280, H = 720, T = 64, S = 40 * T;
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const loadingEl = document.getElementById('loading');
const MAP = new URLSearchParams(location.search).get('map') === 'town' ? 'town' : 'forest';

// ---------- math / noise ----------
function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => vnoise(x, y) * .55 + vnoise(x * 2.03 + 17, y * 2.03 + 9) * .3 + vnoise(x * 4.1 + 41, y * 4.1 + 3) * .15;
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - .47);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const pal = a => a.map(hex);
const isoX = (x, y) => (x - y) / 2;
const isoY = (x, y, z = 0) => (x + y) / 4 - z;
const L3 = (() => { const v = [-.55, -.7, .45], l = Math.hypot(...v); return v.map(c => c / l); })();
const LW = (() => { const v = [-.62, .5], l = Math.hypot(...v); return v.map(c => c / l); })(); // world-plane light for cylinders

// ---------- palettes ----------
const GRASS = pal(['#28441d', '#365e22', '#4a7a2a', '#639631', '#83b03d', '#a6c950']);
const DIRT = pal(['#46301f', '#634329', '#80593a', '#9e7550', '#bd9669']);
const COBBLE = pal(['#3a3834', '#58544c', '#767064', '#948c7d', '#b2a998']);
const FLAG = pal(['#4a4236', '#6e6352', '#8f836d', '#ada187', '#c9bea2']);
const MORTAR = hex('#2b2926');
const CLIFF = pal(['#25242b', '#35343d', '#47454f', '#5c5a63', '#77747b', '#908c90']);
const LEAF = pal(['#15291a', '#1f4224', '#2d5d2c', '#417a33', '#5f9a3d', '#88bb4d']);
const LEAF_AUTUMN = pal(['#3b1d12', '#6a3316', '#99521f', '#c47d2e', '#e2a84a', '#f2cd72']);
const LEAF_BLOSSOM = pal(['#3a1f2e', '#6b3552', '#9c4f73', '#c97497', '#e8a2bb', '#f8d0dc']);
const PINE = pal(['#0d221c', '#153628', '#1e4b36', '#2a6245', '#3c7a55']);
const BUSH = pal(['#172f1b', '#244a25', '#35662f', '#4d853a', '#6ea647', '#98c65a']);
const BARK = pal(['#24170f', '#3d281a', '#5a3b24', '#7a5231']);
const STONE = pal(['#2c2b30', '#44424a', '#5e5b62', '#7b777c', '#9b9696']);
const WSTONE = pal(['#3b3530', '#5a524a', '#7a7064', '#9a8f7f', '#bcb09c']); // warm town stone
const CROP = pal(['#23491f', '#356b2a', '#4f8f35', '#76b545', '#a6d869']);
const WOOD = pal(['#2e1c10', '#4a2e1a', '#6b4427', '#8c5c34', '#ad7a47']);
const PLASTER = pal(['#8a7b62', '#a8987a', '#c4b494', '#d9cbad']);
const SLATE = pal(['#1f2640', '#2b3658', '#3b4c7a', '#50679c', '#6c86ba']);
const RED = pal(['#3d1714', '#5e231c', '#8a3526', '#b04d32', '#d0704a']);
const GREENR = pal(['#1b2e22', '#27442f', '#365f3f', '#4c7d52', '#6a9c6a']);
const ORANGE = pal(['#3f2412', '#66391a', '#8f5424', '#b8742f', '#d9984a']);
const WATER = pal(['#173456', '#22507e', '#3170a3', '#4f97c6', '#8cc6e6', '#d8f1fb']);

// ---------- scenes ----------
const R4 = (x0, x1, y0, y1, extra = {}) => ({ x0: x0 * T, x1: x1 * T, y0: y0 * T, y1: y1 * T, ...extra });
const P = (x, y, extra = {}) => ({ x: x * T, y: y * T, ...extra });

function forestScene() {
  const hut = R4(16, 19.5, 12, 14.75);
  return {
    title: 'GREENFIELD',
    plateauH: 56,
    plateaus: [R4(-9, 26, -9, 5), R4(-9, 6, -9, 24)],
    paved: [R4(6.2, 40, 16, 17.25, { style: 'road' }), R4(21.5, 22.75, 5.5, 40, { style: 'road' })],
    buildings: [{ ...hut, wallH: 52, roofH: 40, ridge: 'x', roof: SLATE, wall: 'timber', moss: true, chimney: true, door: { face: 'y', at: .5 }, windows: [{ face: 'x', at: .5 }] }],
    plots: [R4(25, 31, 8.5, 14.25, { gate: 'y1' })],
    camps: [P(13.6, 21)],
    stairs: [{ x0: 21.5 * T, x1: 22.75 * T, y0: 5 * T, y1: 5 * T + 7 * 16 }],
    yards: [{ x0: hut.x0 - 10, x1: hut.x1 + 70, y0: hut.y1, y1: hut.y1 + 70 }],
    crates: [
      { x: 19.5 * T + 8, y: 12 * T + 10, w: 22, d: 22, h: 18 },
      { x: 19.5 * T + 8, y: 12 * T + 38, w: 22, d: 22, h: 18 },
      { x: 19.5 * T + 36, y: 12 * T + 20, w: 20, d: 20, h: 16 },
    ],
    logs: [{ x: 13.6 * T - 70, y: 21 * T - 30, w: 56, d: 16, h: 11 }, { x: 13.6 * T + 20, y: 21 * T + 44, w: 16, d: 56, h: 11 }],
    lanterns: [P(15.7, 15.5), P(20.2, 15.5), P(23.3, 18.2), P(23.3, 27)],
    spawn: P(20, 19.2),
    baseDensity: (x, y) => smooth(.5, .98, Math.hypot((x - 21 * T) / (15 * T), (y - 19 * T) / (15 * T))),
    densNoise: .75,
    worn: 1,
  };
}

function townScene() {
  const WL = R4(5, 35, 5, 35);
  const gaps = { west: [18.4 * T, 21.6 * T], south: [18.4 * T, 21.6 * T], east: [18.4 * T, 21.6 * T] };
  return {
    title: 'BUNNY HAVEN',
    plateauH: 56,
    plateaus: [R4(-9, 30, -9, 2.4), R4(-9, 2.4, -9, 30)],
    paved: [
      R4(14.5, 25.5, 14.5, 25.5, { style: 'plaza' }),
      R4(25.5, 40, 19.2, 20.8, { style: 'road' }), R4(19.2, 20.8, 25.5, 40, { style: 'road' }),
      R4(0, 14.5, 19.2, 20.8, { style: 'road' }), R4(19.2, 20.8, 12.4, 14.5, { style: 'road' }),
      R4(11.5, 12.5, 18.3, 19.2, { style: 'road' }), R4(27.6, 28.6, 18.4, 19.2, { style: 'road' }),
    ],
    buildings: [
      { ...R4(16.5, 23.5, 7.4, 12.4), wallH: 76, floors: 2, roofH: 58, ridge: 'x', roof: SLATE, wall: 'stone', door: { face: 'y', at: .5, wide: true },
        windows: [.14, .3, .7, .86].map(at => ({ face: 'y', at })).concat([.25, .5, .75].map(at => ({ face: 'x', at }))), tower: { w: 56, h: 52, roof: RED }, banner: true },
      { ...R4(10.3, 13.8, 14.6, 18.2), wallH: 54, roofH: 44, ridge: 'y', roof: RED, wall: 'timber', door: { face: 'x', at: .5 },
        windows: [{ face: 'x', at: .17 }, { face: 'x', at: .83 }, { face: 'y', at: .5 }], awning: { face: 'x', at: .5, cols: ['#b8322a', '#efe3c8'] }, sign: { face: 'x', at: .5, icon: 'potion' }, flowers: true, chimney: true },
      { ...R4(26.2, 30, 15.2, 18.3), wallH: 54, roofH: 42, ridge: 'x', roof: SLATE, wall: 'wood', door: { face: 'y', at: .38 },
        windows: [{ face: 'y', at: .78 }, { face: 'x', at: .5 }], awning: { face: 'y', at: .38, cols: ['#2f5f9e', '#e8e0cc'] }, sign: { face: 'y', at: .38, icon: 'sword' }, chimney: true },
      { ...R4(8, 11.5, 8.4, 11.2), wallH: 50, roofH: 40, ridge: 'x', roof: RED, wall: 'timber', door: { face: 'y', at: .3 }, windows: [{ face: 'y', at: .72 }, { face: 'x', at: .5 }], flowers: true, chimney: true },
      { ...R4(26, 29.2, 8.2, 11.6), wallH: 50, roofH: 42, ridge: 'y', roof: GREENR, wall: 'timber', door: { face: 'y', at: .5 }, windows: [{ face: 'x', at: .28 }, { face: 'x', at: .72 }], flowers: true, chimney: true },
      { ...R4(8.4, 12, 23.2, 26), wallH: 50, roofH: 40, ridge: 'x', roof: ORANGE, wall: 'timber', door: { face: 'y', at: .5 }, windows: [{ face: 'y', at: .18 }, { face: 'y', at: .82 }, { face: 'x', at: .5 }], flowers: true, chimney: true },
      { ...R4(12.6, 15.6, 27.4, 30.6), wallH: 48, roofH: 40, ridge: 'y', roof: SLATE, wall: 'wood', door: { face: 'y', at: .5 }, windows: [{ face: 'x', at: .3 }, { face: 'x', at: .7 }] },
      { ...R4(25.6, 29.1, 25.8, 28.6), wallH: 50, roofH: 40, ridge: 'x', roof: RED, wall: 'timber', door: { face: 'y', at: .62 }, windows: [{ face: 'y', at: .2 }, { face: 'x', at: .5 }], flowers: true, chimney: true },
    ],
    plots: [R4(30.6, 33.8, 24.4, 28.6, { gate: 'x0' })],
    camps: [],
    stairs: [],
    yards: [R4(8, 12, 11.2, 12.2), R4(26, 29.2, 11.6, 12.6), R4(8.4, 12, 26, 27), R4(25.6, 29.1, 28.6, 29.6)],
    crates: [
      { x: 30.1 * T, y: 15.6 * T, w: 22, d: 22, h: 18 }, { x: 30.1 * T, y: 15.6 * T + 26, w: 22, d: 22, h: 18 },
      { x: 13.9 * T, y: 14.7 * T, w: 20, d: 20, h: 16 },
    ],
    barrels: [P(30.55, 16.9), P(30.45, 17.4), P(13.95, 18.35), P(29.3, 28.8)],
    logs: [],
    benches: [
      { x: 17.35 * T, y: 18.6 * T, w: 14, d: 44, h: 9 }, { x: 22.4 * T, y: 18.6 * T, w: 14, d: 44, h: 9 },
      { x: 18.6 * T, y: 17.35 * T, w: 44, d: 14, h: 9 }, { x: 18.6 * T, y: 22.45 * T, w: 44, d: 14, h: 9 },
    ],
    lanterns: [P(17.9, 17.9), P(22.1, 17.9), P(17.9, 22.1), P(22.1, 22.1), P(14.3, 21.2), P(25.7, 18.8), P(21.2, 25.7), P(18.8, 14.3),
      P(28, 21.15), P(32.5, 18.85), P(18.85, 29), P(21.15, 33), P(10.5, 21.15), P(7, 18.85), P(18.85, 12.9), P(21.15, 12.9)],
    fountain: P(20, 20),
    stalls: [
      { x: 15.2 * T, y: 23.1 * T, goods: ['#d8483c', '#f0a53a', '#9fd05a'], cloth: ['#b8322a', '#efe3c8'] },
      { x: 23.1 * T, y: 15.2 * T, goods: ['#e8c25a', '#b07a3c', '#e8e0d0'], cloth: ['#2f7a4a', '#efe3c8'] },
      { x: 23.2 * T, y: 23.2 * T, goods: ['#8a5ad8', '#d85a9a', '#5ab4d8'], cloth: ['#6a3a9a', '#efe3c8'] },
    ],
    planters: [P(15.35, 15.35)],
    trees: [
      P(18.2, 27.6), P(21.8, 27.6), P(18.2, 30.2), P(21.8, 30.2), P(18.2, 32.8), P(21.8, 32.8),
      P(31.4, 18.2), P(31.4, 21.8), P(33.8, 21.8), P(7.4, 18.2), P(7.4, 21.8), P(15.35, 15.35, { planter: true }),
      P(24, 9.8), P(14, 9.6), P(9.6, 13.2), P(33, 10.5), P(31.8, 13.6), P(7.8, 29.5), P(10.8, 32.2), P(24.2, 31.4), P(28.6, 32.6), P(33.2, 31.8),
    ],
    wall: { rect: WL, th: 20, h: 36, gaps },
    portals: [{ ...P(37.3, 20), col: [120, 200, 255], label: 'Greenfield' }, { ...P(20, 37.3), col: [190, 150, 255], label: 'Desert' }],
    spawn: P(20, 23.6),
    baseDensity: (x, y) => smooth(.98, 1.1, Math.max(Math.abs(x - 20 * T), Math.abs(y - 20 * T)) / (15 * T)),
    densNoise: .45,
    worn: .35,
    treePathClear: 70,
    canopyClear: 96,
    townLawn: WL,
  };
}

const SC = MAP === 'town' ? townScene() : forestScene();
for (const k of ['crates', 'barrels', 'logs', 'benches', 'lanterns', 'stalls', 'planters', 'trees', 'portals', 'plots', 'camps', 'stairs', 'yards', 'buildings']) SC[k] = SC[k] || [];
const PLATEAU_H = SC.plateauH;
const plateaus = SC.plateaus;

const inRect = (x, y, r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m;
const inPlateau = (x, y, m = 0) => plateaus.some(p => inRect(x, y, p, m));
function pavedAt(x, y) { // deepest paved rect: {d: depth inside (>0) or negative outside, r}
  let best = -1e9, br = null;
  for (const r of SC.paved) {
    const d = Math.min(x - r.x0, r.x1 - x, y - r.y0, r.y1 - y);
    if (d > best) { best = d; br = r; }
  }
  return { d: best, r: br };
}
function pathDist(x, y) {
  let best = 1e9;
  for (const r of SC.paved) {
    const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}
function forestDensity(x, y) {
  let v = SC.baseDensity(x, y) + (fbm(x * .004 + 7, y * .004 + 3) - .5) * SC.densNoise;
  if (x < T || y < T || x > S - T || y > S - T) v += .6;
  if (inPlateau(x, y)) v += .25;
  return clamp(v, 0, 1);
}
const boxOfItem = c => ({ x0: c.x, x1: c.x + c.w, y0: c.y, y1: c.y + c.d });
function nearWall(x, y, m) {
  if (!SC.wall) return false;
  const r = SC.wall.rect, t = SC.wall.th / 2 + m;
  const onX = (Math.abs(y - r.y0) < t || Math.abs(y - r.y1) < t) && x > r.x0 - t && x < r.x1 + t;
  const onY = (Math.abs(x - r.x0) < t || Math.abs(x - r.x1) < t) && y > r.y0 - t && y < r.y1 + t;
  return onX || onY;
}
function blocked(x, y, m) {
  if (pathDist(x, y) < (m >= 40 && SC.treePathClear ? SC.treePathClear : m + 6)) return true;
  if (SC.buildings.some(b => inRect(x, y, b, m + 30))) return true;
  if (SC.plots.some(p => inRect(x, y, p, m + 18))) return true;
  if (SC.camps.some(c => Math.hypot(x - c.x, y - c.y) < 110 + m)) return true;
  if (Math.hypot(x - SC.spawn.x, y - SC.spawn.y) < 50 + m) return true;
  if (SC.lanterns.some(l => Math.hypot(x - l.x, y - l.y) < 18 + m)) return true;
  if ([...SC.crates, ...SC.benches, ...SC.logs].some(c => inRect(x, y, boxOfItem(c), m))) return true;
  if (SC.barrels.some(b => Math.hypot(x - b.x, y - b.y) < 14 + m)) return true;
  if (SC.stalls.some(s => inRect(x, y, { x0: s.x - 8, x1: s.x + 52, y0: s.y - 8, y1: s.y + 32 }, m))) return true;
  if (SC.trees.some(t => Math.hypot(x - t.x, y - t.y) < 30 + m)) return true;
  if (SC.portals.some(p => Math.hypot(x - p.x, y - p.y) < 90 + m * 2)) return true;
  if (SC.fountain && Math.hypot(x - SC.fountain.x, y - SC.fountain.y) < 90 + m) return true;
  if (nearWall(x, y, m + 10)) return true;
  // keep cliff faces readable: no trees on the rim or on the ground right in front of them
  if (m >= 40 && !inPlateau(x, y)) for (const p of plateaus) {
    if (y >= p.y0 && y <= p.y1 && x > p.x1 && x < p.x1 + 150) return true;
    if (x >= p.x0 && x <= p.x1 && y > p.y1 && y < p.y1 + 150) return true;
  }
  if (SC.stairs.some(s => inRect(x, y, s, m + 30))) return true;
  // canopy check: a tree's crown covers the screen area straight above its base, i.e. world
  // points (x-2h, y-2h). Keep roads, portals and facades visible behind trees.
  if (m >= 40 && SC.canopyClear) for (let h = 0; h <= SC.canopyClear; h += 12) {
    const cx = x - 2 * h, cy = y - 2 * h;
    if (pavedAt(cx, cy).d > -12) return true;
    if (SC.portals.some(p => Math.hypot(cx - p.x, cy - p.y) < 70)) return true;
    if (SC.buildings.some(b => inRect(cx, cy, b, 10))) return true;
  }
  for (const p of plateaus) {
    if (inRect(x, y, p) && (p.x1 - x < 30 || p.y1 - y < 30)) {
      const other = plateaus.find(o => o !== p && inRect(x, y, o, -30));
      if (!other) return true;
    }
  }
  return false;
}

// ---------- sprite builders ----------
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function levelsToCanvas(w, h, lv, palOf) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) {
    const l = lv[i]; if (l < 0) continue;
    const col = palOf(i, l); const o = i * 4;
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
// Clumped foliage: many small spheres, each lit from top-left, plus a global volume term.
function paintClumps(lv, kind, w, h, clumps, env, seed, n, opts = {}) {
  const tex = opts.tex ?? .45, edge = opts.edge ?? .55;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    let best = -9, bx = 0, by = 0;
    for (const c of clumps) {
      const dx = (px + .5 - c.x) / c.r, dy = (py + .5 - c.y) / c.r, f = 1 - dx * dx - dy * dy;
      if (f > best) { best = f; bx = dx; by = dy; }
    }
    const f = best + (vnoise(px * .5 + seed, py * .5 - seed) - .5) * edge;
    if (f <= 0) continue;
    const nz = Math.sqrt(Math.max(0, 1 - bx * bx - by * by));
    const local = bx * L3[0] + by * L3[1] + nz * L3[2];
    const glob = -((px - env.x) / env.rx) * .32 - ((py - env.y) / env.ry) * .42;
    let s = local * .62 + glob + (vnoise(px * .8 + seed * 3, py * .8) - .5) * tex + (opts.bias ?? 0);
    const i = py * w + px;
    lv[i] = clamp(Math.round((s * .5 + .5) * (n - 1) + bayer(px, py) * .9), 0, n - 1);
    kind[i] = 1;
  }
}
function outline(lv, kind, w, h, k, n) {
  const src = lv.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (src[i] < 0 || kind[i] !== k) continue;
    const below = y + 1 >= h || src[i + w] < 0, right = x + 1 >= w || src[i + 1] < 0;
    const above = y === 0 || src[i - w] < 0, left = x === 0 || src[i - 1] < 0;
    if (below || right) lv[i] = 0;
    else if (above || left) lv[i] = Math.min(n - 1, src[i] + 1);
  }
}
function paintTrunk(lv, kind, w, cx, top, bottom, tw, seed) {
  for (let y = top; y <= bottom; y++) {
    const flare = y > bottom - 5 ? (y - (bottom - 5)) * .8 : 0;
    const half = tw / 2 + flare;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const t = (x - (cx - half)) / (half * 2);
      let l = t < .28 ? 3 : t < .6 ? 2 : t < .85 ? 1 : 0;
      if (hash2(x + seed, (y >> 2) + seed) > .8) l = Math.max(0, l - 1);
      if (x >= 0 && x < w) { lv[y * w + x] = l; kind[y * w + x] = 2; }
    }
  }
}

function broadTree(seed, size, leaves) {
  const r = rng(seed);
  const cr = size / 2, trunkH = Math.round(size * .5);
  const w = Math.round(size * 1.3), h = Math.round(size * .95 + trunkH + 8);
  const cx = w / 2, ground = h - 3, cy = ground - trunkH - cr * .55;
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h);
  paintTrunk(lv, kind, w, cx, Math.round(cy), ground, Math.max(5, Math.round(size * .11)), seed);
  const clumps = [];
  const nC = 12 + Math.round(size / 6);
  for (let i = 0; i < nC; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * .72;
    clumps.push({ x: cx + Math.cos(a) * cr * d, y: cy + Math.sin(a) * cr * .78 * d, r: cr * (.26 + r() * .16) });
  }
  paintClumps(lv, kind, w, h, clumps, { x: cx, y: cy, rx: cr, ry: cr * .8 }, seed, leaves.length);
  outline(lv, kind, w, h, 1, leaves.length);
  const canvas = levelsToCanvas(w, h, lv, (i, l) => (kind[i] === 2 ? BARK[l] : leaves[l]));
  return { img: canvas, ox: Math.round(cx), oy: ground, canopyR: cr };
}

function pineTree(seed, height) {
  const r = rng(seed);
  const tiers = 4 + Math.floor(r() * 2);
  const w = Math.round(height * .5) + 6, h = height + 6;
  const cx = w / 2, ground = h - 3, trunkH = Math.round(height * .14);
  const top = ground - height, fBottom = ground - trunkH;
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h);
  paintTrunk(lv, kind, w, cx, fBottom - 8, ground, 4, seed);
  const span = fBottom - top, tierH = span * .44;
  for (let i = 0; i < tiers; i++) {
    const bottom = fBottom - i * (span - tierH) / (tiers - 1), apex = bottom - tierH;
    const hw = (w / 2 - 3) * (1 - i / (tiers + .8));
    for (let y = Math.floor(apex); y <= Math.ceil(bottom); y++) {
      const t = (y - apex) / (bottom - apex); if (t < 0) continue;
      const half = hw * Math.pow(t, .95) + (vnoise(y * .7 + i * 9, seed) - .5) * 3.2;
      for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
        if (x < 0 || x >= w || Math.abs(x + .5 - cx) > half) continue;
        if (y > bottom - 1 - 2.5 * Math.abs(Math.sin((x - cx) * .6 + i * 1.3))) continue;
        let s = -(x - cx) / Math.max(half, 1) * .6 + (1 - t) * .45 - .15 + (vnoise(x * .6 + seed, y * .6) - .5) * .55;
        if (t > .86) s -= .45;
        const idx = y * w + x;
        lv[idx] = clamp(Math.round((s * .5 + .5) * 4 + bayer(x, y) * .9), 0, 4); kind[idx] = 1;
      }
    }
  }
  outline(lv, kind, w, h, 1, 5);
  return { img: levelsToCanvas(w, h, lv, (i, l) => (kind[i] === 2 ? BARK[l] : PINE[l])), ox: Math.round(cx), oy: ground, canopyR: w * .42 };
}

function bushSprite(seed, size, leaves, flowers) {
  const r = rng(seed);
  const w = Math.round(size * 1.25), h = Math.round(size * .85) + 3;
  const cx = w / 2, cy = h - size * .38, ground = h - 2;
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h);
  const clumps = [];
  for (let i = 0; i < 5 + Math.round(size / 8); i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * .6;
    clumps.push({ x: cx + Math.cos(a) * size * .45 * d, y: cy + Math.sin(a) * size * .28 * d, r: size * (.2 + r() * .12) });
  }
  paintClumps(lv, kind, w, h, clumps, { x: cx, y: cy, rx: size / 2, ry: size * .35 }, seed, leaves.length, { bias: .05 });
  outline(lv, kind, w, h, 1, leaves.length);
  const c = levelsToCanvas(w, h, lv, (i, l) => leaves[l]);
  if (flowers) {
    const g = c.getContext('2d');
    for (let i = 0; i < size / 3; i++) {
      const x = Math.floor(r() * w), y = Math.floor(r() * h * .8);
      if (lv[y * w + x] >= 3) { g.fillStyle = flowers[i % flowers.length]; g.fillRect(x, y, 1, 1); if (r() < .4) g.fillRect(x + 1, y, 1, 1); }
    }
  }
  return { img: c, ox: Math.round(cx), oy: ground };
}

function rockSprite(seed, size) {
  const r = rng(seed);
  const w = Math.round(size * 1.3), h = Math.round(size * .95);
  const cx = w / 2, cy = h - size * .38;
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h);
  const clumps = [];
  for (let i = 0; i < 3 + Math.floor(r() * 3); i++) {
    clumps.push({ x: cx + (r() - .5) * size * .5, y: cy + (r() - .5) * size * .2, r: size * (.3 + r() * .14) });
  }
  paintClumps(lv, kind, w, h, clumps, { x: cx, y: cy, rx: size / 2, ry: size * .4 }, seed, 5, { tex: .15, edge: .2 });
  outline(lv, kind, w, h, 1, 5);
  const c = levelsToCanvas(w, h, lv, (i, l) => {
    const x = i % w, y = (i / w) | 0;
    if (l >= 3 && vnoise(x * .35 + seed, y * .35) > .6) return BUSH[l];
    return STONE[l];
  });
  return { img: c, ox: Math.round(cx), oy: h - 2 };
}

function tuftSprite(seed, dark) {
  const r = rng(seed), w = 11, h = 10;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const blades = 4 + Math.floor(r() * 4);
  for (let b = 0; b < blades; b++) {
    const bx = 2 + Math.floor(r() * 7), len = 3 + Math.floor(r() * 6), lean = r() < .35 ? -1 : r() < .5 ? 1 : 0;
    for (let k = 0; k < len; k++) {
      const x = bx + Math.round(lean * (k / len) * 2), y = h - 1 - k;
      const l = clamp(1 + Math.floor((k / len) * 4) - (dark ? 1 : 0), 0, 5);
      g.fillStyle = `rgb(${GRASS[l]})`; g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// Parallelogram-face rasterizer for iso boxes / buildings. Faces are painted in order.
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function rasterFaces(faces, decor) {
  const pr = p => [isoX(p[0], p[1]), isoY(p[0], p[1], p[2])];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const f of faces) {
    for (const p of [f.O, add(f.O, f.A), add(f.O, f.B), add(add(f.O, f.A), f.B)]) {
      const [x, y] = pr(p); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  minX = Math.floor(minX) - 16; minY = Math.floor(minY) - 16; maxX = Math.ceil(maxX) + 16; maxY = Math.ceil(maxY) + 2;
  const w = maxX - minX, h = maxY - minY;
  const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (const f of faces) {
    const [ox, oy] = pr(f.O), a = pr(add(f.O, f.A)), b = pr(add(f.O, f.B));
    const ax = a[0] - ox, ay = a[1] - oy, bx = b[0] - ox, by = b[1] - oy, det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-6) continue;
    const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
    const cs = [[0, 0], [ax, ay], [bx, by], [ax + bx, ay + by]];
    const fx0 = Math.max(0, Math.floor(ox - minX + Math.min(...cs.map(q => q[0])))), fx1 = Math.min(w - 1, Math.ceil(ox - minX + Math.max(...cs.map(q => q[0]))));
    const fy0 = Math.max(0, Math.floor(oy - minY + Math.min(...cs.map(q => q[1])))), fy1 = Math.min(h - 1, Math.ceil(oy - minY + Math.max(...cs.map(q => q[1]))));
    for (let py = fy0; py <= fy1; py++) for (let px = fx0; px <= fx1; px++) {
      const dx = px + minX + .5 - ox, dy = py + minY + .5 - oy;
      const u = (dx * by - dy * bx) / det, v = (ax * dy - ay * dx) / det;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      if (f.clip && !f.clip(u, v)) continue;
      const col = f.color(u * lenA, v * lenB, lenA, lenB, px, py);
      if (!col) continue;
      const o = (py * w + px) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (decor) decor(g, (x, y, z) => [Math.round(isoX(x, y) - minX), Math.round(isoY(x, y, z) - minY)]);
  return { img: c, ox: -minX, oy: -minY };
}
const shadeCol = (c, k) => [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)];

function plankColor(k, seed) {
  return (u, v, lu, lv, px, py) => {
    let l = 2 + (hash2(Math.floor(v / 5) + seed, 3) > .5 ? 1 : 0);
    if (v % 5 < 1) l = 1;
    if (u < 1.5 || v < 1.5 || u > lu - 1.5 || v > lv - 1.5) l = 0;
    if (hash2(px * 3 + seed, py) > .93) l = Math.max(0, l - 1);
    return shadeCol(WOOD[l], k);
  };
}
function stoneColor(k, palette = WSTONE, rowH = 6, bw = 12) {
  return (u, v, lu, lv, px, py) => {
    const row = Math.floor(v / rowH), off = (row & 1) * bw / 2, col = Math.floor((u + off) / bw);
    if (v % rowH < 1 || (u + off) % bw < 1) return shadeCol(palette[0], k);
    let l = 2 + Math.floor(hash2(col, row) * 2);
    if (v % rowH > rowH - 1.5) l++;
    if (hash2(px * 5, py) > .93) l--;
    return shadeCol(palette[clamp(l, 0, 4)], k);
  };
}
function boxSprite(w, d, h, seed) {
  return rasterFaces([
    { O: [0, d, 0], A: [w, 0, 0], B: [0, 0, h], color: plankColor(1, seed) },
    { O: [w, 0, 0], A: [0, d, 0], B: [0, 0, h], color: plankColor(.72, seed + 1) },
    { O: [0, 0, h], A: [w, 0, 0], B: [0, d, 0], color: plankColor(1.18, seed + 2) },
  ]);
}
function logSprite(w, d, h, seed) {
  const bark = (k) => (u, v, lu, lv, px, py) => {
    const t = v / lv; let l = t > .7 ? 3 : t > .35 ? 2 : 1;
    if (hash2(px + seed, py * 5) > .85) l--;
    return shadeCol(BARK[clamp(l, 0, 3)], k);
  };
  const ring = (u, v, lu, lv) => {
    const cxr = lu / 2, cyr = lv / 2, rr = Math.hypot((u - cxr) / cxr, (v - cyr) / cyr);
    return rr > .85 ? BARK[1] : rr % .34 < .1 ? WOOD[2] : WOOD[4];
  };
  const alongX = w > d;
  return rasterFaces(alongX ? [
    { O: [0, d, 0], A: [w, 0, 0], B: [0, 0, h], color: bark(1) },
    { O: [0, 0, h], A: [w, 0, 0], B: [0, d, 0], color: bark(1.15) },
    { O: [w, 0, 0], A: [0, d, 0], B: [0, 0, h], color: ring },
  ] : [
    { O: [w, 0, 0], A: [0, d, 0], B: [0, 0, h], color: bark(.8) },
    { O: [0, 0, h], A: [w, 0, 0], B: [0, d, 0], color: bark(1.15) },
    { O: [0, d, 0], A: [w, 0, 0], B: [0, 0, h], color: ring },
  ]);
}
function benchSprite(w, d, h) {
  const legs = [];
  const alongX = w > d;
  const seat = (k) => (u, v, lu, lv, px, py) => {
    const plank = alongX ? Math.floor(v / 3.5) : Math.floor(u / 3.5);
    let l = (alongX ? v % 3.5 : u % 3.5) < .9 ? 1 : 3 - (plank & 1);
    return shadeCol(WOOD[l], k);
  };
  for (const [lx, ly] of [[2, 2], [w - 5, 2], [2, d - 5], [w - 5, d - 5]]) {
    legs.push({ O: [lx, ly + 3, 0], A: [3, 0, 0], B: [0, 0, h - 2], color: () => WOOD[1] });
    legs.push({ O: [lx + 3, ly, 0], A: [0, 3, 0], B: [0, 0, h - 2], color: () => WOOD[0] });
  }
  return rasterFaces([
    ...legs,
    { O: [0, d, h - 2], A: [w, 0, 0], B: [0, 0, 2], color: () => WOOD[1] },
    { O: [w, 0, h - 2], A: [0, d, 0], B: [0, 0, 2], color: () => WOOD[0] },
    { O: [0, 0, h], A: [w, 0, 0], B: [0, d, 0], color: seat(1.1) },
  ]);
}

// --- generic building: box walls + gable roof, optional tower / awning / sign ---
const ICONS = {
  potion: ['..kk..', '..kk..', '.krrk.', 'krrrrk', 'krwrrk', 'krrrrk', '.kkkk.'],
  sword: ['....kw', '...kwk', '..kwk.', 'kkwk..', '.kk...', 'kk.k..', 'k.....'],
};
const ICON_COL = { k: '#2a1c14', r: '#d8483c', w: '#e8eef2' };

function buildingSprite(b) {
  const Wx = b.x1 - b.x0, Wy = b.y1 - b.y0, Hw = b.wallH, Hr = b.roofH, o = 12;
  const floors = b.floors || 1, floorH = (Hw - 8) / floors;
  const style = b.wall;
  const wins = (face) => (b.windows || []).filter(w => w.face === face);
  const wall = (k, face) => (u, v, lu, lv, px, py) => {
    // foundation
    if (v < 8) {
      const row = Math.floor(v / 4), col = Math.floor((u + row * 5) / 10);
      if (v % 4 < 1 || (u + row * 5) % 10 < 1) return shadeCol(STONE[0], k);
      return shadeCol(STONE[1 + Math.floor(hash2(col, row) * 3)], k);
    }
    const door = b.door && b.door.face === face ? b.door : null;
    if (door) {
      const dw = door.wide ? 13 : 9, dh = door.wide ? 40 : 34, du = u - lu * door.at;
      if (Math.abs(du) < dw && v < dh) {
        if (Math.abs(du) > dw - 2 || v > dh - 2) return shadeCol(style === 'stone' ? WSTONE[1] : WOOD[0], k);
        if (door.wide && v > dh - 10 && Math.hypot(du / (dw - 2), (v - (dh - 10)) / 8) > 1) return shadeCol(WSTONE[2], k);
        if ((du + dw) % 4.5 < 1) return shadeCol(WOOD[1], k);
        if (Math.abs(du - (door.wide ? 0 : 4)) < 1 && Math.abs(v - 18) < 1) return hex('#d8b25a');
        return shadeCol(WOOD[2], k);
      }
    }
    for (const w of wins(face)) {
      for (let f = 0; f < floors; f++) {
        const wc = 8 + f * floorH + floorH * .5, wu = u - lu * w.at;
        if (f === 0 && door && Math.abs(lu * w.at - lu * door.at) < 16) continue;
        if (Math.abs(wu) < 8 && Math.abs(v - wc) < 8) {
          if (Math.abs(wu) > 6.5 || Math.abs(v - wc) > 6.8) return shadeCol(style === 'stone' ? WSTONE[1] : WOOD[0], k);
          if (Math.abs(wu) < .8 || Math.abs(v - wc) < .8) return shadeCol(WOOD[1], k);
          return v > wc ? hex('#ffd98a') : hex('#f0a24a');
        }
        if (b.flowers && Math.abs(wu) < 9 && v < wc - 7 && v > wc - 11) {
          if (v > wc - 9 && hash2(px, py) > .45) return hex(['#e8627a', '#f4d35e', '#f2f0e8', '#b56ad8'][Math.floor(hash2(px * 3, py) * 4)]);
          return shadeCol(v > wc - 9 ? BUSH[3] : WOOD[1], k);
        }
      }
    }
    if (style === 'stone') {
      if (u < 5 || u > lu - 5) return stoneColor(k * 1.08, WSTONE, 8, 10)(u, v, lu, lv, px, py);
      if (floors > 1 && Math.abs(v - (8 + floorH)) < 2) return shadeCol(WSTONE[3], k);
      return stoneColor(k)(u, v, lu, lv, px, py);
    }
    if (style === 'wood') {
      const beam = u < 3 || u > lu - 3 || v > lv - 3;
      if (beam) return shadeCol(WOOD[1], k);
      let l = 2 + (hash2(Math.floor(v / 5), 9) > .5 ? 1 : 0);
      if (v % 5 < 1) l = 1;
      if (hash2(px * 3, py) > .92) l--;
      return shadeCol(WOOD[clamp(l, 0, 4)], k);
    }
    const beam = u < 3 || u > lu - 3 || v > lv - 4 || (v > 8 && v < 11) || Math.abs(u - lu / 3) < 1.6 || Math.abs(u - lu * 2 / 3) < 1.6 ||
      (floors > 1 && Math.abs(v - (8 + floorH)) < 1.5);
    if (beam) return shadeCol(WOOD[hash2(Math.floor(u), Math.floor(v / 3)) > .8 ? 1 : 2], k);
    let l = 2 + (hash2(px, py) > .88 ? 1 : 0) - (hash2(px * 7, py * 3) > .9 ? 1 : 0) - (v < 14 ? 1 : 0);
    return shadeCol(PLASTER[clamp(l, 0, 3)], k);
  };
  const RP = b.roof;
  const roof = (k) => (u, v, lu, lv, px, py) => {
    const rows = Math.round(lv / 6), t = v / lv, row = Math.floor(t * rows), frac = t * rows - row;
    const off = (row & 1) * 5, tile = Math.floor((u + off) / 10);
    if (t > .95) return shadeCol(WOOD[3], k);
    let l = 2 + (hash2(tile, row) > .6 ? 1 : 0) - (hash2(tile * 3, row) > .85 ? 1 : 0);
    if (frac < .2) l = 0; else if (frac > .8) l = Math.min(4, l + 1);
    if ((u + off) % 10 < 1) l = Math.min(l, 1);
    if (b.moss && vnoise(u * .15, v * .3 + row) > .74 && frac >= .2) return shadeCol(BUSH[2 + (l > 2 ? 1 : 0)], k);
    return shadeCol(RP[clamp(l, 0, 4)], k);
  };
  const edge = (k) => (u, v) => shadeCol(WOOD[v < 1.5 ? 1 : 3], k);
  const faces = [];
  const ch = Hw + Hr + 10, cw = 18;
  const chimney = (x0, y0) => {
    const cc = (k) => stoneColor(k, STONE, 4, 8);
    faces.push({ O: [x0 + cw, y0, Hw], A: [0, cw, 0], B: [0, 0, ch - Hw], color: cc(.72) });
    faces.push({ O: [x0, y0 + cw, Hw], A: [cw, 0, 0], B: [0, 0, ch - Hw], color: cc(1) });
    faces.push({ O: [x0, y0, ch], A: [cw, 0, 0], B: [0, cw, 0], color: () => STONE[0] });
  };
  let chimTop = null;
  if (b.ridge === 'x') {
    faces.push({ O: [-o, -o, Hw], A: [Wx + 2 * o, 0, 0], B: [0, Wy / 2 + o, Hr], color: roof(.78) });
    if (b.chimney) { chimney(Wx * .68, Wy * .2); chimTop = [Wx * .68 + cw / 2, Wy * .2 + cw / 2, ch]; }
    faces.push({ O: [0, Wy, 0], A: [Wx, 0, 0], B: [0, 0, Hw], color: wall(1, 'y') });
    faces.push({ O: [Wx, 0, 0], A: [0, Wy, 0], B: [0, 0, Hw], color: wall(.74, 'x') });
    faces.push({ O: [Wx, 0, Hw], A: [0, Wy, 0], B: [0, Wy / 2, Hr], clip: (u, v) => u + v <= 1, color: wall(.74, 'gx') });
    faces.push({ O: [-o, Wy + o, Hw], A: [Wx + 2 * o, 0, 0], B: [0, -(Wy / 2 + o), Hr], color: roof(1.04) });
    faces.push({ O: [Wx + o, Wy + o, Hw], A: [0, -(Wy / 2 + o), Hr], B: [0, 0, -4], color: edge(.8) });
    faces.push({ O: [Wx + o, -o, Hw], A: [0, Wy / 2 + o, Hr], B: [0, 0, -4], color: edge(.7) });
    faces.push({ O: [-o, Wy + o, Hw], A: [Wx + 2 * o, 0, 0], B: [0, 0, -4], color: edge(1) });
  } else {
    faces.push({ O: [-o, -o, Hw], A: [0, Wy + 2 * o, 0], B: [Wx / 2 + o, 0, Hr], color: roof(1.08) });
    if (b.chimney) { chimney(Wx * .18, Wy * .3); chimTop = [Wx * .18 + cw / 2, Wy * .3 + cw / 2, ch]; }
    faces.push({ O: [Wx, 0, 0], A: [0, Wy, 0], B: [0, 0, Hw], color: wall(.74, 'x') });
    faces.push({ O: [0, Wy, 0], A: [Wx, 0, 0], B: [0, 0, Hw], color: wall(1, 'y') });
    faces.push({ O: [0, Wy, Hw], A: [Wx, 0, 0], B: [Wx / 2, 0, Hr], clip: (u, v) => u + v <= 1, color: wall(1, 'gy') });
    faces.push({ O: [Wx + o, -o, Hw], A: [0, Wy + 2 * o, 0], B: [-(Wx / 2 + o), 0, Hr], color: roof(.8) });
    faces.push({ O: [Wx + o, -o, Hw], A: [0, Wy + 2 * o, 0], B: [0, 0, -4], color: edge(.7) });
    faces.push({ O: [Wx + o, Wy + o, Hw], A: [-(Wx / 2 + o), 0, Hr], B: [0, 0, -4], color: edge(.9) });
    faces.push({ O: [-o, Wy + o, Hw], A: [Wx / 2 + o, 0, Hr], B: [0, 0, -4], color: edge(1) });
  }
  let flagAt = null;
  if (b.tower) { // square clock tower rising through the ridge (ridge 'x' only)
    const tw = b.tower.w, tx0 = Wx / 2 - tw / 2, ty0 = Wy / 2 - tw / 2, zt = Hw + Hr + b.tower.h, ph = tw * .9;
    const roofZ = y => Hw + Hr * (1 - Math.abs(y - Wy / 2) / (Wy / 2 + o));
    const z0 = roofZ(ty0 + tw);
    const tc = (k) => stoneColor(k, WSTONE, 7, 12);
    faces.push({ O: [tx0 + tw, ty0, Hw], A: [0, tw, 0], B: [0, 0, zt - Hw], clip: (u, v) => Hw + v * (zt - Hw) >= roofZ(ty0 + u * tw) - 1, color: tc(.74) });
    faces.push({ O: [tx0, ty0 + tw, z0], A: [tw, 0, 0], B: [0, 0, zt - z0], color: tc(1) });
    faces.push({ O: [tx0 - 3, ty0 + tw + 3, zt - 4], A: [tw + 6, 0, 0], B: [0, 0, 4], color: () => WSTONE[3] });
    faces.push({ O: [tx0 + tw + 3, ty0 - 3, zt - 4], A: [0, tw + 6, 0], B: [0, 0, 4], color: () => WSTONE[2] });
    const apex = [tx0 + tw / 2, ty0 + tw / 2, zt + ph], TR = b.tower.roof;
    const tri = (O, A, k) => ({ O, A, B: [apex[0] - O[0], apex[1] - O[1], apex[2] - O[2]], clip: (u, v) => u + v <= 1, color: (u, v, lu, lv, px, py) => {
      const row = Math.floor(v / 5); let l = 2 + (hash2(Math.floor(u / 6), row) > .6 ? 1 : 0); if (v % 5 < 1) l = 0; return shadeCol(TR[l], k);
    } });
    faces.push(tri([tx0 - 4, ty0 - 4, zt], [0, tw + 8, 0], 1.1));
    faces.push(tri([tx0 - 4, ty0 - 4, zt], [tw + 8, 0, 0], .8));
    faces.push(tri([tx0 - 4, ty0 + tw + 4, zt], [tw + 8, 0, 0], 1));
    faces.push(tri([tx0 + tw + 4, ty0 - 4, zt], [0, tw + 8, 0], .72));
    flagAt = apex;
    b._clock = [tx0 + tw / 2, ty0 + tw, zt - b.tower.h * .45];
  }
  if (b.awning) {
    const a = b.awning, cols = a.cols.map(hex);
    const cloth = (k) => (u, v, lu, lv) => {
      const stripe = Math.floor(u / 6) & 1;
      if (v > lv - 3 && (u % 6) > 3 && v > lv - 1.5) return null;
      return shadeCol(cols[stripe], k * (v > lv - 3 ? .82 : 1));
    };
    if (a.face === 'y') faces.push({ O: [a.at * Wx - 24, Wy, 44], A: [48, 0, 0], B: [0, 22, -10], color: cloth(1.05) });
    else faces.push({ O: [Wx, a.at * Wy - 24, 44], A: [0, 48, 0], B: [22, 0, -10], color: cloth(.85) });
  }
  const decor = (g, proj) => {
    if (b.sign) {
      const s = b.sign, pt = s.face === 'y' ? proj(s.at * Wx + 32, Wy + 4, 46) : proj(Wx + 4, s.at * Wy - 32, 46);
      const [sx, sy] = pt;
      g.fillStyle = '#2a1c14'; g.fillRect(sx - 1, sy - 2, 12, 2); g.fillRect(sx + 1, sy, 1, 3); g.fillRect(sx + 9, sy, 1, 3);
      g.fillStyle = '#4a2e1a'; g.fillRect(sx - 2, sy + 3, 15, 13);
      g.fillStyle = '#ad7a47'; g.fillRect(sx - 1, sy + 4, 13, 11);
      const icon = ICONS[s.icon];
      icon.forEach((row, iy) => [...row].forEach((ch, ix) => { if (ch !== '.') { g.fillStyle = ICON_COL[ch]; g.fillRect(sx + 2 + ix, sy + 6 + iy, 1, 1); } }));
    }
    if (b._clock) {
      const [cx, cy] = proj(...b._clock);
      for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) {
        const r = Math.hypot(xx, yy);
        if (r > 7.2) continue;
        g.fillStyle = r > 5.8 ? '#3b2a1a' : r > 5 ? '#c9a24a' : '#efe6cf';
        g.fillRect(cx + xx, cy + yy, 1, 1);
      }
      g.fillStyle = '#2a1c14'; g.fillRect(cx, cy - 4, 1, 5); g.fillRect(cx, cy, 3, 1);
    }
    if (b.banner) {
      for (const at of [.3, .7]) {
        const [bx, by] = proj(at * Wx, Wy + 1, Hw - 10);
        g.fillStyle = '#2a1c14'; g.fillRect(bx - 5, by - 1, 11, 1);
        for (let yy = 0; yy < 20; yy++) for (let xx = -4; xx <= 4; xx++) {
          if (yy > 16 && Math.abs(xx) < 20 - yy) continue;
          g.fillStyle = xx === -4 ? '#6a1a1c' : yy > 5 && yy < 11 && Math.abs(xx) < 2 ? '#e8c25a' : '#a82a2a';
          g.fillRect(bx + xx, by + yy, 1, 1);
        }
      }
    }
  };
  const res = rasterFaces(faces, decor);
  res.chimneyTop = chimTop;
  res.flagAt = flagAt;
  return res;
}

// Cylinders / discs for fountains & barrels: per pixel, the visible surface is the hit with the
// largest height parameter along the pixel's vertical ray (nearest the viewer).
function cylinderSprite(prims, R) {
  const w = Math.ceil(R * 1.5) + 8, top = Math.max(...prims.map(p => p.z1)) + 8, h = Math.ceil(R * .8 + top) + 6;
  const ox = Math.floor(w / 2), oy = Math.ceil(h - R * .4 - 4);
  const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const sx = px + .5 - ox, sy = py + .5 - oy, a = sx + 2 * sy, b = 2 * sy - sx;
    let best = -1e9, col = null;
    for (const p of prims) {
      // top disc at z1
      const tx = a + 2 * p.z1, ty = b + 2 * p.z1, tr = Math.hypot(tx, ty);
      if (p.top && tr <= p.r) { const cc = p.top(tr, tx, ty, px, py); if (cc && p.z1 > best) { best = p.z1; col = cc; continue; } }
      if (!p.wall) continue;
      const A = 8, B = 4 * (a + b), C = a * a + b * b - p.r * p.r, disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const s = Math.sqrt(disc), z = p.inner ? (-B - s) / (2 * A) : (-B + s) / (2 * A);
      if (z < p.z0 || z > p.z1 || z <= best) continue;
      const wx = a + 2 * z, wy = b + 2 * z, n = [wx / p.r, wy / p.r];
      const lit = (p.inner ? -1 : 1) * (n[0] * LW[0] + n[1] * LW[1]);
      const cc = p.wall(lit, Math.atan2(wy, wx) * p.r, z - p.z0, px, py);
      if (cc) { best = z; col = cc; }
    }
    if (!col) continue;
    const o = (py * w + px) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return { img: c, ox, oy };
}
const bandStone = (palette, rowH, bw) => (lit, arc, hz, px, py) => {
  const row = Math.floor(hz / rowH), off = (row & 1) * bw / 2, col = Math.floor((arc + off) / bw);
  if (hz % rowH < 1 || (((arc + off) % bw) + bw) % bw < 1.2) return palette[0];
  let l = 2 + Math.round(lit * 1.4) + (hash2(col, row) > .6 ? 1 : 0);
  if (hash2(px * 3, py) > .92) l--;
  return palette[clamp(l, 0, palette.length - 1)];
};
function waterTop(r, x, y, px, py) {
  const n = vnoise(x * .06, y * .06) + Math.sin(r * .45) * .25;
  let l = 2 + Math.round(n * 1.6 + bayer(px, py) * .8);
  if (hash2(px, py) > .97) l = 5;
  return WATER[clamp(l, 0, 5)];
}
function fountainSprite() {
  const R = 84;
  return cylinderSprite([
    { r: R, z0: 0, z1: 16, wall: bandStone(WSTONE, 6, 14), top: (r) => (r >= R - 10 ? (r > R - 2 ? WSTONE[4] : WSTONE[3]) : null) },
    { r: R - 10, z0: 11, z1: 16, inner: true, wall: bandStone(WSTONE, 6, 14) },
    { r: R - 10, z0: 11, z1: 11, top: waterTop },
    { r: 11, z0: 11, z1: 46, wall: bandStone(WSTONE, 5, 10) },
    { r: 30, z0: 40, z1: 48, wall: bandStone(WSTONE, 4, 10), top: (r, x, y, px, py) => (r >= 25 ? WSTONE[4] : waterTop(r, x, y, px, py)) },
    { r: 5, z0: 48, z1: 60, wall: bandStone(WSTONE, 4, 6), top: () => WSTONE[4] },
  ], R);
}
function barrelSprite(seed) {
  return cylinderSprite([{ r: 11, z0: 0, z1: 21, wall: (lit, arc, hz, px, py) => {
    if (Math.abs(hz - 4) < 1.2 || Math.abs(hz - 17) < 1.2) return STONE[1 + (lit > 0 ? 1 : 0)];
    let l = 2 + Math.round(lit * 1.3) + (((arc + 20) % 5) < 1 ? -1 : 0);
    return WOOD[clamp(l, 0, 4)];
  }, top: (r) => (r > 9 ? STONE[2] : r % 3 < 1 ? WOOD[2] : WOOD[3]) }], 11);
}
function planterSprite() {
  return rasterFaces([
    { O: [0, 44, 0], A: [44, 0, 0], B: [0, 0, 12], color: stoneColor(1, WSTONE, 4, 9) },
    { O: [44, 0, 0], A: [0, 44, 0], B: [0, 0, 12], color: stoneColor(.74, WSTONE, 4, 9) },
    { O: [0, 0, 12], A: [44, 0, 0], B: [0, 44, 0], color: (u, v, lu, lv, px, py) => {
      if (u < 3 || v < 3 || u > lu - 3 || v > lv - 3) return WSTONE[4];
      const h = hash2(px, py); return h > .8 ? hex(['#e8627a', '#f4d35e', '#f2f0e8'][Math.floor(hash2(py, px) * 3)]) : h > .4 ? BUSH[3] : DIRT[1];
    } },
  ]);
}
function stallSprite(s) {
  const w = 52, d = 26, hC = 15, hP = 36, cloth = s.cloth.map(hex), goods = s.goods.map(hex);
  const post = (x, y) => [
    { O: [x, y + 3, 0], A: [3, 0, 0], B: [0, 0, hP], color: () => WOOD[2] },
    { O: [x + 3, y, 0], A: [0, 3, 0], B: [0, 0, hP], color: () => WOOD[1] },
  ];
  return rasterFaces([
    ...post(0, 0), ...post(w - 3, 0),
    { O: [0, d, 0], A: [w, 0, 0], B: [0, 0, hC], color: plankColor(1, 41) },
    { O: [w, 0, 0], A: [0, d, 0], B: [0, 0, hC], color: plankColor(.72, 42) },
    { O: [0, 0, hC], A: [w, 0, 0], B: [0, d, 0], color: (u, v, lu, lv, px, py) => {
      if (u < 2 || v < 2 || u > lu - 2 || v > lv - 2) return WOOD[3];
      const cell = Math.floor(u / 4) + Math.floor(v / 3) * 7;
      return hash2(px >> 1, py) > .35 ? shadeCol(goods[cell % goods.length], hash2(px, py) > .7 ? 1.25 : 1) : WOOD[2];
    } },
    ...post(0, d - 3), ...post(w - 3, d - 3),
    { O: [-4, -4, hP + 6], A: [w + 8, 0, 0], B: [0, d + 12, -10], color: (u, v, lu, lv) => {
      if (v > lv - 3 && (u % 7) > 3.5) return null;
      return shadeCol(cloth[Math.floor(u / 7) & 1], v > lv - 3 ? .85 : 1.05);
    } },
    { O: [w + 4, -4, hP + 6], A: [0, d + 12, -10], B: [0, 0, -5], color: (u) => shadeCol(cloth[Math.floor(u / 7) & 1], .75) },
  ]);
}
function wallSegSprite(len, th, h, alongX, seed) {
  const sc = (k) => stoneColor(k, WSTONE, 6, 13);
  const faces = alongX ? [
    { O: [0, th, 0], A: [len, 0, 0], B: [0, 0, h], color: sc(1) },
    { O: [len, 0, 0], A: [0, th, 0], B: [0, 0, h], color: sc(.74) },
    { O: [0, 0, h], A: [len, 0, 0], B: [0, th, 0], color: sc(1.16) },
  ] : [
    { O: [th, 0, 0], A: [0, len, 0], B: [0, 0, h], color: sc(.74) },
    { O: [0, len, 0], A: [th, 0, 0], B: [0, 0, h], color: sc(1) },
    { O: [0, 0, h], A: [th, 0, 0], B: [0, len, 0], color: sc(1.16) },
  ];
  // merlons on the outer lip
  const mw = 12, mh = 9;
  for (let s0 = 4; s0 + mw <= len; s0 += 26) {
    const mx = alongX ? [s0, 0] : [0, s0], dim = alongX ? [mw, 7] : [7, mw];
    faces.push({ O: [mx[0], mx[1] + dim[1], h], A: [dim[0], 0, 0], B: [0, 0, mh], color: sc(1) });
    faces.push({ O: [mx[0] + dim[0], mx[1], h], A: [0, dim[1], 0], B: [0, 0, mh], color: sc(.74) });
    faces.push({ O: [mx[0], mx[1], h + mh], A: [dim[0], 0, 0], B: [0, dim[1], 0], color: sc(1.16) });
  }
  return rasterFaces(faces);
}
function towerSprite(tw, h, roofPal) {
  const sc = (k) => stoneColor(k, WSTONE, 7, 12);
  const apex = [tw / 2, tw / 2, h + tw * .95];
  const tri = (O, A, k) => ({ O, A, B: [apex[0] - O[0], apex[1] - O[1], apex[2] - O[2]], clip: (u, v) => u + v <= 1, color: (u, v, lu, lv, px, py) => {
    const row = Math.floor(v / 5); let l = 2 + (hash2(Math.floor(u / 6), row) > .6 ? 1 : 0); if (v % 5 < 1) l = 0; return shadeCol(roofPal[l], k);
  } });
  return rasterFaces([
    { O: [tw, 0, 0], A: [0, tw, 0], B: [0, 0, h], color: sc(.74) },
    { O: [0, tw, 0], A: [tw, 0, 0], B: [0, 0, h], color: (u, v, lu, lv, px, py) => (Math.abs(u - lu / 2) < 2.5 && Math.abs(v - h * .65) < 5 ? hex('#1c1712') : sc(1)(u, v, lu, lv, px, py)) },
    tri([-5, -5, h], [0, tw + 10, 0], 1.1), tri([-5, -5, h], [tw + 10, 0, 0], .8),
    tri([-5, tw + 5, h], [tw + 10, 0, 0], 1), tri([tw + 5, -5, h], [0, tw + 10, 0], .72),
  ]);
}

// ---------- sprite libraries ----------
let seedN = 100;
const broadLib = [], autumnLib = [], blossomLib = [], pineLib = [], bushLib = [], flowerBushLib = [], rockLib = [], tuftLib = [], tuftDarkLib = [];
function buildLibraries() {
  for (let i = 0; i < 8; i++) broadLib.push(broadTree(seedN++, 70 + (i % 4) * 14, LEAF));
  for (let i = 0; i < 3; i++) autumnLib.push(broadTree(seedN++, 72 + i * 12, LEAF_AUTUMN));
  for (let i = 0; i < 2; i++) blossomLib.push(broadTree(seedN++, 66 + i * 12, LEAF_BLOSSOM));
  for (let i = 0; i < 7; i++) pineLib.push(pineTree(seedN++, 96 + (i % 4) * 18));
  for (let i = 0; i < 6; i++) bushLib.push(bushSprite(seedN++, 24 + (i % 3) * 8, BUSH));
  for (let i = 0; i < 4; i++) flowerBushLib.push(bushSprite(seedN++, 22 + (i % 2) * 8, BUSH, i % 2 ? ['#f3f0e6', '#f7d9e6'] : ['#f2d25c', '#ffffff']));
  for (let i = 0; i < 5; i++) rockLib.push(rockSprite(seedN++, 18 + i * 6));
  for (let i = 0; i < 8; i++) { tuftLib.push(tuftSprite(seedN++, false)); tuftDarkLib.push(tuftSprite(seedN++, true)); }
}

// ---------- world objects ----------
const objects = [];   // runtime sorted objects
const colliders = []; // {type:'c',x,y,r} | {type:'b',x0,x1,y0,y1}
const lights = [];
const baked = [];     // small things baked into the ground canvas {img,x,y,z,ox,oy}
const shadows = [];   // ellipse shadows baked into ground {x,y,z,rx,ry,dx,dy}
const rectShadows = []; // world-rect shadows baked into ground {x0,x1,y0,y1,k}
const chimneys = [], flags = [];

function placeScatter() {
  const r = rng(4242);
  const gx0 = GROUND.x0 - 80, gx1 = GROUND.x1 + 80, gy0 = GROUND.y0, gy1 = GROUND.y1 + 170;
  // trees
  for (let sy = gy0; sy < gy1; sy += 26) for (let sx = gx0; sx < gx1; sx += 30) {
    const jx = sx + (r() - .5) * 26, jy = sy + (r() - .5) * 22;
    let x = jx + 2 * jy, y = 2 * jy - jx, z = 0;
    if (inPlateau(x, y)) { x += 2 * PLATEAU_H; y += 2 * PLATEAU_H; z = PLATEAU_H; if (!inPlateau(x, y)) continue; }
    const dens = forestDensity(x, y);
    if (r() > Math.pow(dens, 1.6) * .62) continue;
    if (blocked(x, y, 44)) continue;
    const pineZone = fbm(x * .003 + 90, y * .003) > .52;
    const roll = r();
    let spr;
    if (pineZone) spr = pineLib[Math.floor(r() * pineLib.length)];
    else if (roll < .07) spr = autumnLib[Math.floor(r() * autumnLib.length)];
    else if (roll < .1) spr = blossomLib[Math.floor(r() * blossomLib.length)];
    else spr = broadLib[Math.floor(r() * broadLib.length)];
    placeTree(spr, x, y, z, pineZone);
  }
  // bushes & rocks
  for (let sy = gy0; sy < gy1; sy += 18) for (let sx = gx0; sx < gx1; sx += 22) {
    const jx = sx + (r() - .5) * 20, jy = sy + (r() - .5) * 16;
    let x = jx + 2 * jy, y = 2 * jy - jx, z = 0;
    if (inPlateau(x, y)) { x += 2 * PLATEAU_H; y += 2 * PLATEAU_H; z = PLATEAU_H; if (!inPlateau(x, y)) continue; }
    const dens = forestDensity(x, y), roll = r();
    if (roll < .1 + dens * .22) {
      if (blocked(x, y, 16)) continue;
      const lib = r() < .18 ? flowerBushLib : bushLib;
      const spr = lib[Math.floor(r() * lib.length)];
      addSprite(spr, x, y, z, { box: 8 });
      shadows.push({ x, y, z, dx: 6, dy: 1, rx: spr.img.width * .45, ry: spr.img.width * .2 });
    } else if (roll > .985) {
      if (blocked(x, y, 14)) continue;
      const spr = rockLib[Math.floor(r() * rockLib.length)];
      addSprite(spr, x, y, z, { box: 10 });
      if (!z && spr.img.width > 26) colliders.push({ type: 'c', x, y, r: spr.img.width * .45 });
      shadows.push({ x, y, z, dx: 5, dy: 2, rx: spr.img.width * .5, ry: spr.img.width * .2 });
    }
  }
  // grass tufts (baked)
  for (let sy = gy0; sy < gy1; sy += 7) for (let sx = gx0; sx < gx1; sx += 9) {
    const jx = sx + (r() - .5) * 9, jy = sy + (r() - .5) * 6;
    let x = jx + 2 * jy, y = 2 * jy - jx, z = 0;
    if (inPlateau(x, y)) { x += 2 * PLATEAU_H; y += 2 * PLATEAU_H; z = PLATEAU_H; if (!inPlateau(x, y)) continue; }
    const dens = forestDensity(x, y);
    const lushness = fbm(x * .006 + 3, y * .006 + 5);
    if (r() > .12 + lushness * .5 + dens * .15) continue;
    if (pavedAt(x, y).d > -14 || SC.plots.some(p => inRect(x, y, p, 4)) || SC.buildings.some(b => inRect(x, y, b, 6))) continue;
    if (SC.camps.some(c => Math.hypot(x - c.x, y - c.y) < 60) || nearWall(x, y, 2)) continue;
    if (SC.fountain && Math.hypot(x - SC.fountain.x, y - SC.fountain.y) < 90) continue;
    const lib = dens > .55 ? tuftDarkLib : tuftLib;
    baked.push({ img: lib[Math.floor(r() * lib.length)], x, y, z, ox: 5, oy: 9 });
  }
}

function placeTree(spr, x, y, z, slim) {
  addSprite(spr, x, y, z, { fade: true, box: 12 });
  if (!z) colliders.push({ type: 'c', x, y, r: slim ? 12 : 16 });
  const cr = spr.canopyR;
  shadows.push({ x, y, z, dx: cr * .75, dy: cr * .22, rx: cr * 1.05, ry: cr * .5 });
}
function addSprite(spr, x, y, z, opt = {}) {
  const b = opt.box ?? 8;
  objects.push({ kind: 'sprite', img: spr.img, ox: spr.ox, oy: spr.oy, x, y, z, fade: !!opt.fade, box: { x0: x - b, x1: x + b, y0: y - b, y1: y + b } });
}
function addBoxed(spr, x, y, box, extra = {}) {
  objects.push({ kind: 'sprite', img: spr.img, ox: spr.ox, oy: spr.oy, x, y, z: 0, box, ...extra });
}

function placeStructures() {
  // buildings
  for (const b of SC.buildings) {
    const s = buildingSprite(b);
    addBoxed(s, b.x0, b.y0, { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
    colliders.push({ type: 'b', x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
    rectShadows.push({ x0: b.x1, x1: b.x1 + (b.wallH + b.roofH) * .75 + (b.tower ? 60 : 0), y0: b.y0, y1: b.y1 + 14, k: .62 });
    rectShadows.push({ x0: b.x0 - 8, x1: b.x1 + 8, y0: b.y1, y1: b.y1 + 8, k: .8 });
    if (s.chimneyTop) chimneys.push({ x: b.x0 + s.chimneyTop[0], y: b.y0 + s.chimneyTop[1], z: s.chimneyTop[2] });
    if (s.flagAt) flags.push({ x: b.x0 + s.flagAt[0], y: b.y0 + s.flagAt[1], z: s.flagAt[2] });
    const Wx = b.x1 - b.x0, Wy = b.y1 - b.y0, floors = b.floors || 1, floorH = (b.wallH - 8) / floors;
    for (const w of b.windows || []) for (let f = 0; f < floors; f++) {
      const z = 8 + f * floorH + floorH * .5;
      if (w.face === 'y') lights.push({ x: b.x0 + w.at * Wx, y: b.y1 + 8, z, r: 55, col: [255, 190, 110], a: .5, dusk: true });
      else lights.push({ x: b.x1 + 8, y: b.y0 + w.at * Wy, z, r: 55, col: [255, 190, 110], a: .5, dusk: true });
    }
  }
  // stone stairs climbing a cliff
  for (const st of SC.stairs) {
    const n = 7, sd = (st.y1 - st.y0) / n, sw = st.x1 - st.x0, sh = PLATEAU_H / n;
    const stoneFace = (k) => (u, v, lu, lv, px, py) => {
      if (v > lv - 1.2) return shadeCol(COBBLE[4], k);
      const col = Math.floor(u / 11);
      if (u % 11 < 1) return shadeCol(MORTAR, k);
      return shadeCol(COBBLE[1 + Math.floor(hash2(col, py) * 2.2)], k);
    };
    const faces = [];
    for (let i = 0; i < n; i++) { // i = 0 is the top step against the cliff
      const z = PLATEAU_H - i * sh, y0 = i * sd;
      faces.push({ O: [sw, y0, 0], A: [0, sd, 0], B: [0, 0, z], color: (u, v, lu, lv, px, py) => shadeCol(CLIFF[2 + (hash2(px >> 2, py >> 2) > .6 ? 1 : 0)], .78) });
      faces.push({ O: [0, y0, z], A: [sw, 0, 0], B: [0, sd, 0], color: stoneFace(1.12) });
      faces.push({ O: [0, y0 + sd, z - sh], A: [sw, 0, 0], B: [0, 0, sh], color: stoneFace(.9) });
    }
    addBoxed(rasterFaces(faces), st.x0, st.y0, { ...st });
    colliders.push({ type: 'b', ...st });
  }
  // crates, logs, benches, barrels
  SC.crates.forEach((c, i) => {
    addBoxed(boxSprite(c.w, c.d, c.h, 900 + i), c.x, c.y, boxOfItem(c));
    colliders.push({ type: 'b', ...boxOfItem(c) });
    shadows.push({ x: c.x + c.w / 2, y: c.y + c.d / 2, z: 0, dx: 10, dy: 3, rx: 16, ry: 7 });
  });
  SC.logs.forEach((l, i) => { addBoxed(logSprite(l.w, l.d, l.h, 700 + i), l.x, l.y, boxOfItem(l)); colliders.push({ type: 'b', ...boxOfItem(l) }); });
  SC.benches.forEach(bn => {
    addBoxed(benchSprite(bn.w, bn.d, bn.h), bn.x, bn.y, boxOfItem(bn));
    colliders.push({ type: 'b', ...boxOfItem(bn) });
    shadows.push({ x: bn.x + bn.w / 2, y: bn.y + bn.d / 2, z: 0, dx: 6, dy: 2, rx: 18, ry: 6 });
  });
  const barrel = barrelSprite(1);
  SC.barrels.forEach(b => {
    addBoxed(barrel, b.x, b.y, { x0: b.x - 11, x1: b.x + 11, y0: b.y - 11, y1: b.y + 11 });
    colliders.push({ type: 'c', x: b.x, y: b.y, r: 11 });
    shadows.push({ x: b.x, y: b.y, z: 0, dx: 6, dy: 2, rx: 10, ry: 5 });
  });
  // explicit trees (town avenues, planters)
  const tr = rng(99);
  for (const t of SC.trees) {
    if (t.planter) {
      const pl = planterSprite();
      addBoxed(pl, t.x - 22, t.y - 22, { x0: t.x - 22, x1: t.x + 22, y0: t.y - 22, y1: t.y + 22 });
      colliders.push({ type: 'b', x0: t.x - 22, x1: t.x + 22, y0: t.y - 22, y1: t.y + 22 });
      const spr = blossomLib[0];
      objects.push({ kind: 'sprite', img: spr.img, ox: spr.ox, oy: spr.oy + 12, x: t.x + 1, y: t.y + 1, z: 0, fade: true, box: { x0: t.x - 20, x1: t.x + 23, y0: t.y - 20, y1: t.y + 23 } });
      shadows.push({ x: t.x, y: t.y, z: 0, dx: spr.canopyR * .75, dy: spr.canopyR * .22, rx: spr.canopyR * 1.05, ry: spr.canopyR * .5 });
      continue;
    }
    const roll = tr();
    const spr = roll < .12 ? autumnLib[Math.floor(tr() * autumnLib.length)] : roll < .24 ? blossomLib[Math.floor(tr() * blossomLib.length)] : broadLib[Math.floor(tr() * 4)];
    placeTree(spr, t.x, t.y, 0, false);
  }
  // fountain
  if (SC.fountain) {
    const f = SC.fountain, s = fountainSprite();
    addBoxed(s, f.x, f.y, { x0: f.x - 84, x1: f.x + 84, y0: f.y - 84, y1: f.y + 84 });
    colliders.push({ type: 'c', x: f.x, y: f.y, r: 86 });
    shadows.push({ x: f.x, y: f.y, z: 0, dx: 16, dy: 5, rx: 66, ry: 28 });
  }
  // market stalls & planters
  for (const st of SC.stalls) {
    const s = stallSprite(st);
    addBoxed(s, st.x, st.y, { x0: st.x - 4, x1: st.x + 56, y0: st.y - 4, y1: st.y + 30 });
    colliders.push({ type: 'b', x0: st.x, x1: st.x + 52, y0: st.y, y1: st.y + 26 });
    rectShadows.push({ x0: st.x - 4, x1: st.x + 90, y0: st.y - 4, y1: st.y + 36, k: .72 });
  }
  // town wall with gates & towers
  if (SC.wall) placeWalls(SC.wall);
  // portals
  for (const p of SC.portals) {
    objects.push({ kind: 'portal', x: p.x, y: p.y, z: 0, col: p.col, box: { x0: p.x - 40, x1: p.x + 40, y0: p.y - 40, y1: p.y + 40 }, flat: true });
    lights.push({ x: p.x, y: p.y, z: 6, r: 120, col: p.col, a: .7, flick: true });
  }
  // fences around plots (gate on one side)
  for (const plot of SC.plots) {
    const gateMid = plot.gate === 'x0' ? (plot.y0 + plot.y1) / 2 : (plot.x0 + plot.x1) / 2;
    const gate = (x, y) => Math.abs((plot.gate === 'x0' ? y : x) - gateMid) < 40;
    fenceRun(plot.x0, plot.y0, plot.x1, plot.y0);
    fenceRun(plot.x0, plot.y0, plot.x0, plot.y1, plot.gate === 'x0' ? gate : null);
    fenceRun(plot.x1, plot.y0, plot.x1, plot.y1);
    fenceRun(plot.x0, plot.y1, plot.x1, plot.y1, plot.gate === 'y1' ? gate : null);
    const cabbage = [];
    for (let i = 0; i < 4; i++) cabbage.push(bushSprite(300 + i, 11 + (i % 2) * 2, CROP));
    for (let yy = plot.y0 + 22; yy < plot.y1 - 10; yy += 52) for (let xx = plot.x0 + 24; xx < plot.x1 - 14; xx += 30) {
      const c = cabbage[Math.floor(hash2(xx, yy) * 4)];
      baked.push({ img: c.img, x: xx, y: yy + 6, z: 0, ox: c.ox, oy: c.oy });
    }
  }
  // lanterns
  for (const l of SC.lanterns) {
    objects.push({ kind: 'lantern', x: l.x, y: l.y, z: 0, box: { x0: l.x - 4, x1: l.x + 4, y0: l.y - 4, y1: l.y + 4 } });
    colliders.push({ type: 'c', x: l.x, y: l.y, r: 8 });
    lights.push({ x: l.x, y: l.y, z: 30, r: 95, col: [255, 196, 120], a: .6, flick: true });
    shadows.push({ x: l.x, y: l.y, z: 0, dx: 8, dy: 3, rx: 7, ry: 3 });
  }
  // campfires
  for (const camp of SC.camps) {
    objects.push({ kind: 'fire', x: camp.x, y: camp.y, z: 0, box: { x0: camp.x - 16, x1: camp.x + 16, y0: camp.y - 16, y1: camp.y + 16 } });
    colliders.push({ type: 'c', x: camp.x, y: camp.y, r: 26 });
    lights.push({ x: camp.x, y: camp.y, z: 10, r: 210, col: [255, 150, 60], a: .85, flick: true, fire: true });
    const stone = rockLib[0];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      baked.push({ img: stone.img, x: camp.x + Math.cos(a) * 26, y: camp.y + Math.sin(a) * 26, z: 0, ox: stone.ox, oy: stone.oy, scale: .5 });
    }
  }
  for (const p of plateaus) colliders.push({ type: 'b', ...p });
}
function fenceRun(ax, ay, bx, by, skip) {
  const STEP = 34, len = Math.hypot(bx - ax, by - ay), n = Math.round(len / STEP);
  for (let i = 0; i < n; i++) {
    const x0 = ax + (bx - ax) * i / n, y0 = ay + (by - ay) * i / n, x1 = ax + (bx - ax) * (i + 1) / n, y1 = ay + (by - ay) * (i + 1) / n;
    if (skip && skip((x0 + x1) / 2, (y0 + y1) / 2)) { addPost(x0, y0); continue; }
    const box = { x0: Math.min(x0, x1) - 3, x1: Math.max(x0, x1) + 3, y0: Math.min(y0, y1) - 3, y1: Math.max(y0, y1) + 3 };
    objects.push({ kind: 'fence', x: x0, y: y0, x1, y1, z: 0, box });
    colliders.push({ type: 'b', ...box });
  }
  addPost(bx, by);
}
function addPost(x, y) {
  objects.push({ kind: 'fence', x, y, x1: x, y1: y, z: 0, box: { x0: x - 3, x1: x + 3, y0: y - 3, y1: y + 3 } });
}
function placeWalls(wl) {
  const r = wl.rect, th = wl.th, h = wl.h, SEG = 32, TW = 40;
  const segX = [0, 1, 2].map(i => wallSegSprite(SEG, th, h, true, i)), segY = [0, 1, 2].map(i => wallSegSprite(SEG, th, h, false, i));
  const tower = towerSprite(TW, 66, SLATE), gateTower = towerSprite(TW, 74, RED);
  const towers = [[r.x0, r.y0, tower], [r.x1, r.y0, tower], [r.x0, r.y1, tower], [r.x1, r.y1, tower]];
  const gapOf = { y0: null, x0: wl.gaps.west, y1: wl.gaps.south, x1: wl.gaps.east };
  for (const [edge, gap] of Object.entries(gapOf)) if (gap) {
    const alongX = edge[0] === 'y', fixed = r[edge];
    for (const g of gap) towers.push(alongX ? [g + (g === gap[0] ? -TW / 2 : TW / 2), fixed, gateTower] : [fixed, g + (g === gap[0] ? -TW / 2 : TW / 2), gateTower]);
  }
  const inTower = (x, y) => towers.some(([tx, ty]) => Math.abs(x - tx) < TW / 2 + 6 && Math.abs(y - ty) < TW / 2 + 6);
  for (const [edge, gap] of Object.entries(gapOf)) {
    const alongX = edge[0] === 'y', fixed = r[edge], from = alongX ? r.x0 : r.y0, to = alongX ? r.x1 : r.y1;
    for (let s = from; s < to; s += SEG) {
      const mid = s + SEG / 2;
      if (gap && mid > gap[0] && mid < gap[1]) continue;
      const x = alongX ? s : fixed - th / 2, y = alongX ? fixed - th / 2 : s;
      if (inTower(alongX ? mid : fixed, alongX ? fixed : mid)) continue;
      const spr = (alongX ? segX : segY)[Math.floor(hash2(s, fixed) * 3)];
      const box = alongX ? { x0: x, x1: x + SEG, y0: y, y1: y + th } : { x0: x, x1: x + th, y0: y, y1: y + SEG };
      addBoxed(spr, x, y, box);
      colliders.push({ type: 'b', ...box });
      if (!alongX) rectShadows.push({ x0: box.x1, x1: box.x1 + h * 1.3, y0: box.y0, y1: box.y1, k: .66 });
      else rectShadows.push({ x0: box.x0, x1: box.x1, y0: box.y1, y1: box.y1 + 12, k: .78 });
    }
  }
  for (const [tx, ty, spr] of towers) {
    const x = tx - TW / 2, y = ty - TW / 2, box = { x0: x, x1: x + TW, y0: y, y1: y + TW };
    addBoxed(spr, x, y, box);
    colliders.push({ type: 'b', ...box });
    rectShadows.push({ x0: box.x1, x1: box.x1 + 110, y0: box.y0, y1: box.y1 + 10, k: .62 });
  }
}

// ---------- ground bake ----------
const GROUND = { x0: -1540, x1: 1540, y0: -280, y1: 1640 };
let groundCanvas = null;

function cobble(x, y, px, py, depth) {
  const rowH = 22, row = Math.floor(y / rowH), off = (row & 1) * 13 + hash2(row, 7) * 6, cw = 26;
  const col = Math.floor((x + off) / cw);
  const ccx = (col + .5) * cw - off, ccy = (row + .5) * rowH;
  if (pavedAt(ccx, ccy).d < hash2(col * 3, row) * 26 * SC.worn - 6) return null;
  const u = x + off - col * cw, v = y - row * rowH;
  if (u < 3 || v < 3 || (u < 7 && v < 7 && u + v < 8) || (u > cw - 5 && v > rowH - 5 && (cw - u) + (rowH - v) < 6)) return MORTAR;
  let l = 1 + Math.floor(hash2(col, row) * 3);
  if (u < 8 || v < 7) l++;
  if (u > cw - 6 || v > rowH - 5) l--;
  if (hash2(px, py) > .9) l--;
  if (vnoise(x * .02, y * .02) > .72 + (1 - SC.worn) * .2 && hash2(px * 5, py) > .6) return GRASS[2];
  return COBBLE[clamp(l, 0, 4)];
}
// Plaza: large fitted flagstones plus concentric rings around the fountain.
function flagstone(x, y, px, py) {
  if (SC.fountain) {
    const d = Math.hypot(x - SC.fountain.x, y - SC.fountain.y);
    if (d < 250) {
      const ring = Math.floor(d / 26), seg = Math.floor(Math.atan2(y - SC.fountain.y, x - SC.fountain.x) * (ring * 3 + 6) / (Math.PI * 2));
      const rf = d % 26, af = (Math.atan2(y - SC.fountain.y, x - SC.fountain.x) * (ring * 3 + 6) / (Math.PI * 2)) % 1;
      if (rf < 2.5 || Math.abs(af) * d * Math.PI * 2 / (ring * 3 + 6) < 2.5) return MORTAR;
      let l = (ring % 3 === 2 ? 1 : 2) + (hash2(ring, seg) > .6 ? 1 : 0);
      if (rf > 20) l--;
      if (hash2(px, py) > .92) l--;
      return (ring % 3 === 2 ? COBBLE : FLAG)[clamp(l, 0, 4)];
    }
  }
  const sz = 44, row = Math.floor(y / sz), off = (row & 1) * sz / 2, col = Math.floor((x + off) / sz);
  const u = x + off - col * sz, v = y - row * sz;
  if (u < 3 || v < 3) return MORTAR;
  let l = 2 + (hash2(col, row) > .55 ? 1 : 0) - (hash2(col * 7, row) > .85 ? 1 : 0);
  if (u < 7 || v < 6) l++;
  if (u > sz - 5 || v > sz - 4) l--;
  if (hash2(px, py) > .93) l--;
  return FLAG[clamp(l, 0, 4)];
}

function groundColor(x, y, px, py, F) {
  const pv = pavedAt(x, y);
  if (pv.d > -8) {
    if (pv.r.style === 'plaza' && pv.d > 0) return flagstone(x, y, px, py);
    const c = cobble(x, y, px, py); if (c) return c;
  }
  for (const plot of SC.plots) if (inRect(x, y, plot)) {
    const v = (y - plot.y0) % 26;
    let l = v < 14 ? (v < 4 ? 3 : v > 11 ? 1 : 2) : (v < 18 ? 0 : 1);
    if (hash2(px, py) > .88) l = clamp(l + (hash2(py, px) > .5 ? 1 : -1), 0, 4);
    return DIRT[l];
  }
  const dens = F[0];
  const dn = F[2] - (SC.townLawn && inRect(x, y, SC.townLawn) ? .72 : .64);
  const worn = pathDist(x, y) < (20 + F[3] * 30) * SC.worn ? .03 : -1;
  let campWorn = -1;
  for (const c of SC.camps) if (Math.hypot(x - c.x, y - c.y) < 85 + vnoise(x * .03, y * .03) * 30) campWorn = .03;
  const yard = SC.yards.some(r => inRect(x, y, r)) && vnoise(x * .03, y * .03) > .35 ? .03 : -1;
  const dirt = Math.max(dn, worn, campWorn, yard);
  if (dirt + bayer(px, py) * .035 > 0) {
    let t = .5 + (vnoise(x * .05, y * .05) - .5) * .7 - dens * .2;
    let l = clamp(Math.round(t * 4 + bayer(px, py) * .9), 0, 4);
    if (hash2(px * 3, py * 5) > .975) l = 4;
    return DIRT[l];
  }
  let t = .6 + F[1] - dens * .34;
  let l = Math.round(t * 5 + bayer(px, py) * 1.05);
  if (dirt > -.03) l--; // darker grass lip at dirt edges
  const streak = hash2(px, (py + ((px * 7) & 3)) >> 1);
  if (streak > .94) l++; else if (streak < .04) l--;
  return GRASS[clamp(l, 0, 5)];
}

function cliffColor(which, e, hgt, px, py) {
  const k = which === 'x' ? -1 : 0;
  if (hgt > PLATEAU_H - 2 - vnoise(e * .09, 3) * 7) {
    const l = hgt > PLATEAU_H - 2 ? 4 : 2 + (hash2(px, py) > .6 ? 1 : 0) + k;
    return GRASS[clamp(l, 0, 5)];
  }
  if (hgt < 2.5) return CLIFF[0];
  const ep = e * .559, row = Math.floor(hgt / 8), rowOff = hash2(row, 11) * 12;
  const bw = 14 + Math.floor(hash2(row, 5) * 8), col = Math.floor((ep + rowOff) / bw);
  const lu = (ep + rowOff) - col * bw, lvv = hgt - row * 8;
  if (lvv < 1.2 || lu < 1.2) return CLIFF[0];
  let l = 2 + Math.floor(hash2(col, row) * 2) + k;
  if (lvv > 6.5) l++;
  if (lu < 3) l--;
  if (hash2(px * 3, py) > .92) l--;
  if (vnoise(ep * .12, hgt * .12) > .7 && hgt > PLATEAU_H * .5) return BUSH[clamp(l, 1, 3)];
  return CLIFF[clamp(l, 0, 5)];
}

async function bakeGround() {
  const gw = GROUND.x1 - GROUND.x0, gh = GROUND.y1 - GROUND.y0;
  groundCanvas = makeCanvas(gw, gh);
  const g = groundCanvas.getContext('2d');
  const img = g.createImageData(gw, gh), d = img.data;
  const HH = PLATEAU_H;
  // low-frequency fields sampled on a 4px screen lattice, bilinear per pixel
  const Q = 4, fw = Math.ceil(gw / Q) + 2, fh = Math.ceil((gh + HH) / Q) + 2, NF = 4;
  const field = new Float32Array(fw * fh * NF);
  for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
    const sx = GROUND.x0 + i * Q, sy = GROUND.y0 + j * Q, x = sx + 2 * sy, y = 2 * sy - sx, o = (j * fw + i) * NF;
    field[o] = forestDensity(x, y);
    field[o + 1] = (fbm(x * .0035, y * .0035) - .5) * .85 + (vnoise(x * .025, y * .025) - .5) * .3;
    field[o + 2] = fbm(x * .0055 + 31, y * .0055 + 11);
    field[o + 3] = fbm(x * .02, y * .02);
  }
  const F = new Float32Array(NF);
  const sample = (px, py) => {
    const fx = px / Q, fy = py / Q, i = fx | 0, j = fy | 0, u = fx - i, v = fy - j;
    const o00 = (j * fw + i) * NF, o10 = o00 + NF, o01 = o00 + fw * NF, o11 = o01 + NF;
    for (let k = 0; k < NF; k++) F[k] = (field[o00 + k] * (1 - u) + field[o10 + k] * u) * (1 - v) + (field[o01 + k] * (1 - u) + field[o11 + k] * u) * v;
    return F;
  };
  for (let py = 0; py < gh; py++) {
    const sy = GROUND.y0 + py + .5;
    for (let px = 0; px < gw; px++) {
      const sx = GROUND.x0 + px + .5;
      const a = sx + 2 * sy, b = 2 * sy - sx;
      let col = null, top = false, faceWhich = null, faceE = 0, faceH = 0;
      for (const p of plateaus) {
        const hIn = Math.max((p.x0 - a) / 2, (p.y0 - b) / 2), hOut = Math.min((p.x1 - a) / 2, (p.y1 - b) / 2);
        if (hIn > hOut) continue;
        if (HH >= hIn && HH <= hOut) { top = true; break; }
        if (hOut >= 0 && hOut < HH && faceWhich === null) {
          faceWhich = (p.x1 - a) / 2 < (p.y1 - b) / 2 ? 'x' : 'y';
          faceE = faceWhich === 'x' ? b + 2 * hOut : a + 2 * hOut; faceH = hOut;
        }
      }
      let shade = 1;
      if (top) {
        const tx = a + 2 * HH, ty = b + 2 * HH;
        col = groundColor(tx, ty, px, py, sample(px, py + HH));
        let rim = 1e9;
        for (const p of plateaus) if (inRect(tx, ty, p)) rim = Math.min(rim, p.x1 - tx, p.y1 - ty);
        if (rim < 7) col = GRASS[5]; else if (rim < 14) shade = 1.08;
      } else if (faceWhich) {
        col = cliffColor(faceWhich, faceE, faceH, px, py);
      } else {
        col = groundColor(a, b, px, py, sample(px, py));
        for (const p of plateaus) {
          if (b >= p.y0 && b <= p.y1 + 30 && a > p.x1 && a < p.x1 + 70 + vnoise(b * .02, 1) * 30 && !inPlateau(a, b)) shade = Math.min(shade, .62);
          if (a >= p.x0 && a <= p.x1 && b > p.y1 && b < p.y1 + 16) shade = Math.min(shade, .8);
        }
      }
      const o = (py * gw + px) * 4;
      if (shade < 1) { d[o] = col[0] * shade * .88; d[o + 1] = col[1] * shade * .95; d[o + 2] = Math.min(255, col[2] * shade * 1.12 + 6); }
      else { d[o] = Math.min(255, col[0] * shade); d[o + 1] = Math.min(255, col[1] * shade); d[o + 2] = Math.min(255, col[2] * shade); }
      d[o + 3] = 255;
    }
    if (py % 120 === 0) { loadingEl.textContent = `กำลังวาดพื้น… ${Math.round(py / gh * 100)}%`; await new Promise(r => setTimeout(r, 0)); }
  }
  g.putImageData(img, 0, 0);
  // baked small props
  g.imageSmoothingEnabled = false;
  baked.sort((p, q) => (p.x + p.y) - (q.x + q.y));
  for (const b of baked) {
    const sx = Math.round(isoX(b.x, b.y) - GROUND.x0), sy = Math.round(isoY(b.x, b.y, b.z) - GROUND.y0);
    if (b.scale) g.drawImage(b.img, sx - b.ox * b.scale, sy - b.oy * b.scale, b.img.width * b.scale, b.img.height * b.scale);
    else g.drawImage(b.img, sx - b.ox, sy - b.oy);
  }
  // flowers
  const fr = rng(77), fcols = ['#f4efe0', '#f6d25a', '#e89ab8', '#b9a4f0'];
  for (let i = 0; i < 2600; i++) {
    const sx = GROUND.x0 + fr() * gw, sy = GROUND.y0 + fr() * gh;
    const x = sx + 2 * sy, y = 2 * sy - sx;
    if (inPlateau(x, y) || pathDist(x, y) < 20 || SC.plots.some(p => inRect(x, y, p, 10)) || forestDensity(x, y) > .7) continue;
    if (SC.buildings.some(b => inRect(x, y, b, 10))) continue;
    if (fbm(x * .01 + 50, y * .01) < .55) continue;
    g.fillStyle = fcols[Math.floor(fr() * fcols.length)];
    for (let k = 0; k < 4; k++) g.fillRect(Math.round(sx - GROUND.x0 + (fr() - .5) * 10), Math.round(sy - GROUND.y0 + (fr() - .5) * 5), 1, 1);
  }
  // shadows: cool-tinted, trees get dappled holes
  const img2 = g.getImageData(0, 0, gw, gh), d2 = img2.data;
  const darken = (o, k) => { d2[o] *= k * .86; d2[o + 1] *= k * .93; d2[o + 2] = Math.min(255, d2[o + 2] * k * 1.1 + 5); };
  for (const s of shadows) {
    const cx = isoX(s.x, s.y) - GROUND.x0 + s.dx, cy = isoY(s.x, s.y, s.z) - GROUND.y0 + s.dy;
    const x0 = Math.max(0, Math.floor(cx - s.rx)), x1 = Math.min(gw - 1, Math.ceil(cx + s.rx));
    const y0 = Math.max(0, Math.floor(cy - s.ry)), y1 = Math.min(gh - 1, Math.ceil(cy + s.ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let q = ((x - cx) / s.rx) ** 2 + ((y - cy) / s.ry) ** 2;
      q += (vnoise(x * .18, y * .3) - .5) * .5;
      if (q > 1 - (bayer(x, y) + .5) * .12) continue;
      if (s.rx > 20 && vnoise(x * .22 + 5, y * .35) > .8) continue;
      darken((y * gw + x) * 4, .64);
    }
  }
  for (const r of rectShadows) {
    const cs = [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]].map(([x, y]) => [isoX(x, y) - GROUND.x0, isoY(x, y) - GROUND.y0]);
    const x0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[0])))), x1 = Math.min(gw - 1, Math.ceil(Math.max(...cs.map(c => c[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[1])))), y1 = Math.min(gh - 1, Math.ceil(Math.max(...cs.map(c => c[1]))));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const sx = px + GROUND.x0 + .5, sy = py + GROUND.y0 + .5, x = sx + 2 * sy, y = 2 * sy - sx;
      if (!inRect(x, y, r)) continue;
      const soft = Math.min(x - r.x0, r.x1 - x) < 10 && bayer(px, py) > 0;
      if (soft) continue;
      darken((py * gw + px) * 4, r.k);
    }
  }
  g.putImageData(img2, 0, 0);
}

// ---------- player ----------
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const sprites = {};
const player = { x: SC.spawn.x, y: SC.spawn.y, vx: 0, vy: 0, dir: 4, r: 13, target: null, kind: 'player', z: 0 };
const cam = { x: isoX(SC.spawn.x, SC.spawn.y), y: isoY(SC.spawn.x, SC.spawn.y) };
const keys = new Set();
let dusk = false, t0 = performance.now(), time = 0;
const particles = [];

function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

function moveResolve(ent) {
  ent.x = clamp(ent.x, 1.2 * T, S - 1.2 * T); ent.y = clamp(ent.y, 1.2 * T, S - 1.2 * T);
  for (let pass = 0; pass < 2; pass++) for (const c of colliders) {
    if (c.type === 'c') {
      const dx = ent.x - c.x, dy = ent.y - c.y, dist = Math.hypot(dx, dy), m = c.r + ent.r;
      if (dist < m && dist > .001) { ent.x = c.x + dx / dist * m; ent.y = c.y + dy / dist * m; }
    } else {
      const qx = clamp(ent.x, c.x0, c.x1), qy = clamp(ent.y, c.y0, c.y1);
      const dx = ent.x - qx, dy = ent.y - qy, dist = Math.hypot(dx, dy);
      if (dist < ent.r) {
        if (dist > .001) { ent.x = qx + dx / dist * ent.r; ent.y = qy + dy / dist * ent.r; }
        else { // inside: push out through nearest side
          const opts = [[c.x0 - ent.r - ent.x, 0], [c.x1 + ent.r - ent.x, 0], [0, c.y0 - ent.r - ent.y], [0, c.y1 + ent.r - ent.y]];
          opts.sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]));
          ent.x += opts[0][0]; ent.y += opts[0][1];
        }
      }
    }
  }
}

function update(dt) {
  let sx = 0, sy = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) sy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) sy += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) sx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) sx += 1;
  if (sx || sy) player.target = null;
  else if (player.target) {
    const dx = isoX(player.target.x, player.target.y) - isoX(player.x, player.y);
    const dy = isoY(player.target.x, player.target.y) - isoY(player.x, player.y);
    if (Math.hypot(dx, dy) < 4) player.target = null; else { sx = dx; sy = dy; }
  }
  const len = Math.hypot(sx, sy), speed = 125;
  if (len > 0) {
    const vx = sx / len * speed, vy = sy / len * speed;
    player.x += (vx + 2 * vy) * dt; player.y += (2 * vy - vx) * dt;
    const heading = (Math.atan2(vx, -vy) * 180 / Math.PI + 360) % 360;
    player.dir = Math.round(heading / 45) % 8;
    player.moving = true;
  } else player.moving = false;
  moveResolve(player);
  const tx = clamp(isoX(player.x, player.y), GROUND.x0 + W / 2, GROUND.x1 - W / 2);
  const ty = clamp(isoY(player.x, player.y) - 20, GROUND.y0 + H / 2, GROUND.y1 - H / 2);
  cam.x += (tx - cam.x) * Math.min(1, dt * 6); cam.y += (ty - cam.y) * Math.min(1, dt * 6);
  // particles
  for (const c of SC.camps) if (Math.random() < dt * 14) particles.push({ type: 'spark', x: c.x + (Math.random() - .5) * 14, y: c.y + (Math.random() - .5) * 14, z: 12, vz: 30 + Math.random() * 30, life: 1 + Math.random() });
  for (const c of chimneys) if (Math.random() < dt * 2.2) particles.push({ type: 'smoke', x: c.x, y: c.y, z: c.z, vz: 14, life: 3.5, drift: Math.random() * 6 });
  if (SC.fountain && Math.random() < dt * 40) {
    const a = Math.random() * Math.PI * 2, sp = 18 + Math.random() * 10;
    particles.push({ type: 'drop', x: SC.fountain.x, y: SC.fountain.y, z: 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 30 + Math.random() * 20, life: 2, floor: 47 });
  }
  for (const p of SC.portals) if (Math.random() < dt * 10) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * 36;
    particles.push({ type: 'mote', x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr, z: 0, vz: 22 + Math.random() * 20, life: 1.6, col: p.col });
  }
  if (Math.random() < dt * (dusk ? 0 : 1.2)) {
    const sx0 = cam.x + (Math.random() - .5) * W, sy0 = cam.y - H / 2 - 10;
    particles.push({ type: 'leaf', sx: sx0, sy: sy0, vx: 18 + Math.random() * 16, vy: 26 + Math.random() * 14, life: 14, ph: Math.random() * 6 });
  }
  if (dusk && Math.random() < dt * 3) {
    particles.push({ type: 'fly', sx: cam.x + (Math.random() - .5) * W, sy: cam.y + (Math.random() - .5) * H, life: 4 + Math.random() * 3, ph: Math.random() * 6 });
  }
  for (const p of particles) {
    p.life -= dt;
    if (p.type === 'spark' || p.type === 'mote') { p.z += p.vz * dt; p.x += (Math.random() - .5) * 20 * dt; }
    else if (p.type === 'smoke') { p.z += p.vz * dt; p.x += p.drift * dt; p.y -= p.drift * dt; }
    else if (p.type === 'drop') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vz -= 120 * dt; p.z += p.vz * dt;
      const r = Math.hypot(p.x - SC.fountain.x, p.y - SC.fountain.y);
      if (r > 26) p.floor = 11;
      if (p.z < p.floor) p.life = 0;
    }
    else if (p.type === 'leaf') { p.sx += (p.vx + Math.sin(time * 2 + p.ph) * 20) * dt; p.sy += p.vy * dt; }
    else if (p.type === 'fly') { p.sx += Math.sin(time * 1.3 + p.ph) * 12 * dt; p.sy += Math.cos(time * 1.7 + p.ph) * 8 * dt; }
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
}

// ---------- draw ----------
const toScreen = (x, y, z = 0) => [Math.round(isoX(x, y) - cam.x + W / 2), Math.round(isoY(x, y, z) - cam.y + H / 2)];

function boxOf(o) {
  if (o.box) return o.box;
  return { x0: o.x - o.r, x1: o.x + o.r, y0: o.y - o.r, y1: o.y + o.r };
}
function compare(a, b) {
  if (a.flat !== b.flat) return a.flat ? -1 : 1; // ground decals first
  const A = boxOf(a), B = boxOf(b);
  const oy = A.y0 < B.y1 && B.y0 < A.y1, ox = A.x0 < B.x1 && B.x0 < A.x1;
  if (oy) { if (A.x1 <= B.x0) return -1; if (B.x1 <= A.x0) return 1; }
  if (ox) { if (A.y1 <= B.y0) return -1; if (B.y1 <= A.y0) return 1; }
  return ((A.x0 + A.x1) + (A.y0 + A.y1)) - ((B.x0 + B.x1) + (B.y0 + B.y1)) + (a.z - b.z) * 4;
}

function drawIsoLine(x0, y0, x1, y1, h, col) {
  const [ax, ay] = toScreen(x0, y0), [bx, by] = toScreen(x1, y1);
  const steps = Math.max(1, Math.abs(by - ay));
  const sxs = (bx - ax) / steps, sys = Math.sign(by - ay);
  ctx.fillStyle = col;
  for (let k = 0; k < steps; k++) ctx.fillRect(Math.round(ax + sxs * k), ay + sys * k - h, Math.ceil(Math.abs(sxs)) || 1, 2);
}

function drawObject(o, playerScreen, afterPlayer) {
  if (o.kind === 'sprite') {
    const [sx, sy] = toScreen(o.x, o.y, o.z);
    const x = sx - o.ox, y = sy - o.oy;
    if (x > W || y > H || x + o.img.width < 0 || y + o.img.height < 0) return;
    if (o.fade && afterPlayer && playerScreen[0] > x + 6 && playerScreen[0] < x + o.img.width - 6 && playerScreen[1] - 30 > y && playerScreen[1] - 30 < y + o.img.height - 10) {
      ctx.globalAlpha = .42; ctx.drawImage(o.img, x, y); ctx.globalAlpha = 1;
    } else ctx.drawImage(o.img, x, y);
  } else if (o.kind === 'player') {
    const [sx, sy] = toScreen(o.x, o.y);
    const img = sprites[DIRS[o.dir]];
    const bob = o.moving ? Math.round(Math.abs(Math.sin(time * 11)) * 2) : 0;
    if (img) ctx.drawImage(img, sx - 32, sy - 60 - bob);
  } else if (o.kind === 'fence') {
    const [ax, ay] = toScreen(o.x, o.y);
    if (ax < -40 || ax > W + 40 || ay < -40 || ay > H + 40) return;
    if (o.x1 !== o.x || o.y1 !== o.y) {
      drawIsoLine(o.x, o.y, o.x1, o.y1, 17, '#9a6a3c'); drawIsoLine(o.x, o.y, o.x1, o.y1, 16, '#5a3a22');
      drawIsoLine(o.x, o.y, o.x1, o.y1, 9, '#8c5c34'); drawIsoLine(o.x, o.y, o.x1, o.y1, 8, '#4a2e1a');
    }
    ctx.fillStyle = '#4a2e1a'; ctx.fillRect(ax - 2, ay - 22, 4, 23);
    ctx.fillStyle = '#8c5c34'; ctx.fillRect(ax - 2, ay - 22, 2, 22);
    ctx.fillStyle = '#b07e4a'; ctx.fillRect(ax - 2, ay - 23, 3, 1);
  } else if (o.kind === 'lantern') {
    const [sx, sy] = toScreen(o.x, o.y);
    ctx.fillStyle = '#2e1c10'; ctx.fillRect(sx - 1, sy - 34, 3, 35);
    ctx.fillStyle = '#6b4427'; ctx.fillRect(sx - 1, sy - 34, 1, 34);
    ctx.fillStyle = '#2e1c10'; ctx.fillRect(sx - 1, sy - 34, 8, 2); ctx.fillRect(sx + 3, sy - 34, 1, 5);
    const f = .75 + Math.sin(time * 9 + o.x) * .1 + Math.sin(time * 23 + o.y) * .06;
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(sx + 1, sy - 30, 6, 8);
    ctx.fillStyle = `rgba(255,${190 + f * 40 | 0},110,1)`; ctx.fillRect(sx + 2, sy - 29, 4, 6);
    ctx.fillStyle = '#fff4c0'; ctx.fillRect(sx + 3, sy - 27, 2, 2);
  } else if (o.kind === 'fire') {
    const [sx, sy] = toScreen(o.x, o.y);
    ctx.fillStyle = '#3a2414'; ctx.fillRect(sx - 12, sy - 3, 24, 4); ctx.fillRect(sx - 8, sy - 5, 16, 3);
    ctx.fillStyle = '#6b4427'; ctx.fillRect(sx - 12, sy - 3, 24, 1);
    const cols = ['#b8321c', '#e8641e', '#ffa22e', '#ffd65a', '#fff3b8'];
    for (let i = 0; i < 11; i++) {
      const cx = sx - 10 + i * 2, center = 1 - Math.abs(i - 5) / 6;
      const hgt = Math.round((6 + 18 * center) * (.72 + .28 * Math.sin(time * 11 + i * 1.9) + .12 * Math.sin(time * 27 + i)));
      for (let k = 0; k < hgt; k++) {
        const t = k / hgt;
        const ci = clamp(Math.floor((1 - t) * 3.2 * center + (t < .15 ? 0 : 1)), 0, 4);
        ctx.fillStyle = cols[clamp(t > .8 ? 0 : ci + (center > .6 && t < .5 ? 1 : 0), 0, 4)];
        ctx.fillRect(cx, sy - 4 - k, 2, 1);
      }
    }
  } else if (o.kind === 'portal') {
    const [cx, cy] = toScreen(o.x, o.y);
    if (cx < -80 || cx > W + 80 || cy < -80 || cy > H + 80) return;
    const [r, g, b] = o.col;
    const ring = (rad, n, speed, size, alpha) => {
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + time * speed, wx = Math.cos(a) * rad, wy = Math.sin(a) * rad;
        const px = Math.round(cx + (wx - wy) / 2), py = Math.round(cy + (wx + wy) / 4);
        const k = .55 + .45 * Math.sin(i * 1.7 + time * 4);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha * k})`; ctx.fillRect(px, py, size, size);
      }
    };
    ring(40, 64, .4, 2, .95); ring(30, 40, -.7, 1, .8); ring(18, 20, 1.2, 1, .7);
    for (let i = 0; i < 6; i++) { // rune glyph ticks on the outer ring
      const a = i / 6 * Math.PI * 2 - time * .4, wx = Math.cos(a) * 34, wy = Math.sin(a) * 34;
      ctx.fillStyle = `rgba(255,255,255,.85)`; ctx.fillRect(Math.round(cx + (wx - wy) / 2), Math.round(cy + (wx + wy) / 4) - 1, 2, 3);
    }
  }
  if (o.flagAt) drawFlag(o.flagAt);
}
function drawFlag(f) {
  const [sx, sy] = toScreen(f.x, f.y, f.z);
  ctx.fillStyle = '#2a1c14'; ctx.fillRect(sx, sy - 22, 1, 23);
  for (let xx = 0; xx < 14; xx++) {
    const wave = Math.round(Math.sin(time * 5 - xx * .6) * 1.5);
    for (let yy = 0; yy < 8; yy++) {
      ctx.fillStyle = yy < 1 ? '#e05a4a' : yy > 6 ? '#7a1c1c' : xx > 3 && xx < 7 && yy > 2 && yy < 5 ? '#e8c25a' : '#b8322a';
      ctx.fillRect(sx + 1 + xx, sy - 22 + yy + wave, 1, 1);
    }
  }
}

let vignette = null, lightCanvas = null, lctx = null;
function buildOverlays() {
  vignette = makeCanvas(W, H);
  const g = vignette.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .72);
  grad.addColorStop(0, 'rgba(12,8,20,0)'); grad.addColorStop(1, 'rgba(12,8,20,.62)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  lightCanvas = makeCanvas(W, H); lctx = lightCanvas.getContext('2d');
}

function drawLighting() {
  const amb = dusk ? 'rgb(78,86,132)' : 'rgb(246,234,214)';
  lctx.globalCompositeOperation = 'source-over'; lctx.fillStyle = amb; lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    if (l.dusk && !dusk) continue;
    const [sx, sy] = toScreen(l.x, l.y, l.z);
    const fl = l.flick ? .9 + Math.sin(time * 8 + l.x) * .05 + Math.sin(time * 19 + l.y) * .05 : 1;
    const rad = l.r * fl * (dusk ? 1.15 : .8);
    if (sx < -rad || sx > W + rad || sy < -rad || sy > H + rad) continue;
    const gr = lctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    const a = l.a * (dusk ? 1 : .45);
    gr.addColorStop(0, `rgba(${l.col[0]},${l.col[1]},${l.col[2]},${a})`);
    gr.addColorStop(.45, `rgba(${l.col[0]},${l.col[1] * .8 | 0},${l.col[2] * .6 | 0},${a * .45})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = gr; lctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
  }
  ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(lightCanvas, 0, 0);
  // warm bloom on hot sources
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    if (!l.fire && !dusk) continue;
    if (l.dusk && !dusk) continue;
    const [sx, sy] = toScreen(l.x, l.y, l.z);
    const rad = (l.fire ? 70 : 26) * (.92 + Math.sin(time * 10 + l.x) * .08);
    if (sx < -rad || sx > W + rad || sy < -rad || sy > H + rad) continue;
    const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    gr.addColorStop(0, `rgba(255,170,80,${dusk ? .35 : .18})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = gr; ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  if (!dusk) { // golden-hour grade
    ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,196,120,.28)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(vignette, 0, 0);
}

function drawParticles() {
  for (const p of particles) {
    if (p.type === 'spark') {
      const [sx, sy] = toScreen(p.x, p.y, p.z);
      ctx.fillStyle = p.life > .6 ? '#ffd65a' : '#e8641e'; ctx.fillRect(sx, sy, 1, 1);
    } else if (p.type === 'mote') {
      const [sx, sy] = toScreen(p.x, p.y, p.z);
      ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${Math.min(1, p.life)})`; ctx.fillRect(sx, sy, 1, 2);
    } else if (p.type === 'drop') {
      const [sx, sy] = toScreen(p.x, p.y, p.z);
      ctx.fillStyle = p.vz > 0 ? '#e8f7ff' : '#9fd4f0'; ctx.fillRect(sx, sy, 1, 2);
    } else if (p.type === 'smoke') {
      const [sx, sy] = toScreen(p.x, p.y, p.z);
      const a = Math.min(.35, p.life / 3.5 * .35), s = Math.round(3 + (3.5 - p.life) * 2);
      ctx.fillStyle = `rgba(200,196,190,${a})`; ctx.fillRect(sx - s / 2 | 0, sy - s / 2 | 0, s, s);
    } else if (p.type === 'leaf') {
      const x = Math.round(p.sx - cam.x + W / 2), y = Math.round(p.sy - cam.y + H / 2);
      ctx.fillStyle = Math.sin(time * 6 + p.ph) > 0 ? '#e2a84a' : '#c47d2e'; ctx.fillRect(x, y, 2, 1);
    } else if (p.type === 'fly') {
      const x = Math.round(p.sx - cam.x + W / 2), y = Math.round(p.sy - cam.y + H / 2);
      const a = .5 + .5 * Math.sin(time * 5 + p.ph);
      ctx.fillStyle = `rgba(220,255,140,${a})`; ctx.fillRect(x, y, 2, 2);
    }
  }
}

function frame(now) {
  const dt = Math.min(.05, (now - t0) / 1000); t0 = now; time += dt;
  update(dt);
  ctx.fillStyle = '#101510'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(groundCanvas, Math.round(GROUND.x0 - cam.x + W / 2), Math.round(GROUND.y0 - cam.y + H / 2));
  // fountain water shimmer
  if (SC.fountain) {
    const [fx, fy] = toScreen(SC.fountain.x, SC.fountain.y, 11);
    for (let i = 0; i < 26; i++) {
      const a = hash2(i, 3) * Math.PI * 2, rr = 12 + hash2(i, 5) * 58, wx = Math.cos(a) * rr, wy = Math.sin(a) * rr;
      if (Math.sin(time * 3 + i * 1.7) < .55) continue;
      ctx.fillStyle = 'rgba(230,248,255,.9)'; ctx.fillRect(Math.round(fx + (wx - wy) / 2), Math.round(fy + (wx + wy) / 4), 2, 1);
    }
  }
  // player contact shadow
  const [psx, psy] = toScreen(player.x, player.y);
  ctx.fillStyle = 'rgba(16,20,34,.38)';
  for (let r = -4; r <= 4; r++) { const hw = Math.round(15 * Math.sqrt(1 - (r / 5) ** 2)); ctx.fillRect(psx - hw, psy + r - 1, hw * 2, 1); }
  // visible objects, depth sorted
  const vis = [];
  for (const o of objects) {
    const [sx, sy] = toScreen(o.x, o.y, o.z);
    if (sx < -360 || sx > W + 360 || sy < -80 || sy > H + 420) continue;
    vis.push(o);
  }
  vis.push(player);
  vis.sort(compare);
  let after = false;
  for (const o of vis) {
    if (o === player) { after = true; drawObject(o); continue; }
    drawObject(o, [psx, psy], after);
  }
  drawParticles();
  drawLighting();
  requestAnimationFrame(frame);
}

// ---------- input ----------
window.addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyL') dusk = !dusk;
  if (e.code === 'KeyH') { const h = document.getElementById('hud'); h.hidden = !h.hidden; }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', e => keys.delete(e.code));
canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  const mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
  const sx = mx - W / 2 + cam.x, sy = my - H / 2 + cam.y;
  player.target = { x: sx + 2 * sy, y: 2 * sy - sx };
});

// ---------- boot ----------
(async () => {
  document.querySelectorAll('[data-map]').forEach(a => a.classList.toggle('active', a.dataset.map === MAP));
  await new Promise(r => setTimeout(r, 0));
  const tStart = performance.now();
  buildLibraries();
  placeStructures();
  placeScatter();
  // hall flags draw with their building
  for (const f of flags) {
    const host = objects.find(o => o.kind === 'sprite' && o.box && inRect(f.x, f.y, o.box) && o.box.x1 - o.box.x0 > 100);
    if (host) host.flagAt = f;
  }
  await bakeGround();
  buildOverlays();
  await Promise.all(DIRS.map(async d => { sprites[d] = await loadImage(`../isometric-player/${d}.png`); }));
  loadingEl.remove();
  window.__slice = { player, objects, cam, bakeMs: Math.round(performance.now() - tStart), setDusk: v => { dusk = v; } };
  requestAnimationFrame(frame);
})();
