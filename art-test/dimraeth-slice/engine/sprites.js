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
export function bridgeSprite(w, d, deckZ, waterZ, alongY = false) {
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
        if (Math.abs(du) > dw - 2 || v > dh - 2) return shadeCol(style === 'stone' ? P.WSTONE[1] : P.WOOD[0], k);
        if (door.wide && v > dh - 10 && Math.hypot(du / (dw - 2), (v - (dh - 10)) / 8) > 1) return shadeCol(P.WSTONE[2], k);
        if ((du + dw) % 4.5 < 1) return shadeCol(P.WOOD[1], k);
        if (Math.abs(du - (door.wide ? 0 : 4)) < 1 && Math.abs(v - 18) < 1) return hex('#d8b25a');
        return shadeCol(P.WOOD[2], k);
      }
    }
    for (const w of wins(face)) {
      for (let f = 0; f < floors; f++) {
        const wc = 8 + f * floorH + floorH * .5, wu = u - lu * w.at;
        if (f === 0 && door && Math.abs(lu * w.at - lu * door.at) < 16) continue;
        if (Math.abs(wu) < 8 && Math.abs(v - wc) < 8) {
          if (Math.abs(wu) > 6.5 || Math.abs(v - wc) > 6.8) return shadeCol(style === 'stone' ? P.WSTONE[1] : P.WOOD[0], k);
          if (Math.abs(wu) < .8 || Math.abs(v - wc) < .8) return shadeCol(P.WOOD[1], k);
          return v > wc ? hex('#ffd98a') : hex('#f0a24a');
        }
        if (b.flowers && Math.abs(wu) < 9 && v < wc - 7 && v > wc - 11) {
          if (v > wc - 9 && hash2(px, py) > .45) return hex(['#e8627a', '#f4d35e', '#f2f0e8', '#b56ad8'][Math.floor(hash2(px * 3, py) * 4)]);
          return shadeCol(v > wc - 9 ? P.BUSH[3] : P.WOOD[1], k);
        }
      }
    }
    if (style === 'stone') {
      if (u < 5 || u > lu - 5) return stoneColor(k * 1.08, P.WSTONE, 8, 10)(u, v, lu, lv, px, py);
      if (floors > 1 && Math.abs(v - (8 + floorH)) < 2) return shadeCol(P.WSTONE[3], k);
      return stoneColor(k)(u, v, lu, lv, px, py);
    }
    if (style === 'wood') {
      if (u < 3 || u > lu - 3 || v > lv - 3) return shadeCol(P.WOOD[1], k);
      let l = 2 + (hash2(Math.floor(v / 5), 9) > .5 ? 1 : 0);
      if (v % 5 < 1) l = 1;
      if (hash2(px * 3, py) > .92) l--;
      return shadeCol(P.WOOD[clamp(l, 0, 4)], k);
    }
    const beam = u < 3 || u > lu - 3 || v > lv - 4 || (v > 8 && v < 11) || Math.abs(u - lu / 3) < 1.6 || Math.abs(u - lu * 2 / 3) < 1.6 ||
      (floors > 1 && Math.abs(v - (8 + floorH)) < 1.5);
    if (beam) return shadeCol(P.WOOD[hash2(Math.floor(u), Math.floor(v / 3)) > .8 ? 1 : 2], k);
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
  const edge = (k) => (u, v) => shadeCol(P.WOOD[v < 1.5 ? 1 : 3], k);
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

// ---------- shared libraries (built once) ----------
export const LIB = {};
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
  if (!kit) return;
  const want = new Set(['palm', kit.trees.a, kit.trees.b, ...kit.trees.accent, kit.bush, kit.flowerBush, kit.rock, kit.tuft, kit.tuftDark, kit.reed, kit.edgeTrees].filter(Boolean));
  const make = {
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
  };
  for (const key of want) if (!LIB[key] && make[key]) LIB[key] = make[key]();
}
