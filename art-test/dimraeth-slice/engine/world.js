// Places everything that is not terrain: buildings, props, trees, scatter. All placement is
// terrain-aware: z comes from the height grid, and the rules in blocked() keep cliffs, rivers,
// roads and facades readable.
import { K, T, S, hash2, fbm, rng, inRect, isoX, isoY } from './util.js';
import * as SP from './sprites.js';
import { LIB } from './sprites.js';
import * as P from './palettes.js';
import { WS } from './state.js';
import { MAT, GROUND, pavedAt, pathDist, forestDensity } from './terrain.js';
import { biomeOf } from './biomes.js';
const pick = (lib, r) => lib[Math.floor(r() * lib.length)];

const boxOfItem = c => ({ x0: c.x, x1: c.x + c.w, y0: c.y, y1: c.y + c.d });
const H = (x, y) => WS.terrain.heightAt(x, y);
const matAt = (x, y) => WS.terrain.matAt(x, y);

function nearWall(x, y, m) {
  const wl = WS.scene.wall; if (!wl) return false;
  const r = wl.rect, t = wl.th / 2 + m;
  const onX = (Math.abs(y - r.y0) < t || Math.abs(y - r.y1) < t) && x > r.x0 - t && x < r.x1 + t;
  const onY = (Math.abs(x - r.x0) < t || Math.abs(x - r.x1) < t) && y > r.y0 - t && y < r.y1 + t;
  return onX || onY;
}
// Is (x,y) a bad spot for a prop of radius m? `tree` adds the canopy rules.
export function blocked(x, y, m, tree = false) {
  const SC = WS.scene;
  const h0 = H(x, y);
  // must stand on flat, dry, non-stair ground
  for (const [dx, dy] of [[0, 0], [m * .6 + 6, 0], [-m * .6 - 6, 0], [0, m * .6 + 6], [0, -m * .6 - 6]]) {
    if (matAt(x + dx, y + dy) !== MAT.GROUND || Math.abs(H(x + dx, y + dy) - h0) > 2) return true;
  }
  if (pathDist(x, y) < (tree && SC.treePathClear ? SC.treePathClear : m + 6)) return true;
  if ((SC.buildings || []).some(b => inRect(x, y, b, m + 30))) return true;
  if ((SC.plots || []).some(p => inRect(x, y, p, m + 18))) return true;
  if ((SC.camps || []).some(c => Math.hypot(x - c.x, y - c.y) < 110 + m)) return true;
  if (Math.hypot(x - SC.spawn.x, y - SC.spawn.y) < 50 + m) return true;
  if ((SC.lanterns || []).some(l => Math.hypot(x - l.x, y - l.y) < 18 + m)) return true;
  if ([...(SC.crates || []), ...(SC.benches || []), ...(SC.logs || [])].some(c => inRect(x, y, boxOfItem(c), m))) return true;
  if ((SC.barrels || []).some(b => Math.hypot(x - b.x, y - b.y) < 14 + m)) return true;
  if ((SC.stalls || []).some(s => inRect(x, y, { x0: s.x - 8, x1: s.x + 52, y0: s.y - 8, y1: s.y + 32 }, m))) return true;
  if ((SC.trees || []).some(t => Math.hypot(x - t.x, y - t.y) < 30 + m)) return true;
  if ((SC.portals || []).some(p => Math.hypot(x - p.x, y - p.y) < 90 + m * 2)) return true;
  if ((SC.props || []).some(p => Math.hypot(x - p.x, y - p.y) < (p.r || 30) + m)) return true;
  if (WS.bridges.some(b => inRect(x, y, b, m + 20))) return true;
  if (SC.fountain && Math.hypot(x - SC.fountain.x, y - SC.fountain.y) < 90 + m) return true;
  if (nearWall(x, y, m + 10)) return true;
  if (tree) {
    // keep the rim of a terrace clear so the edge reads
    if (H(x + 34, y) < h0 - 12 || H(x, y + 34) < h0 - 12) return true;
    // a crown covers the screen column above its base = world points (x-2h, y-2h).
    // Don't let it hide cliff faces, waterfalls, roads, portals or facades behind it.
    for (let hh = 0; hh <= 96; hh += 12) {
      const cx = x - 2 * hh, cy = y - 2 * hh, ch = H(cx, cy);
      if (ch > h0 + 12 || matAt(cx, cy) === MAT.WATER && ch < h0 - 20) return true;
      if (!SC.canopyClear || hh > SC.canopyClear) continue;
      if (pavedAt(cx, cy).d > -12) return true;
      if ((SC.portals || []).some(p => Math.hypot(cx - p.x, cy - p.y) < 70)) return true;
      if ((SC.buildings || []).some(b => inRect(cx, cy, b, 10))) return true;
    }
  }
  return false;
}

function addSprite(spr, x, y, z, opt = {}) {
  if (spr.glow) WS.lights.push({ x, y, z: z + 14, r: 70 + spr.img.width / K * .6, col: spr.glow, a: .55, flick: true, glow: true });
  const b = opt.box ?? 8;
  WS.objects.push({ kind: 'sprite', img: spr.img, ox: spr.ox, oy: spr.oy, visualScale: opt.visualScale ?? 1, x, y, z, fade: !!opt.fade, box: { x0: x - b, x1: x + b, y0: y - b, y1: y + b } });
}
function addBoxed(spr, x, y, z, box, extra = {}) {
  WS.objects.push({ kind: 'sprite', img: spr.img, ox: spr.ox, oy: spr.oy, visualScale: extra.visualScale ?? 1, x, y, z, box, ...extra });
}
function placeTree(spr, x, y, z, slim) {
  addSprite(spr, x, y, z, { fade: true, box: 12 });
  // Dense forest scenes need visual canopy density without turning adjacent trunks into
  // invisible walls. Keep only a small trunk-sized physical footprint there.
  const denseForest=WS.scene?.gameplay?.mapId==='forest1';
  WS.colliders.push({ type: 'c', x, y, r: denseForest ? (slim?7:9) : (slim?12:16), debugKind:'tree' });
  const cr = spr.canopyR / K; // shadows are in design px
  WS.shadows.push({ x, y, z, dx: cr * .75, dy: cr * .22, rx: cr * 1.05, ry: cr * .5 });
}

// Screen-space scatter: sample the visible surface under a jittered screen grid, so density is
// even on screen whatever the terrain height.
function scatter(stepX, stepY, seed, fn) {
  stepX *= K; stepY *= K; // spacing is in design px, so density doesn't change with render scale
  const r = rng(seed), T0 = WS.terrain;
  for (let sy = GROUND.y0; sy < GROUND.y1 + 170; sy += stepY) for (let sx = GROUND.x0 - 80; sx < GROUND.x1 + 80; sx += stepX) {
    const hit = T0.pick(sx + (r() - .5) * stepX * .9, sy + (r() - .5) * stepY * .9);
    if (hit.face || hit.idx < 0 || T0.M[hit.idx] !== MAT.GROUND) { r(); r(); r(); continue; }
    fn(hit.x, hit.y, hit.z, r);
  }
}

export function placeScatter() {
  const SC = WS.scene;
  const treeScatter = SC.scatter?.trees ?? 1;
  const treeStep = SC.scatter?.treeStep ?? 30;
  const treeStepY = SC.scatter?.treeStepY ?? 26;
  scatter(treeStep, treeStepY, 4242, (x, y, z, r) => {
    const dens = forestDensity(x, y);
    if (r() > Math.pow(dens, 1.6) * .62 * treeScatter * (biomeOf(SC).treeDensity ?? 1)) return;
    if (blocked(x, y, 44, true)) return;
    const pineZone = fbm(x * .003 + 90, y * .003) > .52, roll = r();
    const kit = biomeOf(SC), acc = kit.trees.accent;
    const spr = pineZone ? pick(LIB[kit.trees.b], r)
      : roll < .1 ? pick(LIB[acc[Math.floor(roll * 10 * acc.length) % acc.length]], r)
      : pick(LIB[kit.trees.a], r);
    placeTree(spr, x, y, z, pineZone);
  });
  const undergrowthScatter=SC.scatter?.undergrowth??1;
  const bushStep=SC.scatter?.bushStep??22,bushStepY=SC.scatter?.bushStepY??18;
  scatter(bushStep, bushStepY, 4343, (x, y, z, r) => {
    const dens = forestDensity(x, y), roll = r();
    if (SC.bareByDefault && dens <= 0) return; // editor maps: only what was painted
    const nearWater = WS.terrain.matAt(x + 40, y) === MAT.WATER || WS.terrain.matAt(x, y + 40) === MAT.WATER || WS.terrain.matAt(x - 40, y) === MAT.WATER || WS.terrain.matAt(x, y - 40) === MAT.WATER;
    if (roll < (.1 + dens * .22) * undergrowthScatter) {
      if (blocked(x, y, 16)) return;
      const kit = biomeOf(SC), lib = r() < .18 ? LIB[kit.flowerBush] : LIB[kit.bush];
      const spr = lib[Math.floor(r() * lib.length)];
      addSprite(spr, x, y, z, { box: 8 });
      WS.shadows.push({ x, y, z, dx: 6, dy: 1, rx: spr.img.width / K * .45, ry: spr.img.width / K * .2 });
    } else if (roll > (nearWater ? .93 : .985)) {
      if (blocked(x, y, 14)) return;
      const spr = pick(LIB[biomeOf(SC).rock], r);
      addSprite(spr, x, y, z, { box: 10 });
      if (spr.img.width / K > 26) WS.colliders.push({ type: 'c', x, y, r: spr.img.width / K * .45 });
      WS.shadows.push({ x, y, z, dx: 5, dy: 2, rx: spr.img.width / K * .5, ry: spr.img.width / K * .2 });
    }
  });
  scatter(9, 7, 4444, (x, y, z, r) => {
    const dens = forestDensity(x, y), lush = fbm(x * .006 + 3, y * .006 + 5);
    const T0 = WS.terrain;
    const bank = T0.matAt(x + 14, y) === MAT.WATER || T0.matAt(x, y + 14) === MAT.WATER || T0.matAt(x - 14, y) === MAT.WATER || T0.matAt(x, y - 14) === MAT.WATER;
    if (bank && r() < .35) { { const rd = pick(LIB[biomeOf(SC).reed], r); WS.baked.push({ img: rd, x, y, z, ox: rd.ox, oy: rd.oy }); } return; }
    if (r() > .12 + lush * .5 + dens * .15) return;
    if (pavedAt(x, y).d > -14 || (SC.plots || []).some(p => inRect(x, y, p, 4)) || (SC.buildings || []).some(b => inRect(x, y, b, 6))) return;
    if ((SC.camps || []).some(c => Math.hypot(x - c.x, y - c.y) < 60) || nearWall(x, y, 2)) return;
    if (SC.fountain && Math.hypot(x - SC.fountain.x, y - SC.fountain.y) < 90) return;
    if (T0.matAt(x + 8, y) !== MAT.GROUND || T0.matAt(x, y + 8) !== MAT.GROUND) return;
    const kit = biomeOf(SC), lib = dens > .55 ? LIB[kit.tuftDark] : LIB[kit.tuft];
    { const tf = lib[Math.floor(r() * lib.length)]; WS.baked.push({ img: tf, x, y, z, ox: tf.ox, oy: tf.oy }); }
  });
  // lily pads on calm water
  const T0 = WS.terrain, lr = rng(515);
  for (let n = 0; n < 900; n++) {
    const x = -200 + lr() * 3000, y = -200 + lr() * 3000, k = T0.cellIdx(x, y);
    if (k < 0 || T0.M[k] !== MAT.WATER || T0.wdist[k] < 1 || T0.wdist[k] > 2 || T0.foam[k]) continue;
    if (fbm(x * .01, y * .01 + 9) < .55) continue;
    const l = LIB.lily[Math.floor(lr() * 3)];
    WS.baked.push({ img: l.img, x, y, z: T0.Hh[k], ox: l.ox, oy: l.oy - 3, scale: .8 });
  }
}

export function placeStructures() {
  const SC = WS.scene;
  for (const b of SC.buildings || []) {
    const s = SP.buildingSprite(b), z = H((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    addBoxed(s, b.x0, b.y0, z, { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
    WS.colliders.push({ type: 'b', x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 });
    WS.rectShadows.push({ x0: b.x1, x1: b.x1 + (b.wallH + b.roofH) * .75 + (b.tower ? 60 : 0), y0: b.y0, y1: b.y1 + 14, k: .62 });
    WS.rectShadows.push({ x0: b.x0 - 8, x1: b.x1 + 8, y0: b.y1, y1: b.y1 + 8, k: .8 });
    if (s.chimneyTop) WS.chimneys.push({ x: b.x0 + s.chimneyTop[0], y: b.y0 + s.chimneyTop[1], z: z + s.chimneyTop[2] });
    if (s.flagAt) WS.objects[WS.objects.length - 1].flagAt = { x: b.x0 + s.flagAt[0], y: b.y0 + s.flagAt[1], z: z + s.flagAt[2] };
    const Wx = b.x1 - b.x0, Wy = b.y1 - b.y0, floors = b.floors || 1, floorH = (b.wallH - 8) / floors;
    for (const w of b.windows || []) for (let f = 0; f < floors; f++) {
      const wz = z + 8 + f * floorH + floorH * .5;
      if (w.face === 'y') WS.lights.push({ x: b.x0 + w.at * Wx, y: b.y1 + 8, z: wz, r: 55, col: [255, 190, 110], a: .5, dusk: true });
      else WS.lights.push({ x: b.x1 + 8, y: b.y0 + w.at * Wy, z: wz, r: 55, col: [255, 190, 110], a: .5, dusk: true });
    }
  }
  (SC.crates || []).forEach((c, i) => {
    const z = H(c.x + c.w / 2, c.y + c.d / 2);
    addBoxed(SP.boxSprite(c.w, c.d, c.h, 900 + i), c.x, c.y, z, boxOfItem(c));
    WS.colliders.push({ type: 'b', ...boxOfItem(c) });
    WS.shadows.push({ x: c.x + c.w / 2, y: c.y + c.d / 2, z, dx: 10, dy: 3, rx: 16, ry: 7 });
  });
  (SC.logs || []).forEach((l, i) => { addBoxed(SP.logSprite(l.w, l.d, l.h, 700 + i), l.x, l.y, H(l.x, l.y), boxOfItem(l)); WS.colliders.push({ type: 'b', ...boxOfItem(l) }); });
  (SC.benches || []).forEach(bn => {
    const z = H(bn.x, bn.y);
    addBoxed(SP.benchSprite(bn.w, bn.d, bn.h), bn.x, bn.y, z, boxOfItem(bn));
    WS.colliders.push({ type: 'b', ...boxOfItem(bn) });
    WS.shadows.push({ x: bn.x + bn.w / 2, y: bn.y + bn.d / 2, z, dx: 6, dy: 2, rx: 18, ry: 6 });
  });
  const barrel = SP.barrelSprite();
  (SC.barrels || []).forEach(b => {
    const z = H(b.x, b.y);
    addBoxed(barrel, b.x, b.y, z, { x0: b.x - 11, x1: b.x + 11, y0: b.y - 11, y1: b.y + 11 });
    WS.colliders.push({ type: 'c', x: b.x, y: b.y, r: 11 });
    WS.shadows.push({ x: b.x, y: b.y, z, dx: 6, dy: 2, rx: 10, ry: 5 });
  });
  // hand-placed props: ruined pillars, altars
  for (const p of SC.props || []) {
    const z = H(p.x, p.y);
    let s, box;
    if (p.type === 'pillar') { s = SP.pillarSprite(p.seed || 1, 20, p.h || 60, p.broken, p.palette ? P[p.palette] : undefined); box = { x0: p.x - 4, x1: p.x + 24, y0: p.y - 4, y1: p.y + 24 }; WS.colliders.push({ type: 'b', ...box }); }
    else if (p.type === 'altar') { s = SP.altarSprite(); box = { x0: p.x - 8, x1: p.x + 64, y0: p.y - 8, y1: p.y + 44 }; WS.colliders.push({ type: 'b', ...box }); WS.lights.push({ x: p.x + 28, y: p.y + 18, z: z + 22, r: 90, col: [120, 220, 255], a: .6, flick: true }); }
    else if (p.type === 'bush' || p.type === 'rock') {
      const kit = biomeOf(SC), lib = LIB[p.type === 'bush' ? kit.bush : kit.rock] || LIB[p.type];
      const spr = lib[(p.seed || 0) % lib.length]; addSprite(spr, p.x, p.y, z, { box: 8 });
      WS.shadows.push({ x: p.x, y: p.y, z, dx: 6, dy: 2, rx: spr.img.width / K * .45, ry: spr.img.width / K * .2 });
      if (p.type === 'rock' && spr.img.width / K > 26) WS.colliders.push({ type: 'c', x: p.x, y: p.y, r: spr.img.width / K * .45 });
      continue;
    }
    else if (p.type === 'rubble') { const spr = LIB.rock[(p.seed || 0) % LIB.rock.length]; addSprite(spr, p.x, p.y, z, { box: 8 }); continue; }
    addBoxed(s, p.x, p.y, z, box);
    WS.shadows.push({ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, z, dx: 14, dy: 4, rx: (box.x1 - box.x0) * .6, ry: 8 });
  }
  // explicit trees (avenues, planters, landmarks)
  const tr = rng(99);
  for (const t of SC.trees || []) {
    const z = H(t.x, t.y);
    if (t.planter) {
      const pl = SP.planterSprite();
      addBoxed(pl, t.x - 22, t.y - 22, z, { x0: t.x - 22, x1: t.x + 22, y0: t.y - 22, y1: t.y + 22 });
      WS.colliders.push({ type: 'b', x0: t.x - 22, x1: t.x + 22, y0: t.y - 22, y1: t.y + 22 });
      const spr = LIB.blossom[0];
      WS.objects.push({ kind: 'sprite', img: spr.img, ox: spr.ox, oy: spr.oy + Math.round(12 * K), x: t.x + 1, y: t.y + 1, z, fade: true, box: { x0: t.x - 20, x1: t.x + 23, y0: t.y - 20, y1: t.y + 23 } });
      { const cr = spr.canopyR / K; WS.shadows.push({ x: t.x, y: t.y, z, dx: cr * .75, dy: cr * .22, rx: cr * 1.05, ry: cr * .5 }); }
      continue;
    }
    const roll = tr();
    if (t.kind && LIB[t.kind]) { placeTree(LIB[t.kind][Math.floor(tr() * LIB[t.kind].length)], t.x, t.y, z, true); continue; }
    const spr = t.pine ? LIB.pine[Math.floor(tr() * LIB.pine.length)] : roll < .12 ? LIB.autumn[Math.floor(tr() * LIB.autumn.length)] : roll < .24 ? LIB.blossom[Math.floor(tr() * LIB.blossom.length)] : LIB.broad[Math.floor(tr() * 4)];
    placeTree(spr, t.x, t.y, z, !!t.pine);
  }
  if (SC.fountain) {
    const f = SC.fountain, s = SP.fountainSprite(), z = H(f.x, f.y);
    addBoxed(s, f.x, f.y, z, { x0: f.x - 84, x1: f.x + 84, y0: f.y - 84, y1: f.y + 84 });
    WS.colliders.push({ type: 'c', x: f.x, y: f.y, r: 86 });
    WS.shadows.push({ x: f.x, y: f.y, z, dx: 16, dy: 5, rx: 66, ry: 28 });
  }
  for (const st of SC.stalls || []) {
    addBoxed(SP.stallSprite(st), st.x, st.y, H(st.x, st.y), { x0: st.x - 4, x1: st.x + 56, y0: st.y - 4, y1: st.y + 30 });
    WS.colliders.push({ type: 'b', x0: st.x, x1: st.x + 52, y0: st.y, y1: st.y + 26 });
    WS.rectShadows.push({ x0: st.x - 4, x1: st.x + 90, y0: st.y - 4, y1: st.y + 36, k: .72 });
  }
  if (SC.wall) placeWalls(SC.wall);
  for (const p of SC.portals || []) {
    const z = H(p.x, p.y);
    WS.objects.push({ kind: 'portal', x: p.x, y: p.y, z, col: p.col, box: { x0: p.x - 40, x1: p.x + 40, y0: p.y - 40, y1: p.y + 40 }, flat: true });
    WS.lights.push({ x: p.x, y: p.y, z: z + 6, r: 120, col: p.col, a: .7, flick: true });
  }
  // bridges: walkable deck + railings (railings are fence runs at deck height)
  for (const b of SC.bridges || []) {
    const alongY = b.axis === 'y' || (b.axis !== 'x' && b.y1 - b.y0 > b.x1 - b.x0);
    const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    const bankZ = alongY ? Math.max(H(mx, b.y0 - 8), H(mx, b.y1 + 8)) : Math.max(H(b.x0 - 8, my), H(b.x1 + 8, my));
    const deck = { ...b, z: bankZ + 5 };
    WS.bridges.push(deck);
    let waterZ = bankZ;
    if (alongY) for (let y = b.y0; y < b.y1; y += 8) waterZ = Math.min(waterZ, H(mx, y));
    else for (let x = b.x0; x < b.x1; x += 8) waterZ = Math.min(waterZ, H(x, my));
    const s = SP.bridgeSprite(b.x1 - b.x0, b.y1 - b.y0, deck.z, waterZ, alongY);
    addBoxed(s, b.x0, b.y0, 0, { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }, { flat: true, deck: true });
    if (alongY) { fenceRun(b.x0 + 3, b.y0, b.x0 + 3, b.y1, null, deck.z, false); fenceRun(b.x1 - 3, b.y0, b.x1 - 3, b.y1, null, deck.z, false); }
    else { fenceRun(b.x0, b.y0 + 3, b.x1, b.y0 + 3, null, deck.z, false); fenceRun(b.x0, b.y1 - 3, b.x1, b.y1 - 3, null, deck.z, false); }
    WS.shadows.push({ x: mx, y: b.y1, z: waterZ, dx: 10, dy: 6, rx: Math.max(b.x1 - b.x0, b.y1 - b.y0) * .4, ry: 10 });
  }
  for (const plot of SC.plots || []) {
    const gateMid = plot.gate === 'x0' ? (plot.y0 + plot.y1) / 2 : (plot.x0 + plot.x1) / 2;
    const gate = (x, y) => Math.abs((plot.gate === 'x0' ? y : x) - gateMid) < 40;
    const z = H((plot.x0 + plot.x1) / 2, (plot.y0 + plot.y1) / 2);
    fenceRun(plot.x0, plot.y0, plot.x1, plot.y0, null, z);
    fenceRun(plot.x0, plot.y0, plot.x0, plot.y1, plot.gate === 'x0' ? gate : null, z);
    fenceRun(plot.x1, plot.y0, plot.x1, plot.y1, null, z);
    fenceRun(plot.x0, plot.y1, plot.x1, plot.y1, plot.gate === 'y1' ? gate : null, z);
    for (let yy = plot.y0 + 22; yy < plot.y1 - 10; yy += 52) for (let xx = plot.x0 + 24; xx < plot.x1 - 14; xx += 30) {
      const c = LIB.crop[Math.floor(hash2(xx, yy) * 4)];
      WS.baked.push({ img: c.img, x: xx, y: yy + 6, z, ox: c.ox, oy: c.oy });
    }
  }
  for (const l of SC.lanterns || []) {
    const z = H(l.x, l.y);
    WS.objects.push({ kind: 'lantern', x: l.x, y: l.y, z, box: { x0: l.x - 4, x1: l.x + 4, y0: l.y - 4, y1: l.y + 4 } });
    WS.colliders.push({ type: 'c', x: l.x, y: l.y, r: 8 });
    WS.lights.push({ x: l.x, y: l.y, z: z + 30, r: 95, col: [255, 196, 120], a: .6, flick: true });
    WS.shadows.push({ x: l.x, y: l.y, z, dx: 8, dy: 3, rx: 7, ry: 3 });
  }
  for (const camp of SC.camps || []) {
    const z = H(camp.x, camp.y);
    WS.objects.push({ kind: 'fire', x: camp.x, y: camp.y, z, box: { x0: camp.x - 16, x1: camp.x + 16, y0: camp.y - 16, y1: camp.y + 16 } });
    WS.colliders.push({ type: 'c', x: camp.x, y: camp.y, r: 26 });
    WS.lights.push({ x: camp.x, y: camp.y, z: z + 10, r: 210, col: [255, 150, 60], a: .85, flick: true, fire: true });
    const stone = LIB.rock[0];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      WS.baked.push({ img: stone.img, x: camp.x + Math.cos(a) * 26, y: camp.y + Math.sin(a) * 26, z, ox: stone.ox, oy: stone.oy, scale: .5 });
    }
  }
}

export function fenceRun(ax, ay, bx, by, skip, z = 0, collide = true) {
  const STEP = 34, len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / STEP));
  for (let i = 0; i < n; i++) {
    const x0 = ax + (bx - ax) * i / n, y0 = ay + (by - ay) * i / n, x1 = ax + (bx - ax) * (i + 1) / n, y1 = ay + (by - ay) * (i + 1) / n;
    if (skip && skip((x0 + x1) / 2, (y0 + y1) / 2)) { addPost(x0, y0, z); continue; }
    const box = { x0: Math.min(x0, x1) - 3, x1: Math.max(x0, x1) + 3, y0: Math.min(y0, y1) - 3, y1: Math.max(y0, y1) + 3 };
    WS.objects.push({ kind: 'fence', x: x0, y: y0, x1, y1, z, box });
    if (collide) WS.colliders.push({ type: 'b', ...box });
  }
  addPost(bx, by, z);
}
function addPost(x, y, z) {
  WS.objects.push({ kind: 'fence', x, y, x1: x, y1: y, z, box: { x0: x - 3, x1: x + 3, y0: y - 3, y1: y + 3 } });
}
function placeWalls(wl) {
  const r = wl.rect, th = wl.th, h = wl.h, SEG = 32, TW = 40;
  const segX = SP.wallSegSprite(SEG, th, h, true), segY = SP.wallSegSprite(SEG, th, h, false);
  const tower = SP.towerSprite(TW, 66, P.SLATE), gateTower = SP.towerSprite(TW, 74, P.RED);
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
      const box = alongX ? { x0: x, x1: x + SEG, y0: y, y1: y + th } : { x0: x, x1: x + th, y0: y, y1: y + SEG };
      addBoxed(alongX ? segX : segY, x, y, H(x, y), box);
      WS.colliders.push({ type: 'b', ...box });
      if (!alongX) WS.rectShadows.push({ x0: box.x1, x1: box.x1 + h * 1.3, y0: box.y0, y1: box.y1, k: .66 });
      else WS.rectShadows.push({ x0: box.x0, x1: box.x1, y0: box.y1, y1: box.y1 + 12, k: .78 });
    }
  }
  for (const [tx, ty, spr] of towers) {
    const x = tx - TW / 2, y = ty - TW / 2, box = { x0: x, x1: x + TW, y0: y, y1: y + TW };
    addBoxed(spr, x, y, H(tx, ty), box);
    WS.colliders.push({ type: 'b', ...box });
    WS.rectShadows.push({ x0: box.x1, x1: box.x1 + 110, y0: box.y0, y1: box.y1 + 10, k: .62 });
  }
}
