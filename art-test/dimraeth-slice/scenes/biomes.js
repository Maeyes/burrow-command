// Biome maps built on the shared engine. Each export is a scene factory (see ENGINE.md §5).
// Layouts are intentionally data-only: terrain height fn + water + roads + a few landmarks;
// scatter fills the rest from the biome kit.
import { T, smooth, vnoise, inRect } from '../engine/util.js';
import { SLATE, RED, GREENR, ORANGE, GOLDLEAF } from '../engine/palettes.js';

const R4 = (x0, x1, y0, y1, extra = {}) => ({ x0: x0 * T, x1: x1 * T, y0: y0 * T, y1: y1 * T, ...extra });
const P = (x, y, extra = {}) => ({ x: x * T, y: y * T, ...extra });
// noisy ellipse (organic lakes, mesas, caves); cx..ry in tiles
const blob = (x, y, cx, cy, rx, ry, wob = .22, seed = 0) => {
  const dx = (x / T - cx) / rx, dy = (y / T - cy) / ry;
  return Math.hypot(dx, dy) < 1 + (vnoise(x * .006 + seed, y * .006 - seed) - .5) * wob * 2;
};
const edgeDensity = (cx, cy, r, lo = .45, hi = .98) => (x, y) => smooth(lo, hi, Math.hypot((x - cx * T) / (r * T), (y - cy * T) / (r * T)));
const common = { renderScale: 1.45, densNoise: .6, worn: 1 };

// ---------------- Forest II: misty lake with a long boardwalk ----------------
export function forest2() {
  const lake = (x, y) => blob(x, y, 24, 22, 7.2, 4.6, .25, 3);
  return {
    ...common, id: 'forest2', title: 'WHISPERING FOREST II', biome: 'forest', cliffStyle: 'natural',
    terrain: {
      height: (x, y) => ((x < 8 * T && y < 30 * T) || y < 6 * T ? 48 : 0),
      waterMask: lake, waterDepth: 12,
      rivers: [{ pts: [[21 * T, -8 * T], [21 * T, 3 * T], [22.6 * T, 12 * T], [24 * T, 18.5 * T]], width: [48, 64], depth: 12 }],
      stairs: [{ ...R4(8, 8 + 1.5, 24, 25.25), dir: '-x', from: 0, to: 48 }],
    },
    paved: [],
    bridges: [R4(15.8, 32.4, 21.6, 22.8)],
    camps: [P(12.5, 28)], logs: [{ x: 12.5 * T - 70, y: 28 * T - 30, w: 56, d: 16, h: 11 }],
    lanterns: [P(15.4, 21.4), P(32.8, 23), P(10.2, 23.8)],
    props: [{ type: 'pillar', x: 4 * T, y: 14 * T, h: 58, broken: true, seed: 11 }, { type: 'pillar', x: 5.3 * T, y: 16.5 * T, h: 66, seed: 12 }],
    spawn: P(14, 27), baseDensity: edgeDensity(22, 22, 13, .35), densNoise: .75,
  };
}

// ---------------- Desert I: mesas and an oasis ----------------
export function desert1() {
  const oasis = (x, y) => blob(x, y, 22, 24, 3.4, 2.6, .2, 7);
  return {
    ...common, id: 'desert1', title: 'SUNSCORCH DUNES', biome: 'desert',
    terrain: {
      height: (x, y) => (blob(x, y, 9, 9, 5.5, 4.5, .3, 1) || blob(x, y, 31, 8, 4.5, 3.8, .3, 2) || y < 3.5 * T || x < 3 * T ? 52 : 0),
      waterMask: oasis,
    },
    paved: [],
    trees: [P(18.6, 23.6), P(19.4, 26.2), P(25.2, 21.6), P(25.8, 26.6), P(22.4, 20.8)].map(p => ({ ...p, kind: 'palm' })),
    props: [
      { type: 'pillar', x: 27 * T, y: 13 * T, h: 62, seed: 21, palette: 'SANDSTONE' }, { type: 'pillar', x: 29.4 * T, y: 13 * T, h: 40, broken: true, seed: 22, palette: 'SANDSTONE' },
      { type: 'pillar', x: 27 * T, y: 15.5 * T, h: 48, broken: true, seed: 23, palette: 'SANDSTONE' }, { type: 'pillar', x: 29.4 * T, y: 15.5 * T, h: 62, seed: 24, palette: 'SANDSTONE' },
      { type: 'altar', x: 27.6 * T, y: 13.9 * T, r: 60 },
    ],
    camps: [P(15, 30)],
    spawn: P(18, 30), baseDensity: () => .22, densNoise: .5,
  };
}

// ---------------- Desert II: canyon river with a falls and a rope bridge ----------------
export function desert2() {
  return {
    ...common, id: 'desert2', title: 'CANYON OF ECHOES', biome: 'desert',
    terrain: {
      height: (x, y) => (y < 14 * T + (vnoise(x * .01, 4) - .5) * 60 || x < 11 * T ? 60 : 0),
      rivers: [{ pts: [[30 * T, -8 * T], [29 * T, 8 * T], [26.2 * T, 19 * T], [27.6 * T, 28 * T], [25.5 * T, 46 * T]], width: [56, 90], depth: 12 }],
      stairs: [{ ...R4(18, 19.25, 14, 14 + 1.75), dir: '-y', from: 0, to: 60 }],
    },
    paved: [R4(11, 40, 23.4, 24.6, { style: 'road' })],
    bridges: [R4(25.4, 29.6, 23.2, 24.8)],
    lanterns: [P(24.9, 23.1), P(30.1, 24.9)],
    trees: [P(33, 30, { kind: 'palm' }), P(35, 27.5, { kind: 'palm' })],
    spawn: P(20, 26), baseDensity: () => .28, densNoise: .5, worn: .6,
  };
}

// ---------------- Mines: cave floors ringed by tall rock walls ----------------
const caveHeight = (rooms, ledges = []) => (x, y) => {
  if (!rooms.some(r => blob(x, y, ...r))) return 110;
  for (const l of ledges) if (blob(x, y, ...l.b)) return l.h;
  return 0;
};
export function mine1() {
  const rooms = [[20, 21, 13, 9, .25, 1], [12, 12, 6.5, 6, .25, 2], [30, 29, 7, 6, .25, 3], [22, 6, 4, 3.5, .25, 4]];
  return {
    ...common, id: 'mine1', title: 'OLD COPPER MINE', biome: 'mine',
    terrain: {
      height: caveHeight(rooms, [{ b: [13, 12, 4, 3.2, .2, 5], h: 36 }]),
      waterMask: (x, y) => blob(x, y, 29, 29, 3, 2.2, .2, 9),
      stairs: [{ ...R4(16.9, 16.9 + 1.25, 11.4, 12.65), dir: '-x', from: 0, to: 36 }],
    },
    paved: [R4(18.1, 34, 11.4, 12.65, { style: 'road' }), R4(20, 21.25, 12.65, 30, { style: 'road' })],
    lanterns: [P(18.4, 11), P(22.8, 13.2), P(19.6, 18), P(21.7, 24), P(19.6, 29), P(26, 26), P(13, 10)],
    crates: [{ x: 23 * T, y: 15 * T, w: 22, d: 22, h: 18 }, { x: 23 * T, y: 15 * T + 26, w: 20, d: 20, h: 16 }],
    barrels: [P(22.6, 16.8), P(18.8, 21.5)],
    spawn: P(21.6, 20), baseDensity: () => .3, densNoise: .6,
  };
}
export function mine2() {
  const rooms = [[20, 20, 15, 12, .2, 6]];
  const lake = (x, y) => blob(x, y, 21, 19, 9, 6.5, .22, 8) && !blob(x, y, 22, 19, 3, 2.2, .2, 9);
  return {
    ...common, id: 'mine2', title: 'CRYSTAL DEEP', biome: 'mine',
    terrain: { height: caveHeight(rooms), waterMask: lake, waterDepth: 14 },
    bridges: [R4(11, 20.2, 18.6, 19.8), R4(23.8, 31.4, 18.6, 19.8)],
    lanterns: [P(10.6, 18.4), P(31.8, 20)],
    props: [{ type: 'altar', x: 21.3 * T, y: 18.4 * T, r: 70 }],
    spawn: P(8, 20), baseDensity: () => .38, densNoise: .5,
  };
}

// ---------------- Snow ----------------
export function snow1() {
  return {
    ...common, id: 'snow1', title: 'FROSTPINE FIELD', biome: 'snow', cliffStyle: 'natural',
    terrain: {
      height: (x, y) => (y < 7 * T + (vnoise(x * .01, 2) - .5) * 80 || x < 5 * T ? 50 : 0),
      waterMask: (x, y) => blob(x, y, 25, 24, 6, 3.8, .25, 12), waterDepth: 6,
    },
    lanterns: [P(17, 18)],
    spawn: P(15, 24), baseDensity: edgeDensity(21, 21, 14, .4), densNoise: .7,
  };
}
export function snow2() {
  const L1 = 46, L2 = 92;
  return {
    ...common, id: 'snow2', title: 'GLACIER STEPS', biome: 'snow',
    terrain: {
      height: (x, y) => (y < 8 * T || x < 6 * T ? L2 : y < 16 * T || x < 14 * T ? L1 : 0),
      rivers: [{ pts: [[24 * T, -8 * T], [24 * T, 6 * T], [22.5 * T, 13 * T], [24.5 * T, 22 * T], [23 * T, 46 * T]], width: [50, 80], depth: 10 }],
      stairs: [{ ...R4(14, 15.5, 25, 26.25), dir: '-x', from: 0, to: L1 }, { ...R4(10, 11.25, 8, 9.75), dir: '-y', from: L1, to: L2 }],
    },
    paved: [R4(15.5, 40, 25, 26.25, { style: 'road' })],
    bridges: [R4(22, 26, 24.8, 26.5)],
    lanterns: [P(21.7, 24.7), P(26.3, 26.7)],
    spawn: P(18, 28), baseDensity: edgeDensity(25, 26, 13, .4), densNoise: .7,
  };
}

// ---------------- Magma ----------------
export function magma1() {
  return {
    ...common, id: 'magma1', title: 'EMBER FLATS', biome: 'magma',
    terrain: {
      height: (x, y) => (blob(x, y, 10, 10, 6, 5, .35, 3) || y < 4 * T ? 44 : 0),
      rivers: [
        { pts: [[34 * T, -8 * T], [31 * T, 8 * T], [27 * T, 16 * T], [29 * T, 26 * T], [26 * T, 46 * T]], width: [54, 80], depth: 10 },
        { pts: [[-4 * T, 30 * T], [8 * T, 28 * T], [18 * T, 31 * T], [27.5 * T, 27 * T]], width: 44, depth: 10 },
      ],
    },
    bridges: [R4(25.5, 30.8, 20.4, 21.6)],
    paved: [R4(14, 40, 20.4, 21.6, { style: 'road' })],
    props: [{ type: 'altar', x: 9 * T, y: 9 * T, r: 60 }],
    spawn: P(20, 23), baseDensity: edgeDensity(20, 20, 15, .4), densNoise: .6, worn: .4,
  };
}
export function magma2() {
  const lake = (x, y) => blob(x, y, 21, 20, 9, 7, .25, 5) && !blob(x, y, 21, 20, 3.2, 2.6, .15, 6);
  return {
    ...common, id: 'magma2', title: 'MOLTEN CALDERA', biome: 'magma',
    terrain: {
      height: (x, y) => (!blob(x, y, 21, 20, 15, 12.5, .25, 1) ? 70 : 0),
      waterMask: lake, waterDepth: 14,
    },
    bridges: [R4(9.8, 18, 19.4, 20.6)],
    props: [{ type: 'altar', x: 20.4 * T, y: 19.4 * T, r: 60 }, { type: 'pillar', x: 19 * T, y: 18 * T, h: 70, seed: 31, palette: 'BASALT' }, { type: 'pillar', x: 23 * T, y: 21.6 * T, h: 56, broken: true, seed: 32, palette: 'BASALT' }],
    spawn: P(8.2, 20.4), baseDensity: () => .32, densNoise: .5,
  };
}

// ---------------- Underwater ----------------
export function underwater1() {
  return {
    ...common, id: 'underwater1', title: 'CORAL SHALLOWS', biome: 'underwater', cliffStyle: 'natural',
    terrain: {
      height: (x, y) => (blob(x, y, 8, 8, 7, 6, .35, 1) || blob(x, y, 33, 12, 5, 6, .35, 2) ? 40 : 0),
      rivers: [{ pts: [[-6 * T, 30 * T], [10 * T, 27 * T], [22 * T, 31 * T], [34 * T, 26 * T], [46 * T, 28 * T]], width: [90, 120], depth: 26 }],
    },
    spawn: P(20, 20), baseDensity: edgeDensity(20, 18, 14, .35), densNoise: .7,
  };
}
export function underwater2() {
  return {
    ...common, id: 'underwater2', title: 'SUNKEN ATLANTIS', biome: 'underwater',
    terrain: {
      height: (x, y) => (inRect(x, y, R4(14, 26, 10, 18)) ? 30 : y < 5 * T || x < 4 * T ? 50 : 0),
      stairs: [{ ...R4(19.4, 20.6, 18, 18 + 1.5), dir: '-y', from: 0, to: 30 }],
      rivers: [{ pts: [[46 * T, 34 * T], [30 * T, 30 * T], [10 * T, 36 * T], [-6 * T, 33 * T]], width: 110, depth: 26 }],
    },
    paved: [R4(14.5, 25.5, 10.5, 17.5, { style: 'plaza' }), R4(19.4, 20.6, 19.5, 30, { style: 'road' })],
    buildings: [{ ...R4(17, 23, 10.8, 13.4), wallH: 70, floors: 2, roofH: 44, ridge: 'x', roof: GREENR, wall: 'stone', moss: true, door: { face: 'y', at: .5, wide: true }, windows: [.2, .8].map(at => ({ face: 'y', at })).concat([{ face: 'x', at: .5 }]) }],
    props: [14.8, 16.8, 23.2, 25.2].flatMap((x, i) => [{ type: 'pillar', x: x * T, y: 15 * T, h: [72, 52, 72, 44][i], broken: i % 2 === 1, seed: 40 + i, palette: 'MARBLE' }, { type: 'pillar', x: x * T, y: 16.8 * T, h: [48, 72, 60, 72][i], broken: i % 2 === 0, seed: 50 + i, palette: 'MARBLE' }]),
    spawn: P(20, 24), baseDensity: edgeDensity(20, 20, 14, .45), densNoise: .6, worn: .3,
  };
}

// ---------------- Asgard: floating islands over a sea of clouds ----------------
export function asgard1() {
  const island = (x, y) => blob(x, y, 20, 20, 13, 11, .25, 4) || blob(x, y, 33, 9, 4, 3.5, .2, 5);
  return {
    ...common, id: 'asgard1', title: 'BIFROST ISLE', biome: 'asgard',
    terrain: {
      height: (x, y) => (blob(x, y, 16, 15, 5, 4, .2, 6) ? 44 : 0),
      waterMask: (x, y) => !island(x, y), waterDepth: 70,
      stairs: [{ ...R4(21, 22.5, 14.4, 15.65), dir: '-x', from: 0, to: 44 }],
    },
    paved: [R4(22.5, 32, 14.4, 15.65, { style: 'road' }), R4(12.5, 19.5, 12.5, 17.5, { style: 'plaza' })],
    bridges: [R4(29, 33.4, 8.4, 9.6)],
    props: [{ type: 'altar', x: 15.2 * T, y: 14.4 * T, r: 60 }, ...[[13, 13], [18.6, 13], [13, 16.6], [18.6, 16.6]].map(([x, y], i) => ({ type: 'pillar', x: x * T, y: y * T, h: 86, seed: 60 + i, palette: 'MARBLE' }))],
    spawn: P(26, 22), baseDensity: edgeDensity(20, 20, 12, .5), densNoise: .6, worn: .2,
  };
}
export function asgard2() {
  const island = (x, y) => blob(x, y, 20, 20, 15, 13, .2, 8);
  return {
    ...common, id: 'asgard2', title: 'HALL OF VALOR', biome: 'asgard',
    terrain: {
      height: (x, y) => (inRect(x, y, R4(12, 28, 6, 15)) ? 36 : 0),
      waterMask: (x, y) => !island(x, y), waterDepth: 70,
      stairs: [{ ...R4(18.8, 21.2, 15, 16.5), dir: '-y', from: 0, to: 36 }],
    },
    paved: [R4(12.4, 27.6, 6.4, 14.8, { style: 'plaza' }), R4(18.8, 21.2, 16.5, 32, { style: 'road' })],
    buildings: [{ ...R4(15, 25, 6.8, 10.8), wallH: 84, floors: 2, roofH: 50, ridge: 'x', roof: GOLDLEAF, wall: 'stone', door: { face: 'y', at: .5, wide: true }, windows: [.15, .32, .68, .85].map(at => ({ face: 'y', at })).concat([.3, .7].map(at => ({ face: 'x', at }))), banner: true }],
    props: [13.2, 15.6, 24.4, 26.8].flatMap((x, i) => [{ type: 'pillar', x: x * T, y: 12.2 * T, h: 96, seed: 70 + i, palette: 'MARBLE' }, { type: 'pillar', x: x * T, y: 14 * T, h: 96, seed: 80 + i, palette: 'MARBLE' }]),
    lanterns: [P(18.4, 17), P(21.6, 17), P(18.4, 22), P(21.6, 22)],
    spawn: P(20, 26), baseDensity: edgeDensity(20, 20, 13, .55), densNoise: .5, worn: .2,
  };
}

// ---------------- Royal capital: a real city ----------------
export function city() {
  const roofs = [RED, SLATE, ORANGE, GREENR, RED, SLATE];
  const buildings = [], lanterns = [], trees = [];
  const streetsX = [6, 13, 27, 34], streetsY = [6, 13, 27, 34]; // street centre lines (tiles)
  const blocks = [];
  for (let i = 0; i < streetsX.length - 1; i++) for (let j = 0; j < streetsY.length - 1; j++) blocks.push([streetsX[i] + .9, streetsX[i + 1] - .9, streetsY[j] + .9, streetsY[j + 1] - .9]);
  let n = 0;
  for (const [x0, x1, y0, y1] of blocks) {
    if (x0 < 20 && x1 > 20 && y0 < 20 && y1 > 20) continue; // central square
    // a row of townhouses along the block's south street (+y side), another along its east street
    for (let x = x0 + .2; x + 2.6 <= x1; x += 3.1) {
      const w = 2.6, floors = 2 + (n % 3 === 0 ? 1 : 0);
      buildings.push({ ...R4(x, x + w, y1 - 2.6, y1), wallH: 44 + floors * 16, floors, roofH: 34, ridge: 'x', roof: roofs[n++ % roofs.length], wall: n % 4 === 0 ? 'stone' : 'timber',
        door: { face: 'y', at: .35 + (n % 2) * .3 }, windows: [{ face: 'y', at: .2 }, { face: 'y', at: .8 }, { face: 'x', at: .5 }], chimney: n % 2 === 0, flowers: n % 3 === 1 });
    }
    for (let y = y0 + .2; y + 2.4 <= y1 - 3; y += 2.9) {
      const floors = 2;
      buildings.push({ ...R4(x1 - 2.6, x1, y, y + 2.4), wallH: 76, floors, roofH: 32, ridge: 'y', roof: roofs[n++ % roofs.length], wall: n % 3 === 0 ? 'wood' : 'timber',
        door: { face: 'x', at: .5 }, windows: [{ face: 'x', at: .2 }, { face: 'x', at: .8 }], chimney: n % 3 === 0 });
    }
    trees.push(P((x0 + x1) / 2 - 1.5, (y0 + y1) / 2 - 1.2));
  }
  for (const s of streetsX) for (const t of [9.5, 16.5, 23.5, 30.5]) lanterns.push(P(s + .75, t));
  const canal = (x, y) => x > 19.4 * T && x < 20.6 * T && !(y > 17 * T && y < 23 * T);
  return {
    ...common, id: 'city', title: 'ROYAL CAPITAL', biome: 'city', renderScale: 1.45,
    terrain: { height: () => 0, waterMask: canal, waterDepth: 14 },
    paved: [
      ...streetsX.map(s => R4(s - .6, s + .6, 4, 36, { style: 'road' })), ...streetsY.map(s => R4(4, 36, s - .6, s + .6, { style: 'road' })),
      R4(15, 25, 16, 24, { style: 'plaza' }), R4(4, 36, 19.4, 20.6, { style: 'road' }),
    ],
    bridges: streetsY.map(s => R4(19, 21, s - .7, s + .7)),
    buildings: [...buildings, { ...R4(16.4, 23.6, 16.4, 19.2), wallH: 90, floors: 3, roofH: 52, ridge: 'x', roof: SLATE, wall: 'stone', door: { face: 'y', at: .5, wide: true },
      windows: [.15, .3, .7, .85].map(at => ({ face: 'y', at })).concat([.3, .7].map(at => ({ face: 'x', at }))), tower: { w: 58, h: 64, roof: RED }, banner: true }],
    fountain: P(20, 22), trees, lanterns,
    wall: { rect: R4(2.5, 37.5, 2.5, 37.5), th: 20, h: 40, gaps: { west: [19 * T, 21 * T], south: [19 * T, 21 * T], east: [19 * T, 21 * T] } },
    portals: [{ ...P(39, 20), col: [120, 200, 255] }],
    spawn: P(18, 25.2), baseDensity: (x, y) => smooth(.95, 1.1, Math.max(Math.abs(x - 20 * T), Math.abs(y - 20 * T)) / (17.5 * T)), densNoise: .4,
    worn: .25, treePathClear: 60, canopyClear: 96, townLawn: R4(2.5, 37.5, 2.5, 37.5),
  };
}
