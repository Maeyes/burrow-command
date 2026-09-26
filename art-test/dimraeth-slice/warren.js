// Burrow Command (prototype): a bunny squad defends its warren.
// Day: bunnies farm the field around a flag and carry loot home. Night: waves attack the burrow.
// Gold only comes from kills. Materials upgrade a class. Downed bunnies recover at dawn.
// Progression (docs/BURROW_COMMAND_PROGRESSION_SPEC.md, phase 1): the warren is saved every dawn;
// losing a night is a setback, not game over, and the same wave comes back until it is beaten.
// Each warren level has 5 waves (5 = boss); beating the boss unlocks the warren upgrade.
// Terrain, Blessed Bunny, monster art and FX are the Dimraeth engine's; the rules live here.
import { setRuntimeZoomRange, projectRuntimePoint, boot, setRuntimeActors, setRuntimeActorUpdater, setRuntimePlayerVisual, setRuntimePlayerControl, setRuntimeClickHandler, canRuntimeActorStand, runtimeWalkHeight, resolveRuntimeActor } from './engine/runtime.js';
import { emptyMap, sceneFromMap } from './scenes/custom.js';
import { findPath, canWalkStraight } from './combat/nav.js';
import { getRoster, monsterPresentation } from './combat/rosters.js';
import { loadBlessedHero } from './combat/hero.js';
import { createSkillFx, BASIC_ATTACK_FX } from './combat/skillfx.js';
import { createFloaters } from './combat/floaters.js';
import { combatFX } from './combat/fx.js';
import { combatSFX } from './combat/sfx.js';
import { towerSprite } from './engine/sprites.js';
import * as PAL from './engine/palettes.js';

// ---------- rules ----------
const CLASSES = {
  guard: { name: 'ผู้พิทักษ์', icon: '🛡', fam: 'swordShield', cost: 30, hp: 170, atk: 9, range: 46, cd: .9, speed: 92, carry: 6, blurb: 'ถึก ยืนหน้า' },
  archer: { name: 'นักธนู', icon: '🏹', fam: 'bow', cost: 40, hp: 80, atk: 11, range: 200, cd: 1.1, speed: 100, carry: 5, blurb: 'ยิงไกล' },
  scout: { name: 'หน่วยเร็ว', icon: '🗡', fam: 'dagger', cost: 35, hp: 90, atk: 6, range: 42, cd: .5, speed: 145, carry: 14, blurb: 'แบกของเยอะ วิ่งไว' },
  brute: { name: 'นักทุบ', icon: '🔨', fam: 'hammer', cost: 70, hp: 180, atk: 20, range: 50, cd: 1.5, speed: 82, carry: 8, splash: 70, blurb: 'ตีหมู่' },
};
const DAY_S = 80, NIGHT_S = 55, WAVES_PER_LEVEL = 5, SAVE_KEY = 'burrow-command-save-v1';
const BURROW_MAX = 500, REPAIR_HP = 60, REPAIR_COST = 12, REVIVE_COST = 15;
// warren level gates: hall HP, squad size, tower count; upgrading needs the level's boss beaten
const LOSS = { hallLeft: .2, goldLost: .2 }; // after a lost night: hall left at 20% HP, 20% of banked gold gone
const hallMax = () => BURROW_MAX + (S.warren - 1) * 80;
const squadMax = () => 6 + S.warren * 2;
const towerMax = () => Math.min(TOWER.max, 2 + S.warren);
const warrenCost = () => ({ gold: 30 + S.warren * 50, mats: S.warren * 6 });
// wave strength grows with the wave index inside a level and with the warren level
const levelPower = () => 1 + (S.warren - 1) * .3;
const UPGRADE = [null, { mats: 6, gold: 20 }, { mats: 14, gold: 45 }, { mats: 26, gold: 90 }]; // to tier 1..3, +30% each
const MATS = { wood: 'ไม้', hide: 'หนัง', ore: 'แร่' };
const HALL = { dmg: 9, cd: 1, range: 300 };
// archer towers: built with gold + materials around the warren; raiders knock them down on the way in
const TOWER = { gold: 40, mats: 8, hp: 220, dmg: 8, cd: 1.1, range: 260, max: 6, buildR: 520, gap: 80 };
const T = 64, CENTER = { x: 20 * T, y: 20 * T }, BASE_R = 190;
const HUNT_R = 330; // farm bunnies hunt monsters within this radius of the hunting flag
// defenders stand on a ring around the hall, one sector each: melee outside, ranged inside
const RING = { melee: 235, ranged: 175, zone: 250 };

// ---------- map: a clearing with the warren in the middle, forest all around ----------
function buildMap() {
  const n = 160, map = emptyMap('warren', 'forest');
  const level = new Uint8Array(n * n), road = new Uint8Array(n * n), forest = new Uint8Array(n * n), water = new Uint8Array(n * n);
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dx = i - 80, dy = j - 80, d = Math.hypot(dx, dy), k = j * n + i;
    const wob = Math.sin(Math.atan2(dy, dx) * 5) * 4 + Math.sin(Math.atan2(dy, dx) * 11 + 1) * 2;
    forest[k] = d > 66 + wob ? 4 : d > 56 + wob ? 3 : d > 30 && rnd() < .004 ? 2 : 1;
    // a raised meadow NE, a pond SW: something to look at, away from the four trails
    if (Math.hypot(i - 118, j - 44) < 13 + wob * .4) level[k] = 1;
    if (Math.hypot(i - 46, j - 116) < 8 + wob * .3) water[k] = 1;
  }
  // four dirt trails from the warren to the forest edge: the night waves come in along them
  for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let t = 10; t < 76; t++) {
    const cx = 80 + ax * t + Math.round(Math.sin(t * .15) * 3) * ay, cy = 80 + ay * t + Math.round(Math.sin(t * .15) * 3) * ax;
    for (let b = -2; b <= 2; b++) { const i = cx + (ay ? b : 0), j = cy + (ax ? b : 0); if (i >= 0 && j >= 0 && i < n && j < n) { road[j * n + i] = 2; forest[j * n + i] = t > 56 ? 2 : 1; } }
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (Math.hypot(i - 80, j - 80) < 9) road[j * n + i] = 1; // cobbled yard
  const enc = a => Array.from(a, v => String.fromCharCode(48 + v)).join('');
  Object.assign(map, { level: enc(level), road: enc(road), forest: enc(forest), water: enc(water), spawn: { x: 20, y: 22 } });
  const o = (type, x, y, extra = {}) => map.objects.push({ type, x, y, ...extra });
  o('house', 20, 20, { roof: 'green', floors: 2, ridge: 'x' }); // the burrow hall
  o('house', 16.2, 17.4, { roof: 'red', floors: 1, ridge: 'y' }); o('house', 23.8, 17.2, { roof: 'orange', floors: 1, ridge: 'y' });
  o('well', 17.2, 22.6); o('stall', 23.2, 23.4); o('hay', 15.6, 21); o('cart', 24.8, 20.8); o('signpost', 21.6, 24.6);
  for (const [x, y] of [[18, 18], [22, 18], [18, 22.4], [22.4, 22.4], [20, 25], [25, 20], [15, 20], [20, 15]]) o('lantern', x, y);
  for (const [x, y, axis] of [[16, 25.6, 'x'], [24, 25.6, 'x'], [16, 14.4, 'x'], [24, 14.4, 'x'], [14.4, 16, 'y'], [14.4, 24, 'y'], [25.6, 16, 'y'], [25.6, 24, 'y']]) o('fence', x, y, { axis, len: 3 });
  for (const [x, y] of [[28, 12], [31, 26], [11, 29], [9, 12], [27, 33], [33, 17]]) o('mushroom', x, y);
  for (const [x, y] of [[26.5, 27], [12, 25], [14, 11], [29, 21], [23, 31]]) o('stump', x, y);
  for (const [x, y] of [[17, 27], [27, 14], [12, 18], [21, 11], [31, 30], [8, 22]]) o('flowers', x, y);
  return map;
}

// ---------- boot ----------
const canvas = document.getElementById('scene');
const scene = sceneFromMap(buildMap());
const roster = getRoster('forest', 'forest1');
const hero = await loadBlessedHero();
await combatFX.init({ biome: 'forest', mapId: 'forest1' });

const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const mirrorCache = new Map();
const mirrored = img => { let c = mirrorCache.get(img); if (!c) { c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.translate(img.width, 0); g.scale(-1, 1); g.drawImage(img, 0, 0); mirrorCache.set(img, c); } return c; };

const monsterArt = new Map();
async function artFor(id) {
  if (monsterArt.has(id)) return monsterArt.get(id);
  const p = monsterPresentation(roster, id); if (!p) return null;
  p.frames = await Promise.all(Array.from({ length: p.count }, (_, i) => loadImage(p.frameSrc(i))));
  p.framesLeft = p.frames.map(mirrored);
  monsterArt.set(id, p); return p;
}
const normals = roster.pool.filter(id => { const p = monsterPresentation(roster, id); return p && !p.elite && !p.isBoss; });
const elites = roster.pool.filter(id => monsterPresentation(roster, id)?.elite);
const bossId = roster.bossType;
await Promise.all([...normals, ...elites, bossId].filter(Boolean).map(artFor));

// ---------- state ----------
const S = {
  gold: 20, mats: { wood: 0, hide: 0, ore: 0 }, tier: { guard: 0, archer: 0, scout: 0, brute: 0 },
  burrow: BURROW_MAX, day: 1, night: false, clock: 0, flag: { x: CENTER.x + 160, y: CENTER.y - 440 }, speed: 1, over: null,
  warren: 1, wave: 1, cleared: false, // progress: warren level, wave index 1..5 (advances only on a win), boss beaten
  units: [], monsters: [], towers: [], building: false, queue: [], waveTimer: 0, kills: 0, time: 0, events: [],
};
const later = (sec, fn) => S.events.push({ at: S.time + sec, fn }); // game-clock timer (respects speed/pause)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const standable = (x, y) => { const z = runtimeWalkHeight(x, y); return z !== null && canRuntimeActorStand(x, y, z); };
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const facingTo = (dx, dy) => { const vx = (dx - dy) / 2, vy = (dx + dy) / 4; return DIRS[Math.round(((Math.atan2(vx, -vy) * 180 / Math.PI + 360) % 360) / 45) % 8]; };
const screenLeft = (dx, dy) => dx - dy < 0;

function moveToward(e, tx, ty, speed, dt, stop = 0) {
  const dGoal = Math.hypot(tx - e.x, ty - e.y);
  if (dGoal <= stop + .5) { e.moving = false; e.path = null; return true; }
  // straight when the way is clear, otherwise the engine's A* (fences, houses, cliffs); replan now and then
  e.replan = (e.replan ?? 0) - dt;
  if (e.replan <= 0 && (!e.goalP || Math.hypot(e.goalP.x - tx, e.goalP.y - ty) > 48 || (e.stuck ?? 0) > .25 || !e.path)) {
    e.replan = .7 + Math.random() * .5; e.goalP = { x: tx, y: ty };
    if (canWalkStraight(e.x, e.y, tx, ty)) e.path = null;
    else { const r = findPath(e.x, e.y, tx, ty, { reach: stop }); e.path = r?.path?.length ? r.path.slice() : null; }
  }
  let wx = tx, wy = ty;
  if (e.path) { while (e.path.length && Math.hypot(e.path[0].x - e.x, e.path[0].y - e.y) < 14) e.path.shift(); if (e.path.length) { wx = e.path[0].x; wy = e.path[0].y; } else e.path = null; }
  const dx = wx - e.x, dy = wy - e.y, d = Math.hypot(dx, dy) || 1, step = Math.min(e.path ? d : dGoal - stop, speed * dt);
  const ox = e.x, oy = e.y, z = runtimeWalkHeight(e.x, e.y) ?? 0, nx = e.x + dx / d * step, ny = e.y + dy / d * step;
  const ok = (x, y) => { const h = runtimeWalkHeight(x, y); return h !== null && Math.abs(h - z) < 14 && canRuntimeActorStand(x, y, h); };
  // straight, else slide along the obstacle (keep the side that worked), else a random nudge when pinned
  const sd = e.side ?? 1, px = -dy / d * sd, py = dx / d * sd;
  const tries = [[nx, ny], [e.x + (dx / d * .5 + px) * step, e.y + (dy / d * .5 + py) * step], [e.x + px * step, e.y + py * step]];
  if ((e.stuck ?? 0) > .8) { const a = Math.random() * Math.PI * 2; tries.push([e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14]); }
  let moved = false;
  for (const [x, y] of tries) if (ok(x, y)) { e.x = x; e.y = y; moved = true; break; }
  if (!moved) e.side = -sd;
  resolveRuntimeActor(e);
  e.stuck = Math.hypot(e.x - ox, e.y - oy) < step * .3 ? (e.stuck ?? 0) + dt : 0;
  e.moving = true; e.dir = facingTo(dx, dy);
  return false;
}
function separate(list, r) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; if (a.down || b.down || a.dead || b.dead) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= r || d < .01) continue;
    const push = (r - d) / 2 / d; a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
  }
}

const matCount = () => S.mats.wood + S.mats.hide + S.mats.ore;
function spendMats(n) { for (const k in MATS) { const take = Math.min(n, S.mats[k]); S.mats[k] -= take; n -= take; } }

// ---------- archer towers ----------
let towerArt = null; // built on first use (needs the engine's render scale)
function placeTower(x, y) {
  if (S.towers.length >= towerMax()) return toast(`บ้าน Lv ${S.warren} สร้างได้ ${towerMax()} ป้อม · อัปบ้านเพื่อสร้างเพิ่ม`);
  if (S.gold < TOWER.gold || matCount() < TOWER.mats) return toast(`ต้องใช้ ${TOWER.gold}G + ของ ${TOWER.mats} ชิ้น`);
  if (dist({ x, y }, CENTER) > TOWER.buildR) return toast('สร้างได้เฉพาะในวงสีเหลืองรอบโพรง');
  if (dist({ x, y }, CENTER) < 170 || S.towers.some(t => dist(t, { x, y }) < TOWER.gap) || !standable(x, y)) return toast('ตรงนี้สร้างไม่ได้');
  S.gold -= TOWER.gold; spendMats(TOWER.mats);
  createTower(x, y);
  skillFx?.pillar(x, y, { color: '#ffe27a' }); skillFx?.burst(x, y, { color: '#d9c7a8', count: 20, up: 60 }); combatSFX.playLevelUp({ volume: .35 });
  S.building = false; toast('สร้างป้อมธนูแล้ว!'); renderUi();
}
function createTower(x, y, hp = TOWER.hp) {
  towerArt ??= towerSprite(28, 62, PAL.RED);
  const t = { x, y, hp, maxHp: TOWER.hp, cd: 0 };
  t.actor = {
    kind: 'actor', x: x - 14, y: y - 14, z: 0, r: 4, shadow: false, ox: towerArt.ox, oy: towerArt.oy, getImage: () => towerArt.img,
    get dead() { return t.hp <= 0; },
    drawOverlay(g, { x: sx, y: sy }) { const w = 40, q = t.hp / t.maxHp; g.fillStyle = 'rgba(10,12,12,.85)'; g.fillRect(sx - w / 2, sy - 118, w, 5); g.fillStyle = q > .5 ? '#7ee38a' : q > .25 ? '#ffc94a' : '#ff5a4a'; g.fillRect(sx - w / 2 + 1, sy - 117, (w - 2) * q, 3); },
  };
  S.towers.push(t); return t;
}
function updateTowers(dt) {
  for (const t of S.towers) {
    t.cd -= dt; if (t.cd > 0) continue;
    const m = nearestMonster(t, TOWER.range); if (!m) continue;
    t.cd = TOWER.cd;
    skillFx?.play('shotArrow', { from: { x: t.x, y: t.y }, to: { x: m.x, y: m.y } });
    later(.22, () => { if (m.dead) return; m.hp -= TOWER.dmg; floaters?.text(m.x, m.y, TOWER.dmg, { color: '#bfe3ff', size: 13 }); combatFX.playHitSpark(m.x, m.y, { visualScale: m.actor.visualScale }); if (m.hp <= 0) killMonster(m, null); });
  }
}
function hurtTower(t, dmg) {
  if (t.hp <= 0) return;
  t.hp -= dmg; floaters?.text(t.x, t.y, `-${Math.round(dmg)}`, { color: '#ff9a4a', size: 13, lift: 90 });
  if (t.hp <= 0) { t.hp = 0; combatFX.playBossDeath(t.x, t.y, { visualScale: 1 }); combatSFX.playDeath({ volume: .6 }); toast('ป้อมธนูพังแล้ว!'); S.towers = S.towers.filter(x => x !== t); renderUi(); }
}

// ---------- bunnies ----------
let unitSeq = 0;
function statsOf(cls) { const c = CLASSES[cls], k = 1 + .3 * S.tier[cls]; return { maxHp: Math.round(c.hp * k), atk: c.atk * k }; }
// each extra bunny of a class costs 20% more: a squad of one kind gets expensive
const priceOf = cls => Math.round(CLASSES[cls].cost * (1 + .2 * S.units.filter(u => u.cls === cls).length));
function recruit(cls, free = false) {
  const c = CLASSES[cls], price = priceOf(cls);
  if (!free && S.units.length >= squadMax()) return toast(`บ้าน Lv ${S.warren} มีกระต่ายได้ ${squadMax()} ตัว · อัปบ้านเพื่อเพิ่ม`);
  if (!free && S.gold < price) return toast('เงินไม่พอ');
  if (!free) S.gold -= price;
  const a = (unitSeq * 2.4) % (Math.PI * 2), st = statsOf(cls);
  const u = { id: ++unitSeq, cls, r: 12, x: CENTER.x + Math.cos(a) * 120, y: CENTER.y + 150 + Math.sin(a) * 40, hp: st.maxHp, ...st, stance: 'farm', carry: { gold: 0, wood: 0, hide: 0, ore: 0 }, cd: 0, atkUntil: 0, dir: 'south', moving: false, down: false };
  S.units.push(u);
  skillFx?.pillar(u.x, u.y, { color: '#ffd6ec' }); combatSFX.playLevelUp?.({ volume: .3 });
  renderUi(); return u;
}
const carried = u => u.carry.gold + u.carry.wood + u.carry.hide + u.carry.ore;
function deposit(u) {
  if (!carried(u)) return;
  S.gold += u.carry.gold; for (const k in MATS) S.mats[k] += u.carry[k];
  floaters?.text(u.x, u.y, `+${u.carry.gold}G${u.carry.wood + u.carry.hide + u.carry.ore ? ` +${u.carry.wood + u.carry.hide + u.carry.ore} ของ` : ''}`, { color: '#ffd45c', size: 14, lift: 60 });
  combatSFX.playPickup(); u.carry = { gold: 0, wood: 0, hide: 0, ore: 0 }; renderUi();
}
function heroImage(u) {
  const now = performance.now(), fam = CLASSES[u.cls].fam;
  let set, img;
  if (u.down) { set = hero.animations.death[u.dir]; img = set.frames[set.frames.length - 1]; }
  else if (now < u.atkUntil && hero.animations['atk_' + fam]) { set = hero.animations['atk_' + fam][u.dir]; const t = 1 - (u.atkUntil - now) / 375; img = set.frames[Math.min(set.frames.length - 1, Math.floor(t * set.frames.length))]; }
  else if (now < (u.hurtUntil ?? 0)) { set = hero.animations.hurt[u.dir]; img = set.frames[Math.floor((1 - (u.hurtUntil - now) / 360) * set.frames.length) % set.frames.length]; }
  else { set = hero.animations[u.moving ? 'run' : 'idle'][u.dir]; img = set.frames[Math.floor(now / (u.moving ? 80 : 140) + u.id * 3) % set.frames.length]; }
  return { img: set.flipX ? mirrored(img) : img, footY: set.footY };
}
function unitActor(u) {
  return {
    kind: 'actor', get x() { return u.x; }, get y() { return u.y; }, z: 0, r: 12, visualScale: 1,
    get dead() { return false; },
    getImage() { const v = heroImage(u); this.oy = v.footY; return v.img; },
    drawOverlay(g, { x, y }) {
      const w = 30, q = u.hp / u.maxHp;
      if (!u.down) { g.fillStyle = 'rgba(10,12,12,.8)'; g.fillRect(x - w / 2, y - 62, w, 4); g.fillStyle = '#7ee38a'; g.fillRect(x - w / 2 + 1, y - 61, (w - 2) * q, 2); }
      g.font = '11px system-ui'; g.textAlign = 'center'; g.fillStyle = u.down ? '#ff8a8a' : '#fff4cf';
      g.fillText(u.down ? '💤' : CLASSES[u.cls].icon + (S.tier[u.cls] ? '★'.repeat(S.tier[u.cls]) : ''), x, y - 66);
      if (carried(u)) { g.fillStyle = '#ffd45c'; g.fillText('👜' + carried(u), x + 20, y - 40); }
    },
  };
}

// ---------- monsters ----------
let monSeq = 0;
function spawnMonster(type, x, y, { night = false, power = 1 } = {}) {
  const p = monsterArt.get(type); if (!p) return;
  const boss = !!p.isBoss, elite = !!p.elite;
  const hp = Math.round((boss ? 650 : elite ? 110 : 45) * power), atk = (boss ? 20 : elite ? 11 : 6) * power;
  const m = { id: ++monSeq, type, p, r: boss ? 22 : 13, x, y, home: { x, y }, hp, maxHp: hp, atk, range: boss ? 70 : 38, cd: 1 + Math.random() * .5, speed: boss ? 60 : elite ? 72 : 78, night, boss, elite, left: false, dead: false, reward: Math.round((boss ? 80 : elite ? 12 : 5) * (1 + (S.warren - 1) * .25)) };
  m.actor = {
    kind: 'actor', get x() { return m.x + (m.lx ?? 0); }, get y() { return m.y + (m.ly ?? 0); }, z: 0, r: 12,
    visualScale: (boss ? 1.65 : elite ? 2.4 : 2) * (p.scale || 1),
    get dead() { return m.dead; },
    getImage() { const f = m.left ? p.framesLeft : p.frames; return f[Math.floor(performance.now() / 120 + m.id) % f.length]; },
    drawOverlay(g, { x, y }) {
      if (m.dead) return; const w = boss ? 70 : 38, q = m.hp / m.maxHp;
      g.fillStyle = 'rgba(10,12,12,.82)'; g.fillRect(x - w / 2, y - 55, w, 5); g.fillStyle = m.night ? '#ff7a4a' : '#e85b55'; g.fillRect(x - w / 2 + 1, y - 54, (w - 2) * q, 3);
      if (boss) { g.font = 'bold 11px system-ui'; g.textAlign = 'center'; g.fillStyle = '#ffd45c'; g.fillText(p.name, x, y - 61); }
    },
  };
  S.monsters.push(m); return m;
}
function fieldPoint() {
  const z0 = runtimeWalkHeight(CENTER.x, CENTER.y + 200) ?? 0;
  for (let i = 0; i < 40; i++) {
    const nearFlag = Math.random() < .6, o = nearFlag ? S.flag : CENTER, a = Math.random() * Math.PI * 2;
    const r = nearFlag ? 120 + Math.random() * 300 : 420 + Math.random() * 520, x = o.x + Math.cos(a) * r, y = o.y + Math.sin(a) * r;
    if (dist({ x, y }, CENTER) < 330) continue; // never inside the warren
    const z = runtimeWalkHeight(x, y); if (z === null || Math.abs(z - z0) > 12 || !canRuntimeActorStand(x, y, z)) continue; // same ground level as the warren
    return { x, y };
  }
  return null;
}
const edgePoints = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ax, ay]) => ({ x: CENTER.x + ax * 1100, y: CENTER.y + ay * 1100 }));
function killMonster(m, by) {
  m.dead = true; S.kills++;
  (m.boss ? combatFX.playBossDeath : combatFX.playNormalDeath).call(combatFX, m.x, m.y, { visualScale: m.actor.visualScale });
  combatSFX.playDeath({ volume: .45 });
  const loot = { gold: m.reward }, drops = [{ label: `${m.reward} G`, tier: 'gold' }];
  if (Math.random() < (m.boss ? 1 : m.elite ? .9 : .45)) { const k = Object.keys(MATS)[Math.floor(Math.random() * 3)], q = m.boss ? 10 : m.elite ? 2 : 1; loot[k] = q; drops.push({ label: `${MATS[k]} ×${q}`, tier: m.elite || m.boss ? 'blue' : 'green' }); }
  floaters?.loot(m.x, m.y, drops);
  // by night the loot goes straight into the warren; by day the killer has to carry it home
  const u = by && !by.down ? by : null;
  if (S.night || !u) { S.gold += loot.gold; for (const k in MATS) S.mats[k] += loot[k] ?? 0; renderUi(); }
  else for (const k in loot) u.carry[k] += loot[k];
}

// ---------- combat ----------
function strike(u, target) {
  const c = CLASSES[u.cls], now = performance.now();
  u.cd = c.cd; u.atkUntil = now + 375; u.dir = facingTo(target.x - u.x, target.y - u.y);
  combatSFX.playAttack({ volume: .25 });
  skillFx?.play(BASIC_ATTACK_FX[c.fam], { from: { x: u.x, y: u.y }, to: { x: target.x, y: target.y } });
  later(c.fam === 'bow' ? .26 : .18, () => {
    if (u.down) return;
    const hits = c.splash ? S.monsters.filter(m => !m.dead && dist(m, target) < c.splash) : [target];
    for (const m of hits) {
      if (m.dead) continue;
      const crit = Math.random() < .12, dmg = Math.max(1, Math.round(u.atk * (crit ? 1.8 : 1) * (.9 + Math.random() * .2)));
      m.hp -= dmg; m.aggro = u;
      floaters?.text(m.x, m.y, crit ? `★ ${dmg}` : dmg, { color: crit ? '#ffe36f' : '#ffffff', size: crit ? 18 : 14 });
      combatFX.playHitSpark(m.x, m.y, { visualScale: m.actor.visualScale }); combatSFX.playHit({ critical: crit, volume: .3 });
      if (m.hp <= 0) killMonster(m, u);
    }
  });
}
function hurtUnit(u, dmg, from) {
  if (u.down) return;
  u.hp -= dmg; u.hurtUntil = performance.now() + 360;
  floaters?.text(u.x, u.y, `-${Math.round(dmg)}`, { color: '#ff6b5e', size: 13 });
  if (u.hp <= 0) {
    u.hp = 0; u.down = true; u.moving = false;
    // whatever it was carrying spills: half is lost
    for (const k in u.carry) u.carry[k] = Math.floor(u.carry[k] / 2);
    toast(`${CLASSES[u.cls].name} ล้มแล้ว! (ฟื้นตอนเช้า หรือจ่าย ${REVIVE_COST}G)`); combatSFX.playDeath({ volume: .5 }); renderUi();
  }
}
function nearestMonster(p, maxD, filter = () => true) { let b = null, bd = maxD; for (const m of S.monsters) { if (m.dead || !filter(m)) continue; const d = dist(p, m); if (d < bd) { bd = d; b = m; } } return b; }
function nearestUnit(p, maxD) { let b = null, bd = maxD; for (const u of S.units) { if (u.down) continue; const d = dist(p, u); if (d < bd) { bd = d; b = u; } } return b; }

function ringPost(u) {
  const ring = S.units.filter(x => !x.down && (S.night || x.stance === 'guard'));
  const i = Math.max(0, ring.indexOf(u)), a = i / Math.max(1, ring.length) * Math.PI * 2 + .4, r = CLASSES[u.cls].range > 100 ? RING.ranged : RING.melee;
  return { x: CENTER.x + Math.cos(a) * r, y: CENTER.y + Math.sin(a) * r };
}
function farmSpot(u) { // idle farmers spread around the flag instead of piling on it
  const farmers = S.units.filter(x => !x.down && x.stance === 'farm'), i = Math.max(0, farmers.indexOf(u)), a = i / Math.max(1, farmers.length) * Math.PI * 2;
  return { x: S.flag.x + Math.cos(a) * 110, y: S.flag.y + Math.sin(a) * 110 };
}
// pick a target, preferring monsters nobody else is already on (claims are counted per tick)
function pickTarget(u, from, maxD, filter) {
  let best = null, bs = Infinity;
  for (const m of S.monsters) {
    if (m.dead || !filter(m) || dist(from, m) > maxD) continue;
    const sc = dist(u, m) + (m.claims ?? 0) * 140;
    if (sc < bs) { bs = sc; best = m; }
  }
  if (best) best.claims = (best.claims ?? 0) + 1;
  return best;
}
function updateUnit(u, dt, i) {
  if (u.down) return;
  u.cd -= dt;
  const c = CLASSES[u.cls], atHome = dist(u, CENTER) < BASE_R;
  if (atHome && carried(u)) deposit(u);
  if (atHome && !S.night && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .08 * dt); // rest in the warren
  const holdsRing = S.night || u.stance === 'guard', post = holdsRing ? ringPost(u) : { x: CENTER.x + (u.id % 5 - 2) * 30, y: CENTER.y + 150 };
  let target = null, goal = null;
  const dusk = !S.night && S.clock > DAY_S - 7;
  if (holdsRing) {
    // defend your own sector first; help the nearest fight only if nothing comes your way
    target = pickTarget(u, post, RING.zone, () => true) || (dist(u, post) < 320 ? pickTarget(u, CENTER, 330, () => true) : null);
    if (target && dist(target, post) > RING.zone + 140 && dist(target, CENTER) > 200) target = null; // don't get dragged away from the ring
  }
  else if (dusk || carried(u) >= c.carry) goal = post; // bag full / evening: go home
  else target = pickTarget(u, S.flag, HUNT_R, m => !m.night) || pickTarget(u, u, 220, m => !m.night);
  if (target) {
    const d = dist(u, target);
    if (d <= c.range) { u.moving = false; if (u.cd <= 0) strike(u, target); }
    else moveToward(u, target.x, target.y, c.speed, dt, c.range * .8);
    return;
  }
  if (!goal) goal = holdsRing ? post : farmSpot(u);
  if (moveToward(u, goal.x, goal.y, c.speed * (S.night ? 1.2 : 1), dt, 12)) u.moving = false;
}
function updateMonster(m, dt) {
  if (m.dead) return;
  m.cd -= dt; m.lx = m.ly = 0;
  let target = m.aggro && !m.aggro.down && dist(m, m.aggro) < 420 ? m.aggro : nearestUnit(m, m.night ? 180 : 150);
  if (!m.night && !target && dist(m, m.home) > 60) { moveToward(m, m.home.x, m.home.y, m.speed * .6, dt); m.left = screenLeft(m.home.x - m.x, m.home.y - m.y); return; }
  if (!m.night && target && dist(target, m.home) > 480) { m.aggro = null; target = null; }
  if (!target && m.night) { // a tower in the way gets knocked down first, then the burrow hall
    const tw = S.towers.filter(t => t.hp > 0 && dist(m, t) < 150).sort((a, b) => dist(m, a) - dist(m, b))[0];
    if (tw) {
      m.left = screenLeft(tw.x - m.x, tw.y - m.y);
      if (dist(m, tw) > 42) moveToward(m, tw.x, tw.y, m.speed, dt, 38);
      else if (m.cd <= 0) { m.cd = 1.3; m.lunge = performance.now(); m.lungeTo = { x: tw.x, y: tw.y }; later(.18, () => { if (!m.dead) hurtTower(tw, m.atk * .7); }); }
      lunge(m); return;
    }
    if (dist(m, CENTER) > 175 && (m.stuck ?? 0) < 1.5) { moveToward(m, CENTER.x, CENTER.y, m.speed, dt, 150); m.left = screenLeft(CENTER.x - m.x, CENTER.y - m.y); }
    else if (m.cd <= 0) { m.cd = 1.3; S.burrow -= m.atk * .6; floaters?.text(CENTER.x, CENTER.y, `-${Math.round(m.atk * .6)}`, { color: '#ff9a4a', size: 15, lift: 90 }); m.lunge = performance.now(); combatFX.playTackle(m.x, m.y, { visualScale: m.actor.visualScale }); renderUi(); }
    lunge(m); return;
  }
  if (!target) { if (Math.random() < dt * .3) m.home = { x: m.home.x + (Math.random() - .5) * 60, y: m.home.y + (Math.random() - .5) * 60 }; return; }
  const d = dist(m, target);
  m.left = screenLeft(target.x - m.x, target.y - m.y);
  if (d > m.range) moveToward(m, target.x, target.y, m.speed, dt, m.range * .8);
  else if (m.cd <= 0) { m.cd = 1.25; m.lunge = performance.now(); m.lungeTo = { x: target.x, y: target.y }; later(.18, () => { if (!m.dead && dist(m, target) < m.range + 20) { hurtUnit(target, m.atk, m); combatFX.playTackle(target.x, target.y, { visualScale: 1 }); } }); }
  lunge(m);
}
function lunge(m) { // short hop toward the target so the attack reads
  const t = (performance.now() - (m.lunge ?? 0)) / 360; if (t > 1) return;
  const to = m.lungeTo ?? CENTER, dx = to.x - m.x, dy = to.y - m.y, d = Math.hypot(dx, dy) || 1, k = (t < .5 ? t * 2 : 2 - t * 2) * 14;
  m.lx = dx / d * k; m.ly = dy / d * k;
}

// ---------- day / night ----------
function startNight() {
  S.night = true; S.clock = 0;
  // once the level's boss is beaten the nights replay wave 4 (farmable) until the warren is upgraded
  const n = S.cleared ? WAVES_PER_LEVEL - 1 : S.wave, boss = n === WAVES_PER_LEVEL && !S.cleared;
  const count = 3 + n * 2 + (S.warren - 1) * 3, power = (1 + (n - 1) * .2) * levelPower();
  S.queue = []; for (let i = 0; i < count; i++) S.queue.push(Math.random() < .08 + n * .08 + (S.warren - 1) * .04 && elites.length ? elites[i % elites.length] : normals[i % normals.length]);
  if (boss && bossId) S.queue.splice(Math.floor(S.queue.length / 2), 0, bossId); // the boss comes mid-wave, not after it
  S.nightWave = n; S.wavePower = power; S.waveTimer = 0;
  for (const m of S.monsters) if (!m.night) m.dead = true; // the field empties at dusk
  window.__slice?.setDusk(true);
  banner(`คืนที่ ${S.day} · เวฟ ${S.warren}-${n}`, boss ? `คืนบอส! ชนะแล้วอัปบ้านได้ · มอน ${S.queue.length} ตัว` : `มอนสเตอร์ ${S.queue.length} ตัวกำลังบุกโพรง!`);
  renderUi();
}
function endNight(won) {
  for (const m of S.monsters) m.dead = true;
  S.queue = [];
  if (won) {
    if (S.cleared) banner('รอดแล้ว!', 'บอสของเลเวลนี้แพ้ไปแล้ว · อัปบ้านเมื่อพร้อม 🏠');
    else if (S.wave >= WAVES_PER_LEVEL) { S.cleared = true; banner('ชนะบอสแล้ว! 🎉', `อัปบ้านเป็น Lv ${S.warren + 1} ได้แล้ว`); }
    else { S.wave++; banner('รอดแล้ว!', `คืนพรุ่งนี้ เวฟ ${S.warren}-${S.wave}`); }
  } else {
    // a lost night costs something, but the game goes on and the same wave comes back
    const lost = Math.floor(S.gold * LOSS.goldLost);
    S.gold -= lost; S.burrow = Math.round(hallMax() * LOSS.hallLeft);
    for (const u of S.units) { u.down = true; u.hp = 0; u.moving = false; }
    combatSFX.playDeath({ volume: .7 });
    banner('โพรงแตก…', `เสีย ${lost}G · เช้านี้ซ่อมแล้วเตรียมตัว คืนนี้เวฟ ${S.warren}-${S.cleared ? WAVES_PER_LEVEL - 1 : S.wave} กลับมาอีก`);
  }
  S.pendingBanner = true;
  startDay();
}
function startDay() {
  S.night = false; S.clock = 0; S.day++;
  for (const m of S.monsters) m.dead = true;
  S.monsters = S.monsters.filter(m => !m.dead);
  for (const u of S.units) { if (u.down) { u.down = false; u.x = CENTER.x + (Math.random() - .5) * 120; u.y = CENTER.y + 150; } u.hp = u.maxHp; } // everyone wakes up rested
  window.__slice?.setDusk(false);
  if (!S.pendingBanner) banner(`วันที่ ${S.day}`, 'กระต่ายออกล่ารอบจุดล่า 🚩 · คลิกพื้นเพื่อย้าย');
  S.pendingBanner = false;
  save(); renderUi();
}
function upgradeWarren() {
  const c = warrenCost();
  if (!S.cleared || S.night || S.gold < c.gold || matCount() < c.mats) return;
  S.gold -= c.gold; spendMats(c.mats);
  const before = hallMax(); S.warren++; S.wave = 1; S.cleared = false; S.burrow += hallMax() - before;
  skillFx?.pillar(CENTER.x, CENTER.y, { color: '#ffe27a', count: 40 }); skillFx?.burst(CENTER.x, CENTER.y, { color: '#ffe27a', color2: '#ffffff', count: 40, up: 160, life: 1 });
  combatSFX.playLevelUp();
  banner(`บ้าน Lv ${S.warren}! 🏠`, `กระต่าย ${squadMax()} ตัว · ป้อม ${towerMax()} ป้อม · โพรง ${hallMax()} HP · มอนแรงขึ้น`);
  save(); renderUi();
}

// ---------- save / load (localStorage; versioned for later migrations) ----------
function save() {
  const data = { v: 1, gold: S.gold, mats: S.mats, tier: S.tier, burrow: S.burrow, warren: S.warren, wave: S.wave, cleared: S.cleared, day: S.day, kills: S.kills, flag: S.flag,
    units: S.units.map(u => ({ cls: u.cls, stance: u.stance })), towers: S.towers.map(t => ({ x: t.x, y: t.y, hp: Math.round(t.hp) })) };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}
function load() {
  let d = null; try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch {}
  if (!d || d.v !== 1) return false;
  Object.assign(S, { gold: d.gold, mats: { ...S.mats, ...d.mats }, tier: { ...S.tier, ...d.tier }, warren: d.warren, wave: d.wave, cleared: d.cleared, day: d.day, kills: d.kills ?? 0, flag: d.flag ?? S.flag });
  S.burrow = Math.min(hallMax(), d.burrow);
  for (const x of d.units) recruit(x.cls, true).stance = x.stance || 'farm';
  for (const t of d.towers || []) createTower(t.x, t.y, t.hp);
  return true;
}
addEventListener('beforeunload', () => { if (!S.night && !S.resetting) save(); }); // leaving by day keeps the day's shopping; leaving at night replays from dawn

function tick(dt) {
  if (S.over) return;
  dt *= S.speed; S.clock += dt; S.time += dt;
  if (S.events.length) { const due = S.events.filter(e => e.at <= S.time); S.events = S.events.filter(e => e.at > S.time); for (const e of due) e.fn(); }
  if (!S.night) {
    if (S.clock >= DAY_S) startNight();
    const alive = S.monsters.filter(m => !m.dead && !m.night).length, cap = 12 + S.warren * 2;
    if (alive < cap && Math.random() < dt * 1.5) { const p = fieldPoint(); if (p) spawnMonster(Math.random() < .15 && elites.length ? elites[0] : normals[Math.floor(Math.random() * normals.length)], p.x, p.y, { power: levelPower() * (1 + (S.wave - 1) * .06) }); }
  } else {
    S.waveTimer -= dt;
    if (S.queue.length && S.waveTimer <= 0) {
      S.waveTimer = 1.4 / Math.max(1, (S.nightWave + S.warren - 1) * .5);
      const e = edgePoints[Math.floor(Math.random() * 4)], type = S.queue.shift();
      // the boss scales with the warren level only, not with the wave index
      for (let t = 0; t < 10; t++) { const x = e.x + (Math.random() - .5) * 160, y = e.y + (Math.random() - .5) * 160; if (standable(x, y)) { spawnMonster(type, x, y, { night: true, power: type === bossId ? levelPower() : S.wavePower }); break; } }
    }
    const left = S.monsters.some(m => m.night && !m.dead);
    if (S.burrow <= 0) endNight(false);
    else if ((S.clock >= NIGHT_S && !left) || (!S.queue.length && !left && S.clock > 8)) endNight(true);
  }
  // the burrow hall has an archer loft: it shoots the nearest raider, day or night
  S.hallCd = (S.hallCd ?? 0) - dt;
  if (S.hallCd <= 0) { const m = nearestMonster(CENTER, HALL.range); if (m) { S.hallCd = HALL.cd; const from = { x: CENTER.x, y: CENTER.y }; skillFx?.play('shotArrow', { from, to: { x: m.x, y: m.y } }); later(.22, () => { if (m.dead) return; m.hp -= HALL.dmg; floaters?.text(m.x, m.y, HALL.dmg, { color: '#bfe3ff', size: 13 }); combatFX.playHitSpark(m.x, m.y, { visualScale: m.actor.visualScale }); if (m.hp <= 0) killMonster(m, null); }); } }
  updateTowers(dt);
  for (const m of S.monsters) m.claims = 0;
  S.units.forEach((u, i) => updateUnit(u, dt, i));
  for (const m of S.monsters) updateMonster(m, dt);
  separate(S.units, 32); separate(S.monsters.filter(m => !m.dead), 30);
  S.monsters = S.monsters.filter(m => !m.dead || performance.now() - (m.deadAt ??= performance.now()) < 50);
}

// ---------- camera: WASD / arrows / drag, the runtime player is an invisible camera rig ----------
const keys = new Set(), cam = { x: CENTER.x + 60, y: CENTER.y + 60 };
addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'Escape' && S.building) { S.building = false; renderUi(); } if (e.code === 'Space') { e.preventDefault(); cam.x = CENTER.x + 60; cam.y = CENTER.y + 60; } });
addEventListener('keyup', e => keys.delete(e.code));
function moveCamera(dt) {
  let sx = 0, sy = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) sy -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) sy += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) sx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) sx += 1;
  if (sx || sy) { const v = 520 * dt; cam.x += (sx + 2 * sy) * v * .5; cam.y += (2 * sy - sx) * v * .5; }
  cam.x = Math.max(200, Math.min(2360, cam.x)); cam.y = Math.max(200, Math.min(2360, cam.y));
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('on'), 2200); }
function banner(title, sub) { const el = $('banner'); el.innerHTML = `<b>${title}</b><span>${sub}</span>`; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function renderUi() {
  $('gold').textContent = S.gold; for (const k in MATS) $('m-' + k).textContent = S.mats[k];
  $('burrow').style.width = `${100 * S.burrow / hallMax()}%`; $('burrow-t').textContent = `${Math.ceil(S.burrow)} / ${hallMax()}`;
  $('shop').innerHTML = Object.entries(CLASSES).map(([k, c]) => {
    const t = S.tier[k], up = UPGRADE[t + 1], mats = S.mats.wood + S.mats.hide + S.mats.ore;
    return `<div class="card"><button class="buy" data-buy="${k}" ${S.gold < priceOf(k) ? 'disabled' : ''}><i>${c.icon}</i><b>${c.name}</b><small>${c.blurb}</small><em>${priceOf(k)} G</em></button>
      <button class="up" data-up="${k}" ${!up || S.gold < up.gold || mats < up.mats ? 'disabled' : ''}>${up ? `อัปเกรด ★${t + 1} · ${up.mats} ของ + ${up.gold}G` : 'สูงสุดแล้ว'}</button></div>`;
  }).join('');
  const downs = S.units.filter(u => u.down).length;
  $('repair').disabled = S.gold < REPAIR_COST || (S.burrow >= hallMax() && S.towers.every(t => t.hp >= t.maxHp)); $('repair').textContent = `🔧 ซ่อม +${REPAIR_HP} (${REPAIR_COST}G)`;
  $('build').disabled = !S.building && (S.towers.length >= towerMax() || S.gold < TOWER.gold || matCount() < TOWER.mats); $('build').classList.toggle('on', S.building);
  $('build').textContent = S.building ? '✖ ยกเลิกการสร้าง' : `🏹 ป้อมธนู ${S.towers.length}/${towerMax()} (${TOWER.gold}G + ${TOWER.mats} ของ)`;
  const wc = warrenCost();
  $('upgrade').disabled = !S.cleared || S.night || S.gold < wc.gold || matCount() < wc.mats;
  $('upgrade').textContent = S.cleared ? `🏠 อัปบ้าน → Lv ${S.warren + 1} (${wc.gold}G + ${wc.mats} ของ)` : `🏠 อัปบ้าน: ชนะบอสเวฟ ${S.warren}-${WAVES_PER_LEVEL} ก่อน`;
  $('revive').disabled = !downs || S.gold < REVIVE_COST; $('revive').textContent = `💖 ปลุกกระต่าย (${REVIVE_COST}G)${downs ? ` · ล้ม ${downs}` : ''}`;
  $('squad').innerHTML = S.units.map(u => `<button data-unit="${u.id}" class="${u.down ? 'down' : ''} ${u.stance}" title="คลิกสลับ: ออกล่า (ไปที่จุดล่า 🚩) / เฝ้าบ้าน (ยืนรอบโพรง)">${CLASSES[u.cls].icon}<small>${u.down ? 'ล้ม' : u.stance === 'farm' ? 'ออกล่า' : 'เฝ้าบ้าน'}</small></button>`).join('');
  syncClock();
}
function syncClock() {
  const total = S.night ? NIGHT_S : DAY_S, left = Math.max(0, Math.ceil(total - S.clock));
  $('phase').textContent = S.night ? `🌙 คืนที่ ${S.day}` : `☀️ วันที่ ${S.day}`;
  $('timer').textContent = S.night ? `เหลือมอน ${S.queue.length + S.monsters.filter(m => m.night && !m.dead).length}` : `ค่ำใน ${left}s`;
  $('wave').textContent = `🏠 Lv ${S.warren} · เวฟ ${S.warren}-${S.cleared ? `${WAVES_PER_LEVEL} ✓` : S.wave}`;
  $('clockbar').style.width = `${100 * Math.min(1, S.clock / total)}%`; $('clockbar').className = S.night ? 'night' : '';
}
document.body.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.buy) recruit(b.dataset.buy);
  else if (b.dataset.up) { const k = b.dataset.up, up = UPGRADE[S.tier[k] + 1]; let need = up.mats; S.gold -= up.gold; for (const m in MATS) { const take = Math.min(need, S.mats[m]); S.mats[m] -= take; need -= take; } S.tier[k]++; for (const u of S.units) if (u.cls === k) { const st = statsOf(k); u.hp += st.maxHp - u.maxHp; Object.assign(u, st); skillFx?.pillar(u.x, u.y, { color: '#ffe27a' }); } combatSFX.playLevelUp(); toast(`${CLASSES[k].name} อัปเกรดเป็น ★${S.tier[k]}`); renderUi(); }
  else if (b.dataset.unit) { const u = S.units.find(x => x.id === +b.dataset.unit); if (u && !u.down) { u.stance = u.stance === 'farm' ? 'guard' : 'farm'; renderUi(); } }
  else if (b.id === 'repair') { // hall first, whatever is left goes to damaged towers
    S.gold -= REPAIR_COST; let left = REPAIR_HP; const add = Math.min(left, hallMax() - S.burrow); S.burrow += add; left -= add;
    for (const t of S.towers) { const a = Math.min(left, t.maxHp - t.hp); t.hp += a; left -= a; if (a) skillFx?.burst(t.x, t.y, { color: '#ffe27a', count: 10, up: 60 }); }
    skillFx?.burst(CENTER.x, CENTER.y, { color: '#ffe27a', count: 18, up: 90 }); renderUi();
  }
  else if (b.id === 'revive') { const u = S.units.find(x => x.down); if (u) { S.gold -= REVIVE_COST; u.down = false; u.hp = Math.round(u.maxHp * .6); skillFx?.pillar(u.x, u.y, { color: '#ffd6ec' }); renderUi(); } }
  else if (b.id === 'build') { S.building = !S.building; if (S.building) toast('คลิกพื้นในวงสีเหลืองเพื่อวางป้อม'); renderUi(); }
  else if (b.id === 'speed') { S.speed = S.speed === 1 ? 2 : 1; b.textContent = `⏩ x${S.speed}`; }
  else if (b.id === 'skip' && !S.night) S.clock = DAY_S - .1;
  else if (b.id === 'upgrade') upgradeWarren();
  else if (b.id === 'reset' && confirm('เริ่มหมู่บ้านใหม่? เซฟเดิมจะหายทั้งหมด')) { try { localStorage.removeItem(SAVE_KEY); } catch {} S.resetting = true; location.reload(); }
});

// ---------- world objects: farm flag + burrow hall HP ----------
const blank = document.createElement('canvas'); blank.width = blank.height = 1;
const flagActor = { kind: 'actor', get x() { return S.flag.x; }, get y() { return S.flag.y; }, z: 0, r: 4, shadow: false, getImage: () => blank,
  drawOverlay(g, { x, y, time }) {
    if (S.night || !S.units.some(u => u.stance === 'farm')) return;
    g.strokeStyle = '#3a2616'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 70); g.stroke();
    const wave = Math.sin(time * 6) * 3; g.fillStyle = '#ff6fa8'; g.strokeStyle = '#5a1030'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y - 70); g.lineTo(x + 34, y - 60 + wave); g.lineTo(x, y - 50); g.closePath(); g.fill(); g.stroke();
  } };
const hallActor = { kind: 'actor', x: CENTER.x + 40, y: CENTER.y + 40, z: 0, r: 4, shadow: false, getImage: () => blank,
  drawOverlay(g, { x, y }) { if (S.building) drawBuildRing(g); const w = 110, q = S.burrow / hallMax(); g.fillStyle = 'rgba(10,12,12,.85)'; g.fillRect(x - w / 2, y - 150, w, 7); g.fillStyle = q > .5 ? '#7ee38a' : q > .25 ? '#ffc94a' : '#ff5a4a'; g.fillRect(x - w / 2 + 1, y - 149, (w - 2) * q, 5); g.font = 'bold 11px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff4cf'; g.fillText(`โพรงกระต่าย Lv ${S.warren}`, x, y - 156); } };

function drawBuildRing(g) { // the build radius as an iso ellipse around the hall
  const z = runtimeWalkHeight(CENTER.x, CENTER.y) ?? 0, c = projectRuntimePoint(CENTER.x, CENTER.y, z), e = projectRuntimePoint(CENTER.x + TOWER.buildR, CENTER.y - TOWER.buildR, z);
  const rx = Math.abs(e.x - c.x);
  g.save(); g.setLineDash([8, 6]); g.strokeStyle = 'rgba(255,214,90,.85)'; g.lineWidth = 2; g.beginPath(); g.ellipse(c.x, c.y, rx, rx / 2, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(255,214,90,.07)'; g.fill(); g.restore();
}
let skillFx = null, floaters = null, edgeLayer = null;
function drawEdgeArrows() {
  if (!edgeLayer) { edgeLayer = document.createElement('canvas'); edgeLayer.style.cssText = 'position:absolute;pointer-events:none;z-index:6;background:transparent!important'; canvas.after(edgeLayer); }
  const L = edgeLayer, r = canvas.getBoundingClientRect(), pr = canvas.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
  if (L.width !== canvas.width || L.height !== canvas.height) { L.width = canvas.width; L.height = canvas.height; }
  Object.assign(L.style, { left: `${r.left - pr.left}px`, top: `${r.top - pr.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const g = L.getContext('2d'), W = L.width, H = L.height, pad = 26;
  g.clearRect(0, 0, W, H);
  if (!S.night && S.units.some(u => u.stance === 'farm')) {
    const z = runtimeWalkHeight(S.flag.x, S.flag.y) ?? 0, c = projectRuntimePoint(S.flag.x, S.flag.y, z), e = projectRuntimePoint(S.flag.x + HUNT_R, S.flag.y - HUNT_R, z);
    const rx = Math.abs(e.x - c.x);
    g.save(); g.setLineDash([12, 8]); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,111,168,.85)'; g.fillStyle = 'rgba(255,111,168,.08)';
    g.beginPath(); g.ellipse(c.x, c.y, rx, rx / 2, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
    g.font = 'bold 15px system-ui'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(30,8,18,.9)'; g.fillStyle = '#ffd0e4';
    g.strokeText('จุดล่า 🚩', c.x, c.y + 22); g.fillText('จุดล่า 🚩', c.x, c.y + 22);
  }
  if (!S.night) return;
  // bucket off-screen raiders by the edge direction they are in, so a wave shows as a few arrows
  const groups = new Map();
  for (const m of S.monsters) {
    if (m.dead || !m.night) continue;
    const p = projectRuntimePoint(m.x, m.y, runtimeWalkHeight(m.x, m.y) ?? 0);
    if (p.x > pad && p.x < W - pad && p.y > pad && p.y < H - pad) continue;
    const a = Math.atan2(p.y - H / 2, p.x - W / 2), key = Math.round(a / (Math.PI / 8));
    const gr = groups.get(key) ?? { a: 0, n: 0, boss: false }; gr.a += a; gr.n++; gr.boss ||= m.boss; groups.set(key, gr);
  }
  const t = performance.now() / 1000;
  for (const gr of groups.values()) {
    const a = gr.a / gr.n, dx = Math.cos(a), dy = Math.sin(a);
    const k = Math.min((W / 2 - pad) / Math.abs(dx || 1e-6), (H / 2 - pad) / Math.abs(dy || 1e-6)), x = W / 2 + dx * k, y = H / 2 + dy * k;
    g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = .75 + Math.sin(t * 6) * .25;
    g.fillStyle = gr.boss ? '#ffd45c' : '#ff5a4a'; g.strokeStyle = 'rgba(20,6,4,.9)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(14, 0); g.lineTo(-10, -12); g.lineTo(-4, 0); g.lineTo(-10, 12); g.closePath(); g.stroke(); g.fill();
    g.rotate(-a); g.globalAlpha = 1; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeText(gr.boss ? `บอส +${gr.n}` : gr.n, -dx * 24, -dy * 24 + 4); g.fillStyle = '#fff'; g.fillText(gr.boss ? `บอส +${gr.n}` : gr.n, -dx * 24, -dy * 24 + 4);
    g.restore();
  }
}
setRuntimePlayerVisual(() => ({ image: null }));
setRuntimeClickHandler(hit => {
  if (S.over || !hit || hit.idx < 0) return;
  if (S.building) return placeTower(hit.x, hit.y);
  if (S.night) return toast('กลางคืนกระต่ายเฝ้าโพรง ย้ายธงไม่ได้');
  if (!standable(hit.x, hit.y)) return toast('ปักธงตรงนั้นไม่ได้');
  S.flag = { x: hit.x, y: hit.y }; skillFx?.burst(hit.x, hit.y, { color: '#ff9fcf', count: 10, up: 30 }); toast('ย้ายจุดล่าแล้ว · กระต่ายสายฟาร์มจะไปล่ามอนในวงสีชมพู');
});
let last = performance.now();
setRuntimeActorUpdater(({ player }) => {
  const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
  setRuntimePlayerControl(true); moveCamera(dt); player.x = cam.x; player.y = cam.y;
  tick(dt); combatFX.update(dt * S.speed);
  setRuntimeActors([...S.units.map(u => u.actor ??= unitActor(u)), ...S.monsters.filter(m => !m.dead).map(m => m.actor), ...S.towers.map(t => t.actor), flagActor, hallActor, ...combatFX.getRuntimeActors()]);
  skillFx?.update(dt); skillFx?.draw(); floaters?.update(dt); floaters?.draw(); drawEdgeArrows(); syncClock();
});
skillFx = createSkillFx(canvas); floaters = createFloaters(canvas);
const resumed = load();
if (!resumed) { recruit('guard', true); recruit('archer', true); }
renderUi();
setRuntimeZoomRange(.45, 1.3); // wheel: zoom out to watch the whole clearing
await boot(scene, { canvasEl: canvas, loadingEl: $('loading'), playerSprites: null, worldScale: 1.45, zoom: .62 });
{ const l = $('loading'); if (l) l.hidden = true; }
banner(resumed ? `กลับมาแล้ว · วันที่ ${S.day}` : 'วันที่ 1', resumed ? `บ้าน Lv ${S.warren} · เวฟ ${S.warren}-${S.wave}` : 'กระต่าย "ออกล่า" ไปล่ามอนในวงชมพูรอบธง 🚩 · คลิกพื้นเพื่อย้ายจุดล่า');
window.__warren = S; window.__warrenDev = { placeTower, renderUi, save, upgradeWarren }; // dev hooks
window.__warrenStep = // dev: fast-forward the simulation (balance tests)
  sec => { for (let t = 0; t < sec && !S.over; t += 1 / 30) { tick(1 / 30); combatFX.update(1 / 30); } renderUi(); };
