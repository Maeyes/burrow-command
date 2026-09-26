// Terrain = a height grid of 16x16-world-unit cells. Every cell has a flat top at height h (screen px)
// and a material. Height differences between neighbours become vertical faces: cliffs, stair
// risers, river banks and waterfalls all come from the same data.
//
// The ground image is baked by casting one ray per screen pixel down through the grid (DDA), so
// cliffs, stairs and waterfalls occlude correctly with no special cases. The per-pixel hit height is
// kept in `zbuf`, which the runtime uses to hide parts of sprites standing behind higher terrain.
import { K, T, S, hash2, vnoise, fbm, rng, bayer, clamp, smooth, inRect, isoX, isoY, makeCanvas, yieldFrame } from './util.js';
import * as P from './palettes.js';
import { WS } from './state.js';
import { LIB } from './sprites.js';
import { biomeOf, BIOMES } from './biomes.js';
const LAVA = BIOMES.magma; // lava ramps, usable in any biome
let B = biomeOf(null); // active biome kit (ramps)
const BIO = () => B;

export const C = 16;                         // cell size (world units)
const GX0 = -2560, GY0 = -2560, N = 512;     // grid origin & size (covers everything the camera can see)
export const MAT = { GROUND: 0, STAIR: 1, WATER: 2 };
export const STAIR_STYLE = { stone: 0, ramp: 1, wood: 2, slope: 3, marble: 4 };
export const GROUND = { x0: -1540, x1: 1540, y0: -280, y1: 1640 }; // baked ground canvas, absolute screen px (scaled by K in buildTerrain)
const GROUND_DESIGN = { ...GROUND };

// ---------- grid ----------
export function buildTerrain(scene) {
  B = biomeOf(scene);
  for (const k in GROUND_DESIGN) GROUND[k] = Math.round(GROUND_DESIGN[k] * K);
  const t = scene.terrain || {};
  const Hh = new Float32Array(N * N), M = new Uint8Array(N * N), riser = new Uint8Array(N * N); // riser: 1 = +x face, 2 = +y face
  // stair look per cell: 0 stone, 1 earth ramp, 2 wood, 3 natural slope, 4 marble slope
  const ST = new Uint8Array(N * N), SAX = new Uint8Array(N * N);
  // smooth slopes (ramp + its graded shoulders): per cell surface h = max(S0 + GXs*lx + GYs*ly, FL),
  // lx/ly = local coords 0..C inside the cell. FL is the untouched ground under a shoulder.
  const SL = new Uint8Array(N * N), S0 = new Float32Array(N * N), GXs = new Float32Array(N * N), GYs = new Float32Array(N * N), FL = new Float32Array(N * N).fill(-1e9);
  const setPlane = (k, i, j, f, gx, gy, floor) => {
    const x0 = GX0 + i * C, y0 = GY0 + j * C;
    SL[k] = 1; S0[k] = f(x0, y0); GXs[k] = gx; GYs[k] = gy; FL[k] = floor;
    Hh[k] = Math.max(S0[k] + (gx + gy) * C / 2, floor);
  };
  const baseH = t.height || (() => 0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) Hh[j * N + i] = baseH(GX0 + (i + .5) * C, GY0 + (j + .5) * C);
  // stairs: one step per cell row, climbing toward -x or -y
  for (const s of t.stairs || []) {
    // dir = direction of climb. '-x'/'-y' show their risers (faces toward the viewer);
    // '+x'/'+y' climb away from the viewer, so only the step tops and side walls show.
    const alongY = s.dir === '-y' || s.dir === '+y', up = s.dir[0] === '+';
    const n = Math.round((alongY ? s.y1 - s.y0 : s.x1 - s.x0) / C), step = (s.to - s.from) / (n + 1);
    const style = STAIR_STYLE[s.style || B.stairStyle || 'stone'] ?? 0;
    if (style === 3 || style === 4) { // smooth slope: continuous height from `from` at the low end to `to` at the high end
      const len = alongY ? s.y1 - s.y0 : s.x1 - s.x0, gA = (s.to - s.from) / len * (up ? 1 : -1);
      const A0 = alongY ? s.y0 : s.x0, A1 = alongY ? s.y1 : s.x1, L0 = alongY ? s.x0 : s.y0, L1 = alongY ? s.x1 : s.y1;
      const rampH = a => s.from + (s.to - s.from) * clamp(up ? (a - A0) / len : (A1 - a) / len, 0, 1);
      // shoulders: earth graded down from the ramp edge to the ground at slope KS, instead of a sheer wall
      const SW = Math.min((s.to - s.from) / .45, 80), KS = (s.to - s.from) / SW; // at most 5 cells wide; tall ramps get steeper shoulders
      const gAx = alongY ? 0 : gA, gAy = alongY ? gA : 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const cx = GX0 + (i + .5) * C, cy = GY0 + (j + .5) * C, a = alongY ? cy : cx, l = alongY ? cx : cy;
        if (a < A0 || a > A1 || l < L0 - SW || l > L1 + SW) continue;
        const k = j * N + i;
        if (l >= L0 && l <= L1) { // ramp surface
          setPlane(k, i, j, (x, y) => rampH(alongY ? y : x), gAx, gAy, -1e9);
          M[k] = MAT.STAIR; riser[k] = 0; ST[k] = style; SAX[k] = alongY ? 2 : 1;
          continue;
        }
        if (M[k] === MAT.STAIR || SL[k]) continue;
        const side = l < L0 ? 1 : -1, edge = l < L0 ? L0 : L1; // lateral gradient: rises toward the ramp
        const f = (x, y) => rampH(alongY ? y : x) - KS * Math.abs((alongY ? x : y) - edge);
        const lg = KS * side, gx = alongY ? lg : gA, gy = alongY ? gA : lg;
        const x0 = GX0 + i * C, y0 = GY0 + j * C, peak = Math.max(f(x0, y0), f(x0 + C, y0), f(x0, y0 + C), f(x0 + C, y0 + C));
        if (peak <= Hh[k] + .5) continue; // ground already higher than the embankment here
        setPlane(k, i, j, f, gx, gy, Hh[k]);
      }
      continue;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = GX0 + (i + .5) * C, y = GY0 + (j + .5) * C;
      if (!inRect(x, y, s)) continue;
      const k = up ? Math.floor(((alongY ? y - s.y0 : x - s.x0)) / C) : Math.floor((alongY ? s.y1 - y : s.x1 - x) / C); // 0 = lowest row
      Hh[j * N + i] = s.from + step * (k + 1);
      M[j * N + i] = MAT.STAIR; riser[j * N + i] = up ? 0 : alongY ? 2 : 1;
      ST[j * N + i] = STAIR_STYLE[s.style || B.stairStyle || 'stone'] ?? 0; SAX[j * N + i] = alongY ? 2 : 1;
    }
  }
  // rivers: carve a channel `depth` px below the local ground along a polyline
  const falls = [];
  for (const rv of t.rivers || []) {
    const pts = rv.pts, depth = rv.depth ?? 12;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const wMax = Math.max(...[].concat(rv.width)) / 2 + 12;
    const i0 = Math.max(0, Math.floor((minX - wMax - GX0) / C)), i1 = Math.min(N - 1, Math.ceil((maxX + wMax - GX0) / C));
    const j0 = Math.max(0, Math.floor((minY - wMax - GY0) / C)), j1 = Math.min(N - 1, Math.ceil((maxY + wMax - GY0) / C));
    let total = 0; const segLen = [];
    for (let k = 0; k < pts.length - 1; k++) { const l = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); segLen.push(l); total += l; }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = GX0 + (i + .5) * C, y = GY0 + (j + .5) * C;
      let best = 1e9, along = 0, acc = 0;
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        const u = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1), d = Math.hypot(x - ax - u * dx, y - ay - u * dy);
        if (d < best) { best = d; along = (acc + u * segLen[k]) / total; }
        acc += segLen[k];
      }
      const width = Array.isArray(rv.width) ? rv.width[0] + (rv.width[1] - rv.width[0]) * along : rv.width;
      if (best < width / 2 + (vnoise(x * .02, y * .02) - .5) * 14) {
        const idx = j * N + i;
        if (M[idx] === MAT.WATER) continue;
        Hh[idx] = baseH(x, y) - depth; M[idx] = MAT.WATER; if (rv.kind === 'lava') LQ[idx] = 1;
      }
    }
  }
  // liquid kind per cell: 0 = the biome's own liquid (water/ice/cloud...), 1 = lava
  const LQ = new Uint8Array(N * N);
  // free-form water bodies (lakes, lava pools, cloud seas): waterMask(x,y) -> true
  if (t.waterMask) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = GX0 + (i + .5) * C, y = GY0 + (j + .5) * C, idx = j * N + i;
    if (M[idx] === MAT.WATER || M[idx] === MAT.STAIR || !t.waterMask(x, y)) continue;
    Hh[idx] = baseH(x, y) - (t.waterDepth ?? 12); M[idx] = MAT.WATER;
    if (t.liquidKind && t.liquidKind(x, y) === 'lava') LQ[idx] = 1;
  }
  // water helpers: distance-to-bank (cells, capped) and waterfall foam
  const wdist = new Uint8Array(N * N).fill(255), foam = new Uint8Array(N * N);
  const q = [];
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const idx = j * N + i; if (M[idx] !== MAT.WATER) continue;
    if (M[idx - 1] !== MAT.WATER || M[idx + 1] !== MAT.WATER || M[idx - N] !== MAT.WATER || M[idx + N] !== MAT.WATER) { wdist[idx] = 0; q.push(idx); }
  }
  for (let qi = 0; qi < q.length; qi++) {
    const idx = q[qi], dd = wdist[idx]; if (dd >= 5) continue;
    for (const nb of [idx - 1, idx + 1, idx - N, idx + N]) if (M[nb] === MAT.WATER && wdist[nb] > dd + 1) { wdist[nb] = dd + 1; q.push(nb); }
  }
  for (let j = 1; j < N - 3; j++) for (let i = 1; i < N - 3; i++) {
    const idx = j * N + i; if (M[idx] !== MAT.WATER) continue;
    for (const [nb, dirX] of [[idx + N, false], [idx + 1, true]]) { // waterfall on this cell's +y / +x face
      if (M[nb] !== MAT.WATER || Hh[idx] - Hh[nb] < 16) continue;
      falls.push({ x: GX0 + (i + (dirX ? 1 : .5)) * C, y: GY0 + (j + (dirX ? .5 : 1)) * C, zTop: Hh[idx], zBot: Hh[nb], lava: !!LQ[idx] });
      for (let k = 0; k < 4; k++) { const f = dirX ? nb + k : nb + k * N; if (M[f] === MAT.WATER) foam[f] = Math.max(foam[f], 4 - k); }
    }
  }
  for (let j = 1; j < N - 1; j += 6) for (let i = 1; i < N - 1; i += 6) {
    const idx = j * N + i; if (M[idx] !== MAT.WATER || wdist[idx] < 1 || !(B.glowLiquid || LQ[idx])) continue;
    WS.lights.push({ x: GX0 + (i + .5) * C, y: GY0 + (j + .5) * C, z: Hh[idx] + 4, r: 120, col: [255, 110, 40], a: .7, flick: true, glow: true });
  }
  let zMax = 0, zMin = 0;
  for (let k = 0; k < N * N; k++) {
    if (SL[k] && M[k] === MAT.WATER) SL[k] = 0; // a river/lake painted over a shoulder wins
    const top = SL[k] ? Hh[k] + (Math.abs(GXs[k]) + Math.abs(GYs[k])) * C / 2 : Hh[k]; zMax = Math.max(zMax, top); zMin = Math.min(zMin, Hh[k]);
  }
  // exact surface height (smooth slopes are linear inside their cell)
  const surf = (k, x, y) => SL[k] ? Math.max(S0[k] + GXs[k] * (x - GX0 - (k % N) * C) + GYs[k] * (y - GY0 - Math.floor(k / N) * C), FL[k]) : Hh[k];
  const cellIdx = (x, y) => {
    const i = Math.floor((x - GX0) / C), j = Math.floor((y - GY0) / C);
    return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i;
  };
  const T0 = {
    Hh, M, riser, wdist, foam, falls, zMax, zMin, cellIdx, LQ, ST, SAX, SL, S0, GXs, GYs, FL,
    heightAt: (x, y) => { const k = cellIdx(x, y); return k < 0 ? 0 : surf(k, x, y); },
    matAt: (x, y) => { const k = cellIdx(x, y); return k < 0 ? MAT.GROUND : M[k]; },
  };
  // walkable height (null = blocked by water). Bridges override.
  T0.walkHeight = (x, y) => {
    for (const b of WS.bridges) if (inRect(x, y, b)) return b.z;
    const k = cellIdx(x, y); if (k < 0) return 0;
    return M[k] === MAT.WATER ? null : surf(k, x, y);
  };
  // ray pick: visible surface under screen pixel (absolute screen coords)
  T0.pick = (sx, sy) => { const r = castRay(T0, sx, sy); return r; };
  return T0;
}

// One pixel ray: start above the highest terrain and walk down-back through the cells.
// Returns { z, face: 0 top | 1 (+x face) | 2 (+y face), idx, prev, x, y }.
function castRay(T0, sx, sy) {
  const { Hh, SL, S0, GXs, GYs, FL } = T0;
  sx /= K; sy /= K; // screen px -> design px
  const a = sx + 2 * sy, b = 2 * sy - sx;
  let z = T0.zMax + 2, x = a + 2 * z, y = b + 2 * z;
  let ci = Math.floor((x - GX0) / C), cj = Math.floor((y - GY0) / C), side = 0, prev = -1;
  for (let guard = 0; guard < 400; guard++) {
    if (ci < 0 || cj < 0 || ci >= N || cj >= N) return { z: 0, face: 0, idx: -1, prev: -1, x: a, y: b };
    const idx = cj * N + ci, lx = x - (GX0 + ci * C), ly = y - (GY0 + cj * C), dz = Math.min(lx, ly) / 2, zExit = z - dz;
    if (SL[idx]) { // smooth slope / shoulder: intersect the ray with max(tilted plane, floor)
      const gs = GXs[idx] + GYs[idx], p0 = S0[idx] + GXs[idx] * lx + GYs[idx] * ly, hIn = Math.max(p0, FL[idx]);
      if (hIn >= z && side) return { z, face: 0, idx, prev, x, y }; // steep back-facing plane: still read it as ground
      const den = 1 - 2 * gs, sp = den > 1e-4 ? (z - p0) / den : Infinity, s = Math.min(sp, z - FL[idx]); // ray: z-s, plane: p0-2*gs*s
      if (s <= dz) { const h = z - s; return { z: h, face: 0, idx, prev, x: a + 2 * h, y: b + 2 * h }; }
      x -= 2 * dz; y -= 2 * dz; z = zExit; prev = idx;
      if (lx < ly) { ci--; side = 1; } else if (ly < lx) { cj--; side = 2; } else { ci--; cj--; side = 1; }
      continue;
    }
    const h = Hh[idx];
    if (h >= z && side) return { z, face: side, idx, prev, x, y };
    if (h >= zExit) return { z: h, face: 0, idx, prev, x: a + 2 * h, y: b + 2 * h };
    x -= 2 * dz; y -= 2 * dz; z = zExit; prev = idx;
    if (lx < ly) { ci--; side = 1; } else if (ly < lx) { cj--; side = 2; } else { ci--; cj--; side = 1; }
  }
  return { z: 0, face: 0, idx: -1, prev: -1, x: a, y: b };
}

// ---------- surface colours ----------
// Painted roads (map editor): scene.pavedField = { x0, y0, cell, n, d: Float32Array } holding a
// signed distance to the road edge (world units, + inside). Rect roads (scene.paved) still work.
const ROAD = { style: 'road' }, TRAIL = { style: 'dirt' };
function fieldAt(f, x, y) {
  const fx = (x - f.x0) / f.cell - .5, fy = (y - f.y0) / f.cell - .5, i = Math.floor(fx), j = Math.floor(fy);
  if (i < 0 || j < 0 || i >= f.n - 1 || j >= f.n - 1) return -1e9;
  const u = fx - i, v = fy - j, d = f.d, n = f.n, k = j * n + i;
  return (d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + n] * (1 - u) + d[k + n + 1] * u) * v;
}
export function pavedAt(x, y) {
  let best = -1e9, br = null;
  const f = WS.scene.pavedField, t = WS.scene.trailField;
  if (f) { best = fieldAt(f, x, y); br = ROAD; }
  if (t) { const d = fieldAt(t, x, y); if (d > best) { best = d; br = TRAIL; } }
  for (const r of WS.scene.paved || []) {
    const d = Math.min(x - r.x0, r.x1 - x, y - r.y0, r.y1 - y);
    if (d > best) { best = d; br = r; }
  }
  return { d: best, r: br };
}
export function pathDist(x, y) {
  let best = 1e9;
  const f = WS.scene.pavedField, t = WS.scene.trailField;
  if (f) best = Math.max(0, -fieldAt(f, x, y));
  if (t) best = Math.min(best, Math.max(0, -fieldAt(t, x, y)));
  for (const r of WS.scene.paved || []) {
    const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}
export function forestDensity(x, y) {
  const SC = WS.scene;
  let v = SC.baseDensity(x, y) + (fbm(x * .004 + 7, y * .004 + 3) - .5) * SC.densNoise;
  if (!SC.noEdgeForest && (x < T || y < T || x > S - T || y > S - T)) v += .6;
  if (WS.terrain && WS.terrain.heightAt(x, y) > 20) v += SC.highDensity ?? .25;
  return clamp(v, 0, 1);
}

function cobble(x, y, px, py) {
  const SC = WS.scene;
  const rowH = 22, row = Math.floor(y / rowH), off = (row & 1) * 13 + hash2(row, 7) * 6, cw = 26;
  const col = Math.floor((x + off) / cw);
  const ccx = (col + .5) * cw - off, ccy = (row + .5) * rowH;
  if (pavedAt(ccx, ccy).d < hash2(col * 3, row) * 26 * SC.worn - 6) return null;
  const u = x + off - col * cw, v = y - row * rowH;
  if (u < 3 || v < 3 || (u < 7 && v < 7 && u + v < 8) || (u > cw - 5 && v > rowH - 5 && (cw - u) + (rowH - v) < 6)) return P.MORTAR;
  let l = 1 + Math.floor(hash2(col, row) * 3);
  if (u < 8 || v < 7) l++;
  if (u > cw - 6 || v > rowH - 5) l--;
  if (hash2(px, py) > .9) l--;
  if (vnoise(x * .02, y * .02) > .72 + (1 - SC.worn) * .2 && hash2(px * 5, py) > .6) return B.ground[2];
  return P.COBBLE[clamp(l, 0, 4)];
}
// Dirt trail: packed earth with two faint wheel/foot ruts, frayed grassy edges.
function trailColor(x, y, px, py, d) {
  const edge = (vnoise(x * .06, y * .06) - .5) * 12;
  if (d < edge) return null;                     // frayed border -> normal ground
  let l = 2 + Math.round((vnoise(x * .045, y * .045) - .5) * 1.4 + bayer(px, py) * .8);
  if (d < edge + 4) l--;                          // darker trodden rim
  const rut = Math.abs(Math.sin(d * .35));
  if (d > 10 && rut < .12) l--;
  if (hash2(px * 3, py * 5) > .975) l = 4;       // pebbles
  if (vnoise(x * .03, y * .03) > .74 && hash2(px, py) > .5) return B.ground[2]; // grass tufts in the track
  return B.dirt[clamp(l, 0, 4)];
}
function flagstone(x, y, px, py) {
  const f = WS.scene.fountain;
  if (f) {
    const d = Math.hypot(x - f.x, y - f.y);
    if (d < 250) {
      const ring = Math.floor(d / 26), n = ring * 3 + 6, ang = Math.atan2(y - f.y, x - f.x) * n / (Math.PI * 2);
      const seg = Math.floor(ang), rf = d % 26, af = ang - seg;
      if (rf < 2.5 || af * d * Math.PI * 2 / n < 2.5) return P.MORTAR;
      let l = (ring % 3 === 2 ? 1 : 2) + (hash2(ring, seg) > .6 ? 1 : 0);
      if (rf > 20) l--;
      if (hash2(px, py) > .92) l--;
      return (ring % 3 === 2 ? P.COBBLE : P.FLAG)[clamp(l, 0, 4)];
    }
  }
  const sz = 44, row = Math.floor(y / sz), off = (row & 1) * sz / 2, col = Math.floor((x + off) / sz);
  const u = x + off - col * sz, v = y - row * sz;
  if (u < 3 || v < 3) return P.MORTAR;
  let l = 2 + (hash2(col, row) > .55 ? 1 : 0) - (hash2(col * 7, row) > .85 ? 1 : 0);
  if (u < 7 || v < 6) l++;
  if (u > sz - 5 || v > sz - 4) l--;
  if (hash2(px, py) > .93) l--;
  return P.FLAG[clamp(l, 0, 4)];
}
// F = low-frequency fields [density, grassTone, dirtNoise, wornNoise] sampled on a lattice
function groundColor(x, y, px, py, F) {
  const SC = WS.scene;
  const pv = pavedAt(x, y);
  if (pv.d > -8) {
    if (pv.r.style === 'dirt') { const c = trailColor(x, y, px, py, pv.d); if (c) return c; }
    else if (pv.r.style === 'plaza' && pv.d > 0) return flagstone(x, y, px, py);
    const c = cobble(x, y, px, py); if (c) return c;
  }
  for (const plot of SC.plots || []) if (inRect(x, y, plot)) {
    if (plot.ground === 'grass') continue;
    const v = (y - plot.y0) % 26;
    let l = v < 14 ? (v < 4 ? 3 : v > 11 ? 1 : 2) : (v < 18 ? 0 : 1);
    if (hash2(px, py) > .88) l = clamp(l + (hash2(py, px) > .5 ? 1 : -1), 0, 4);
    return B.dirt[l];
  }
  const dens = F[0];
  const dn = F[2] - (SC.townLawn && inRect(x, y, SC.townLawn) ? .72 : .64);
  const worn = pathDist(x, y) < (20 + F[3] * 30) * SC.worn ? .03 : -1;
  let campWorn = -1;
  for (const c of SC.camps || []) if (Math.hypot(x - c.x, y - c.y) < 85 + vnoise(x * .03, y * .03) * 30) campWorn = .03;
  const yard = (SC.yards || []).some(r => inRect(x, y, r)) && vnoise(x * .03, y * .03) > .35 ? .03 : -1;
  const dirt = Math.max(dn, worn, campWorn, yard);
  if (dirt + bayer(px, py) * .035 > 0) {
    const t = .5 + (vnoise(x * .05, y * .05) - .5) * .7 - dens * .2;
    let l = clamp(Math.round(t * 4 + bayer(px, py) * .9), 0, 4);
    if (hash2(px * 3, py * 5) > .975) l = 4;
    return B.dirt[l];
  }
  const t = .6 + F[1] - dens * .34;
  let l = Math.round(t * 5 + bayer(px, py) * 1.05);
  if (dirt > -.03) l--;
  const streak = hash2(px, (py + ((px * 7) & 3)) >> 1);
  if (streak > .94) l++; else if (streak < .04) l--;
  return B.ground[clamp(l, 0, 5)];
}
// vertical rock face: e = coordinate along the edge, hgt = height above the face's foot, tall = face height
function cliffColor(side, e, hgt, tall, px, py) {
  const style = WS.scene.cliffStyle || B.cliffStyle;
  if (style === 'natural') return naturalCliff(side, e, hgt, tall, px, py);
  if (style === 'strata') return strataCliff(side, e, hgt, tall, px, py);
  if (style === 'lavaVein') return lavaCliff(side, e, hgt, tall, px, py);
  if (style === 'marble') return marbleCliff(side, e, hgt, tall, px, py);
  const k = side === 1 ? -1 : 0;
  if (hgt > tall - 2 - vnoise(e * .09, 3) * 7) {
    const l = hgt > tall - 2 ? 4 : 2 + (hash2(px, py) > .6 ? 1 : 0) + k;
    return B.ground[clamp(l, 0, 5)];
  }
  if (hgt < 2.5) return B.cliff[0];
  const ep = e * .559, row = Math.floor(hgt / 8), rowOff = hash2(row, 11) * 12;
  const bw = 14 + Math.floor(hash2(row, 5) * 8), col = Math.floor((ep + rowOff) / bw);
  const lu = (ep + rowOff) - col * bw, lvv = hgt - row * 8;
  if (lvv < 1.2 || lu < 1.2) return B.cliff[0];
  let l = 2 + Math.floor(hash2(col, row) * 2) + k;
  if (lvv > 6.5) l++;
  if (lu < 3) l--;
  if (hash2(px * 3, py) > .92) l--;
  if (vnoise(ep * .12, hgt * .12) > .7 && hgt > tall * .5) return B.moss[clamp(l, 1, 3)];
  return B.cliff[clamp(l, 0, 5)];
}
// Forest escarpment: an earth band with hanging roots under the grass lip, then irregular
// weathered boulders (jittered Voronoi in edge/height space) with dark cracks, top-lit faces,
// moss and a dark soil foot. No rows, so it never reads as masonry.
// Desert mesa: horizontal sandstone strata, wind-eroded (bands wobble and pinch out).
function strataCliff(side, e, hgt, tall, px, py) {
  const k = side === 1 ? -1 : 0, ep = e * .559;
  if (hgt > tall - 2) return B.ground[clamp(4 + k, 0, 5)];
  const wob = hgt + (vnoise(ep * .04, 3) - .5) * 6 + (vnoise(ep * .15, 8) - .5) * 2;
  const band = Math.floor(wob / 5), f = wob / 5 - band;
  let l = 2 + k + (hash2(band, 3) > .5 ? 1 : 0) - (hash2(band, 9) > .82 ? 1 : 0);
  if (f < .18) l--; else if (f > .8) l++;
  if (vnoise(ep * .5, hgt * .06) > .76) l--;            // vertical wind grooves
  if (hash2(px * 3, py) > .93) l--;
  if (hgt < 3) l = 0;
  return B.cliff[clamp(l, 0, 5)];
}
// Magma basalt: dark columns with glowing cracks that brighten toward the foot.
function lavaCliff(side, e, hgt, tall, px, py) {
  const k = side === 1 ? -1 : 0, ep = e * .559;
  if (hgt > tall - 2) return B.ground[clamp(3 + k, 0, 5)];
  // irregular basalt columns (varying width) with a few glowing fissures, hotter near the foot
  const warp = ep + vnoise(hgt * .05, 2) * 6, colW = 14, col = Math.floor(warp / colW), f = warp / colW - col;
  const fissure = vnoise(ep * .09, hgt * .05 + col * 3.1) > .7 && Math.abs(vnoise(ep * .35, hgt * .2) - .5) < .07;
  const heat = 1 - hgt / tall;
  if (fissure || (heat > .82 && vnoise(ep * .2, 5) > .6)) return B.moss[clamp(Math.round(1 + heat * 4 + (hash2(px, py) > .7 ? 1 : 0)), 0, 5)];
  if (f < .06 && hash2(col, 7) > .35) return B.cliff[0];
  let l = 2 + k + (hash2(col, Math.floor(hgt / 18)) > .6 ? 1 : 0);
  if (f < .3) l++; else if (f > .82) l--;
  if (hash2(px * 3, py) > .9) l--;
  return B.cliff[clamp(l, 0, 5)];
}
// Asgard marble: large smooth ashlar blocks with a gold trim course under the lip.
function marbleCliff(side, e, hgt, tall, px, py) {
  const k = side === 1 ? -1 : 0, ep = e * .559;
  if (hgt > tall - 2) return B.ground[clamp(4 + k, 0, 5)];
  if (hgt > tall - 7) return B.moss[clamp((hgt > tall - 4 ? 4 : 2) + k, 0, 5)];
  const row = Math.floor(hgt / 14), off = (row & 1) * 18, colI = Math.floor((ep + off) / 36);
  const lu = (ep + off) % 36, lv = hgt % 14;
  if (lu < 1 || lv < 1) return B.cliff[1 + k + 1];
  let l = 4 + k - (lv < 3 ? 1 : 0) + (lv > 11 ? 1 : 0) - (hash2(colI, row) > .7 ? 1 : 0);
  if (vnoise(ep * .08, hgt * .08) > .72) l--;          // soft veining
  return B.cliff[clamp(l, 0, 5)];
}
function naturalCliff(side, e, hgt, tall, px, py) {
  const k = side === 1 ? -1 : 0;
  const ep = e * .559;
  const lip = tall - 2 - vnoise(ep * .06, 3) * 7;
  if (hgt > lip) return B.ground[clamp(hgt > tall - 2 ? 4 : 2 + (hash2(px, py) > .6 ? 1 : 0) + k, 0, 5)];
  // a few wiggly roots hanging from the turf
  for (let r = -1; r <= 1; r++) {
    const rc = Math.floor(ep / 23) + r, rx = rc * 23 + hash2(rc, 71) * 20, len = 6 + hash2(rc, 72) * 22;
    if (hash2(rc, 70) < .45 || hgt < lip - len) continue;
    const wig = rx + Math.sin((lip - hgt) * .35 + rc) * 1.6 + (lip - hgt) * (hash2(rc, 74) - .5) * .4;
    if (Math.abs(ep - wig) < .9) return P.BARK[clamp(1 + (hgt > lip - 4 ? 1 : 0) + k, 0, 3)];
  }
  // uneven earth band under the turf, dripping into the rock
  const earth = 4 + vnoise(ep * .05, 9) * 9 + (vnoise(ep * .21, 2) > .62 ? 6 : 0);
  const soil = vnoise(ep * .07, hgt * .09 + 5);
  if (hgt > lip - earth || (soil > .7 && hgt > tall * .35)) {
    let l = 2 + k + (vnoise(ep * .3, hgt * .4) > .6 ? 1 : 0) - (hgt < lip - earth + 2 ? 1 : 0);
    if (hash2(px * 5, py) > .95) l = 4;
    return B.dirt[clamp(l, 0, 4)];
  }
  if (hgt < 2) return B.dirt[0];
  // big weathered boulders; only some seams are cracks so rocks merge into a mass
  const sx = 34, sy = 20, gx = ep / sx, gy = hgt / sy + vnoise(ep * .04, 1) * .6, ix = Math.floor(gx), iy = Math.floor(gy);
  let d1 = 9, d2 = 9, c1 = 0, c2 = 0, cyTop = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i + .1 + hash2(ix + i, iy + j) * .8, cy = iy + j + .1 + hash2(ix + i + 91, iy + j) * .8;
    const d = Math.hypot((gx - cx) * 1.25, gy - cy), id = (ix + i) * 131 + (iy + j);
    if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = id; cyTop = cy; } else if (d < d2) { d2 = d; c2 = id; }
  }
  const edge = d2 - d1, crackOn = hash2(Math.min(c1, c2), Math.max(c1, c2)) > .35;
  if (crackOn && edge < .045) return B.cliff[0];
  let l = 2 + k + (hash2(c1, 5) > .55 ? 1 : 0);
  const rel = gy - cyTop;                                   // + = upper part of this boulder
  if (rel > .25) l++; else if (rel < -.3) l--;
  if (crackOn && edge < .12 && rel > 0) l++;                // lit rim just above a crack
  if (vnoise(ep * .6, hgt * .04) > .74) l--;                // vertical weathering streaks
  if (hash2(px * 3, py) > .92) l--;
  if (vnoise(ep * .08, hgt * .1) > .6 && rel > -.1 && hgt > tall * .3) return B.moss[clamp(l, 1, 4)];
  if (hgt < 4 + vnoise(ep * .15, 4) * 7) return B.dirt[clamp(l - 1, 0, 3)];
  return B.cliff[clamp(l, 0, 5)];
}
function bankColor(side, e, hgt, tall, px, py) { // short bank above water
  const style = WS.scene.cliffStyle || B.cliffStyle;
  if (style === 'blocks' || style === 'marble') { // built quay: dressed stone
    if (hgt > tall - 2) return B.ground[side === 1 ? 2 : 3];
    if (hgt < 3) return B.liquid[0];
    const l = 1 + (hash2(Math.floor(e * .3), Math.floor(hgt / 3)) > .6 ? 1 : 0) + (side === 1 ? -1 : 0) + (hash2(px, py) > .85 ? 1 : 0);
    return hgt < 6 ? P.STONE[clamp(l, 0, 3)] : B.dirt[clamp(l, 0, 4)];
  }
  // natural bank: ragged turf lip, soil with a few roots, rocks and wet darkness at the waterline
  const k = side === 1 ? -1 : 0, ep = e * .559;
  const lip = tall - 1.5 - vnoise(ep * .09, 11) * 4.5;
  if (hgt > lip) return B.ground[clamp((hgt > tall - 1.5 ? 4 : 3) + k, 0, 5)];
  if (hgt < 1.5) return B.liquid[0];
  const rockLine = 2.5 + vnoise(ep * .07, 21) * 4;
  if (hgt < rockLine && vnoise(ep * .16, 13) > .45) { // waterline stones
    const cell = Math.floor(ep / 7), f = (ep % 7) / 7;
    if (f < .12) return B.cliff[0];
    return B.cliff[clamp(2 + k + (hgt > rockLine - 1.5 ? 1 : 0) + (hash2(cell, 3) > .6 ? 1 : 0), 0, 5)];
  }
  const rc = Math.floor(ep / 13);
  if (hash2(rc, 7) > .78 && Math.abs((ep % 13) - 6) < .8 && hgt > lip - 2 - hash2(rc, 8) * 6) return P.BARK[clamp(1 + k, 0, 3)];
  let l = 2 + k + Math.round((vnoise(ep * .2, hgt * .3) - .5) * 1.4);
  if (hgt < tall * .35) l--;                     // wet, darker soil near the water
  if (hash2(px * 5, py) > .95) l++;
  return B.dirt[clamp(l, 0, 4)];
}
function riserColor(side, e, hgt, tall, px, py) {
  if (hgt > tall - 1.5) return P.COBBLE[4];
  const ep = e * .559, col = Math.floor(ep / 11);
  if (ep % 11 < 1) return P.MORTAR;
  const l = 1 + Math.floor(hash2(col, py >> 3) * 2) + (side === 1 ? -1 : 0);
  return P.COBBLE[clamp(l, 0, 4)];
}
function fallColor(e, hgt, tall, px, py, lava) {
  const B = lava ? LAVA : BIO();
  const col = Math.floor(e * .559 / 2);
  const n = vnoise(col * .55, hgt * .06 + col * .3);
  if (hgt > tall - 3) return B.foam[2];
  if (hgt < 5) return B.foam[hash2(px, py) > .4 ? 1 : 2];
  const l = n > .66 ? 5 : n > .5 ? 4 : n > .32 ? 3 : 2;
  return B.liquid[l];
}
// Earth ramp: a worn dirt track whose sides blend into turf, with tiny soil risers, so a slope
// between terraces reads as a natural path instead of masonry.
function rampTopColor(tx, ty, cx0, cy0, idx, px, py, F) {
  const T0 = WS.terrain, ax = T0.SAX[idx], M = T0.M;
  // lateral distance to the ramp side (cells across the climb that are not ramp)
  const lat = ax === 2 ? tx - cx0 : ty - cy0, step = ax === 2 ? 1 : 512;
  const sideA = M[idx - step] !== MAT.STAIR, sideB = M[idx + step] !== MAT.STAIR;
  const edge = Math.min(sideA ? lat : 99, sideB ? C - lat : 99) + (vnoise(tx * .08, ty * .08) - .5) * 10 + (vnoise(tx * .3, ty * .3) - .5) * 5;
  if (edge < (T0.ST[idx] === 3 ? 9 : 4)) return groundColor(tx, ty, px, py, F); // turf on the shoulders
  let l = 2 + Math.round((vnoise(tx * .05, ty * .05) - .5) * 1.6 + bayer(px, py) * .8);
  if (edge < 7) l--;
  if (hash2(px * 3, py * 5) > .97) l = 4; // pebbles
  return B.dirt[clamp(l, 0, 4)];
}
function rampRiserColor(side, e, hgt, tall, px, py) {
  // same soil as the track, only a touch darker, so the ramp reads as one continuous slope
  const l = 2 + Math.round((vnoise(e * .05, hgt * .2) - .5) * 1.4 + bayer(px, py) * .8) - (side === 1 ? 1 : 0);
  return B.dirt[clamp(l, 0, 4)];
}
// Wooden steps (mines): planks across the climb, dark seams, lit nosing.
function woodTopColor(tx, ty, cx0, cy0, idx, px, py) {
  const ax = WS.terrain.SAX[idx], along = ax === 2 ? ty - cy0 : tx - cx0, lat = ax === 2 ? tx : ty;
  if (along > C - 2.5) return P.WOOD[4];
  if (((lat % 11) + 11) % 11 < 1) return P.WOOD[0];
  return P.WOOD[clamp(2 + (hash2(Math.floor(lat / 11), Math.floor(cx0 + cy0)) > .5 ? 1 : 0) - (hash2(px, py) > .9 ? 1 : 0), 0, 4)];
}
function woodRiserColor(side, e, hgt, tall, px, py) {
  if (hgt > tall - 1.2) return P.WOOD[3];
  return P.WOOD[clamp(1 + (side === 1 ? -1 : 0) + (((e * .559) % 9) < 1 ? -1 : 0), 0, 4)];
}
function stairTopColor(tx, ty, cellX0, cellY0, riser, px, py) {
  const lat = riser === 2 ? tx : ty, front = riser === 2 ? cellY0 + C - ty : cellX0 + C - tx;
  if (front < 2.5) return P.COBBLE[4];
  if (((lat % 20) + 20) % 20 < 1.2) return P.MORTAR;
  const l = 2 + (hash2(Math.floor(lat / 20), Math.floor(cellY0 + cellX0)) > .5 ? 1 : 0) - (hash2(px, py) > .9 ? 1 : 0);
  return P.COBBLE[clamp(l, 0, 4)];
}
// Asgard uses the same continuous, comfortably wide climb as a natural slope, but with fitted
// marble slabs. Fine seams keep the surface readable without turning it back into narrow stairs.
function marbleTopColor(tx, ty, idx, px, py) {
  const ax = WS.terrain.SAX[idx], along = ax === 2 ? ty : tx, lat = ax === 2 ? tx : ty;
  const seamA = ((along % 32) + 32) % 32, seamL = ((lat % 48) + 48) % 48;
  if (seamA < 1.1 || seamL < 1.1) return P.MARBLE[1];
  const vein = vnoise(tx * .035 + 19, ty * .06 - 7);
  let l = 2 + (bayer(px, py) > .25 ? 1 : 0) + (vein > .7 ? 1 : 0) - (vein < .28 ? 1 : 0);
  return P.MARBLE[clamp(l, 0, 4)];
}
function marbleRiserColor(side, e, hgt, tall, px, py) {
  if (hgt > tall - 1.5) return P.MARBLE[4];
  const seam = ((e % 32) + 32) % 32;
  if (seam < 1.1 || ((hgt % 18) + 18) % 18 < 1) return P.MARBLE[0];
  return P.MARBLE[clamp(1 + (bayer(px, py) > .1 ? 1 : 0) - (side === 1 ? 1 : 0), 0, 4)];
}
function waterColor(tx, ty, idx, px, py) {
  const T0 = WS.terrain, d = T0.wdist[idx], fo = T0.foam[idx], B = T0.LQ[idx] ? LAVA : BIO();
  const across = tx - ty, along = tx + ty;
  const n = vnoise(across * .07, along * .012 + across * .01);
  // depth = bilinear distance-to-bank between cell centres (no visible cell squares)
  const fx = (tx + 2560) / C - .5, fy = (ty + 2560) / C - .5, ci = Math.floor(fx), cj = Math.floor(fy), u = fx - ci, v = fy - cj;
  const wd = (i, j) => { const k = j * 512 + i; return T0.M[k] === MAT.WATER ? Math.min(T0.wdist[k], 4) : -.8; };
  const depth = (wd(ci, cj) * (1 - u) + wd(ci + 1, cj) * u) * (1 - v) + (wd(ci, cj + 1) * (1 - u) + wd(ci + 1, cj + 1) * u) * v;
  let l = 4.2 - depth * .95 + (n - .5) * 1.3;
  l = Math.round(l + bayer(px, py) * .9);
  if (fo && hash2(px, py) < fo * .22 + bayer(px, py) * .1) return B.foam[clamp(fo - 1 + (hash2(py, px) > .5 ? 1 : 0), 0, 2)];
  if (d === 0) { // foam / light line right at the bank
    const i = idx % 512, j = (idx / 512) | 0, M = T0.M;
    const lx = tx - (-2560 + i * C), ly = ty - (-2560 + j * C);
    if ((M[idx - 1] !== MAT.WATER && lx < 2.5) || (M[idx - 512] !== MAT.WATER && ly < 2.5) || (M[idx + 1] !== MAT.WATER && lx > C - 2) || (M[idx + 512] !== MAT.WATER && ly > C - 2)) return B.foam[hash2(px, py) > .5 ? 0 : 1];
  }
  return B.liquid[clamp(l, 0, 5)];
}

// ---------- bake ----------
export async function bakeGround(progress) {
  const T0 = WS.terrain, SC = WS.scene, { Hh, M, riser } = T0;
  const gw = GROUND.x1 - GROUND.x0, gh = GROUND.y1 - GROUND.y0;
  const canvas = makeCanvas(gw, gh), g = canvas.getContext('2d');
  const img = g.createImageData(gw, gh), d = img.data;
  const zbuf = new Int16Array(gw * gh);
  // low-frequency fields on a 4px lattice (rows extended for high/low terrain)
  const Q = 4, rowOff = Math.ceil(-T0.zMin * K / Q) + 2, fw = Math.ceil(gw / Q) + 2, fh = Math.ceil((gh + (T0.zMax - T0.zMin) * K) / Q) + 6, NF = 4;
  const field = new Float32Array(fw * fh * NF);
  for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
    const sx = (GROUND.x0 + i * Q) / K, sy = (GROUND.y0 + (j - rowOff) * Q) / K, x = sx + 2 * sy, y = 2 * sy - sx, o = (j * fw + i) * NF;
    field[o] = forestDensity(x, y);
    field[o + 1] = (fbm(x * .0035, y * .0035) - .5) * .85 + (vnoise(x * .025, y * .025) - .5) * .3;
    field[o + 2] = fbm(x * .0055 + 31, y * .0055 + 11);
    field[o + 3] = fbm(x * .02, y * .02);
  }
  const F = new Float32Array(NF);
  const sample = (px, py) => {
    const fx = px / Q, fy = py / Q + rowOff, i = clamp(fx | 0, 0, fw - 2), j = clamp(fy | 0, 0, fh - 2), u = fx - i, v = fy - j;
    const o00 = (j * fw + i) * NF, o10 = o00 + NF, o01 = o00 + fw * NF, o11 = o01 + NF;
    for (let k = 0; k < NF; k++) F[k] = (field[o00 + k] * (1 - u) + field[o10 + k] * u) * (1 - v) + (field[o01 + k] * (1 - u) + field[o11 + k] * u) * v;
    return F;
  };
  // building/wall shadows rasterised to cells for a fast lookup
  const shadowCell = new Int16Array(512 * 512).fill(-1);
  WS.rectShadows.forEach((r, n) => {
    for (let y = r.y0; y <= r.y1 + C; y += C) for (let x = r.x0; x <= r.x1 + C; x += C) { const k = T0.cellIdx(Math.min(x, r.x1), Math.min(y, r.y1)); if (k >= 0 && shadowCell[k] < 0) shadowCell[k] = n; }
  });
  const waterPix = [], fallPix = [];
  const H = (x, y) => T0.heightAt(x, y);
  for (let py = 0; py < gh; py++) {
    const sy = GROUND.y0 + py + .5;
    for (let px = 0; px < gw; px++) {
      const sx = GROUND.x0 + px + .5;
      const hit = castRay(T0, sx, sy);
      let col, shade = 1;
      const o = (py * gw + px) * 4;
      zbuf[py * gw + px] = Math.round(hit.z);
      if (hit.idx < 0) { col = B.ground[1]; }
      else if (hit.face) {
        const hTop = Hh[hit.idx], hFoot = hit.prev >= 0 ? Hh[hit.prev] : 0, tall = hTop - hFoot, hgt = hit.z - hFoot;
        const e = hit.face === 1 ? hit.y : hit.x, m = M[hit.idx];
        if (m === MAT.WATER) { const lv = T0.LQ[hit.idx]; col = fallColor(e, hgt, tall, px, py, lv); fallPix.push(px, py, Math.round(hgt), Math.round(tall), Math.round(e), lv); }
        else if (m === MAT.STAIR) {
          const st = T0.ST[hit.idx], isRiser = riser[hit.idx] === hit.face;
          if (st === 3) col = naturalCliff(hit.face, e, hgt, tall, px, py);
          else if (st === 4) col = marbleRiserColor(hit.face, e, hgt, tall, px, py);
          else if (st === 1) col = isRiser ? rampRiserColor(hit.face, e, hgt, tall, px, py) : naturalCliff(hit.face, e, hgt, tall, px, py);
          else if (st === 2) col = isRiser ? woodRiserColor(hit.face, e, hgt, tall, px, py) : (tall < 20 ? P.WOOD[1] : cliffColor(hit.face, e, hgt, tall, px, py));
          else col = isRiser ? riserColor(hit.face, e, hgt, tall, px, py) : cliffColor(hit.face, e, hgt, tall, px, py);
        }
        else if (hit.prev >= 0 && M[hit.prev] === MAT.WATER && tall < 24) col = bankColor(hit.face, e, hgt, tall, px, py);
        else col = cliffColor(hit.face, e, hgt, tall, px, py);
      } else {
        const tx = hit.x, ty = hit.y, h = hit.z, m = M[hit.idx];
        const i = hit.idx % 512, j = (hit.idx / 512) | 0, cx0 = -2560 + i * C, cy0 = -2560 + j * C;
        if (m === MAT.WATER) {
          col = waterColor(tx, ty, hit.idx, px, py);
          if (hash2(px * 7, py * 3) > .985) waterPix.push(px, py, T0.LQ[hit.idx]);
        } else if (m === MAT.STAIR) {
          const st = T0.ST[hit.idx];
          col = st === 4 ? marbleTopColor(tx, ty, hit.idx, px, py) : st === 1 || st === 3 ? rampTopColor(tx, ty, cx0, cy0, hit.idx, px, py, sample(px, py + h * K)) : st === 2 ? woodTopColor(tx, ty, cx0, cy0, hit.idx, px, py) : stairTopColor(tx, ty, cx0, cy0, riser[hit.idx], px, py);
        }
        else {
          col = groundColor(tx, ty, px, py, sample(px, py + h * K));
          // rim light on front edges, dark line on back edges, wet soil next to water
          const idx = hit.idx;
          if ((Hh[idx + 1] < h - 12 && cx0 + C - tx < 5) || (Hh[idx + 512] < h - 12 && cy0 + C - ty < 5)) {
            const water = M[idx + 1] === MAT.WATER || M[idx + 512] === MAT.WATER;
            col = water ? B.ground[4] : B.ground[5];
          } else if ((Hh[idx - 1] < h - 12 && tx - cx0 < 1.6) || (Hh[idx - 512] < h - 12 && ty - cy0 < 1.6)) col = B.ground[0];
          else if ((M[idx - 1] === MAT.WATER && tx - cx0 < 4) || (M[idx - 512] === MAT.WATER && ty - cy0 < 4) || (M[idx + 1] === MAT.WATER && cx0 + C - tx < 3) || (M[idx + 512] === MAT.WATER && cy0 + C - ty < 3)) shade = .78;
        }
        // slopes: lit when facing the sun (-x, a little -y), darker facing away, so inclines read as 3D
        if (T0.SL[hit.idx]) { const k = clamp(1 + T0.GXs[hit.idx] * .75 + T0.GYs[hit.idx] * .35, .72, 1.25); col = [Math.min(255, col[0] * k), Math.min(255, col[1] * k), Math.min(255, col[2] * k)]; }
        // cast shadow from higher terrain (sun from -x) and contact AO under faces
        const reach = 40 + vnoise(ty * .02, h * .1) * 50;
        for (let dd = 12; dd <= reach; dd += 12) if (H(tx - dd, ty) > h + 14) { shade = Math.min(shade, .62); break; }
        if (shade > .8 && H(tx, ty - 12) > h + 14) shade = .82;
        const sc = shadowCell[hit.idx];
        if (sc >= 0) { const r = WS.rectShadows[sc]; if (inRect(tx, ty, r) && !(Math.min(tx - r.x0, r.x1 - tx) < 10 && bayer(px, py) > 0)) shade = Math.min(shade, r.k); }
      }
      if (shade < 1) { d[o] = col[0] * shade * .88; d[o + 1] = col[1] * shade * .95; d[o + 2] = Math.min(255, col[2] * shade * 1.12 + 6); }
      else { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; }
      d[o + 3] = 255;
    }
    if (py % 100 === 0) { progress?.(py / gh); await yieldFrame(); }
  }
  g.putImageData(img, 0, 0);
  // small props painted into the ground
  g.imageSmoothingEnabled = false;
  const baked = WS.baked.slice().sort((p, q) => (p.x + p.y) - (q.x + q.y));
  for (const b of baked) {
    const sx = Math.round(isoX(b.x, b.y) - GROUND.x0), sy = Math.round(isoY(b.x, b.y, b.z) - GROUND.y0);
    if (b.scale) g.drawImage(b.img, sx - b.ox * b.scale, sy - b.oy * b.scale, b.img.width * b.scale, b.img.height * b.scale);
    else g.drawImage(b.img, sx - b.ox, sy - b.oy);
  }
  // flowers, sampled in world space so they sit on every terrace
  const fr = rng(77), fcols = B.flowers;
  for (let n = 0; n < 5200; n++) {
    const x = -1400 + fr() * 5400, y = -1400 + fr() * 5400;
    if (T0.matAt(x, y) !== MAT.GROUND || pathDist(x, y) < 20 || (SC.plots || []).some(p => inRect(x, y, p, 10)) || forestDensity(x, y) > .7) continue;
    if ((SC.buildings || []).some(b => inRect(x, y, b, 10)) || fbm(x * .01 + 50, y * .01) < .55) continue;
    const z = H(x, y), sx = isoX(x, y) - GROUND.x0, sy = isoY(x, y, z) - GROUND.y0;
    if (sx < 0 || sy < 0 || sx >= gw || sy >= gh) continue;
    g.fillStyle = fcols[Math.floor(fr() * fcols.length)];
    for (let k = 0; k < 4; k++) g.fillRect(Math.round(sx + (fr() - .5) * 10 * K), Math.round(sy + (fr() - .5) * 5 * K), 1, 1);
  }
  // soft cool ellipse shadows (trees get dappled holes)
  const img2 = g.getImageData(0, 0, gw, gh), d2 = img2.data;
  for (const s of WS.shadows) {
    const cx = isoX(s.x, s.y) - GROUND.x0 + s.dx * K, cy = isoY(s.x, s.y, s.z) - GROUND.y0 + s.dy * K, srx = s.rx * K, sry = s.ry * K;
    const x0 = Math.max(0, Math.floor(cx - srx)), x1 = Math.min(gw - 1, Math.ceil(cx + srx));
    const y0 = Math.max(0, Math.floor(cy - sry)), y1 = Math.min(gh - 1, Math.ceil(cy + sry));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (Math.abs(zbuf[y * gw + x] - s.z) > 6) continue; // only on the surface the object stands on
      let q = ((x - cx) / srx) ** 2 + ((y - cy) / sry) ** 2;
      q += (vnoise(x * .18, y * .3) - .5) * .5;
      if (q > 1 - (bayer(x, y) + .5) * .12) continue;
      if (s.rx > 20 && vnoise(x * .22 + 5, y * .35) > .8) continue;
      const o = (y * gw + x) * 4, k = .64;
      d2[o] *= k * .86; d2[o + 1] *= k * .93; d2[o + 2] = Math.min(255, d2[o + 2] * k * 1.1 + 5);
    }
  }
  g.putImageData(img2, 0, 0);
  WS.ground = { canvas, zbuf, gw, gh, waterPix: Int32Array.from(waterPix), fallPix: Int32Array.from(fallPix) };
}
