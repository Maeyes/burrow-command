// Waterfall Valley: three terrain levels, a river that falls twice, a bridge, and two stairways.
// This is the reference scene for the terrain system (heights, stairs, rivers, bridges).
import { T, smooth, vnoise, inRect } from '../engine/util.js';
import { SLATE } from '../engine/palettes.js';

const R4 = (x0, x1, y0, y1, extra = {}) => ({ x0: x0 * T, x1: x1 * T, y0: y0 * T, y1: y1 * T, ...extra });
const P = (x, y, extra = {}) => ({ x: x * T, y: y * T, ...extra });

export default function valleyScene() {
  const L1 = 44, L2 = 88;
  const stairs = [
    { ...R4(16, 16 + 1.5, 21, 22.25), dir: '-x', from: 0, to: L1 },     // lowland -> middle terrace (climb west)
    { ...R4(10, 11.25, 8, 8 + 1.75), dir: '-y', from: L1, to: L2 },      // middle terrace -> highland (climb north)
  ];
  // keep terrace edges straight near stairways, slightly ragged elsewhere
  const calm = (x, y) => Math.min(1, ...stairs.map(s => Math.max(0, Math.hypot(Math.max(s.x0 - x, 0, x - s.x1), Math.max(s.y0 - y, 0, y - s.y1)) - 1.5 * T) / (2.5 * T)));
  const height = (x, y) => {
    const j = (vnoise(x * .012, y * .012) - .5) * 44 * calm(x, y);
    if ((y < 8 * T + j && x < 32 * T) || (x < 6 * T + j && y < 18 * T)) return L2;
    if (y < 15 * T + j || (x < 16 * T + j && y < 31 * T)) return L1;
    return 0;
  };
  const hut = R4(29, 32.5, 16.6, 19.4);
  return {
    id: 'valley', title: 'WATERFALL VALLEY',
    terrain: {
      height,
      stairs,
      rivers: [{ pts: [[26 * T, -8 * T], [26 * T, 4 * T], [25.2 * T, 11 * T], [23.6 * T, 17 * T], [25.8 * T, 22 * T], [24.2 * T, 28 * T], [27 * T, 34 * T], [27.5 * T, 46 * T]], width: [70, 118], depth: 12 }],
    },
    paved: [
      R4(17.5, 40, 21, 22.25, { style: 'road' }),       // lowland road over the bridge
      R4(10, 16, 21, 22.25, { style: 'road' }),         // middle terrace
      R4(10, 11.25, 9.75, 22.25, { style: 'road' }),    // up to the highland stairs
      R4(8.6, 14.4, 3.2, 8, { style: 'plaza' }),        // shrine courtyard on the highland
    ],
    bridges: [R4(24.1, 27.2, 20.85, 22.4)],
    buildings: [{ ...hut, wallH: 50, roofH: 40, ridge: 'x', roof: SLATE, wall: 'timber', moss: true, chimney: true, door: { face: 'y', at: .5 }, windows: [{ face: 'x', at: .5 }, { face: 'y', at: .18 }], flowers: true }],
    plots: [R4(30.5, 36, 24.6, 29.4, { gate: 'x0' })],
    camps: [P(13, 26.2)],
    logs: [{ x: 13 * T - 70, y: 26.2 * T - 30, w: 56, d: 16, h: 11 }],
    yards: [{ x0: hut.x0 - 10, x1: hut.x1 + 40, y0: hut.y1, y1: hut.y1 + 60 }],
    crates: [{ x: hut.x1 + 8, y: hut.y0 + 10, w: 22, d: 22, h: 18 }, { x: hut.x1 + 8, y: hut.y0 + 38, w: 20, d: 20, h: 16 }],
    barrels: [P(33, 19.9)],
    props: [
      { type: 'altar', x: 10.9 * T, y: 5 * T, r: 60 },
      { type: 'pillar', x: 9.3 * T, y: 3.6 * T, h: 64, broken: true, seed: 3 },
      { type: 'pillar', x: 13.3 * T, y: 3.6 * T, h: 70, seed: 4 },
      { type: 'pillar', x: 9.3 * T, y: 6.9 * T, h: 70, seed: 5 },
      { type: 'pillar', x: 13.3 * T, y: 6.9 * T, h: 52, broken: true, seed: 6 },
      { type: 'rubble', x: 14.2 * T, y: 7.6 * T, seed: 2, r: 16 },
      { type: 'rubble', x: 8.8 * T, y: 5.4 * T, seed: 4, r: 16 },
    ],
    lanterns: [P(19, 20.7), P(28.2, 22.6), P(34, 20.7), P(24.3, 20.6), P(27, 22.65), P(15.6, 20.7), P(11.6, 12.4), P(11.6, 18.6), P(12.2, 8.2)],
    trees: [P(4.5, 3, { pine: true }), P(16, 2.5, { pine: true }), P(21, 5.2), P(30.5, 3.5, { pine: true })],
    portals: [{ ...P(37.6, 21.6), col: [120, 200, 255], label: 'Greenfield' }],
    spawn: P(20.5, 23.4),
    baseDensity: (x, y) => smooth(.45, .95, Math.hypot((x - 25 * T) / (14 * T), (y - 24 * T) / (14 * T))),
    densNoise: .7,
    highDensity: .12,
    worn: 1,
    canopyClear: 48,
  };
}
