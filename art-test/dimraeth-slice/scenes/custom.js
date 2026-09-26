import { mapTitleV2 } from '../../../src/simulation/mapNames.ts';
// Scenes painted in the map editor (editor.html). A map file is plain data:
// {
//   version: 2, name, biome, roster, n: 160, cell: 16,  // roster: '' (auto) | forest | desert | mine
//   level: '0012…', water: '0020…', road: '0120…',       // one char per cell, row-major; water 1 water / 2 lava; road 1 stone / 2 dirt trail
//   forest: '0031…',                                     // 0 auto, 1 clearing, 2 sparse, 3 forest, 4 dense
//   bridge: '0010…',                                     // painted bridge decks (hand-placed, one deck per patch)
//   spawn: { x, y },                                     // tiles
//   objects: [{ type, x, y, ...options }],               // tiles; see OBJECT_TYPES
// }
// The engine does all edge work: cliffs between levels, banks/foam/falls on water, worn road edges.
// This file adds the "smart" parts: slopes/stairs where a road meets a cliff, meandering edges, hand-painted bridges.
import { T, clamp, vnoise } from '../engine/util.js';
import { SLATE, RED, GREENR, ORANGE } from '../engine/palettes.js';
import { biomeOf } from '../engine/biomes.js';

export const LEVEL_H = 44;       // px per terrain level
export const MAP_N = 160, MAP_CELL = 16;
export const FOREST_DENSITY = [null, -1, .22, .55, .9]; // index = forest brush value; null = biome default
export const ROOFS = { red: RED, slate: SLATE, orange: ORANGE, green: GREENR };

// Everything the editor can stamp. `r` = editor footprint radius in tiles (for picking/overlap).
export const OBJECT_TYPES = {
  tree: { label: 'ต้นไม้', r: .5, color: '#3f7a34' },
  palm: { label: 'ต้นปาล์ม', r: .5, color: '#7fae3a' },
  bush: { label: 'พุ่มไม้', r: .35, color: '#6ea647' },
  rock: { label: 'หิน', r: .4, color: '#8b8a90' },
  lantern: { label: 'ตะเกียง/คบเพลิง', r: .25, color: '#ffd27a' },
  camp: { label: 'กองไฟ', r: .6, color: '#ff8a30' },
  house: { label: 'บ้าน', r: 1.8, color: '#c49a6c', opts: { roof: 'red', floors: 1 } },
  crate: { label: 'ลังไม้', r: .3, color: '#a8743f' },
  barrel: { label: 'ถังไม้', r: .3, color: '#8c5c34' },
  altar: { label: 'แท่นบูชา', r: .8, color: '#8fe6ff' },
  pillar: { label: 'เสาหิน', r: .4, color: '#bcb09c' },
  temple: { label: 'วิหาร (หินอ่อน)', r: 2.6, color: '#f2f0f6' },
  palace: { label: 'วังใต้ทะเล', r: 2.4, color: '#e05a7c' },
  portal: { label: 'Portal', r: .8, color: '#78c8ff' },
  monster: { label: 'จุดเกิดมอน', r: .5, color: '#ff5a5a' },
  // wild
  pine: { label: 'ต้นสน', r: .45, color: '#1e4b36' },
  stump: { label: 'ตอไม้', r: .25, color: '#5a3b24' },
  log: { label: 'ท่อนไม้ล้ม', r: .5, color: '#7a5231', opts: { axis: 'x' } },
  mushroom: { label: 'เห็ดยักษ์', r: .35, color: '#c84232' },
  flowers: { label: 'ดงดอกไม้', r: .3, color: '#e89ab8' },
  fern: { label: 'กอเฟิร์น', r: .3, color: '#4d853a' },
  cactus: { label: 'กระบองเพชร', r: .3, color: '#468252' },
  coral: { label: 'ปะการัง', r: .35, color: '#e05a7c' },
  // village
  fence: { label: 'รั้วไม้', r: .3, color: '#ad7a47', opts: { axis: 'x', len: 3 } },
  well: { label: 'บ่อน้ำ', r: .5, color: '#9a8f7f' },
  signpost: { label: 'ป้ายบอกทาง', r: .2, color: '#8c5c34' },
  stall: { label: 'แผงตลาด', r: .6, color: '#d8483c' },
  cart: { label: 'เกวียน', r: .55, color: '#6b4427' },
  hay: { label: 'กองฟาง', r: .45, color: '#d4b25c' },
};
const STALL_LOOKS = [
  { goods: ['#d8483c', '#f0a53a', '#9fd05a'], cloth: ['#b8322a', '#efe3c8'] },
  { goods: ['#e8c25a', '#b07a3c', '#e8e0d0'], cloth: ['#2f7a4a', '#efe3c8'] },
  { goods: ['#8a5ad8', '#d85a9a', '#5ab4d8'], cloth: ['#6a3a9a', '#efe3c8'] },
  { goods: ['#f4d35e', '#e8627a', '#f2f0e8'], cloth: ['#2b4c8a', '#efe3c8'] },
];

export function emptyMap(name = 'untitled', biome = 'forest') {
  const z = '0'.repeat(MAP_N * MAP_N);
  return { version: 2, name, biome, roster: '', n: MAP_N, cell: MAP_CELL, level: z, water: z, road: z, forest: z, spawn: { x: 20, y: 20 }, objects: [] };
}

// Signed distance (world units) to the edge of a 0/1 mask: + inside, - outside. 8-neighbour chamfer.
export function signedDistance(mask, n, cell) {
  const INF = 1e9, dIn = new Float32Array(n * n), dOut = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) { dIn[k] = mask[k] ? INF : 0; dOut[k] = mask[k] ? 0 : INF; }
  const pass = d => {
    const D = 1.4142;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i; let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + 1);
      if (j > 0) { v = Math.min(v, d[k - n] + 1); if (i > 0) v = Math.min(v, d[k - n - 1] + D); if (i < n - 1) v = Math.min(v, d[k - n + 1] + D); }
      d[k] = v;
    }
    for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i; let v = d[k];
      if (i < n - 1) v = Math.min(v, d[k + 1] + 1);
      if (j < n - 1) { v = Math.min(v, d[k + n] + 1); if (i < n - 1) v = Math.min(v, d[k + n + 1] + D); if (i > 0) v = Math.min(v, d[k + n - 1] + D); }
      d[k] = v;
    }
  };
  pass(dIn); pass(dOut);
  const out = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) out[k] = (mask[k] ? dIn[k] - .5 : -(dOut[k] - .5)) * cell;
  return out;
}

const decode = (str, n) => (str ? Uint8Array.from(str, c => c.charCodeAt(0) - 48) : new Uint8Array(n * n));

// Where a road crosses from one terrain level to a higher one, build a stairway on the lower side.
// Returns engine stairs [{x0,x1,y0,y1,dir,from,to}] in world units, and the cells they occupy.
export function autoStairs(level, road, water, n, cell, style = 'stone') {
  const stairs = [], taken = new Uint8Array(n * n), cands = [];
  // connected road patches: one painted road crossing one terrace edge = one slope
  const comp = new Int32Array(n * n).fill(-1);
  for (let k = 0, id = 0; k < n * n; k++) {
    if (!road[k] || comp[k] >= 0) continue;
    const q = [k]; comp[k] = id;
    while (q.length) { const c = q.pop(), i = c % n; for (const nb of [i > 0 ? c - 1 : -1, i < n - 1 ? c + 1 : -1, c - n, c + n]) if (nb >= 0 && nb < n * n && road[nb] && comp[nb] < 0) { comp[nb] = id; q.push(nb); } }
    id++;
  }
  const STEP = style === 'slope' ? 5.5 : style === 'ramp' ? 4.5 : 7; // px per step (player can climb 12); ramps are longer and gentler
  const MIN_W = style === 'slope' ? 10 : 1; // smooth slopes are at least ~3 characters wide (10 cells = 160 px)
  // scan boundaries in 4 directions; a run of adjacent road cells along the boundary = one stairway
  const dirs = [[1, 0, '-x'], [-1, 0, '+x'], [0, 1, '-y'], [0, -1, '+y']]; // (di,dj) points from HIGH cell to LOW cell
  for (const [di, dj, dir] of dirs) {
    const seen = new Uint8Array(n * n);
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const hi = j * n + i, lo = (j + dj) * n + (i + di);
      if (seen[hi] || !road[hi] || !road[lo] || water[lo] || level[hi] <= level[lo]) continue;
      // grow the run sideways (perpendicular to the climb)
      const si = dj ? 1 : 0, sj = di ? 1 : 0, run = [[i, j]];
      for (let s = 1; ; s++) {
        const a = i + si * s, b = j + sj * s; if (a >= n - 1 || b >= n - 1) break;
        const h2 = b * n + a, l2 = (b + dj) * n + (a + di);
        if (!road[h2] || !road[l2] || level[h2] !== level[hi] || level[l2] !== level[lo]) break;
        run.push([a, b]);
      }
      const from = level[lo] * LEVEL_H, to = level[hi] * LEVEL_H, len = Math.max(2, Math.ceil((to - from) / STEP) - 1);
      // widen short runs sideways along the same cliff edge, alternating ends, so the slope is roomy
      // The slope must top out on the real upper terrace: the edge may wander by a few cells, so look
      // up to MIN_W cells into the high side (a diagonal edge) for level[hi]; the gap is filled up to it.
      const fills = [], run0 = run.length;
      const edgeOk = (a, b, commit) => {
        if (a < 1 || b < 1 || a >= n - 1 || b >= n - 1) return false;
        for (let t = 0; t <= len + 1; t++) { const q = (b + dj * t) * n + (a + di * t); if (q < 0 || q >= n * n || water[q]) return false; }
        for (let t = 0; t <= MIN_W; t++) {
          const qa = a - di * t, qb = b - dj * t; if (qa < 0 || qb < 0 || qa >= n || qb >= n) return false;
          const q = qb * n + qa;
          if (water[q] || level[q] > level[hi]) return false;
          if (level[q] === level[hi]) { if (commit) for (let u = 0; u < t; u++) fills.push((b - dj * u) * n + (a - di * u)); return true; }
        }
        return false;
      };
      for (let t = 0; run.length < MIN_W && t < MIN_W * 2; t++) {
        const [ea, eb] = t & 1 ? run[0] : run[run.length - 1], sg = t & 1 ? -1 : 1, a = ea + si * sg, b = eb + sj * sg;
        if (edgeOk(a, b, false)) { edgeOk(a, b, true); t & 1 ? run.unshift([a, b]) : run.push([a, b]); }
      }
      run.forEach(([a, b]) => { seen[b * n + a] = 1; });
      const [ai, aj] = run[0], [bi, bj] = run[run.length - 1];
      // stair cells: on the low side, starting at the boundary and running `len` cells away from the cliff
      let x0, x1, y0, y1;
      if (di) { const bx = di > 0 ? ai + 1 : ai; x0 = di > 0 ? bx : bx - len; x1 = x0 + len; y0 = Math.min(aj, bj); y1 = Math.max(aj, bj) + 1; }
      else { const by = dj > 0 ? aj + 1 : aj; y0 = dj > 0 ? by : by - len; y1 = y0 + len; x0 = Math.min(ai, bi); x1 = Math.max(ai, bi) + 1; }
      let roadIn = 0; // how much of the painted road this slope actually carries
      for (let b = y0; b < y1; b++) for (let a = x0; a < x1; a++) if (a >= 0 && b >= 0 && a < n && b < n && road[b * n + a]) roadIn++;
      cands.push({ key: `${comp[hi]}:${level[lo]}:${level[hi]}`, s: { x0: x0 * cell, x1: x1 * cell, y0: y0 * cell, y1: y1 * cell, dir, from, to, style }, r: [x0, x1, y0, y1], fills, w: roadIn * 4 + run0, hiL: level[hi] });
    }
  }
  // A wide road over a jagged edge finds several crossings at one spot. Keep the widest (then the
  // tallest) and drop any later one that would overlap a slope already placed.
  cands.sort((p, q) => q.w - p.w || (q.s.to - q.s.from) - (p.s.to - p.s.from));
  const done = new Set();
  for (const c of cands) {
    if (style === 'slope' && done.has(c.key)) continue;
    const [x0, x1, y0, y1] = c.r;
    let hit = 0;
    for (let b = y0; b < y1; b++) for (let a = x0; a < x1; a++) if (a >= 0 && b >= 0 && a < n && b < n && taken[b * n + a]) hit++;
    if (hit) continue;
    stairs.push(c.s); done.add(c.key);
    for (const q of c.fills) level[q] = c.hiL;
    for (let b = y0; b < y1; b++) for (let a = x0; a < x1; a++) if (a >= 0 && b >= 0 && a < n && b < n) taken[b * n + a] = 1;
  }
  return { stairs, taken };
}

// Water painted *along* a terrace edge straddles two levels and would become one long wall of
// falling water. A real fall is about as long as the river is wide, where the river crosses the
// edge. For every run of fall edges, compare its length with how far the water extends away from
// the edge on both sides. If it is much longer, it is a straddle: sink the upper strip of water to
// the lower level, so the river runs along the foot of the cliff instead.
export function settleWater(level, water, n) {
  const out = level.slice();
  const W = (i, j) => i >= 0 && j >= 0 && i < n && j < n && water[j * n + i] > 0;
  // boundaries: horizontal (between rows j and j+1) walk along i; vertical (cols i, i+1) walk along j
  for (const horiz of [true, false]) {
    for (let a = 0; a < n - 1; a++) {
      let b = 0;
      while (b < n) {
        const cell = (p, q) => (horiz ? [q, p] : [p, q]); // p = across-boundary index, q = along index
        const [i0, j0] = cell(a, b), [i1, j1] = cell(a + 1, b);
        const k0 = j0 * n + i0, k1 = j1 * n + i1;
        if (!(W(i0, j0) && W(i1, j1) && level[k0] !== level[k1])) { b++; continue; }
        const hiFirst = level[k0] > level[k1], start = b;
        while (b < n) {
          const [ii0, jj0] = cell(a, b), [ii1, jj1] = cell(a + 1, b), q0 = jj0 * n + ii0, q1 = jj1 * n + ii1;
          if (!(W(ii0, jj0) && W(ii1, jj1)) || (level[q0] > level[q1]) !== hiFirst || level[q0] === level[q1]) break;
          b++;
        }
        const len = b - start;
        // perpendicular water extent on each side, averaged over the run
        let up = 0, dn = 0;
        for (let q = start; q < b; q++) {
          for (let d = 0; d < 40; d++) { const [ci, cj] = cell(hiFirst ? a - d : a + 1 + d, q); if (!W(ci, cj)) break; up++; }
          for (let d = 0; d < 40; d++) { const [ci, cj] = cell(hiFirst ? a + 1 + d : a - d, q); if (!W(ci, cj)) break; dn++; }
        }
        up /= len; dn /= len;
        if (len > 8 && len > 1.6 * (up + dn)) {
          const low = Math.min(...Array.from({ length: len }, (_, t) => { const [ci, cj] = cell(hiFirst ? a + 1 : a, start + t); return level[cj * n + ci]; }));
          for (let q = start; q < b; q++) for (let d = 0; d < 40; d++) {
            const [ci, cj] = cell(hiFirst ? a - d : a + 1 + d, q); if (!W(ci, cj)) break; out[cj * n + ci] = Math.min(out[cj * n + ci], low);
          }
        }
      }
    }
  }
  return out;
}

// Bridges are placed by hand with the bridge brush: each connected painted patch becomes one deck.
// It spans along the patch's longer side; the deck height comes from the banks at its two ends.
export function bridgesFromMask(mask, water, n, cell) {
  const seen = new Uint8Array(n * n), out = [];
  for (let k = 0; k < n * n; k++) {
    if (seen[k] || !mask[k]) continue;
    let x0 = n, x1 = 0, y0 = n, y1 = 0; const q = [k]; seen[k] = 1;
    while (q.length) {
      const c = q.pop(), i = c % n, j = (c / n) | 0;
      x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j);
      for (const nb of [c - 1, c + 1, c - n, c + n]) if (nb >= 0 && nb < n * n && !seen[nb] && mask[nb]) { seen[nb] = 1; q.push(nb); }
    }
    const axis = (x1 - x0) >= (y1 - y0) ? 'x' : 'y';
    out.push({ x0: x0 * cell, x1: (x1 + 1) * cell, y0: y0 * cell, y1: (y1 + 1) * cell, axis });
  }
  return out;
}

// how a road climbs a terrace: 'auto' follows the biome (forest = earth ramp, mine = wooden steps, city = stone stairs…)
export const SLOPE_STYLES = { auto: 'อัตโนมัติตามธีม', slope: 'เนินลาดเรียบ (กว้าง)', ramp: 'ทางลาดดิน', stone: 'บันไดหิน', wood: 'บันไดไม้' };
export const slopeStyleOf = data => (data.slopeStyle && data.slopeStyle !== 'auto' ? data.slopeStyle : biomeOf({ biome: data.biome }).stairStyle || 'stone');

export function sceneFromMap(data, opts = {}) {
  const n = data.n || MAP_N, cell = data.cell || MAP_CELL;
  const level = settleWater(decode(data.level, n), decode(data.water, n), n), water = decode(data.water, n), road = decode(data.road, n), forest = decode(data.forest, n);
  const slope = slopeStyleOf(data);
  const { stairs, taken } = autoStairs(level, road, water, n, cell, slope);
  const bridgeMask = decode(data.bridge, n);
  const bridges = bridgesFromMask(bridgeMask, water, n, cell);
  const idx = (x, y) => clamp(Math.floor(y / cell), 0, n - 1) * n + clamp(Math.floor(x / cell), 0, n - 1); // border cells continue outward
  // Organic edges: terrain levels and water are sampled through a gentle noise warp, so a straight
  // brush stroke still gives a meandering bank / cliff line. No warp next to stairs (they need the
  // exact painted edge) or under bridges.
  const calm = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (taken[j * n + i] || bridgeMask[j * n + i])
    for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < n && jj < n) calm[jj * n + ii] = 1; }
  const warp = data.organic === false ? 0 : 26;
  const idxW = (x, y) => {
    if (!warp || calm[idx(x, y)]) return idx(x, y);
    return idx(x + (vnoise(x * .017, y * .017) - .5) * warp * 2, y + (vnoise(x * .017 + 31, y * .017 + 17) - .5) * warp * 2);
  };
  const stoneRoad = road.map(v => (v === 1 ? 1 : 0)), trail = road.map(v => (v === 2 ? 1 : 0));
  const P = o => ({ x: o.x * T, y: o.y * T });
  // Stable source fingerprint lets the renderer persist baked terrain safely. Any editor
  // change invalidates the cache automatically; renderScale/engine version are added later.
  const sourceText=JSON.stringify(data);let sourceHash=2166136261;
  for(let i=0;i<sourceText.length;i++){sourceHash^=sourceText.charCodeAt(i);sourceHash=Math.imul(sourceHash,16777619);}
  const scene = {
    id: 'custom', title: (data.title || mapTitleV2(data.name || '') || 'CUSTOM MAP').toUpperCase(), biome: data.biome || 'forest', roster: data.roster || undefined,
    cacheKey:`map:${data.name||'custom'}:${(sourceHash>>>0).toString(16)}`,
    renderScale: opts.renderScale ?? data.renderScale ?? 1.45,
    terrain: {
      height: (x, y) => level[idxW(x, y)] * LEVEL_H,
      waterMask: (x, y) => { const k = idxW(x, y); return water[k] >= 1 && !taken[idx(x, y)]; },
      liquidKind: (x, y) => (water[idxW(x, y)] === 2 ? 'lava' : 'water'),
      waterDepth: 12,
      stairs,
    },
    paved: [], bridges,
    pavedField: stoneRoad.some(v => v) ? { x0: 0, y0: 0, cell, n, d: signedDistance(stoneRoad, n, cell) } : null,
    trailField: trail.some(v => v) ? { x0: 0, y0: 0, cell, n, d: signedDistance(trail, n, cell) } : null,
    spawn: { x: (data.spawn?.x ?? 20) * T, y: (data.spawn?.y ?? 20) * T },
    // a blank map stays blank: only painted forest grows trees/bushes/rocks, no auto forest border
    baseDensity: (x, y) => FOREST_DENSITY[forest[idx(x, y)]] ?? -1, bareByDefault: true, noEdgeForest: true,
    densNoise: .6, worn: 1, cliffStyle: data.cliffStyle,
    treePathClear: 56, canopyClear: 72, // keep painted roads and houses readable under tree crowns
    trees: [], props: [], lanterns: [], camps: [], logs: [], crates: [], barrels: [], buildings: [], portals: [], stalls: [], fences: [],
    gameplay: { mapId: data.name, spawnPoints: [] },
  };
  for (const o of data.objects || []) {
    const p = P(o);
    switch (o.type) {
      case 'tree': scene.trees.push({ ...p, kind: o.kind || biomeOf(scene).trees.a }); break;
      case 'temple': case 'palace': scene.props.push({ type: o.type, ...p, r: 150 }); break;
      case 'palm': scene.trees.push({ ...p, kind: 'palm' }); break;
      case 'bush': case 'rock': case 'altar': scene.props.push({ type: o.type, ...p, seed: Math.round(o.x * 7 + o.y * 13), r: 30 }); break;
      case 'pillar': scene.props.push({ type: 'pillar', ...p, h: o.h || 64, broken: !!o.broken, seed: Math.round(o.x * 7 + o.y), r: 30 }); break;
      case 'lantern': scene.lanterns.push(p); break;
      case 'camp': scene.camps.push(p); break;
      case 'crate': scene.crates.push({ x: p.x - 11, y: p.y - 11, w: 22, d: 22, h: 18 }); break;
      case 'barrel': scene.barrels.push(p); break;
      case 'portal': scene.portals.push({ ...p, id:o.id||'', to:o.to||'', toPortal:o.toPortal||'', col: [120, 200, 255] }); break;
      case 'pine': scene.trees.push({ ...p, kind: scene.biome === 'snow' ? 'snowPine' : 'pine' }); break;
      case 'cactus': scene.trees.push({ ...p, kind: 'cactus' }); break;
      case 'log': scene.logs.push(o.axis === 'y' ? { x: p.x - 8, y: p.y - 28, w: 16, d: 56, h: 14 } : { x: p.x - 28, y: p.y - 8, w: 56, d: 16, h: 14 }); break;
      case 'stall': scene.stalls.push({ x: p.x - 26, y: p.y - 13, ...STALL_LOOKS[Math.round(o.x * 7 + o.y * 13) % STALL_LOOKS.length] }); break;
      case 'fence': { const L = (o.len || 3) * T / 2; scene.fences.push(o.axis === 'y' ? { ax: p.x, ay: p.y - L, bx: p.x, by: p.y + L } : { ax: p.x - L, ay: p.y, bx: p.x + L, by: p.y }); break; }
      case 'stump': case 'mushroom': case 'flowers': case 'fern': case 'coral': case 'well': case 'signpost': case 'cart': case 'hay':
        scene.props.push({ type: o.type, ...p, seed: Math.round(o.x * 7 + o.y * 13), r: OBJECT_TYPES[o.type].r * T * .8 }); break;
      case 'monster': scene.gameplay.spawnPoints.push({ ...p, pool: o.pool || null }); break;
      case 'house': {
        const floors = clamp(o.floors || 1, 1, 3), w = (o.w || 3.5) * T, d = (o.d || 2.75) * T;
        scene.buildings.push({ x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - d / 2, y1: p.y + d / 2, wallH: 38 + floors * 14, floors, roofH: 38,
          ridge: o.ridge || 'x', roof: ROOFS[o.roof] || RED, wall: o.wall || 'timber', chimney: true, flowers: true, moss: scene.biome === 'forest',
          door: { face: 'y', at: .5 }, windows: [{ face: 'y', at: .18 }, { face: 'y', at: .82 }, { face: 'x', at: .5 }] });
        break;
      }
    }
  }
  return scene;
}
