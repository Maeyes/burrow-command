// Bunny Haven: walled town with plaza, fountain, town hall, shops, market and warp portals.
import { T, smooth, inRect } from '../engine/util.js';
import { SLATE, RED, GREENR, ORANGE } from '../engine/palettes.js';

const R4 = (x0, x1, y0, y1, extra = {}) => ({ x0: x0 * T, x1: x1 * T, y0: y0 * T, y1: y1 * T, ...extra });
const P = (x, y, extra = {}) => ({ x: x * T, y: y * T, ...extra });

export default function townScene() {
  const WL = R4(5, 35, 5, 35);
  const gaps = { west: [18.4 * T, 21.6 * T], south: [18.4 * T, 21.6 * T], east: [18.4 * T, 21.6 * T] };
  const plateaus = [R4(-9, 30, -9, 2.4), R4(-9, 2.4, -9, 30)];
  return {
    id: 'town', title: 'BUNNY HAVEN',
    terrain: { height: (x, y) => (plateaus.some(p => inRect(x, y, p)) ? 56 : 0) },
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
    yards: [R4(8, 12, 11.2, 12.2), R4(26, 29.2, 11.6, 12.6), R4(8.4, 12, 26, 27), R4(25.6, 29.1, 28.6, 29.6)],
    crates: [
      { x: 30.1 * T, y: 15.6 * T, w: 22, d: 22, h: 18 }, { x: 30.1 * T, y: 15.6 * T + 26, w: 22, d: 22, h: 18 },
      { x: 13.9 * T, y: 14.7 * T, w: 20, d: 20, h: 16 },
    ],
    barrels: [P(30.55, 16.9), P(30.45, 17.4), P(13.95, 18.35), P(29.3, 28.8)],
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
