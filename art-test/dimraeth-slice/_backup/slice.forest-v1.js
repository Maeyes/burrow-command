// Dimraeth-style environment slice — visual target test for the iso map (Step 1).
// Same 2:1 projection as iso-arena-draft; everything here is procedural pixel art so the
// visual language (diagonal structures, elevation faces, painted ground, density, light)
// can be judged before any asset production.

const W = 1280, H = 720, T = 64, S = 40 * T;
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const loadingEl = document.getElementById('loading');

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

// ---------- palettes ----------
const GRASS = pal(['#28441d', '#365e22', '#4a7a2a', '#639631', '#83b03d', '#a6c950']);
const DIRT = pal(['#46301f', '#634329', '#80593a', '#9e7550', '#bd9669']);
const COBBLE = pal(['#3a3834', '#58544c', '#767064', '#948c7d', '#b2a998']);
const MORTAR = hex('#2b2926');
const CLIFF = pal(['#25242b', '#35343d', '#47454f', '#5c5a63', '#77747b', '#908c90']);
const LEAF = pal(['#15291a', '#1f4224', '#2d5d2c', '#417a33', '#5f9a3d', '#88bb4d']);
const LEAF_AUTUMN = pal(['#3b1d12', '#6a3316', '#99521f', '#c47d2e', '#e2a84a', '#f2cd72']);
const LEAF_BLOSSOM = pal(['#3a1f2e', '#6b3552', '#9c4f73', '#c97497', '#e8a2bb', '#f8d0dc']);
const PINE = pal(['#0d221c', '#153628', '#1e4b36', '#2a6245', '#3c7a55']);
const BUSH = pal(['#172f1b', '#244a25', '#35662f', '#4d853a', '#6ea647', '#98c65a']);
const BARK = pal(['#24170f', '#3d281a', '#5a3b24', '#7a5231']);
const STONE = pal(['#2c2b30', '#44424a', '#5e5b62', '#7b777c', '#9b9696']);
const CROP = pal(['#23491f', '#356b2a', '#4f8f35', '#76b545', '#a6d869']);
const WOOD = pal(['#2e1c10', '#4a2e1a', '#6b4427', '#8c5c34', '#ad7a47']);
const PLASTER = pal(['#8a7b62', '#a8987a', '#c4b494', '#d9cbad']);
const SLATE = pal(['#1f2640', '#2b3658', '#3b4c7a', '#50679c', '#6c86ba']);

// ---------- layout (world units) ----------
const PLATEAU_H = 56;
const plateaus = [
  { x0: -9 * T, x1: 26 * T, y0: -9 * T, y1: 5 * T },
  { x0: -9 * T, x1: 6 * T, y0: -9 * T, y1: 24 * T },
];
const paths = [
  { x0: 6.2 * T, x1: 40 * T, y0: 16 * T, y1: 17.25 * T },
  { x0: 21.5 * T, x1: 22.75 * T, y0: 5.5 * T, y1: 40 * T },
];
const hut = { x0: 16 * T, x1: 19.5 * T, y0: 12 * T, y1: 14.75 * T };
const stairs = { x0: 21.5 * T, x1: 22.75 * T, y0: 5 * T, y1: 5 * T + 7 * 16 };
const plot = { x0: 25 * T, x1: 31 * T, y0: 8.5 * T, y1: 14.25 * T };
const camp = { x: 13.6 * T, y: 21 * T };
const spawn = { x: 20 * T, y: 19.2 * T };
const lanterns = [
  { x: 15.7 * T, y: 15.5 * T }, { x: 20.2 * T, y: 15.5 * T },
  { x: 23.3 * T, y: 18.2 * T }, { x: 23.3 * T, y: 27 * T },
];
const crates = [
  { x: 19.5 * T + 8, y: 12 * T + 10, w: 22, d: 22, h: 18 },
  { x: 19.5 * T + 8, y: 12 * T + 38, w: 22, d: 22, h: 18 },
  { x: 19.5 * T + 36, y: 12 * T + 20, w: 20, d: 20, h: 16 },
];
const logs = [
  { x: camp.x - 70, y: camp.y - 30, w: 56, d: 16, h: 11 },
  { x: camp.x + 20, y: camp.y + 44, w: 16, d: 56, h: 11 },
];

const inRect = (x, y, r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m;
const inPlateau = (x, y, m = 0) => plateaus.some(p => inRect(x, y, p, m));
function pathInside(x, y) { // >0 inside a path (depth to its edge), negative outside
  let best = -1e9;
  for (const r of paths) best = Math.max(best, Math.min(x - r.x0, r.x1 - x, y - r.y0, r.y1 - y));
  return best;
}
function pathDist(x, y) {
  let best = 1e9;
  for (const r of paths) {
    const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}
function forestDensity(x, y) {
  const d = Math.hypot((x - 21 * T) / (15 * T), (y - 19 * T) / (15 * T));
  let v = smooth(.5, .98, d) + (fbm(x * .004 + 7, y * .004 + 3) - .5) * .75;
  if (x < T || y < T || x > S - T || y > S - T) v += .6;
  if (inPlateau(x, y)) v += .25;
  return clamp(v, 0, 1);
}
function blocked(x, y, m) {
  if (pathDist(x, y) < m + 6) return true;
  if (inRect(x, y, hut, m + 30) || inRect(x, y, plot, m + 18)) return true;
  if (Math.hypot(x - camp.x, y - camp.y) < 110 + m) return true;
  if (Math.hypot(x - spawn.x, y - spawn.y) < 50 + m) return true;
  if (lanterns.some(l => Math.hypot(x - l.x, y - l.y) < 18 + m)) return true;
  if (crates.some(c => inRect(x, y, { x0: c.x, x1: c.x + c.w, y0: c.y, y1: c.y + c.d }, m))) return true;
  // keep cliff faces readable: no trees on the rim or on the ground right in front of them
  if (m >= 40 && !inPlateau(x, y)) for (const p of plateaus) {
    if (y >= p.y0 && y <= p.y1 && x > p.x1 && x < p.x1 + 150) return true;
    if (x >= p.x0 && x <= p.x1 && y > p.y1 && y < p.y1 + 150) return true;
  }
  if (inRect(x, y, stairs, m + 30)) return true;
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
  return { img: canvas, ox: Math.round(cx), oy: ground, canopyR: cr, canopyTop: 0, canopyBottom: Math.round(cy + cr * .7) };
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
function rasterFaces(faces) {
  const pr = p => [isoX(p[0], p[1]), isoY(p[0], p[1], p[2])];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const f of faces) {
    for (const p of [f.O, add(f.O, f.A), add(f.O, f.B), add(add(f.O, f.A), f.B)]) {
      const [x, y] = pr(p); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  minX = Math.floor(minX) - 1; minY = Math.floor(minY) - 1; maxX = Math.ceil(maxX) + 1; maxY = Math.ceil(maxY) + 1;
  const w = maxX - minX, h = maxY - minY;
  const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (const f of faces) {
    const [ox, oy] = pr(f.O), a = pr(add(f.O, f.A)), b = pr(add(f.O, f.B));
    const ax = a[0] - ox, ay = a[1] - oy, bx = b[0] - ox, by = b[1] - oy, det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-6) continue;
    const lenA = Math.hypot(ax, ay), lenB = Math.hypot(bx, by);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
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
  return { img: c, ox: -minX, oy: -minY };
}
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
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

function hutSprite() {
  const Wx = hut.x1 - hut.x0, Wy = hut.y1 - hut.y0, Hw = 52, Hr = 40, o = 12;
  const wall = (k, feature) => (u, v, lu, lv, px, py) => {
    const up = u, vz = v;
    if (vz < 8) { // stone foundation
      const row = Math.floor(vz / 4), col = Math.floor((up + row * 5) / 10);
      if (vz % 4 < 1 || (up + row * 5) % 10 < 1) return shadeCol(STONE[0], k);
      return shadeCol(STONE[1 + Math.floor(hash2(col, row) * 3)], k);
    }
    if (feature === 'door' && Math.abs(up - lu * .5) < 9 && vz < 34) {
      if (Math.abs(up - lu * .5) > 7 || vz > 32) return shadeCol(WOOD[0], k);
      if ((up - lu * .5 + 7) % 4.5 < 1) return shadeCol(WOOD[1], k);
      if (Math.abs(up - lu * .5 - 4) < 1 && Math.abs(vz - 18) < 1) return hex('#d8b25a');
      return shadeCol(WOOD[2], k);
    }
    if (feature === 'window' && Math.abs(up - lu * .5) < 8 && vz > 18 && vz < 34) {
      if (Math.abs(up - lu * .5) > 6.5 || vz < 19.5 || vz > 32.5) return shadeCol(WOOD[0], k);
      if (Math.abs(up - lu * .5) < .8 || Math.abs(vz - 26) < .8) return shadeCol(WOOD[1], k);
      return vz > 26 ? hex('#ffd98a') : hex('#f0a24a');
    }
    const beam = up < 3 || up > lu - 3 || vz > lv - 4 || (vz > 8 && vz < 11) || Math.abs(up - lu / 3) < 1.6 || Math.abs(up - lu * 2 / 3) < 1.6;
    if (beam) return shadeCol(WOOD[hash2(Math.floor(up), Math.floor(vz / 3)) > .8 ? 1 : 2], k);
    let l = 2 + (hash2(px, py) > .88 ? 1 : 0) - (hash2(px * 7, py * 3) > .9 ? 1 : 0) - (vz < 14 ? 1 : 0);
    return shadeCol(PLASTER[clamp(l, 0, 3)], k);
  };
  const roof = (k) => (u, v, lu, lv, px, py) => {
    const rows = 10, t = v / lv, row = Math.floor(t * rows), frac = t * rows - row;
    const off = (row & 1) * 5, tile = Math.floor((u + off) / 10);
    if (t > .94) return shadeCol(WOOD[3], k);
    let l = 2 + (hash2(tile, row) > .6 ? 1 : 0) - (hash2(tile * 3, row) > .85 ? 1 : 0);
    if (frac < .2) l = 0; else if (frac > .8) l = Math.min(4, l + 1);
    if ((u + off) % 10 < 1) l = Math.min(l, 1);
    if (vnoise(u * .15, v * .3 + row) > .74 && frac >= .2) return shadeCol(BUSH[2 + (l > 2 ? 1 : 0)], k);
    return shadeCol(SLATE[clamp(l, 0, 4)], k);
  };
  const edge = (k) => (u, v) => shadeCol(WOOD[v < 1.5 ? 1 : 3], k);
  const cx0 = Wx * .68, cy0 = Wy * .2, cw = 18, ch = Hw + Hr + 10;
  const chimney = (k) => (u, v, lu, lv, px, py) => {
    const row = Math.floor(v / 4), col = Math.floor((u + row * 4) / 8);
    if (v % 4 < 1 || (u + row * 4) % 8 < 1) return shadeCol(STONE[0], k);
    return shadeCol(STONE[2 + Math.floor(hash2(col, row) * 2)], k);
  };
  const res = rasterFaces([
    { O: [-o, -o, Hw], A: [Wx + 2 * o, 0, 0], B: [0, Wy / 2 + o, Hr], color: roof(.78) },
    { O: [cx0 + cw, cy0, Hw], A: [0, cw, 0], B: [0, 0, ch - Hw], color: chimney(.72) },
    { O: [cx0, cy0 + cw, Hw], A: [cw, 0, 0], B: [0, 0, ch - Hw], color: chimney(1) },
    { O: [cx0, cy0, ch], A: [cw, 0, 0], B: [0, cw, 0], color: () => STONE[0] },
    { O: [0, Wy, 0], A: [Wx, 0, 0], B: [0, 0, Hw], color: wall(1, 'door') },
    { O: [Wx, 0, 0], A: [0, Wy, 0], B: [0, 0, Hw], color: wall(.74, 'window') },
    { O: [Wx, 0, Hw], A: [0, Wy, 0], B: [0, Wy / 2, Hr], clip: (u, v) => u + v <= 1 && u >= 0, color: wall(.74) },
    { O: [-o, Wy + o, Hw], A: [Wx + 2 * o, 0, 0], B: [0, -(Wy / 2 + o), Hr], color: roof(1.04) },
    { O: [Wx + o, Wy + o, Hw], A: [0, -(Wy / 2 + o), Hr], B: [0, 0, -4], color: edge(.8) },
    { O: [Wx + o, -o, Hw], A: [0, Wy / 2 + o, Hr], B: [0, 0, -4], color: edge(.7) },
    { O: [-o, Wy + o, Hw], A: [Wx + 2 * o, 0, 0], B: [0, 0, -4], color: edge(1) },
  ]);
  res.chimneyTop = [cx0 + cw / 2, cy0 + cw / 2, ch];
  return res;
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
const shadows = [];   // ellipse shadows baked into ground {x,y,z,rx,ry,dx,dy,k}
let hutObj = null;

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
    addSprite(spr, x, y, z, { fade: true, box: 12 });
    if (!z) colliders.push({ type: 'c', x, y, r: pineZone ? 12 : 16 });
    const cr = spr.canopyR;
    shadows.push({ x, y, z, dx: cr * .75, dy: cr * .22, rx: cr * 1.05, ry: cr * .5, k: 1 });
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
      shadows.push({ x, y, z, dx: 6, dy: 1, rx: spr.img.width * .45, ry: spr.img.width * .2, k: .9 });
    } else if (roll > .985) {
      if (blocked(x, y, 14)) continue;
      const spr = rockLib[Math.floor(r() * rockLib.length)];
      addSprite(spr, x, y, z, { box: 10 });
      if (!z && spr.img.width > 26) colliders.push({ type: 'c', x, y, r: spr.img.width * .45 });
      shadows.push({ x, y, z, dx: 5, dy: 2, rx: spr.img.width * .5, ry: spr.img.width * .2, k: .9 });
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
    if (pathInside(x, y) > -14 || inRect(x, y, plot, 4) || inRect(x, y, hut, 6)) continue;
    if (Math.hypot(x - camp.x, y - camp.y) < 60) continue;
    const lib = dens > .55 ? tuftDarkLib : tuftLib;
    baked.push({ img: lib[Math.floor(r() * lib.length)], x, y, z, ox: 5, oy: 9 });
  }
}

function addSprite(spr, x, y, z, opt = {}) {
  const b = opt.box ?? 8;
  objects.push({ kind: 'sprite', img: spr.img, ox: spr.ox, oy: spr.oy, x, y, z, fade: !!opt.fade, box: { x0: x - b, x1: x + b, y0: y - b, y1: y + b } });
}

function placeStructures() {
  // hut
  const hs = hutSprite();
  hutObj = { kind: 'sprite', img: hs.img, ox: hs.ox, oy: hs.oy, x: hut.x0, y: hut.y0, z: 0, box: { ...hut }, fade: false };
  objects.push(hutObj);
  colliders.push({ type: 'b', ...hut });
  lights.push({ x: hut.x1 + 6, y: (hut.y0 + hut.y1) / 2, z: 26, r: 70, col: [255, 190, 110], a: .55, dusk: true });
  chimney = { x: hut.x0 + hs.chimneyTop[0], y: hut.y0 + hs.chimneyTop[1], z: hs.chimneyTop[2] };
  // stone stairs climbing the north cliff where the path ends
  {
    const n = 7, sd = (stairs.y1 - stairs.y0) / n, sw = stairs.x1 - stairs.x0, sh = PLATEAU_H / n;
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
    const s = rasterFaces(faces);
    objects.push({ kind: 'sprite', img: s.img, ox: s.ox, oy: s.oy, x: stairs.x0, y: stairs.y0, z: 0, box: { ...stairs } });
    colliders.push({ type: 'b', ...stairs });
  }
  // crates & logs
  crates.forEach((c, i) => {
    const s = boxSprite(c.w, c.d, c.h, 900 + i);
    objects.push({ kind: 'sprite', img: s.img, ox: s.ox, oy: s.oy, x: c.x, y: c.y, z: 0, box: { x0: c.x, x1: c.x + c.w, y0: c.y, y1: c.y + c.d } });
    colliders.push({ type: 'b', x0: c.x, x1: c.x + c.w, y0: c.y, y1: c.y + c.d });
    shadows.push({ x: c.x + c.w / 2, y: c.y + c.d / 2, z: 0, dx: 10, dy: 3, rx: 16, ry: 7, k: .9 });
  });
  logs.forEach((l, i) => {
    const s = logSprite(l.w, l.d, l.h, 700 + i);
    objects.push({ kind: 'sprite', img: s.img, ox: s.ox, oy: s.oy, x: l.x, y: l.y, z: 0, box: { x0: l.x, x1: l.x + l.w, y0: l.y, y1: l.y + l.d } });
    colliders.push({ type: 'b', x0: l.x, x1: l.x + l.w, y0: l.y, y1: l.y + l.d });
  });
  // fences around the plot (gate on the south side, facing the path)
  const P = 34;
  const run = (ax, ay, bx, by, skip) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.round(len / P);
    for (let i = 0; i < n; i++) {
      const x0 = ax + (bx - ax) * i / n, y0 = ay + (by - ay) * i / n, x1 = ax + (bx - ax) * (i + 1) / n, y1 = ay + (by - ay) * (i + 1) / n;
      if (skip && skip((x0 + x1) / 2, (y0 + y1) / 2)) { addPost(x0, y0); continue; }
      objects.push({ kind: 'fence', x: x0, y: y0, x1, y1, z: 0, box: { x0: Math.min(x0, x1) - 3, x1: Math.max(x0, x1) + 3, y0: Math.min(y0, y1) - 3, y1: Math.max(y0, y1) + 3 } });
      colliders.push({ type: 'b', x0: Math.min(x0, x1) - 3, x1: Math.max(x0, x1) + 3, y0: Math.min(y0, y1) - 3, y1: Math.max(y0, y1) + 3 });
    }
    addPost(bx, by);
  };
  const gate = (x) => Math.abs(x - (plot.x0 + plot.x1) / 2) < 40;
  run(plot.x0, plot.y0, plot.x1, plot.y0);
  run(plot.x0, plot.y0, plot.x0, plot.y1);
  run(plot.x1, plot.y0, plot.x1, plot.y1);
  run(plot.x0, plot.y1, plot.x1, plot.y1, (x) => gate(x));
  // crops (baked)
  const cabbage = [];
  for (let i = 0; i < 4; i++) cabbage.push(bushSprite(300 + i, 11 + (i % 2) * 2, CROP));
  for (let yy = plot.y0 + 22; yy < plot.y1 - 10; yy += 52) for (let xx = plot.x0 + 24; xx < plot.x1 - 14; xx += 30) {
    const c = cabbage[Math.floor(hash2(xx, yy) * 4)];
    baked.push({ img: c.img, x: xx, y: yy + 6, z: 0, ox: c.ox, oy: c.oy });
  }
  // lanterns
  for (const l of lanterns) {
    objects.push({ kind: 'lantern', x: l.x, y: l.y, z: 0, box: { x0: l.x - 4, x1: l.x + 4, y0: l.y - 4, y1: l.y + 4 } });
    colliders.push({ type: 'c', x: l.x, y: l.y, r: 8 });
    lights.push({ x: l.x, y: l.y, z: 30, r: 95, col: [255, 196, 120], a: .6, flick: true });
    shadows.push({ x: l.x, y: l.y, z: 0, dx: 8, dy: 3, rx: 7, ry: 3, k: .8 });
  }
  // campfire
  objects.push({ kind: 'fire', x: camp.x, y: camp.y, z: 0, box: { x0: camp.x - 16, x1: camp.x + 16, y0: camp.y - 16, y1: camp.y + 16 } });
  colliders.push({ type: 'c', x: camp.x, y: camp.y, r: 26 });
  lights.push({ x: camp.x, y: camp.y, z: 10, r: 210, col: [255, 150, 60], a: .85, flick: true, fire: true });
  const stone = rockLib[0];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    baked.push({ img: stone.img, x: camp.x + Math.cos(a) * 26, y: camp.y + Math.sin(a) * 26, z: 0, ox: stone.ox, oy: stone.oy, scale: .5 });
  }
  // plateaus
  for (const p of plateaus) colliders.push({ type: 'b', ...p });
}
let chimney = null;
function addPost(x, y) {
  objects.push({ kind: 'fence', x, y, x1: x, y1: y, z: 0, box: { x0: x - 3, x1: x + 3, y0: y - 3, y1: y + 3 } });
}

// ---------- ground bake ----------
const GROUND = { x0: -1540, x1: 1540, y0: -280, y1: 1640 };
let groundCanvas = null;

function cobble(x, y, px, py) {
  const rowH = 22, row = Math.floor(y / rowH), off = (row & 1) * 13 + hash2(row, 7) * 6, cw = 26;
  const col = Math.floor((x + off) / cw);
  const ccx = (col + .5) * cw - off, ccy = (row + .5) * rowH;
  if (pathInside(ccx, ccy) < hash2(col * 3, row) * 26 - 6) return null;
  const u = x + off - col * cw, v = y - row * rowH;
  if (u < 3 || v < 3 || (u < 7 && v < 7 && u + v < 8) || (u > cw - 5 && v > rowH - 5 && (cw - u) + (rowH - v) < 6)) return MORTAR;
  let l = 1 + Math.floor(hash2(col, row) * 3);
  if (u < 8 || v < 7) l++;
  if (u > cw - 6 || v > rowH - 5) l--;
  if (hash2(px, py) > .9) l--;
  if (vnoise(x * .02, y * .02) > .72 && hash2(px * 5, py) > .6) return GRASS[2];
  return COBBLE[clamp(l, 0, 4)];
}

function groundColor(x, y, px, py, F) {
  const pi = pathInside(x, y);
  if (pi > -8) { const c = cobble(x, y, px, py); if (c) return c; }
  if (inRect(x, y, plot)) {
    const v = (y - plot.y0) % 26;
    let l = v < 14 ? (v < 4 ? 3 : v > 11 ? 1 : 2) : (v < 18 ? 0 : 1);
    if (hash2(px, py) > .88) l = clamp(l + (hash2(py, px) > .5 ? 1 : -1), 0, 4);
    return DIRT[l];
  }
  const dens = F[0];
  const dn = F[2] - .64;
  const worn = pathDist(x, y) < 20 + F[3] * 30 ? .03 : -1;
  const campD = Math.hypot(x - camp.x, y - camp.y), campWorn = campD < 85 + vnoise(x * .03, y * .03) * 30 ? .03 : -1;
  const yard = inRect(x, y, { x0: hut.x0 - 10, x1: hut.x1 + 70, y0: hut.y1, y1: hut.y1 + 70 }) && vnoise(x * .03, y * .03) > .35 ? .03 : -1;
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
        // bright rim on the plateau lip
        let rim = 1e9;
        for (const p of plateaus) if (inRect(tx, ty, p)) rim = Math.min(rim, p.x1 - tx, p.y1 - ty);
        if (rim < 7) col = GRASS[5]; else if (rim < 14) shade = 1.08;
      } else if (faceWhich) {
        col = cliffColor(faceWhich, faceE, faceH, px, py);
      } else {
        col = groundColor(a, b, px, py, sample(px, py));
        // cliff shadow / AO on the ground at the foot of plateaus
        for (const p of plateaus) {
          if (b >= p.y0 && b <= p.y1 + 30 && a > p.x1 && a < p.x1 + 70 + vnoise(b * .02, 1) * 30 && !inPlateau(a, b)) shade = Math.min(shade, .62);
          if (a >= p.x0 && a <= p.x1 && b > p.y1 && b < p.y1 + 16) shade = Math.min(shade, .8);
        }
        if (a > hut.x1 && a < hut.x1 + 80 && b > hut.y0 && b < hut.y1 + 14) shade = Math.min(shade, .62);
        if (inRect(a, b, hut, 8)) shade = Math.min(shade, .7);
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
    if (inPlateau(x, y) || pathInside(x, y) > -20 || inRect(x, y, plot, 10) || forestDensity(x, y) > .7) continue;
    if (fbm(x * .01 + 50, y * .01) < .55) continue;
    g.fillStyle = fcols[Math.floor(fr() * fcols.length)];
    for (let k = 0; k < 4; k++) g.fillRect(Math.round(sx - GROUND.x0 + (fr() - .5) * 10), Math.round(sy - GROUND.y0 + (fr() - .5) * 5), 1, 1);
  }
  // soft cool shadows under trees/bushes, with dapple holes
  const img2 = g.getImageData(0, 0, gw, gh), d2 = img2.data;
  for (const s of shadows) {
    const cx = isoX(s.x, s.y) - GROUND.x0 + s.dx, cy = isoY(s.x, s.y, s.z) - GROUND.y0 + s.dy;
    const x0 = Math.max(0, Math.floor(cx - s.rx)), x1 = Math.min(gw - 1, Math.ceil(cx + s.rx));
    const y0 = Math.max(0, Math.floor(cy - s.ry)), y1 = Math.min(gh - 1, Math.ceil(cy + s.ry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let q = ((x - cx) / s.rx) ** 2 + ((y - cy) / s.ry) ** 2;
      q += (vnoise(x * .18, y * .3) - .5) * .5;
      if (q > 1 - (bayer(x, y) + .5) * .12) continue;
      if (s.rx > 20 && vnoise(x * .22 + 5, y * .35) > .8) continue;
      const o = (y * gw + x) * 4, k = .64;
      d2[o] *= k * .86; d2[o + 1] *= k * .93; d2[o + 2] = Math.min(255, d2[o + 2] * k * 1.1 + 5);
    }
  }
  g.putImageData(img2, 0, 0);
}

// ---------- player ----------
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const sprites = {};
const player = { x: spawn.x, y: spawn.y, vx: 0, vy: 0, dir: 4, r: 13, target: null, kind: 'player', z: 0 };
const cam = { x: isoX(spawn.x, spawn.y), y: isoY(spawn.x, spawn.y) };
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
  if (Math.random() < dt * 14) particles.push({ type: 'spark', x: camp.x + (Math.random() - .5) * 14, y: camp.y + (Math.random() - .5) * 14, z: 12, vz: 30 + Math.random() * 30, life: 1 + Math.random() });
  if (chimney && Math.random() < dt * 3) particles.push({ type: 'smoke', x: chimney.x, y: chimney.y, z: chimney.z, vz: 14, life: 3.5, drift: Math.random() * 6 });
  if (Math.random() < dt * (dusk ? 0 : 1.2)) {
    const sx0 = cam.x + (Math.random() - .5) * W, sy0 = cam.y - H / 2 - 10;
    particles.push({ type: 'leaf', sx: sx0, sy: sy0, vx: 18 + Math.random() * 16, vy: 26 + Math.random() * 14, life: 14, ph: Math.random() * 6 });
  }
  if (dusk && Math.random() < dt * 3) {
    particles.push({ type: 'fly', sx: cam.x + (Math.random() - .5) * W, sy: cam.y + (Math.random() - .5) * H, life: 4 + Math.random() * 3, ph: Math.random() * 6 });
  }
  for (const p of particles) {
    p.life -= dt;
    if (p.type === 'spark') { p.z += p.vz * dt; p.x += (Math.random() - .5) * 20 * dt; }
    else if (p.type === 'smoke') { p.z += p.vz * dt; p.x += p.drift * dt; p.y -= p.drift * dt; }
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
  // player contact shadow
  const [psx, psy] = toScreen(player.x, player.y);
  ctx.fillStyle = 'rgba(16,20,34,.38)';
  for (let r = -4; r <= 4; r++) { const hw = Math.round(15 * Math.sqrt(1 - (r / 5) ** 2)); ctx.fillRect(psx - hw, psy + r - 1, hw * 2, 1); }
  // visible objects, depth sorted
  const vis = [];
  for (const o of objects) {
    const [sx, sy] = toScreen(o.x, o.y, o.z);
    if (sx < -260 || sx > W + 260 || sy < -60 || sy > H + 320) continue;
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
  await new Promise(r => setTimeout(r, 0));
  const tStart = performance.now();
  buildLibraries();
  placeStructures();
  placeScatter();
  await bakeGround();
  buildOverlays();
  await Promise.all(DIRS.map(async d => { sprites[d] = await loadImage(`../isometric-player/${d}.png`); }));
  loadingEl.remove();
  window.__slice = { player, objects, cam, bakeMs: Math.round(performance.now() - tStart), setDusk: v => { dusk = v; } };
  requestAnimationFrame(frame);
})();
