// Procedural pixel-art sprite builders. Each returns { img: canvas, ox, oy } where (ox, oy) is the
// pixel inside img that sits on the object's world anchor (ground point, local origin).
//
// Three families:
//  1. foliage/rocks  -> paintClumps(): many small lit spheres + global volume + dither + outline
//  2. architecture   -> rasterFaces(): parallelogram faces in 3D local space, painted back to front
//  3. round things   -> cylinderSprite(): analytic ray/cylinder hits (fountains, barrels, pillars)
import { K, hash2, vnoise, rng, bayer, clamp, hex, shadeCol, add, isoX, isoY, L3, LW, makeCanvas } from './util.js';
import * as P from './palettes.js';

// ---------- foliage ----------
export function levelsToCanvas(w, h, lv, palOf) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) {
    const l = lv[i]; if (l < 0) continue;
    const col = palOf(i, l); const o = i * 4;
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
export function paintClumps(lv, kind, w, h, clumps, env, seed, n, opts = {}) {
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
    const s = local * .62 + glob + (vnoise(px * .8 + seed * 3, py * .8) - .5) * tex + (opts.bias ?? 0);
    const i = py * w + px;
    lv[i] = clamp(Math.round((s * .5 + .5) * (n - 1) + bayer(px, py) * .9), 0, n - 1);
    kind[i] = 1;
  }
}
// selective outline: bottom/right edge -> darkest, top/left edge -> rim light
export function outline(lv, kind, w, h, k, n) {
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

export function broadTree(seed, size, leaves, bark = P.BARK) {
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
  return { img: levelsToCanvas(w, h, lv, (i, l) => (kind[i] === 2 ? bark[l] : leaves[l])), ox: Math.round(cx), oy: ground, canopyR: cr };
}

export function pineTree(seed, height, ramp = P.PINE, snow = null) {
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
        lv[idx] = clamp(Math.round((s * .5 + .5) * 4 + bayer(x, y) * .9), 0, 4); kind[idx] = snow && (t < .38 + vnoise(x * .4, i * 7 + seed) * .25) && s > -.15 ? 3 : 1;
      }
    }
  }
  outline(lv, kind, w, h, 1, 5); if (snow) outline(lv, kind, w, h, 3, 5);
  return { img: levelsToCanvas(w, h, lv, (i, l) => (kind[i] === 2 ? P.BARK[l] : kind[i] === 3 ? snow[l] : ramp[l])), ox: Math.round(cx), oy: ground, canopyR: w * .42 };
}

export function bushSprite(seed, size, leaves, flowers) {
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

export function rockSprite(seed, size, palette = P.STONE) {
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
    if (l >= 3 && vnoise(x * .35 + seed, y * .35) > .6) return P.BUSH[l];
    return palette[l];
  });
  return { img: c, ox: Math.round(cx), oy: h - 2 };
}

export function tuftSprite(seed, dark, ramp = P.GRASS, tall = 1) {
  const r = rng(seed), w = Math.round(11 * K), h = Math.round(10 * K * tall);
  const c = makeCanvas(w, h), g = c.getContext('2d'); c.ox = Math.round(w / 2); c.oy = h - 1;
  const blades = Math.round((4 + Math.floor(r() * 4)) * K);
  for (let b = 0; b < blades; b++) {
    const bx = 2 + Math.floor(r() * (w - 4)), len = Math.round((3 + Math.floor(r() * 6)) * K * tall), lean = r() < .35 ? -1 : r() < .5 ? 1 : 0;
    for (let k = 0; k < len; k++) {
      const x = bx + Math.round(lean * (k / len) * 2), y = h - 1 - k;
      const l = clamp(1 + Math.floor((k / len) * 4) - (dark ? 1 : 0), 0, ramp.length - 1);
      g.fillStyle = `rgb(${ramp[l]})`; g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}
// reeds / cattails for river banks
export function reedSprite(seed) {
  const r = rng(seed), w = Math.round(13 * K), h = Math.round(22 * K);
  const c = makeCanvas(w, h), g = c.getContext('2d'); c.ox = Math.round(w / 2); c.oy = h - 1;
  for (let b = 0; b < Math.round(6 * K); b++) {
    const bx = 2 + Math.floor(r() * (w - 4)), len = Math.round((9 + Math.floor(r() * 12)) * K), lean = r() < .5 ? -1 : 1;
    for (let k = 0; k < len; k++) {
      const x = bx + Math.round(lean * (k / len) ** 2 * 3), y = h - 1 - k;
      g.fillStyle = `rgb(${P.BUSH[clamp(1 + Math.floor(k / len * 4), 0, 5)]})`; g.fillRect(x, y, 1, 1);
    }
    if (r() < .5) { const x = bx + lean * 3, y = h - len; g.fillStyle = '#5a3620'; g.fillRect(x, y, 2, 4); g.fillStyle = '#7a4a2a'; g.fillRect(x, y, 1, 3); }
  }
  return c;
}

// ---------- architecture ----------
// faces: { O:[x,y,z], A:[..], B:[..], color(u,v,lenA,lenB,px,py)->rgb|null, clip?(uFrac,vFrac) }
// u,v arrive in screen-pixel lengths along A and B, so patterns keep a constant pixel scale.
export function rasterFaces(faces, decor) {
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
      const col = f.color(u * lenA / K, v * lenB / K, lenA / K, lenB / K, px, py);
      if (!col) continue;
      const o = (py * w + px) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (decor) {
    const dc = makeCanvas(Math.ceil(w / K), Math.ceil(h / K)), dg = dc.getContext('2d');
    decor(dg, (x, y, z) => [Math.round((isoX(x, y) - minX) / K), Math.round((isoY(x, y, z) - minY) / K)]);
    g.imageSmoothingEnabled = false; g.drawImage(dc, 0, 0, dc.width * K, dc.height * K);
  }
  return { img: c, ox: -minX, oy: -minY };
}

export function plankColor(k, seed) {
  return (u, v, lu, lv, px, py) => {
    let l = 2 + (hash2(Math.floor(v / 5) + seed, 3) > .5 ? 1 : 0);
    if (v % 5 < 1) l = 1;
    if (u < 1.5 || v < 1.5 || u > lu - 1.5 || v > lv - 1.5) l = 0;
    if (hash2(px * 3 + seed, py) > .93) l = Math.max(0, l - 1);
    return shadeCol(P.WOOD[l], k);
  };
}
export function stoneColor(k, palette = P.WSTONE, rowH = 6, bw = 12) {
  return (u, v, lu, lv, px, py) => {
    const row = Math.floor(v / rowH), off = (row & 1) * bw / 2, col = Math.floor((u + off) / bw);
    if (v % rowH < 1 || (u + off) % bw < 1) return shadeCol(palette[0], k);
    let l = 2 + Math.floor(hash2(col, row) * 2);
    if (v % rowH > rowH - 1.5) l++;
    if (hash2(px * 5, py) > .93) l--;
    return shadeCol(palette[clamp(l, 0, palette.length - 1)], k);
  };
}
// standard box: +y face (lit), +x face (shade), top. Other faces are never visible.
export function boxFaces(x, y, z, w, d, h, colY, colX, colTop) {
  return [
    { O: [x, y + d, z], A: [w, 0, 0], B: [0, 0, h], color: colY },
    { O: [x + w, y, z], A: [0, d, 0], B: [0, 0, h], color: colX },
    { O: [x, y, z + h], A: [w, 0, 0], B: [0, d, 0], color: colTop },
  ];
}
export function boxSprite(w, d, h, seed) {
  return rasterFaces(boxFaces(0, 0, 0, w, d, h, plankColor(1, seed), plankColor(.72, seed + 1), plankColor(1.18, seed + 2)));
}
export function logSprite(w, d, h, seed) {
  const bark = (k) => (u, v, lu, lv, px, py) => {
    const t = v / lv; let l = t > .7 ? 3 : t > .35 ? 2 : 1;
    if (hash2(px + seed, py * 5) > .85) l--;
    return shadeCol(P.BARK[clamp(l, 0, 3)], k);
  };
  const ring = (u, v, lu, lv) => {
    const cxr = lu / 2, cyr = lv / 2, rr = Math.hypot((u - cxr) / cxr, (v - cyr) / cyr);
    return rr > .85 ? P.BARK[1] : rr % .34 < .1 ? P.WOOD[2] : P.WOOD[4];
  };
  return rasterFaces(w > d ? [
    { O: [0, d, 0], A: [w, 0, 0], B: [0, 0, h], color: bark(1) },
    { O: [0, 0, h], A: [w, 0, 0], B: [0, d, 0], color: bark(1.15) },
    { O: [w, 0, 0], A: [0, d, 0], B: [0, 0, h], color: ring },
  ] : [
    { O: [w, 0, 0], A: [0, d, 0], B: [0, 0, h], color: bark(.8) },
    { O: [0, 0, h], A: [w, 0, 0], B: [0, d, 0], color: bark(1.15) },
    { O: [0, d, 0], A: [w, 0, 0], B: [0, 0, h], color: ring },
  ]);
}
export function benchSprite(w, d, h) {
  const legs = [];
  const alongX = w > d;
  const seat = (k) => (u, v) => {
    const plank = alongX ? Math.floor(v / 3.5) : Math.floor(u / 3.5);
    const l = (alongX ? v % 3.5 : u % 3.5) < .9 ? 1 : 3 - (plank & 1);
    return shadeCol(P.WOOD[l], k);
  };
  for (const [lx, ly] of [[2, 2], [w - 5, 2], [2, d - 5], [w - 5, d - 5]]) {
    legs.push({ O: [lx, ly + 3, 0], A: [3, 0, 0], B: [0, 0, h - 2], color: () => P.WOOD[1] });
    legs.push({ O: [lx + 3, ly, 0], A: [0, 3, 0], B: [0, 0, h - 2], color: () => P.WOOD[0] });
  }
  return rasterFaces([
    ...legs,
    { O: [0, d, h - 2], A: [w, 0, 0], B: [0, 0, 2], color: () => P.WOOD[1] },
    { O: [w, 0, h - 2], A: [0, d, 0], B: [0, 0, 2], color: () => P.WOOD[0] },
    { O: [0, 0, h], A: [w, 0, 0], B: [0, d, 0], color: seat(1.1) },
  ]);
}

// Wooden bridge deck spanning along world x (w) with width d. Posts go down into the water.
export function bridgeSprite(w, d, deckZ, waterZ, alongY = false, style = 'wood') {
  if (style === 'basalt' || style === 'marble') return stoneBridgeSprite(w, d, deckZ, waterZ, alongY, style);
  // planks run across the walking direction; posts line both long edges
  const plank = (k) => (u, v, lu, lv, px, py) => {
    const a = alongY ? v : u, b = alongY ? u : v, lb = alongY ? lu : lv;
    const pl = Math.floor(a / 5);
    if (a % 5 < 1) return shadeCol(P.WOOD[0], k);
    let l = 2 + (hash2(pl, 7) > .5 ? 1 : 0);
    if (hash2(px, py) > .9) l--;
    if (b < 2 || b > lb - 2) l = 1;
    return shadeCol(P.WOOD[clamp(l, 0, 4)], k);
  };
  const beam = (k) => (u, v) => shadeCol(P.WOOD[v < 1.2 ? 3 : 1], k);
  const faces = [];
  const postDepth = deckZ - waterZ + 6;
  const post = (px, py) => {
    faces.push({ O: [px, py + 5, deckZ - postDepth], A: [5, 0, 0], B: [0, 0, postDepth], color: () => P.WOOD[1] });
    faces.push({ O: [px + 5, py, deckZ - postDepth], A: [0, 5, 0], B: [0, 0, postDepth], color: () => P.WOOD[0] });
  };
  if (alongY) { for (let py = 10; py < d; py += 34) for (const px of [0, w - 5]) post(px, py); }
  else { for (let px = 10; px < w; px += 34) for (const py of [0, d - 5]) post(px, py); }
  faces.push({ O: [0, d, deckZ - 5], A: [w, 0, 0], B: [0, 0, 5], color: beam(1) });
  faces.push({ O: [w, 0, deckZ - 5], A: [0, d, 0], B: [0, 0, 5], color: beam(.74) });
  faces.push({ O: [0, 0, deckZ], A: [w, 0, 0], B: [0, d, 0], color: plank(1.1) });
  return rasterFaces(faces);
}

// Ruined stone pillar: box with a noise-eaten broken top.
export function pillarSprite(seed, w, h, broken, palette = P.WSTONE) {
  const top = (u, v) => hash2(Math.floor(u / 3) + seed, 5);
  const sc = (k) => (u, v, lu, lv, px, py) => {
    if (broken && v > lv - 14 && v > lv - 14 + top(u) * 14) return null;
    if (vnoise(u * .2 + seed, v * .15) > .72) return shadeCol(P.BUSH[2 + (hash2(px, py) > .5 ? 1 : 0)], k);
    return stoneColor(k, palette, 7, 99)(u, v, lu, lv, px, py);
  };
  const faces = [
    { O: [-4, w + 4, 0], A: [w + 8, 0, 0], B: [0, 0, 6], color: stoneColor(1, palette, 3, 8) },
    { O: [w + 4, -4, 0], A: [0, w + 8, 0], B: [0, 0, 6], color: stoneColor(.74, palette, 3, 8) },
    { O: [-4, -4, 6], A: [w + 8, 0, 0], B: [0, w + 8, 0], color: () => palette[3] },
    { O: [0, w, 6], A: [w, 0, 0], B: [0, 0, h], color: sc(1) },
    { O: [w, 0, 6], A: [0, w, 0], B: [0, 0, h], color: sc(.74) },
  ];
  if (!broken) faces.push({ O: [-3, -3, h + 6], A: [w + 6, 0, 0], B: [0, w + 6, 0], color: () => palette[4] },
    { O: [-3, w + 3, h + 2], A: [w + 6, 0, 0], B: [0, 0, 4], color: () => palette[3] },
    { O: [w + 3, -3, h + 2], A: [0, w + 6, 0], B: [0, 0, 4], color: () => palette[2] });
  return rasterFaces(faces);
}
// low altar block with glowing rune line
export function altarSprite() {
  const faces = boxFaces(0, 0, 0, 56, 36, 14, stoneColor(1, P.WSTONE, 5, 11), stoneColor(.74, P.WSTONE, 5, 11), (u, v, lu, lv) => {
    if (Math.abs(v - lv / 2) < 1.2 && u > 6 && u < lu - 6) return hex('#8fe6ff');
    return stoneColor(1.15, P.WSTONE, 99, 99)(u, v, lu, lv, 0, 0);
  });
  return rasterFaces([...boxFaces(-8, -8, 0, 72, 52, 5, stoneColor(1, P.WSTONE, 3, 9), stoneColor(.74, P.WSTONE, 3, 9), () => P.WSTONE[3]), ...faces.map(f => ({ ...f, O: [f.O[0], f.O[1], f.O[2] + 5] }))]);
}

// ---------- buildings ----------
const ICONS = {
  potion: ['..kk..', '..kk..', '.krrk.', 'krrrrk', 'krwrrk', 'krrrrk', '.kkkk.'],
  sword: ['....kw', '...kwk', '..kwk.', 'kkwk..', '.kk...', 'kk.k..', 'k.....'],
};
const ICON_COL = { k: '#2a1c14', r: '#d8483c', w: '#e8eef2' };

// b: { x0,x1,y0,y1, wallH, roofH, ridge:'x'|'y', roof:ramp, wall:'timber'|'stone'|'wood', floors?,
//      door:{face:'x'|'y',at,wide?}, windows:[{face,at}], chimney?, flowers?, moss?, awning?, sign?, tower?, banner? }
export function buildingSprite(b) {
  const Wx = b.x1 - b.x0, Wy = b.y1 - b.y0, Hw = b.wallH, Hr = b.roofH, o = 12;
  const wallPal = b.wallPalette || P.WSTONE, woodPal = b.woodPalette || P.WOOD;
  if (b.stage === 'foundation') {
    const sc = k => stoneColor(k, wallPal, 5, 12);
    return rasterFaces(boxFaces(0, 0, 0, Wx, Wy, 8, sc(1), sc(.74), sc(1.14)));
  }
  if (b.stage === 'frame') {
    const timber = k => (u, v, lu, lv, px, py) => shadeCol(woodPal[clamp(2 + (hash2(px, py) > .7 ? 1 : 0), 0, woodPal.length - 1)], k);
    const faces = [...boxFaces(0, 0, 0, Wx, Wy, 6, timber(1), timber(.74), timber(1.12))];
    for (const [x, y] of [[0, 0], [Wx - 6, 0], [0, Wy - 6], [Wx - 6, Wy - 6]]) faces.push(...boxFaces(x, y, 6, 6, 6, Hw - 6, timber(1), timber(.74), timber(1.12)));
    faces.push(...boxFaces(0, 0, Hw - 5, Wx, 6, 6, timber(1), timber(.74), timber(1.12)));
    faces.push(...boxFaces(0, Wy - 6, Hw - 5, Wx, 6, 6, timber(1), timber(.74), timber(1.12)));
    faces.push(...boxFaces(0, 0, Hw - 5, 6, Wy, 6, timber(1), timber(.74), timber(1.12)));
    faces.push(...boxFaces(Wx - 6, 0, Hw - 5, 6, Wy, 6, timber(1), timber(.74), timber(1.12)));
    return rasterFaces(faces);
  }
  const floors = b.floors || 1, floorH = (Hw - 8) / floors;
  const style = b.wall;
  const wins = (face) => (b.windows || []).filter(w => w.face === face);
  const wall = (k, face) => (u, v, lu, lv, px, py) => {
    if (v < 8) {
      const row = Math.floor(v / 4), col = Math.floor((u + row * 5) / 10);
      if (v % 4 < 1 || (u + row * 5) % 10 < 1) return shadeCol(P.STONE[0], k);
      return shadeCol(P.STONE[1 + Math.floor(hash2(col, row) * 3)], k);
    }
    const door = b.door && b.door.face === face ? b.door : null;
    if (door) {
      const dw = door.wide ? 13 : 9, dh = door.wide ? 40 : 34, du = u - lu * door.at;
      if (Math.abs(du) < dw && v < dh) {
        if (Math.abs(du) > dw - 2 || v > dh - 2) return shadeCol(style === 'stone' ? wallPal[1] : woodPal[0], k);
        if (door.wide && v > dh - 10 && Math.hypot(du / (dw - 2), (v - (dh - 10)) / 8) > 1) return shadeCol(wallPal[2], k);
        if ((du + dw) % 4.5 < 1) return shadeCol(woodPal[1], k);
        if (Math.abs(du - (door.wide ? 0 : 4)) < 1 && Math.abs(v - 18) < 1) return hex('#d8b25a');
        return shadeCol(P.WOOD[2], k);
      }
    }
    for (const w of wins(face)) {
      for (let f = 0; f < floors; f++) {
        const wc = 8 + f * floorH + floorH * .5, wu = u - lu * w.at;
        if (f === 0 && door && Math.abs(lu * w.at - lu * door.at) < 16) continue;
        if (Math.abs(wu) < 8 && Math.abs(v - wc) < 8) {
          if (Math.abs(wu) > 6.5 || Math.abs(v - wc) > 6.8) return shadeCol(style === 'stone' ? wallPal[1] : woodPal[0], k);
          if (Math.abs(wu) < .8 || Math.abs(v - wc) < .8) return shadeCol(woodPal[1], k);
          return v > wc ? hex('#ffd98a') : hex('#f0a24a');
        }
        if (b.flowers && Math.abs(wu) < 9 && v < wc - 7 && v > wc - 11) {
          if (v > wc - 9 && hash2(px, py) > .45) return hex(['#e8627a', '#f4d35e', '#f2f0e8', '#b56ad8'][Math.floor(hash2(px * 3, py) * 4)]);
          return shadeCol(v > wc - 9 ? P.BUSH[3] : woodPal[1], k);
        }
      }
    }
    if (style === 'stone') {
      if (u < 5 || u > lu - 5) return stoneColor(k * 1.08, wallPal, 8, 10)(u, v, lu, lv, px, py);
      if (floors > 1 && Math.abs(v - (8 + floorH)) < 2) return shadeCol(wallPal[3], k);
      return stoneColor(k, wallPal)(u, v, lu, lv, px, py);
    }
    if (style === 'wood') {
      if (u < 3 || u > lu - 3 || v > lv - 3) return shadeCol(woodPal[1], k);
      let l = 2 + (hash2(Math.floor(v / 5), 9) > .5 ? 1 : 0);
      if (v % 5 < 1) l = 1;
      if (hash2(px * 3, py) > .92) l--;
      return shadeCol(woodPal[clamp(l, 0, woodPal.length - 1)], k);
    }
    const beam = u < 3 || u > lu - 3 || v > lv - 4 || (v > 8 && v < 11) || Math.abs(u - lu / 3) < 1.6 || Math.abs(u - lu * 2 / 3) < 1.6 ||
      (floors > 1 && Math.abs(v - (8 + floorH)) < 1.5);
    if (beam) return shadeCol(woodPal[hash2(Math.floor(u), Math.floor(v / 3)) > .8 ? 1 : 2], k);
    const l = 2 + (hash2(px, py) > .88 ? 1 : 0) - (hash2(px * 7, py * 3) > .9 ? 1 : 0) - (v < 14 ? 1 : 0);
    return shadeCol(P.PLASTER[clamp(l, 0, 3)], k);
  };
  const RP = b.roof;
  const roof = (k) => (u, v, lu, lv) => {
    const rows = Math.round(lv / 6), t = v / lv, row = Math.floor(t * rows), frac = t * rows - row;
    const off = (row & 1) * 5, tile = Math.floor((u + off) / 10);
    if (t > .95) return shadeCol(P.WOOD[3], k);
    let l = 2 + (hash2(tile, row) > .6 ? 1 : 0) - (hash2(tile * 3, row) > .85 ? 1 : 0);
    if (frac < .2) l = 0; else if (frac > .8) l = Math.min(4, l + 1);
    if ((u + off) % 10 < 1) l = Math.min(l, 1);
    if (b.moss && vnoise(u * .15, v * .3 + row) > .74 && frac >= .2) return shadeCol(P.BUSH[2 + (l > 2 ? 1 : 0)], k);
    return shadeCol(RP[clamp(l, 0, 4)], k);
  };
  const edge = (k) => (u, v) => shadeCol(woodPal[v < 1.5 ? 1 : 3], k);
  const faces = [];
  const ch = Hw + Hr + 10, cw = 18;
  const chimney = (x0, y0) => {
    const cc = (k) => stoneColor(k, P.STONE, 4, 8);
    faces.push({ O: [x0 + cw, y0, Hw], A: [0, cw, 0], B: [0, 0, ch - Hw], color: cc(.72) });
    faces.push({ O: [x0, y0 + cw, Hw], A: [cw, 0, 0], B: [0, 0, ch - Hw], color: cc(1) });
    faces.push({ O: [x0, y0, ch], A: [cw, 0, 0], B: [0, cw, 0], color: () => P.STONE[0] });
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
  if (b.porch) {
    const pw = Wx * .78, px = (Wx - pw) / 2, pd = 24, deckZ = 5, awningZ = Hw * .62;
    const wc = k => (u, v, lu, lv, sx, sy) => shadeCol(woodPal[clamp(2 + (hash2(sx, sy) > .72 ? 1 : 0), 0, woodPal.length - 1)], k);
    faces.push(...boxFaces(px, Wy - 2, 0, pw, pd, deckZ, wc(1), wc(.74), wc(1.12)));
    faces.push(...boxFaces(px + pw * .12, Wy + pd - 5, deckZ, 5, 5, awningZ - deckZ, wc(1), wc(.74), wc(1.12)));
    faces.push(...boxFaces(px + pw * .88 - 5, Wy + pd - 5, deckZ, 5, 5, awningZ - deckZ, wc(1), wc(.74), wc(1.12)));
    faces.push({ O: [px - 6, Wy - 2, awningZ], A: [pw + 12, 0, 0], B: [0, pd + 8, -11], color: roof(1.02) });
    faces.push(...boxFaces(Wx * .38, Wy + pd, 0, Wx * .24, 10, 3, wc(1), wc(.74), wc(1.12)));
  }
  let flagAt = null, clock = null;
  if (b.tower) { // square clock tower rising through the ridge (ridge 'x' only)
    const tw = b.tower.w, tx0 = Wx / 2 - tw / 2, ty0 = Wy / 2 - tw / 2, zt = Hw + Hr + b.tower.h, ph = tw * .9;
    const roofZ = y => Hw + Hr * (1 - Math.abs(y - Wy / 2) / (Wy / 2 + o));
    const z0 = roofZ(ty0 + tw);
    const tc = (k) => stoneColor(k, P.WSTONE, 7, 12);
    faces.push({ O: [tx0 + tw, ty0, Hw], A: [0, tw, 0], B: [0, 0, zt - Hw], clip: (u, v) => Hw + v * (zt - Hw) >= roofZ(ty0 + u * tw) - 1, color: tc(.74) });
    faces.push({ O: [tx0, ty0 + tw, z0], A: [tw, 0, 0], B: [0, 0, zt - z0], color: tc(1) });
    faces.push({ O: [tx0 - 3, ty0 + tw + 3, zt - 4], A: [tw + 6, 0, 0], B: [0, 0, 4], color: () => P.WSTONE[3] });
    faces.push({ O: [tx0 + tw + 3, ty0 - 3, zt - 4], A: [0, tw + 6, 0], B: [0, 0, 4], color: () => P.WSTONE[2] });
    faces.push(...pyramidFaces(tx0 - 4, ty0 - 4, zt, tw + 8, ph, b.tower.roof));
    flagAt = [tx0 + tw / 2, ty0 + tw / 2, zt + ph];
    clock = [tx0 + tw / 2, ty0 + tw, zt - b.tower.h * .45];
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
      const s = b.sign, [sx, sy] = s.face === 'y' ? proj(s.at * Wx + 32, Wy + 4, 46) : proj(Wx + 4, s.at * Wy - 32, 46);
      g.fillStyle = '#2a1c14'; g.fillRect(sx - 1, sy - 2, 12, 2); g.fillRect(sx + 1, sy, 1, 3); g.fillRect(sx + 9, sy, 1, 3);
      g.fillStyle = '#4a2e1a'; g.fillRect(sx - 2, sy + 3, 15, 13);
      g.fillStyle = '#ad7a47'; g.fillRect(sx - 1, sy + 4, 13, 11);
      ICONS[s.icon].forEach((row, iy) => [...row].forEach((ch, ix) => { if (ch !== '.') { g.fillStyle = ICON_COL[ch]; g.fillRect(sx + 2 + ix, sy + 6 + iy, 1, 1); } }));
    }
    if (clock) {
      const [cx, cy] = proj(...clock);
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
export function pyramidFaces(x0, y0, z, w, ph, ramp) {
  const apex = [x0 + w / 2, y0 + w / 2, z + ph];
  const tri = (O, A, k) => ({ O, A, B: [apex[0] - O[0], apex[1] - O[1], apex[2] - O[2]], clip: (u, v) => u + v <= 1, color: (u, v) => {
    const row = Math.floor(v / 5); let l = 2 + (hash2(Math.floor(u / 6), row) > .6 ? 1 : 0); if (v % 5 < 1) l = 0; return shadeCol(ramp[l], k);
  } });
  return [tri([x0, y0, z], [0, w, 0], 1.1), tri([x0, y0, z], [w, 0, 0], .8), tri([x0, y0 + w, z], [w, 0, 0], 1), tri([x0 + w, y0, z], [0, w, 0], .72)];
}

// ---------- cylinders ----------
// prims: { r, z0, z1, wall?(lit, arc, hz, px, py), top?(r, x, y, px, py), inner? }
export function cylinderSprite(prims, R) {
  const w = Math.ceil((R * 1.5 + 8) * K), top = Math.max(...prims.map(p => p.z1)) + 8, h = Math.ceil((R * .8 + top + 6) * K);
  const ox = Math.floor(w / 2), oy = Math.ceil(h - (R * .4 + 4) * K);
  const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const sx = (px + .5 - ox) / K, sy = (py + .5 - oy) / K, a = sx + 2 * sy, b = 2 * sy - sx;
    let best = -1e9, col = null;
    for (const p of prims) {
      const tx = a + 2 * p.z1, ty = b + 2 * p.z1, tr = Math.hypot(tx, ty);
      if (p.top && tr <= p.r) { const cc = p.top(tr, tx, ty, px, py); if (cc && p.z1 > best) { best = p.z1; col = cc; continue; } }
      if (!p.wall) continue;
      const A = 8, B = 4 * (a + b), C = a * a + b * b - p.r * p.r, disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const s = Math.sqrt(disc), z = p.inner ? (-B - s) / (2 * A) : (-B + s) / (2 * A);
      if (z < p.z0 || z > p.z1 || z <= best) continue;
      const wx = a + 2 * z, wy = b + 2 * z;
      const lit = (p.inner ? -1 : 1) * (wx / p.r * LW[0] + wy / p.r * LW[1]);
      const cc = p.wall(lit, Math.atan2(wy, wx) * p.r, z - p.z0, px, py);
      if (cc) { best = z; col = cc; }
    }
    if (!col) continue;
    const o = (py * w + px) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return { img: c, ox, oy };
}
export const bandStone = (palette, rowH, bw) => (lit, arc, hz, px, py) => {
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
  return P.WATER[clamp(l, 0, 5)];
}
export function fountainSprite() {
  const R = 84;
  return cylinderSprite([
    { r: R, z0: 0, z1: 16, wall: bandStone(P.WSTONE, 6, 14), top: (r) => (r >= R - 10 ? (r > R - 2 ? P.WSTONE[4] : P.WSTONE[3]) : null) },
    { r: R - 10, z0: 11, z1: 16, inner: true, wall: bandStone(P.WSTONE, 6, 14) },
    { r: R - 10, z0: 11, z1: 11, top: waterTop },
    { r: 11, z0: 11, z1: 46, wall: bandStone(P.WSTONE, 5, 10) },
    { r: 30, z0: 40, z1: 48, wall: bandStone(P.WSTONE, 4, 10), top: (r, x, y, px, py) => (r >= 25 ? P.WSTONE[4] : waterTop(r, x, y, px, py)) },
    { r: 5, z0: 48, z1: 60, wall: bandStone(P.WSTONE, 4, 6), top: () => P.WSTONE[4] },
  ], R);
}
export function barrelSprite() {
  return cylinderSprite([{ r: 11, z0: 0, z1: 21, wall: (lit, arc, hz) => {
    if (Math.abs(hz - 4) < 1.2 || Math.abs(hz - 17) < 1.2) return P.STONE[1 + (lit > 0 ? 1 : 0)];
    const l = 2 + Math.round(lit * 1.3) + (((arc + 20) % 5) < 1 ? -1 : 0);
    return P.WOOD[clamp(l, 0, 4)];
  }, top: (r) => (r > 9 ? P.STONE[2] : r % 3 < 1 ? P.WOOD[2] : P.WOOD[3]) }], 11);
}
export function planterSprite() {
  return rasterFaces(boxFaces(0, 0, 0, 44, 44, 12, stoneColor(1, P.WSTONE, 4, 9), stoneColor(.74, P.WSTONE, 4, 9), (u, v, lu, lv, px, py) => {
    if (u < 3 || v < 3 || u > lu - 3 || v > lv - 3) return P.WSTONE[4];
    const h = hash2(px, py); return h > .8 ? hex(['#e8627a', '#f4d35e', '#f2f0e8'][Math.floor(hash2(py, px) * 3)]) : h > .4 ? P.BUSH[3] : P.DIRT[1];
  }));
}
export function stallSprite(s) {
  const w = 52, d = 26, hC = 15, hP = 36, cloth = s.cloth.map(hex), goods = s.goods.map(hex);
  const post = (x, y) => [
    { O: [x, y + 3, 0], A: [3, 0, 0], B: [0, 0, hP], color: () => P.WOOD[2] },
    { O: [x + 3, y, 0], A: [0, 3, 0], B: [0, 0, hP], color: () => P.WOOD[1] },
  ];
  return rasterFaces([
    ...post(0, 0), ...post(w - 3, 0),
    { O: [0, d, 0], A: [w, 0, 0], B: [0, 0, hC], color: plankColor(1, 41) },
    { O: [w, 0, 0], A: [0, d, 0], B: [0, 0, hC], color: plankColor(.72, 42) },
    { O: [0, 0, hC], A: [w, 0, 0], B: [0, d, 0], color: (u, v, lu, lv, px, py) => {
      if (u < 2 || v < 2 || u > lu - 2 || v > lv - 2) return P.WOOD[3];
      const cell = Math.floor(u / 4) + Math.floor(v / 3) * 7;
      return hash2(px >> 1, py) > .35 ? shadeCol(goods[cell % goods.length], hash2(px, py) > .7 ? 1.25 : 1) : P.WOOD[2];
    } },
    ...post(0, d - 3), ...post(w - 3, d - 3),
    { O: [-4, -4, hP + 6], A: [w + 8, 0, 0], B: [0, d + 12, -10], color: (u, v, lu, lv) => {
      if (v > lv - 3 && (u % 7) > 3.5) return null;
      return shadeCol(cloth[Math.floor(u / 7) & 1], v > lv - 3 ? .85 : 1.05);
    } },
    { O: [w + 4, -4, hP + 6], A: [0, d + 12, -10], B: [0, 0, -5], color: (u) => shadeCol(cloth[Math.floor(u / 7) & 1], .75) },
  ]);
}
export function wallSegSprite(len, th, h, alongX) {
  const sc = (k) => stoneColor(k, P.WSTONE, 6, 13);
  const faces = alongX ? boxFaces(0, 0, 0, len, th, h, sc(1), sc(.74), sc(1.16)) : boxFaces(0, 0, 0, th, len, h, sc(1), sc(.74), sc(1.16));
  const mw = 12, mh = 9;
  for (let s0 = 4; s0 + mw <= len; s0 += 26) {
    const [mx, my] = alongX ? [s0, 0] : [0, s0], [dx, dy] = alongX ? [mw, 7] : [7, mw];
    faces.push(...boxFaces(mx, my, h, dx, dy, mh, sc(1), sc(.74), sc(1.16)));
  }
  return rasterFaces(faces);
}

// Freestanding editor wall: a lower, chunkier stone run with cap stones and
// regularly-spaced buttresses. Length is supplied by the editor in world px.
export function stoneWallSprite(len, alongX, seed = 0) {
  const th = 12, h = 30, capH = 4, capOver = 2;
  const sc = k => stoneColor(k, P.WSTONE, 6, 14);
  const faces = alongX
    ? boxFaces(0, 0, 0, len, th, h, sc(1), sc(.74), sc(1.16))
    : boxFaces(0, 0, 0, th, len, h, sc(1), sc(.74), sc(1.16));
  faces.push(...(alongX
    ? boxFaces(-capOver, -capOver, h, len + capOver * 2, th + capOver * 2, capH, sc(1), sc(.74), sc(1.16))
    : boxFaces(-capOver, -capOver, h, th + capOver * 2, len + capOver * 2, capH, sc(1), sc(.74), sc(1.16))));
  const step = 38, pier = 5;
  for (let at = 0; at <= len; at += step) {
    const pos = Math.min(len - pier, Math.max(0, at + ((seed & 1) ? 2 : 0)));
    faces.push(...(alongX
      ? boxFaces(pos, -3, 0, pier, th + 6, h + 2, sc(1), sc(.74), sc(1.16))
      : boxFaces(-3, pos, 0, th + 6, pier, h + 2, sc(1), sc(.74), sc(1.16))));
  }
  return rasterFaces(faces);
}

// Walk-through stone gate that shares the wall footprint and palette. The two
// piers remain physical while the opening is intentionally collider-free.
export function stoneGateSprite(len, alongX, palette = P.WSTONE) {
  const th = 14, h = 56, pier = 18, lintelZ = 40, cap = 3;
  const sc = k => stoneColor(k, palette, 6, 14);
  const block = (at, span, z, height) => alongX
    ? boxFaces(at, 0, z, span, th, height, sc(1), sc(.74), sc(1.16))
    : boxFaces(0, at, z, th, span, height, sc(1), sc(.74), sc(1.16));
  const faces = [
    ...block(0, pier, 0, h), ...block(len - pier, pier, 0, h),
    ...block(-cap, pier + cap * 2, h, 5), ...block(len - pier - cap, pier + cap * 2, h, 5),
    ...block(0, len, lintelZ, 13),
    ...block(len / 2 - 6, 12, lintelZ + 13, 7),
  ];
  return rasterFaces(faces);
}
export function towerSprite(tw, h, roofPal) {
  const sc = (k) => stoneColor(k, P.WSTONE, 7, 12);
  return rasterFaces([
    { O: [tw, 0, 0], A: [0, tw, 0], B: [0, 0, h], color: sc(.74) },
    { O: [0, tw, 0], A: [tw, 0, 0], B: [0, 0, h], color: (u, v, lu, lv, px, py) => (Math.abs(u - lu / 2) < 2.5 && Math.abs(v - h * .65) < 5 ? hex('#1c1712') : sc(1)(u, v, lu, lv, px, py)) },
    ...pyramidFaces(-5, -5, h, tw + 10, tw * .95, roofPal),
  ]);
}

// ---------- biome flora & props ----------
// round column shaded like a cylinder (cacti, stalagmites)
function paintColumn(lv, kind, w, cx, top, bottom, halfAt, n, k = 1, ribs = 0) {
  for (let y = Math.max(0, Math.floor(top)); y <= bottom; y++) {
    const hw = halfAt(y); if (!(hw > 0)) continue;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      if (x < 0 || x >= w) continue;
      const u = (x + .5 - cx) / hw; if (Math.abs(u) > 1) continue;
      let s = -u * .7 + Math.sqrt(1 - u * u) * .5 - .1;
      if (ribs && Math.abs(Math.sin((u * 1.4 + 1) * ribs)) < .18) s -= .35;
      lv[y * w + x] = clamp(Math.round((s * .5 + .5) * (n - 1) + bayer(x, y) * .9), 0, n - 1); kind[y * w + x] = k;
    }
  }
}
export function cactusSprite(seed, height, ramp, flowerCol) {
  const r = rng(seed), w = Math.round(height * .8), h = height + 4, cx = w / 2, ground = h - 2, hw0 = Math.max(4, height * .1);
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h);
  paintColumn(lv, kind, w, cx, ground - height, ground, y => { const t = (y - (ground - height)) / height; return t < .12 ? hw0 * Math.sqrt(t / .12) : hw0; }, ramp.length, 1, 3);
  for (let a = 0; a < 2; a++) { // arms: out, then up
    if (r() < .25) continue;
    const dir = a ? 1 : -1, ay = ground - height * (.35 + r() * .3), reach = height * (.22 + r() * .1), up = height * (.18 + r() * .18), ahw = hw0 * .7;
    const ax = cx + dir * reach;
    for (let x = Math.round(cx); x !== Math.round(ax); x += dir) for (let y = Math.round(ay - ahw); y <= ay + ahw; y++) {
      const u = (y - ay) / ahw;
      if (x >= 0 && x < w && y >= 0) { lv[y * w + x] = clamp(Math.round((-u * .5 + .5) * (ramp.length - 1)), 0, ramp.length - 1); kind[y * w + x] = 1; }
    }
    paintColumn(lv, kind, w, ax, ay - up, ay, y => (y < ay - up + 3 ? ahw * .8 : ahw), ramp.length, 1, 2);
  }
  outline(lv, kind, w, h, 1, ramp.length);
  const c = levelsToCanvas(w, h, lv, (i, l) => ramp[l]), g = c.getContext('2d');
  g.fillStyle = '#f4e8c8';
  for (let i = 0; i < height / 3; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); if (lv[y * w + x] >= 2) g.fillRect(x, y, 1, 1); }
  if (flowerCol) { g.fillStyle = flowerCol; g.fillRect(Math.round(cx - 2), ground - height - 1, 4, 3); g.fillStyle = '#fff4c0'; g.fillRect(Math.round(cx - 1), ground - height, 2, 1); }
  return { img: c, ox: Math.round(cx), oy: ground, canopyR: w * .35 };
}
export function palmSprite(seed, height, frond, bark) {
  const r = rng(seed), w = Math.round(height * 1.2), h = height + 10, ground = h - 3, lean = (r() - .5) * height * .35;
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h);
  const topX = w / 2 + lean, topY = ground - height;
  for (let y = topY; y <= ground; y++) { // curved, ringed trunk
    const t = (ground - y) / height, cx = w / 2 + lean * t * t, hw = 2.5 + (1 - t) * 1.5;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      if (x < 0 || x >= w) continue;
      const u = (x - cx) / hw; let l = u < -.3 ? 3 : u < .3 ? 2 : 1; if ((y % 4) === 0) l--;
      lv[y * w + x] = clamp(l, 0, 3); kind[y * w + x] = 2;
    }
  }
  const clumps = [], nF = 7 + Math.floor(r() * 3);
  for (let f = 0; f < nF; f++) { // fronds = chains of shrinking clumps that droop
    const a = f / nF * Math.PI * 2 + r() * .4, len = height * (.38 + r() * .12);
    for (let k2 = 0; k2 < 16; k2++) { const t = k2 / 15; clumps.push({ x: topX + Math.cos(a) * len * t, y: topY + Math.sin(a) * len * t * .45 + t * t * height * .24, r: height * .055 * (1 - t * .7) + 1 }); }
  }
  paintClumps(lv, kind, w, h, clumps, { x: topX, y: topY, rx: height * .4, ry: height * .25 }, seed, frond.length, { tex: .25, edge: .35 });
  outline(lv, kind, w, h, 1, frond.length);
  return { img: levelsToCanvas(w, h, lv, (i, l) => (kind[i] === 2 ? bark[l] : frond[l])), ox: Math.round(w / 2), oy: ground, canopyR: height * .4 };
}
export function spireSprite(seed, height, ramp, glowRamp) { // stalagmite / obsidian spire
  const r = rng(seed), w = Math.round(height * .55) + 4, h = height + 4, cx = w / 2, ground = h - 2, base = height * (.2 + r() * .06);
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h);
  paintColumn(lv, kind, w, cx + (r() - .5) * 3, ground - height, ground, y => { const t = (y - (ground - height)) / height; return base * Math.pow(t, .8) + (vnoise(y * .3, seed) - .5) * 2; }, ramp.length, 1, 0);
  for (let k2 = 0; k2 < 2; k2++) { const sx2 = cx + (k2 ? 1 : -1) * base * .9, sh = height * (.3 + r() * .2); paintColumn(lv, kind, w, sx2, ground - sh, ground, y => base * .45 * Math.pow((y - (ground - sh)) / sh, .8), ramp.length, 1, 0); }
  outline(lv, kind, w, h, 1, ramp.length);
  const c = levelsToCanvas(w, h, lv, (i, l) => ramp[l]);
  if (glowRamp) {
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lv[y * w + x] >= 0 && vnoise(x * .5 + seed, y * .12) > .78) { g.fillStyle = `rgb(${glowRamp[3 + (hash2(x, y) > .6 ? 1 : 0)]})`; g.fillRect(x, y, 1, 1); }
  }
  return { img: c, ox: Math.round(cx), oy: ground, canopyR: base * 1.4, glow: glowRamp ? glowRamp[3] : null };
}
export function crystalSprite(seed, size, ramp) { // cluster of faceted prisms: left face lit, right face shaded
  const r = rng(seed), w = Math.round(size * 1.3), h = Math.round(size * 1.5), ground = h - 3;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const prisms = [];
  for (let i = 0; i < 3 + Math.floor(r() * 3); i++) prisms.push({ x: w / 2 + (r() - .5) * size * .6, hgt: size * (.45 + r() * .8), hw: size * (.08 + r() * .07), lean: (r() - .5) * .5 });
  prisms.sort((a, b) => b.hgt - a.hgt);
  for (const p of prisms) {
    for (let y = 0; y < p.hgt; y++) {
      const tip = y > p.hgt - p.hw * 2.2 ? (p.hgt - y) / (p.hw * 2.2) : 1, cx = p.x + p.lean * y, hw = p.hw * tip;
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        const u = (x + .5 - cx) / Math.max(hw, .5); if (Math.abs(u) > 1) continue;
        let l = u < -.1 ? 4 : u < .35 ? 3 : 1; if (Math.abs(u) > .85) l = u < 0 ? 5 : 0; if (y > p.hgt * .6 && u < 0) l = 5;
        g.fillStyle = `rgb(${ramp[clamp(l, 0, ramp.length - 1)]})`; g.fillRect(x, Math.round(ground - y), 1, 1);
      }
    }
  }
  return { img: c, ox: Math.round(w / 2), oy: ground, canopyR: size * .4, glow: ramp[4] };
}
export function deadTreeSprite(seed, size, bark, embers) {
  const r = rng(seed), w = Math.round(size * 1.2), h = Math.round(size * 1.3), ground = h - 3, cx = w / 2;
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h);
  paintTrunk(lv, kind, w, cx, Math.round(ground - size * .7), ground, Math.max(4, size * .09), seed);
  const branch = (x, y, a, len, th, depth) => {
    for (let t = 0; t < len; t++) {
      const bx = Math.round(x + Math.cos(a) * t), by = Math.round(y + Math.sin(a) * t);
      for (let q = 0; q < th; q++) if (bx + q >= 0 && bx + q < w && by >= 0 && by < h) { lv[by * w + bx + q] = q === 0 ? 2 : 1; kind[by * w + bx + q] = 2; }
    }
    if (depth > 0) for (let k2 = 0; k2 < 2; k2++) branch(x + Math.cos(a) * len, y + Math.sin(a) * len, a + (k2 ? .5 : -.5) + (r() - .5) * .4, len * .62, Math.max(1, th - 1), depth - 1);
  };
  branch(cx, ground - size * .7, -Math.PI / 2 - .5, size * .3, 3, 2);
  branch(cx, ground - size * .7, -Math.PI / 2 + .45, size * .32, 3, 2);
  branch(cx, ground - size * .55, -Math.PI / 2 - 1.1, size * .2, 2, 1);
  const c = levelsToCanvas(w, h, lv, (i, l) => bark[clamp(l, 0, bark.length - 1)]);
  if (embers) {
    const g = c.getContext('2d');
    for (let i = 0; i < size * .7; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * h * .7); if (lv[y * w + x] >= 0 || r() < .15) { g.fillStyle = `rgb(${embers[3 + Math.floor(r() * 3)]})`; g.fillRect(x, y, 1 + (r() < .3 ? 1 : 0), 1); } }
  }
  return { img: c, ox: Math.round(cx), oy: ground, canopyR: size * .35, glow: embers ? embers[3] : null };
}
export function kelpSprite(seed, height, ramp) {
  const r = rng(seed), w = Math.round(height * .45) + 6, h = height + 4, ground = h - 2;
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h);
  for (let sN = 0; sN < 3 + Math.floor(r() * 3); sN++) {
    const x0 = w / 2 + (r() - .5) * w * .4, hh = height * (.55 + r() * .45), ph = r() * 6;
    for (let y = 0; y < hh; y++) {
      const t = y / hh, cx = x0 + Math.sin(t * 5 + ph) * (2 + t * 5), bladeW = 1.2 + Math.sin(t * 9 + ph) * 1.4 + (t > .2 ? 1 : 0);
      for (let x = Math.floor(cx - bladeW); x <= Math.ceil(cx + bladeW); x++) {
        if (x < 0 || x >= w) continue;
        const u = (x - cx) / Math.max(bladeW, .5), i2 = Math.round(ground - y) * w + x;
        lv[i2] = clamp(Math.round((.5 - u * .35 + t * .3) * (ramp.length - 1) + bayer(x, y) * .8), 0, ramp.length - 1); kind[i2] = 1;
      }
    }
  }
  outline(lv, kind, w, h, 1, ramp.length);
  return { img: levelsToCanvas(w, h, lv, (i, l) => ramp[l]), ox: Math.round(w / 2), oy: ground, canopyR: w * .3 };
}
export function coralSprite(seed, size, ramp, fan = false) {
  const r = rng(seed), w = Math.round(size * 1.3), h = Math.round(size * 1.1), ground = h - 2;
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h), clumps = [];
  if (fan) { // lattice fan: a half-disc with radial + ring ribs
    for (let y = 0; y < h - 2; y++) for (let x = 0; x < w; x++) {
      const u = (x - w / 2) / (w * .48), v = (ground - y) / (h * .9); if (u * u + v * v > 1 || v < 0) continue;
      const lat = Math.abs(Math.sin(Math.atan2(v, u) * 9)) < .35 || Math.abs(Math.sin(Math.hypot(u, v) * 14)) < .3;
      if (!lat) continue;
      lv[y * w + x] = clamp(Math.round((.6 - u * .3 + v * .2) * (ramp.length - 1)), 0, ramp.length - 1); kind[y * w + x] = 1;
    }
  } else {
    const grow = (x, y, a, len, depth) => {
      for (let t = 0; t < len; t += 2) clumps.push({ x: x + Math.cos(a) * t, y: y + Math.sin(a) * t, r: (2.2 + depth * .5) * K });
      if (depth > 0) for (let k2 = 0; k2 < 2; k2++) grow(x + Math.cos(a) * len, y + Math.sin(a) * len, a + (k2 ? .55 : -.55) + (r() - .5) * .3, len * .7, depth - 1);
    };
    grow(w / 2, ground, -Math.PI / 2, size * .3, 3);
    paintClumps(lv, kind, w, h, clumps, { x: w / 2, y: ground - size * .4, rx: size * .5, ry: size * .45 }, seed, ramp.length, { tex: .3, edge: .2 });
  }
  outline(lv, kind, w, h, 1, ramp.length);
  return { img: levelsToCanvas(w, h, lv, (i, l) => ramp[l]), ox: Math.round(w / 2), oy: ground, canopyR: size * .45 };
}
export function pebbleSprite(seed, ramp) {
  const r = rng(seed), w = Math.round(10 * K), h = Math.round(6 * K), c = makeCanvas(w, h), g = c.getContext('2d'); c.ox = Math.round(w / 2); c.oy = h - 1;
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(r() * (w - 3)), y = Math.floor(2 + r() * (h - 4)), s2 = 1 + Math.floor(r() * 2 * K);
    g.fillStyle = `rgb(${ramp[1]})`; g.fillRect(x, y + 1, s2 + 1, s2); g.fillStyle = `rgb(${ramp[3]})`; g.fillRect(x, y, s2, s2);
  }
  return c;
}

// ---------- farm & village life ----------
export function scarecrowSprite(seed = 1) {
  const cloth = seed & 1 ? P.RED : P.SLATE;
  const wood = k => () => shadeCol(P.WOOD[2], k);
  return rasterFaces([
    ...boxFaces(-2, -2, 0, 4, 4, 58, wood(1), wood(.74), wood(1.1)),
    ...boxFaces(-25, -2, 39, 50, 4, 4, wood(1), wood(.74), wood(1.1)),
    { O: [-23, 3, 30], A: [46, 0, 0], B: [0, 0, 20], color: (u, v, lu) => shadeCol(cloth[clamp(2 + (u > lu / 2 ? -1 : 1), 0, 4)], 1), clip: (u, v) => v < .75 || Math.abs(u - .5) > .12 },
    ...boxFaces(-8, -6, 52, 16, 12, 14, () => P.STRAW[3], () => P.STRAW[2], () => P.STRAW[4]),
    { O: [-15, -8, 66], A: [30, 0, 0], B: [0, 16, 0], color: () => P.STRAW[2] },
    { O: [-9, 0, 66], A: [18, 0, 0], B: [0, 0, 6], color: () => P.STRAW[3] },
  ]);
}

export function woodpileSprite(seed = 1) {
  const faces = [], r = rng(seed);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
    const x = i * 13 + row * 6, z = row * 10, d = 18 + Math.round(r() * 5);
    faces.push(...boxFaces(x, 0, z, 11, d, 9, plankColor(1, seed + i + row * 7), plankColor(.72, seed + i), () => P.WOOD[3]));
  }
  return rasterFaces(faces);
}

export function laundrySprite(seed = 1) {
  const cols = seed & 1 ? [P.RED[3], '#efe3c8', P.SLATE[3]] : [P.GREENR[3], '#e8d8b8', P.ORANGE[3]];
  const post = x => [
    ...boxFaces(x, 0, 0, 4, 4, 50, () => P.WOOD[2], () => P.WOOD[1], () => P.WOOD[3]),
  ];
  const faces = [...post(0), ...post(54)];
  for (let i = 0; i < 3; i++) faces.push({ O: [5 + i * 17, 2, 27 + (i & 1) * 2], A: [14, 0, 0], B: [0, 0, 18], color: (u, v, lu, lv, px, py) => shadeCol(Array.isArray(cols[i]) ? cols[i] : hex(cols[i]), .9 + bayer(px, py) * .12) });
  return rasterFaces(faces, (g, proj) => { const [a, b] = proj(2, 2, 48), [c, d] = proj(56, 2, 48); g.strokeStyle = '#d8c9ad'; g.lineWidth = 1; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
}

export function farmAnimalSprite(kind, seed = 1, theme = 'forest') {
  const themes = {
    forest: ['#6b4427', '#e9dfca', '#c84232'], desert: ['#8e6038', '#ead07a', '#d0704a'],
    snow: ['#56707e', '#f4faff', '#8aa2b8'], mine: ['#262028', '#766a74', '#6ae0ff'],
    magma: ['#1c1414', '#6e5e54', '#ff6a1a'], underwater: ['#26503a', '#cab0f0', '#ff8a9a'],
    asgard: ['#908a96', '#f2f6fa', '#f6cc50'], city: ['#6b4427', '#e9dfca', '#c84232'],
  };
  const [dark, body, accent] = themes[theme] || themes.forest, scale = K, W = kind === 'sheep' ? 34 : 25, H = kind === 'sheep' ? 25 : 22;
  const c = makeCanvas(Math.round(W * scale), Math.round(H * scale)), g = c.getContext('2d');
  const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x * scale), Math.round(y * scale), Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))); };
  if (kind === 'sheep') {
    rect(6, 7, 21, 11, dark); rect(5, 5, 20, 11, body); rect(23, 10, 7, 7, dark);
    rect(8, 16, 3, 7, dark); rect(21, 16, 3, 7, dark); rect(27, 12, 2, 2, accent);
    for (let i = 0; i < 7; i++) rect(6 + (i * 7 + seed * 3) % 18, 4 + (i * 5) % 9, 4, 3, body);
  } else {
    rect(5, 9, 13, 8, dark); rect(4, 7, 13, 8, body); rect(15, 5, 7, 7, body); rect(21, 8, 4, 3, accent);
    rect(17, 2, 2, 4, accent); rect(20, 3, 2, 3, accent); rect(8, 16, 2, 5, dark); rect(14, 16, 2, 5, dark);
  }
  return { img: c, ox: Math.round(W * scale / 2), oy: Math.round((H - 1) * scale) };
}

// ---------- shared libraries (built once) ----------
export const LIB = {};
let MAKE = null;
// library by key, built on first use (editor props, or biome flora placed outside its biome)
export function libOf(key) { if (!LIB[key] && MAKE?.[key]) LIB[key] = MAKE[key](); return LIB[key]; }
// Always builds the base (forest) set - towns, camps and planters use it - plus whatever the
// active biome kit asks for.
export function buildLibraries(kit = null) {
  let seed = 100;
  const n = (k, f) => Array.from({ length: k }, (_, i) => f(i));
  const S = v => Math.round(v * K);
  for (const key of Object.keys(LIB)) delete LIB[key];
  LIB.broad = n(8, i => broadTree(seed++, S(70 + (i % 4) * 14), P.LEAF));
  LIB.autumn = n(3, i => broadTree(seed++, S(72 + i * 12), P.LEAF_AUTUMN));
  LIB.blossom = n(2, i => broadTree(seed++, S(66 + i * 12), P.LEAF_BLOSSOM));
  LIB.pine = n(7, i => pineTree(seed++, S(96 + (i % 4) * 18)));
  LIB.bush = n(6, i => bushSprite(seed++, S(24 + (i % 3) * 8), P.BUSH));
  LIB.flowerBush = n(4, i => bushSprite(seed++, S(22 + (i % 2) * 8), P.BUSH, i % 2 ? ['#f3f0e6', '#f7d9e6'] : ['#f2d25c', '#ffffff']));
  LIB.rock = n(5, i => rockSprite(seed++, S(18 + i * 6)));
  LIB.tuft = []; LIB.tuftDark = [];
  for (let i = 0; i < 8; i++) { LIB.tuft.push(tuftSprite(seed++, false)); LIB.tuftDark.push(tuftSprite(seed++, true)); }
  LIB.reed = n(4, i => reedSprite(900 + i));
  LIB.crop = n(4, i => bushSprite(300 + i, S(11 + (i % 2) * 2), P.CROP));
  LIB.lily = n(3, i => bushSprite(500 + i, S(9 + i * 2), P.CROP));
  const want = new Set(kit ? ['palm', kit.trees.a, kit.trees.b, ...kit.trees.accent, kit.bush, kit.flowerBush, kit.rock, kit.tuft, kit.tuftDark, kit.reed, kit.edgeTrees].filter(Boolean) : []);
  const make = MAKE = {
    palm: () => n(5, i => palmSprite(1000 + i, S(90 + (i % 3) * 18), P.PALM, P.PALMBARK)),
    cactus: () => n(5, i => cactusSprite(1100 + i, S(34 + (i % 3) * 14), P.CACTUS)),
    cactusFlower: () => n(3, i => cactusSprite(1150 + i, S(40 + i * 10), P.CACTUS, ['#f06a8a', '#f6d25a', '#ff9ab8'][i])),
    dryBush: () => n(5, i => bushSprite(1200 + i, S(20 + (i % 3) * 7), P.DRYBUSH)),
    dryBushBig: () => n(4, i => ({ ...bushSprite(1220 + i, S(40 + i * 8), P.DRYBUSH), canopyR: S(20 + i * 4) })),
    sandRock: () => n(5, i => rockSprite(1250 + i, S(18 + i * 7), P.SANDSTONE)),
    dryTuft: () => n(8, i => tuftSprite(1300 + i, i & 1, P.STRAW)),
    snowPine: () => n(7, i => pineTree(1400 + i, S(96 + (i % 4) * 18), P.PINE, P.SNOW)),
    frostTree: () => n(3, i => broadTree(1450 + i, S(70 + i * 12), P.FROST)),
    snowBush: () => n(5, i => bushSprite(1500 + i, S(22 + (i % 3) * 8), P.SNOWBUSH)),
    iceRock: () => n(5, i => rockSprite(1550 + i, S(18 + i * 6), P.ICE)),
    frostTuft: () => n(8, i => tuftSprite(1600 + i, i & 1, P.FROSTGRASS)),
    stalagmite: () => n(6, i => spireSprite(1700 + i, S(50 + (i % 3) * 26), P.CAVESTONE)),
    crystal: () => n(5, i => crystalSprite(1750 + i, S(26 + (i % 3) * 10), i % 2 ? P.CRYSTAL_A : P.CRYSTAL_B)),
    crystalBig: () => n(2, i => crystalSprite(1780 + i, S(58 + i * 12), i ? P.CRYSTAL_A : P.CRYSTAL_B)),
    crystalSmall: () => n(4, i => crystalSprite(1790 + i, S(14 + i * 3), i % 2 ? P.CRYSTAL_A : P.CRYSTAL_B)),
    rubble: () => n(5, i => rockSprite(1800 + i, S(12 + i * 4), P.CAVESTONE)),
    caveRock: () => n(5, i => rockSprite(1850 + i, S(20 + i * 7), P.CAVESTONE)),
    pebbles: () => n(6, i => pebbleSprite(1900 + i, P.CAVESTONE)),
    deadTree: () => n(5, i => deadTreeSprite(2000 + i, S(70 + (i % 3) * 16), P.CHAR)),
    obsidianSpire: () => n(5, i => spireSprite(2050 + i, S(44 + (i % 3) * 22), P.OBSIDIAN, P.EMBERGLOW)),
    emberTree: () => n(3, i => deadTreeSprite(2080 + i, S(76 + i * 10), P.CHAR, P.EMBERGLOW)),
    charBush: () => n(5, i => bushSprite(2100 + i, S(18 + (i % 3) * 6), P.ASHBUSH)),
    emberBush: () => n(3, i => bushSprite(2130 + i, S(18 + i * 5), P.ASHBUSH, ['#ff8a30', '#ffcc50'])),
    basalt: () => n(5, i => rockSprite(2150 + i, S(18 + i * 7), P.BASALT)),
    ashTuft: () => n(8, i => tuftSprite(2200 + i, i & 1, P.ASH)),
    kelp: () => n(6, i => kelpSprite(2300 + i, S(70 + (i % 3) * 24), P.KELP)),
    coral: () => n(6, i => coralSprite(2350 + i, S(26 + (i % 3) * 10), [P.CORAL_PINK, P.CORAL_ORANGE, P.CORAL_PURPLE][i % 3])),
    coralFan: () => n(3, i => coralSprite(2380 + i, S(34 + i * 8), [P.CORAL_PURPLE, P.CORAL_PINK, P.CORAL_ORANGE][i], true)),
    seaBush: () => n(5, i => bushSprite(2400 + i, S(20 + (i % 3) * 7), P.SEAWEED)),
    reefRock: () => n(5, i => rockSprite(2450 + i, S(20 + i * 7), P.REEF)),
    seagrass: () => n(8, i => tuftSprite(2500 + i, i & 1, P.SEAGRASS, 1.6)),
    goldTree: () => n(5, i => broadTree(2600 + i, S(70 + (i % 3) * 14), P.GOLDLEAF, P.WHITEBARK)),
    whiteTree: () => n(4, i => broadTree(2650 + i, S(66 + (i % 2) * 16), P.SILVERLEAF, P.WHITEBARK)),
    goldBush: () => n(5, i => bushSprite(2700 + i, S(20 + (i % 3) * 7), P.GOLDLEAF, ['#ffffff', '#fff4bc'])),
    marbleRock: () => n(5, i => rockSprite(2750 + i, S(16 + i * 6), P.MARBLE)),
    paleTuft: () => n(8, i => tuftSprite(2800 + i, i & 1, P.PALEGRASS)),
    // editor props (built on first use, any biome)
    mushroom: () => n(5, i => mushroomSprite(3000 + i, S(22 + (i % 3) * 12), [P.CAP_RED, P.CAP_BROWN, P.CAP_RED, P.CAP_BLUE, P.CAP_BROWN][i])),
    fern: () => n(4, i => fernSprite(3050 + i, S(22 + (i % 2) * 8))),
    flowers: () => n(4, i => flowerPatchSprite(3100 + i, [['#e8627a', '#f4d35e', '#f2f0e8'], ['#b9a4f0', '#f4efe0'], ['#f6d25a', '#ff9a4a'], ['#e89ab8', '#ffffff', '#8ac8ff']][i])),
    stump: () => n(3, i => stumpSprite(3150 + i, 10 + i * 2, 8 + i * 2)),
    signpost: () => n(2, i => signpostSprite(3200 + i)),
    hay: () => n(2, i => haySprite(3250 + i)),
    cart: () => n(2, i => cartSprite(3300 + i, i ? P.PALM : P.STRAW)),
    well: () => [wellSprite()],
    scarecrow: () => n(2, i => scarecrowSprite(3400 + i)),
    woodpile: () => n(2, i => woodpileSprite(3450 + i)),
    laundry: () => n(2, i => laundrySprite(3500 + i)),
  };
  for (const key of want) if (!LIB[key] && make[key]) LIB[key] = make[key]();
}

// ---------- stone bridges (magma: basalt, asgard: marble) ----------
// Deck of flagstones, arched side walls down to the liquid, low parapets on both long edges.
// The parapets are part of the sprite (the deck is drawn flat, before actors), so they stay low.
export function stoneBridgeSprite(w, d, deckZ, waterZ, alongY, style) {
  const marble = style === 'marble';
  const ramp = marble ? P.MARBLE : P.BASALT, trim = marble ? P.GOLDLEAF : P.OBSIDIAN, glow = P.EMBERGLOW;
  const L = alongY ? d : w, span = L / Math.max(1, Math.round(L / 56));
  const flag = k => (u, v, lu, lv, px, py) => {
    const a = alongY ? v : u, b = alongY ? u : v;
    const row = Math.floor(a / 10), off = (row & 1) * 7, col = Math.floor((b + off) / 14);
    if (a % 10 < 1 || (b + off) % 14 < 1) return shadeCol(ramp[0], k);
    if (!marble && hash2(col * 3, row * 5) > .9 && (b + off) % 14 < 3) return glow[2]; // cooled lava seam
    const l = 2 + Math.round(hash2(col, row) * 1.4 + bayer(px, py) * .6);
    return shadeCol(ramp[clamp(l, 0, ramp.length - 1)], k);
  };
  // side wall with arches between piers; the holes show the liquid behind
  const side = k => (u, v, lu, lv, px, py) => {
    const t = (u % span) / span;
    const archTop = (lv - 10) * Math.sqrt(Math.max(0, 1 - Math.pow((t - .5) / .36, 2)));
    if (t > .14 && t < .86 && v < archTop) return null;
    if (v > lv - 4) return shadeCol(trim[marble ? 3 : 2], k);      // cornice band
    const row = Math.floor(v / 6), off = (row & 1) * 6;
    if (v % 6 < 1 || (u + off) % 12 < 1) return shadeCol(ramp[0], k);
    let l = 2 + Math.round(hash2(Math.floor((u + off) / 12), row) * 1.3 + bayer(px, py) * .6);
    if (!marble && v < 8) l--;                                      // scorched footing
    return shadeCol(ramp[clamp(l, 0, ramp.length - 1)], k);
  };
  const parapet = k => (u, v, lu, lv, px, py) => {
    if (marble) {                                                   // balustrade: gold cap, marble balusters
      if (v > lv - 2.2) return shadeCol(trim[4], k);
      if (v < 2) return shadeCol(ramp[2], k);
      return u % 7 < 3.2 ? shadeCol(ramp[3 + (hash2(px, py) > .8 ? 1 : 0)], k) : null;
    }
    if (v > lv - 2) return shadeCol(ramp[4], k);
    if (u % 9 < 1) return shadeCol(ramp[0], k);
    return shadeCol(ramp[clamp(2 + Math.round(hash2(Math.floor(u / 9), 3) + bayer(px, py) * .5), 0, 4)], k);
  };
  const cap = () => marble ? trim[4] : ramp[3];
  const H = Math.max(8, deckZ - waterZ + 4), PH = marble ? 9 : 7, T = 5;
  const faces = [];
  if (alongY) {   // long edges are x = 0 and x = w
    faces.push({ O: [T, 0, deckZ], A: [0, d, 0], B: [0, 0, PH], color: parapet(.74) });
    faces.push({ O: [0, 0, deckZ + PH], A: [T, 0, 0], B: [0, d, 0], color: cap });
    faces.push({ O: [0, 0, deckZ], A: [w, 0, 0], B: [0, d, 0], color: flag(1.12) });
    faces.push({ O: [0, d, deckZ - H], A: [w, 0, 0], B: [0, 0, H], color: side(1) });
    faces.push({ O: [w, 0, deckZ - H], A: [0, d, 0], B: [0, 0, H], color: side(.74) });
    faces.push({ O: [w, 0, deckZ], A: [0, d, 0], B: [0, 0, PH], color: parapet(.74) });
    faces.push({ O: [w - T, 0, deckZ + PH], A: [T, 0, 0], B: [0, d, 0], color: cap });
  } else {        // long edges are y = 0 and y = d
    faces.push({ O: [0, T, deckZ], A: [w, 0, 0], B: [0, 0, PH], color: parapet(1) });
    faces.push({ O: [0, 0, deckZ + PH], A: [w, 0, 0], B: [0, T, 0], color: cap });
    faces.push({ O: [0, 0, deckZ], A: [w, 0, 0], B: [0, d, 0], color: flag(1.12) });
    faces.push({ O: [w, 0, deckZ - H], A: [0, d, 0], B: [0, 0, H], color: side(.74) });
    faces.push({ O: [0, d, deckZ - H], A: [w, 0, 0], B: [0, 0, H], color: side(1) });
    faces.push({ O: [0, d, deckZ], A: [w, 0, 0], B: [0, 0, PH], color: parapet(1) });
    faces.push({ O: [0, d - T, deckZ + PH], A: [w, 0, 0], B: [0, T, 0], color: cap });
  }
  return rasterFaces(faces);
}

// several sprites anchored at local world points, drawn in the given (back-to-front) order
function composeSprites(parts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const at = parts.map(p => {
    const sx = isoX(p.x, p.y) - p.spr.ox, sy = isoY(p.x, p.y, p.z || 0) - p.spr.oy;
    x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx + p.spr.img.width); y1 = Math.max(y1, sy + p.spr.img.height);
    return [sx, sy];
  });
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const c = makeCanvas(Math.ceil(x1 - x0) + 1, Math.ceil(y1 - y0) + 1), g = c.getContext('2d');
  parts.forEach((p, i) => g.drawImage(p.spr.img, Math.round(at[i][0] - x0), Math.round(at[i][1] - y0)));
  return { img: c, ox: -x0, oy: -y0 };
}
const dith = (ramp, l, k) => (u, v, lu, lv, px, py) => shadeCol(ramp[clamp(l + (bayer(px, py) > .75 ? 1 : 0), 0, ramp.length - 1)], k);

// ---------- Asgard temple: marble peristyle on a stepped base, gold-trimmed pediment ----------
// Local origin = back corner of the stylobate top. W along x (ridge), D along y.
export function templeSprite(W = 288, D = 192) {
  const M = P.MARBLE, G = P.GOLDLEAF;
  const step = k => (u, v, lu, lv, px, py) => {
    if (v > lv - 1.2) return shadeCol(M[4], k);
    if (u % 16 < 1) return shadeCol(M[1], k);
    return shadeCol(M[clamp(2 + Math.round(hash2(Math.floor(u / 16), 1) * 1.2 + bayer(px, py) * .6), 0, 4)], k);
  };
  const paving = (u, v, lu, lv, px, py) => {
    const r = Math.floor(v / 16), off = (r & 1) * 12;
    if (v % 16 < 1 || (u + off) % 24 < 1) return M[2];
    return shadeCol(M[3 + (hash2(Math.floor((u + off) / 24), r) > .7 ? 1 : 0)], bayer(px, py) > .85 ? .97 : 1.1);
  };
  const cella = k => (u, v, lu, lv, px, py) => {
    if (v % 10 < 1) return shadeCol(M[1], k * .86);
    return shadeCol(M[clamp(1 + Math.round(hash2(Math.floor(u / 20) + Math.floor(v / 10) * 7, 7) + bayer(px, py) * .6), 0, 4)], k * .86);
  };
  const door = k => (u, v, lu, lv, px, py) => {
    const c = lu / 2, dw = 26, dh = 44;
    if (Math.abs(u - c) < dw / 2 + 3 && v < dh + 3) {
      if (Math.abs(u - c) < dw / 2 && v < dh) return v > dh - 8 ? shadeCol(G[2], k) : P.SLATE[0];
      return shadeCol(G[3], k);
    }
    return cella(k)(u, v, lu, lv, px, py);
  };
  const shaft = k => (u, v, lu, lv, px, py) => {        // fluted column
    const f = u % 4; let l = f < 1 ? 1 : f < 2.5 ? 3 : 4;
    if (hash2(px, py * 3) > .95) l--;
    return shadeCol(M[clamp(l, 0, 4)], k);
  };
  const capital = k => (u, v, lu, lv) => shadeCol(v > lv - 2 ? G[4] : M[4], k);
  const frieze = k => (u, v, lu, lv, px, py) => {
    if (v < 2.2) return shadeCol(G[3], k);              // gold band above the columns
    if (v > lv - 2) return shadeCol(M[4], k);
    const t = u % 24;
    if (t < 6) return shadeCol(t % 2 < 1 ? M[1] : M[2], k);                  // triglyphs
    if (t > 11 && t < 17 && v > 4 && v < lv - 4) return shadeCol(G[2 + (bayer(px, py) > .5 ? 1 : 0)], k); // gold rosettes
    return shadeCol(M[3], k);
  };
  const faces = [];
  faces.push(...boxFaces(-26, -26, -18, W + 52, D + 52, 6, step(1), step(.74), () => M[3]));
  faces.push(...boxFaces(-17, -17, -12, W + 34, D + 34, 6, step(1), step(.74), () => M[3]));
  faces.push(...boxFaces(-8, -8, -6, W + 16, D + 16, 6, step(1), step(.74), paving));
  const CH = 66;
  const cols = [], nx = Math.round(W / 36), ny = Math.round(D / 36);
  for (let i = 0; i <= nx; i++) { cols.push([i * (W - 14) / nx, 0]); cols.push([i * (W - 14) / nx, D - 14]); }
  for (let j = 1; j < ny; j++) { cols.push([0, j * (D - 14) / ny]); cols.push([W - 14, j * (D - 14) / ny]); }
  const column = ([x, y]) => [
    ...boxFaces(x - 2, y - 2, 0, 18, 18, 3, dith(M, 2, 1), dith(M, 2, .74), () => M[3]),
    ...boxFaces(x, y, 3, 14, 14, CH - 8, shaft(1), shaft(.74), () => M[3]),
    ...boxFaces(x - 3, y - 3, CH - 5, 20, 20, 5, capital(1), capital(.74), () => M[4]),
  ];
  const byDepth = (a, b) => a[0] + a[1] - b[0] - b[1];
  cols.filter(([x, y]) => y === 0 || x === 0).sort(byDepth).forEach(c => faces.push(...column(c)));
  faces.push(...boxFaces(34, 30, 0, W - 68, D - 60, CH, door(1), cella(.74), () => M[2]));
  cols.filter(([x, y]) => !(y === 0 || x === 0)).sort(byDepth).forEach(c => faces.push(...column(c)));
  faces.push(...boxFaces(-6, -6, CH, W + 12, D + 12, 14, frieze(1), frieze(.74), () => M[3]));
  const RH = 44, ez = CH + 14;
  faces.push({ O: [-10, D + 10, ez], A: [W + 20, 0, 0], B: [0, -(D / 2 + 10), RH], color: (u, v, lu, lv, px, py) => {
    if (v > lv - 2.5) return shadeCol(G[4], 1.05);      // gold ridge
    if (v < 2.5) return M[4];
    if (v % 7 < 1) return M[1];
    return shadeCol(M[clamp(2 + ((Math.floor(u / 9) + Math.floor(v / 7)) & 1) + (bayer(px, py) > .8 ? 1 : 0), 0, 4)], 1.04);
  } });
  faces.push({ O: [W + 10, D + 10, ez], A: [0, -(D + 20), 0], B: [0, 0, RH], clip: (u, v) => v <= 1 - Math.abs(2 * u - 1), color: (u, v, lu, lv, px, py) => {
    const edge = 1 - Math.abs(2 * u / lu - 1) - v / lv;
    if (edge < .06 || v < 2.5) return shadeCol(G[3], .8);          // gold raking cornice
    if (Math.hypot(u - lu / 2, (v - lv * .36) * 2) < 9) return shadeCol(G[Math.hypot(u - lu / 2, (v - lv * .36) * 2) < 5 ? 5 : 3], .9); // sun disc
    return shadeCol(M[2 + (bayer(px, py) > .7 ? 1 : 0)], .76);
  } });
  return rasterFaces(faces);
}

// ---------- undersea palace (original design): pearl hall, shell-spiral towers, scallop dome ----------
export function palaceSprite(W = 256, D = 208) {
  const Pr = P.PEARL, Gl = P.SEAGLOW, Au = P.GOLDLEAF, Co = P.CORAL_PINK, Rf = P.REEF;
  const wall = k => (u, v, lu, lv, px, py) => {
    // two storeys of arched windows, one per 32-unit bay
    const bay = u % 32, up = v > lv * .5, wy = up ? lv * .62 : lv * .16, wh = up ? lv * .22 : lv * .24, cx = 16, hw = 6, ay = wy + wh;
    const inA = (r) => Math.abs(bay - cx) < r && v > wy - (r - hw) && (v < ay || Math.hypot(bay - cx, (v - ay) * 1.2) < r);
    if (inA(hw)) return v < wy + 2 ? shadeCol(Au[3], k) : Gl[3 + (bayer(px, py) > .6 ? 1 : 0)];
    if (inA(hw + 2)) return shadeCol(Au[2], k);
    if (Math.abs(v - lv * .52) < 1.5) return shadeCol(Co[3], k);   // coral string course
    const sheen = vnoise(u * .08 + v * .05, v * .12) * 1.6;        // mother-of-pearl
    return shadeCol(Pr[clamp(2 + Math.round(sheen + bayer(px, py) * .7), 0, 5)], k);
  };
  const gate = k => (u, v, lu, lv, px, py) => {
    const c = lu / 2, gw = 22, gh = lv * .42, r = Math.hypot(u - c, (v - gh) * 1.1);
    if (Math.abs(u - c) < gw && (v < gh || r < gw)) {
      if (Math.abs(u - c) > gw - 3 || (v > gh && r > gw - 3)) return shadeCol(Au[4], k);
      return Gl[1 + (Math.floor(v / 5) & 1)];
    }
    return wall(k)(u, v, lu, lv, px, py);
  };
  const base = k => (u, v, lu, lv, px, py) => v > lv - 2 ? shadeCol(Co[3], k) : shadeCol(Rf[clamp(1 + Math.round(vnoise(u * .1, v * .3) * 2 + bayer(px, py) * .6), 0, 4)], k);
  const hallH = 64;
  const hall = rasterFaces([
    ...boxFaces(-24, -24, 0, W + 48, D + 48, 10, base(1), base(.74), (u, v, lu, lv, px, py) => shadeCol(Rf[3 + (bayer(px, py) > .7 ? 1 : 0)], 1.1)),
    ...boxFaces(0, 0, 10, W, D, hallH, gate(1), wall(.74), (u, v, lu, lv, px, py) => shadeCol(Pr[3 + (bayer(px, py) > .6 ? 1 : 0)], 1.1)),
    ...boxFaces(-4, -4, 10 + hallH, W + 8, D + 8, 5, (u, v) => shadeCol(Au[v > 3 ? 4 : 2], 1), (u, v) => shadeCol(Au[v > 3 ? 3 : 1], .8), (u, v, lu, lv, px, py) => {
      if (u < 5 || v < 5 || u > lu - 5 || v > lv - 5) return Au[4];              // gold rim
      const r = Math.floor(v / 8), off = (r & 1) * 6;                            // pearl scale tiles
      if (v % 8 < 1 || (u + off) % 12 < 1) return Pr[1];
      return shadeCol(Pr[clamp(3 + Math.round(vnoise(u * .05, v * .05) + bayer(px, py) * .6) - ((v % 8) < 3 ? 1 : 0), 0, 5)], 1.05);
    }),
  ]);
  // spiral-shell tower: pearl drum + coiled cone striped coral/gold
  const tower = (R, H, coneH) => {
    const prims = [{ r: R, z0: 0, z1: H, wall: (lit, arc, hz, px, py) => {
      const slit = Math.abs(((arc % 24) + 24) % 24 - 12) < 3 && ((hz > H * .55 && hz < H * .7) || (hz > H * .25 && hz < H * .38));
      if (slit) return Gl[4];
      if (hz > H - 4) return Au[clamp(3 + Math.round(lit), 0, 5)];
      return Pr[clamp(2 + Math.round(lit * 1.6 + vnoise(arc * .1, hz * .1) + bayer(px, py) * .6), 0, 5)];
    } }];
    const n = 16;
    for (let i = 0; i < n; i++) {
      const z0 = H + i * coneH / n, r = R * (1 - i / n) + 1.5;
      prims.push({ r, z0, z1: z0 + coneH / n + .5, wall: (lit, arc, hz, px, py) => {
        const coil = ((arc / (2 * Math.PI * r) + (z0 + hz) / (coneH * .28)) % 1 + 1) % 1;
        return (coil < .5 ? Co : Au)[clamp(2 + Math.round(lit * 1.5 + bayer(px, py) * .6) - (coil % .5 < .08 ? 2 : 0), 0, 5)];
      } });
    }
    prims.push({ r: 2, z0: H + coneH, z1: H + coneH + 10, wall: lit => Au[clamp(4 + Math.round(lit), 0, 5)], top: () => Pr[5] });
    return cylinderSprite(prims, R);
  };
  // scallop dome: stacked rings shaped as a hemisphere, 16 ribs
  const dome = R => {
    const prims = [{ r: R + 4, z0: 0, z1: 8, wall: lit => Au[clamp(3 + Math.round(lit), 0, 5)] }];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI / 2, a1 = (i + 1) / n * Math.PI / 2, r = R * Math.cos(a0) + .5;
      prims.push({ r, z0: 8 + R * Math.sin(a0), z1: 8 + R * Math.sin(a1) + .6, wall: (lit, arc, hz, px, py) => {
        const rib = ((arc / r) * 8 / Math.PI % 1 + 1) % 1;
        return (rib < .12 ? Au : Co)[clamp(2 + Math.round(lit * 1.7 + (rib > .5 ? .5 : 0) + bayer(px, py) * .6), 0, 5)];
      }, top: i === n - 1 ? () => Au[5] : undefined });
    }
    prims.push({ r: 2.5, z0: 8 + R, z1: 8 + R + 26, wall: lit => Au[clamp(4 + Math.round(lit), 0, 5)], top: () => Gl[5] });
    return cylinderSprite(prims, R + 4);
  };
  const tBack = tower(20, 118, 56), tSide = tower(18, 104, 50), tFront = tower(22, 96, 52), dm = dome(46);
  return composeSprites([
    { spr: tBack, x: 0, y: 0, z: 10 },
    { spr: hall, x: 0, y: 0, z: 0 },
    { spr: tSide, x: W, y: 0, z: 10 },
    { spr: tSide, x: 0, y: D, z: 10 },
    { spr: dm, x: W / 2, y: D / 2, z: 10 + hallH + 5 },
    { spr: tFront, x: W, y: D, z: 10 },
  ]);
}

// ---------- editor props (village & wild) ----------
// Tree stump: bark cylinder with growth rings on top and a flared root collar.
export function stumpSprite(seed, R = 12, h = 10) {
  const cut = rng(seed)() * 3;
  return cylinderSprite([
    { r: R + 3, z0: 0, z1: 2.5, wall: (lit, arc) => P.BARK[clamp(1 + Math.round(lit * 1.3) + (((arc + 40) % 9) < 3 ? 0 : -1), 0, 3)] },
    { r: R, z0: 0, z1: h + cut, wall: (lit, arc, hz, px, py) => {
      let l = 1 + Math.round(lit * 1.4) + (((arc + 40) % 4) < 1 ? -1 : 0);
      if (hash2(px, py * 3) > .9) l--;
      return P.BARK[clamp(l, 0, 3)];
    }, top: (rr, x, y) => (rr > R - 2 ? P.BARK[2] : (rr + vnoise(x * .2, y * .2) * 1.5) % 3.2 < 1 ? P.WOOD[2] : P.WOOD[4]) },
  ], R + 3);
}
// Giant mushroom: pale stem, domed cap with white spots.
export function mushroomSprite(seed, size, cap = P.CAP_RED) {
  const r = rng(seed), w = Math.round(size * 1.3) + 4, h = Math.round(size * 1.35) + 4, cx = w / 2, ground = h - 2;
  const lv = new Int8Array(w * h).fill(-1), kind = new Uint8Array(w * h);
  const stemH = size * .72, capY = ground - stemH, capR = size * .6, capH = size * .42;
  paintColumn(lv, kind, w, cx, capY, ground, y => size * .13 + (y > ground - 4 ? (y - ground + 4) * .6 : 0), P.STEM.length, 2);
  for (let y = Math.floor(capY - capH); y <= capY + 2; y++) for (let x = 0; x < w; x++) {
    const u = (x + .5 - cx) / capR, v = (capY - y) / capH;
    if (v < -.15 || u * u + v * v > 1) continue;
    const nz = Math.sqrt(Math.max(0, 1 - u * u - v * v));
    let s = -u * .55 + v * .35 + nz * .45 - .2 + (vnoise(x * .4 + seed, y * .4) - .5) * .3;
    if (v < .05) s = -.8; // shaded rim underside
    lv[y * w + x] = clamp(Math.round((s * .5 + .5) * (cap.length - 1) + bayer(x, y) * .9), 0, cap.length - 1); kind[y * w + x] = 1;
  }
  outline(lv, kind, w, h, 1, cap.length); outline(lv, kind, w, h, 2, P.STEM.length);
  const c = levelsToCanvas(w, h, lv, (i, l) => (kind[i] === 2 ? P.STEM[l] : cap[l])), g = c.getContext('2d');
  for (let i = 0; i < 5 + size / 8; i++) {
    const a = (r() - .5) * 2.4, d = .3 + r() * .55, x = Math.round(cx + Math.sin(a) * capR * d), y = Math.round(capY - capH * (.35 + r() * .5) * Math.cos(a * .6));
    if (lv[y * w + x] < 1 || kind[y * w + x] !== 1) continue;
    const s2 = r() < .5 ? 2 : 3; g.fillStyle = '#f6efe2'; g.fillRect(x, y, s2, s2 - 1); g.fillStyle = '#d8ccbc'; g.fillRect(x, y + s2 - 2, s2, 1);
  }
  return { img: c, ox: Math.round(cx), oy: ground, canopyR: capR };
}
// Low flower patch: leafy stems with bright heads.
export function flowerPatchSprite(seed, cols) {
  const r = rng(seed), w = Math.round(30 * K), h = Math.round(16 * K);
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const heads = [];
  for (let b = 0; b < 40 * K; b++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()), bx = Math.round(w / 2 + Math.cos(a) * d * (w / 2 - 3)), by = Math.round(h - 3 - (1 + Math.sin(a)) * d * 2.5 * K);
    const len = Math.round((2 + r() * 5) * K);
    for (let k = 0; k < len; k++) { g.fillStyle = `rgb(${P.BUSH[clamp(1 + Math.floor(k / len * 4), 0, 5)]})`; g.fillRect(bx + (k > len / 2 && b & 1 ? 1 : 0), by - k, 1, 1); }
    if (r() < .55) heads.push([bx, by - len, cols[Math.floor(r() * cols.length)]]);
  }
  heads.sort((p, q) => p[1] - q[1]);
  for (const [x, y, col] of heads) { g.fillStyle = col; g.fillRect(x - 1, y - 1, 3, 2); g.fillRect(x, y - 2, 1, 1); g.fillStyle = '#fff4c0'; g.fillRect(x, y - 1, 1, 1); }
  return { img: c, ox: Math.round(w / 2), oy: h - 2 };
}
// Fern: arched fronds (dark rachis + paired leaflets that shrink toward the tip), fanning from the ground.
export function fernSprite(seed, size, ramp = P.BUSH) {
  const r = rng(seed), w = Math.round(size * 2.2), h = Math.round(size * 1.2) + 3, cx = w / 2, ground = h - 2;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const put = (x, y, l) => { if (x < 0 || y < 0 || x >= w || y >= h) return; g.fillStyle = `rgb(${ramp[clamp(l, 0, ramp.length - 1)]})`; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const nF = 7 + Math.floor(r() * 3), fronds = [];
  for (let f = 0; f < nF; f++) fronds.push({ a: Math.PI * (1.1 + f / (nF - 1) * .8) + (r() - .5) * .18, len: size * (.62 + r() * .3), back: f % 2 === 0 });
  fronds.sort((p, q) => (q.back - p.back)); // back fronds first (darker), front ones over them
  for (const fr of fronds) {
    const steps = Math.round(fr.len * 1.4), dark = fr.back ? -1 : 0;
    let px = cx, py = ground - 1;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, ang = fr.a + t * t * .9 * Math.sign(Math.cos(fr.a) || 1) * .6;
      const x = cx + Math.cos(fr.a) * fr.len * t * 1.1, y = ground - 1 + Math.sin(fr.a) * fr.len * t * 1.3 + t * t * fr.len * (.35 + Math.abs(Math.cos(fr.a)) * .5);
      const leaf = Math.sin(Math.min(1, t * 1.3) * Math.PI) * size * .13 + .6, lit = Math.cos(fr.a) < 0 ? 1 : 0;
      if (k % 2 === 0 && t > .12) for (let q = 1; q <= leaf; q++) { // leaflets: one each side, angled forward
        put(x - q * .5, y - q, 3 + lit + dark + (q > leaf - 1 ? 1 : 0));
        put(x + q * .5, y + q * .6, 2 + lit + dark);
      }
      put(x, y, 1 + dark); px = x; py = y;
    }
  }
  return { img: c, ox: Math.round(cx), oy: ground };
}
// Stone well with water, two posts, a little shingle roof and a bucket.
export function wellSprite() {
  const R = 22;
  const base = cylinderSprite([
    { r: R, z0: 0, z1: 20, wall: bandStone(P.WSTONE, 6, 11), top: (rr) => (rr >= R - 5 ? (rr > R - 1.5 ? P.WSTONE[4] : P.WSTONE[3]) : null) },
    { r: R - 5, z0: 8, z1: 20, inner: true, wall: bandStone(P.WSTONE, 6, 11) },
    { r: R - 5, z0: 8, z1: 8, top: (rr, x, y, px, py) => P.WATER[clamp(1 + Math.round(vnoise(x * .2, y * .2) * 2 + bayer(px, py) * .6), 0, 5)] },
  ], R);
  const post = (x, y, hgt) => [
    { O: [x, y + 4, 0], A: [4, 0, 0], B: [0, 0, hgt], color: () => P.WOOD[2] },
    { O: [x + 4, y, 0], A: [0, 4, 0], B: [0, 0, hgt], color: () => P.WOOD[1] },
  ];
  const roofCol = k => (u, v, lu, lv, px, py) => shadeCol(P.RED[clamp(2 + (Math.floor(v / 4) & 1) - (v % 4 < .9 ? 1 : 0) + (hash2(Math.floor(u / 5), Math.floor(v / 4)) > .8 ? 1 : 0), 0, 4)], k);
  // posts stand on the rim at the back-left and front-right of the ring (local frame: ring centre at R,R)
  const back = rasterFaces([...post(R - 2, -1, 52), { O: [R, 0, 50], A: [0, R * 2, 0], B: [0, 0, 3], color: () => P.WOOD[3] }]);
  const front = rasterFaces([...post(R - 2, R * 2 - 3, 52)]);
  const roof = rasterFaces([
    { O: [R - 14, -8, 50], A: [0, R * 2 + 16, 0], B: [14, 0, 14], color: roofCol(.85) },
    { O: [R, -8, 64], A: [0, R * 2 + 16, 0], B: [14, 0, -14], color: roofCol(1.1) },
  ]);
  const bucket = cylinderSprite([{ r: 4, z0: 0, z1: 6, wall: (lit) => P.WOOD[clamp(2 + Math.round(lit * 1.5), 0, 4)], top: (rr) => (rr > 3 ? P.WOOD[1] : P.WATER[3]) }], 4);
  return composeSprites([
    { spr: back, x: -R, y: -R, z: 0 }, { spr: base, x: 0, y: 0, z: 0 }, { spr: bucket, x: R * .55, y: R * .55, z: 20 },
    { spr: front, x: -R, y: -R, z: 0 }, { spr: roof, x: -R, y: -R, z: 0 },
  ]);
}
// Signpost: one post, two arrow boards pointing different ways.
export function signpostSprite(seed) {
  const d1 = rng(seed)() < .5 ? 1 : -1, BL = 32, BH = 11;
  const board = (k) => (u, v, lu, lv, px, py) => {
    if (v < 1.2 || v > lv - 1.2) return shadeCol(P.WOOD[1], k);
    if (Math.abs(v - lv / 2) < .6 && u > lu * .25 && u < lu * .7 && hash2(Math.floor(u / 2), 1) > .35) return shadeCol(P.WOOD[0], k); // carved lettering
    return shadeCol(P.WOOD[clamp((v % 4 < .8 ? 2 : 3) + (hash2(px, py) > .92 ? 1 : 0), 0, 4)], k);
  };
  const arrow = (dir) => (u, v) => { const tip = dir > 0 ? 1 - u : u; return tip > .2 || Math.abs(v - .5) <= tip / .2 * .5; };
  return rasterFaces([
    { O: [2.5, -BL / 2 + 2, 22], A: [0, BL, 0], B: [0, 0, BH], color: board(.78), clip: arrow(-d1) },
    { O: [-2.5, 2.5, 0], A: [5, 0, 0], B: [0, 0, 48], color: () => P.WOOD[2] },
    { O: [2.5, -2.5, 0], A: [0, 5, 0], B: [0, 0, 48], color: () => P.WOOD[1] },
    { O: [-2.5, -2.5, 48], A: [5, 0, 0], B: [0, 5, 0], color: () => P.WOOD[3] },
    { O: [-BL / 2 + 2, 2.6, 34], A: [BL, 0, 0], B: [0, 0, BH], color: board(1.08), clip: arrow(d1) },
  ]);
}
// Hand cart: plank bed heaped with a load, two spoked wheels, shafts. Local origin = bed back corner.
export function cartSprite(seed, load = P.STRAW) {
  const L = 44, D = 24, Z = 14, Hs = 8, WR = 13;
  const wheel = (k) => (u, v, lu, lv) => { // u,v in screen px: work in face fractions so the rim stays round
    const x = (u / lu - .5) * 2, y = (v / lv - .5) * 2, rr = Math.hypot(x, y);
    if (rr > 1) return null;
    if (rr > .9) return shadeCol(P.STONE[1], k);             // iron tyre
    if (rr > .72) return shadeCol(P.WOOD[y < 0 ? 3 : 2], k); // felloe, lit on top
    if (rr < .22) return shadeCol(rr < .12 ? P.STONE[3] : P.WOOD[1], k);
    return Math.abs(Math.sin(Math.atan2(y, x) * 3)) < .3 ? shadeCol(P.WOOD[2], k) : null;
  };
  const heap = (u, v, lu, lv, px, py) => load[clamp(1 + Math.round(vnoise(px * .3, py * .3) * 2.4 + bayer(px, py) * .7), 0, load.length - 1)];
  return rasterFaces([
    { O: [L / 2 - WR, -1, Z - WR], A: [WR * 2, 0, 0], B: [0, 0, WR * 2], color: wheel(.7) },
    { O: [0, 0, Z], A: [L, 0, 0], B: [0, D, 0], color: plankColor(1.15, seed) },
    { O: [3, 3, Z + Hs + 3], A: [L - 6, 0, 0], B: [0, D - 6, 0], color: heap },
    { O: [3, D - 3, Z], A: [L - 6, 0, 0], B: [0, 0, Hs + 3], color: heap },
    { O: [L - 3, 3, Z], A: [0, D - 6, 0], B: [0, 0, Hs + 3], color: (u, v, lu, lv, px, py) => shadeCol(heap(u, v, lu, lv, px, py), .78) },
    { O: [L, 0, Z], A: [0, D, 0], B: [0, 0, Hs], color: plankColor(.72, seed + 1) },
    { O: [0, D, Z], A: [L, 0, 0], B: [0, 0, Hs], color: plankColor(1, seed + 2) },
    { O: [L, 1, Z + 2], A: [22, 0, -8], B: [0, 3, 0], color: () => P.WOOD[3] }, // shafts
    { O: [L, D - 4, Z + 2], A: [22, 0, -8], B: [0, 3, 0], color: () => P.WOOD[3] },
    { O: [L / 2 - WR, D + 1, Z - WR], A: [WR * 2, 0, 0], B: [0, 0, WR * 2], color: wheel(1) },
  ]);
}
// Hay: stacked straw bales tied with twine.
export function haySprite(seed) {
  const off = Math.round(rng(seed)() * 6);
  const straw = (k) => (u, v, lu, lv, px, py) => {
    if (Math.abs(u - lu * .3) < .8 || Math.abs(u - lu * .7) < .8) return shadeCol(P.WOOD[1], k);
    const l = 2 + Math.round((vnoise(u * .9, v * .25 + px * .01) - .5) * 3 + bayer(px, py) * .8);
    return shadeCol(P.STRAW[clamp(l, 0, 5)], k);
  };
  const bale = (x, y, z) => boxFaces(x, y, z, 30, 18, 14, straw(1), straw(.74), straw(1.15));
  return rasterFaces([...bale(0, 0, 0), ...bale(off, 20, 0), ...bale(4, 9, 14)]);
}
