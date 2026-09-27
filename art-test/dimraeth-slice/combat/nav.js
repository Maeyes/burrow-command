// Click-to-move pathfinding for the Dimraeth runtime.
// A* over a coarse world grid, using the same walkability rules as the runtime
// (terrain height, step-up, colliders), then string-pulled into few waypoints.
import { WS } from '../engine/state.js';
import { canRuntimeActorStand, runtimeWalkHeight, moveRuntimePlayerToward } from '../engine/runtime.js';

const G = 32;               // grid cell in world units
const CLEARANCE = 15;       // keep the hero's radius (13) + margin away from colliders
const MAX_EXPANSIONS = 14000;
const SPEED_SCREEN = 125;   // same screen-space speed the runtime uses for click-walking
const BUCKET = 96;

// ---- collider lookup (static per map; built lazily) ----
let bucketSource = null, buckets = null;
function colliderBuckets() {
  if (buckets && bucketSource === WS.colliders && bucketSource.length === buckets.count) return buckets;
  const map = new Map(); let count = 0;
  const put = (bx, by, c) => { const k = bx * 100003 + by; (map.get(k) || map.set(k, []).get(k)).push(c); };
  for (const c of WS.colliders) {
    count++;
    const x0 = c.type === 'c' ? c.x - c.r : c.x0, x1 = c.type === 'c' ? c.x + c.r : c.x1;
    const y0 = c.type === 'c' ? c.y - c.r : c.y0, y1 = c.type === 'c' ? c.y + c.r : c.y1;
    for (let bx = Math.floor((x0 - CLEARANCE) / BUCKET); bx <= Math.floor((x1 + CLEARANCE) / BUCKET); bx++)
      for (let by = Math.floor((y0 - CLEARANCE) / BUCKET); by <= Math.floor((y1 + CLEARANCE) / BUCKET); by++) put(bx, by, c);
  }
  bucketSource = WS.colliders; buckets = { map, count };
  return buckets;
}
function collides(x, y, clearance = CLEARANCE) {
  const list = colliderBuckets().map.get(Math.floor(x / BUCKET) * 100003 + Math.floor(y / BUCKET));
  if (!list) return false;
  for (const c of list) {
    if (c.type === 'c') { if (Math.hypot(x - c.x, y - c.y) < c.r + clearance) return true; }
    else {
      const qx = Math.max(c.x0, Math.min(x, c.x1)), qy = Math.max(c.y0, Math.min(y, c.y1));
      if (Math.hypot(x - qx, y - qy) < clearance) return true;
    }
  }
  return false;
}

/** True if the hero can stand at (x,y) coming from height zRef. */
function standable(x, y, zRef) {
  return canRuntimeActorStand(x, y, zRef) && !collides(x, y);
}

/** Straight-line walkability (terrain steps + colliders), sampled every ~10 units. */
export function canWalkStraight(x0, y0, x1, y1, clearance = CLEARANCE - 3) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 10));
  let z = runtimeWalkHeight(x0, y0);
  if (z === null) return false;
  for (let i = 1; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    if (!canRuntimeActorStand(x, y, z) || collides(x, y, clearance)) return false;
    z = runtimeWalkHeight(x, y) ?? z;
  }
  return true;
}

// ---- tiny binary heap ----
class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const key = (gx, gy) => (gx + 4096) * 8192 + (gy + 4096);

/**
 * Find a walkable route. Returns { path:[{x,y}...], complete:boolean } — `path` excludes the
 * start, `complete` is false when the goal itself is unreachable (path leads to the closest
 * reachable point instead). Returns null when there is nowhere to go.
 * `reach` lets the search stop once within that many world units of the goal (attack range).
 */
export function findPath(sx, sy, gx, gy, { reach = 0, maxExpansions = MAX_EXPANSIONS, skipStraightCheck = false } = {}) {
  const sz = runtimeWalkHeight(sx, sy);
  if (sz === null) return null;
  if (Math.hypot(gx - sx, gy - sy) <= Math.max(reach, 6)) return { path: [], complete: true };
  if (!skipStraightCheck && canWalkStraight(sx, sy, gx, gy)) return { path: [{ x: gx, y: gy }], complete: true, length: Math.hypot(gx - sx, gy - sy) };

  const s = { gx: Math.round(sx / G), gy: Math.round(sy / G) };
  const goalG = { gx: Math.round(gx / G), gy: Math.round(gy / G) };
  const nodes = new Map();
  const node = (cx, cy, from) => {
    const k = key(cx, cy);
    let n = nodes.get(k);
    if (!n) {
      const x = cx * G, y = cy * G, h = runtimeWalkHeight(x, y);
      n = { k, cx, cy, x, y, h, g: Infinity, parent: null, closed: false, from: from ?? null };
      nodes.set(k, n);
    }
    return n;
  };
  const start = node(s.gx, s.gy);
  start.x = sx; start.y = sy; start.h = sz; start.g = 0;
  const heur = n => Math.hypot(gx - n.x, gy - n.y);
  const open = new Heap(); open.push(heur(start) * 1.15, start);
  let best = start, bestH = heur(start), expansions = 0, found = null;

  // Callers controlling many autonomous agents can use a smaller per-search
  // budget without restricting the full-resolution hero navigator.
  const searchLimit = Math.max(64, Math.min(MAX_EXPANSIONS, Math.floor(maxExpansions)));
  while (open.size && expansions < searchLimit) {
    const [, cur] = open.pop();
    if (cur.closed) continue;
    cur.closed = true; expansions++;
    const hd = heur(cur);
    if (hd < bestH) { bestH = hd; best = cur; }
    if ((cur.cx === goalG.gx && cur.cy === goalG.gy) || (reach > 0 && hd <= reach)) { found = cur; break; }
    for (const [dx, dy] of DIRS) {
      const nx = cur.cx + dx, ny = cur.cy + dy, nb = node(nx, ny);
      if (nb.closed || nb.h === null) continue;
      if (!standable(nb.x, nb.y, cur.h)) continue;
      if (dx && dy) { // no corner cutting
        const a = node(cur.cx + dx, cur.cy), b = node(cur.cx, cur.cy + dy);
        if (a.h === null || b.h === null || !standable(a.x, a.y, cur.h) || !standable(b.x, b.y, cur.h)) continue;
      }
      const cost = cur.g + (dx && dy ? 1.4142 : 1) * G + Math.abs(nb.h - cur.h) * 0.5;
      if (cost < nb.g) { nb.g = cost; nb.parent = cur; open.push(cost + heur(nb) * 1.15, nb); }
    }
  }

  const end = found ?? best;
  if (end === start) return null;
  const raw = [];
  for (let n = end; n; n = n.parent) raw.push({ x: n.x, y: n.y });
  raw.reverse();
  raw[0] = { x: sx, y: sy };
  const complete = Boolean(found);
  if (found && reach === 0 && standable(gx, gy, end.h ?? sz)) raw.push({ x: gx, y: gy });

  // string-pull: keep only waypoints needed to avoid obstacles
  const out = []; let a = 0;
  while (a < raw.length - 1) {
    let b = raw.length - 1;
    while (b > a + 1 && !canWalkStraight(raw[a].x, raw[a].y, raw[b].x, raw[b].y)) b--;
    out.push(raw[b]); a = b;
  }
  let length = 0, px = sx, py = sy;
  for (const p of out) { length += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; }
  return { path: out, complete, length };
}

/** World distance travelled per second for a given world heading, matching the runtime's screen speed. */
function worldSpeed(dx, dy) {
  const d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  return SPEED_SCREEN / Math.max(0.2, Math.hypot((ux - uy) / 2, (ux + uy) / 4));
}

/** Follows a path with the runtime hero. Call update(player, dt) every frame while `active`. */
export function createNavigator() {
  const nav = {
    path: [], goal: null, reach: 0, complete: true, stuckFor: 0, lastX: 0, lastY: 0,
    get active() { return nav.path.length > 0; },
    clear() { nav.path = []; nav.goal = null; nav.stuckFor = 0; },
    /** Plan a route from the player to (x,y). Returns false if there is no usable route. */
    goTo(player, x, y, { reach = 0 } = {}) {
      const r = findPath(player.x, player.y, x, y, { reach });
      if (!r) { nav.clear(); return false; }
      nav.path = r.path; nav.goal = { x, y }; nav.reach = reach; nav.complete = r.complete; nav.stuckFor = 0;
      nav.lastX = player.x; nav.lastY = player.y;
      return r.path.length > 0 || r.complete;
    },
    /** Advance along the path. Returns true while still travelling. */
    update(player, dt) {
      if (!nav.path.length) return false;
      let wp = nav.path[0];
      while (nav.path.length && Math.hypot(wp.x - player.x, wp.y - player.y) < 10) { nav.path.shift(); wp = nav.path[0]; }
      if (!wp) { nav.goal = null; return false; }
      const dx = wp.x - player.x, dy = wp.y - player.y, d = Math.hypot(dx, dy);
      moveRuntimePlayerToward(wp.x, wp.y, Math.min(d, worldSpeed(dx, dy) * dt));
      const moved = Math.hypot(player.x - nav.lastX, player.y - nav.lastY);
      nav.lastX = player.x; nav.lastY = player.y;
      nav.stuckFor = moved < worldSpeed(dx, dy) * dt * 0.2 ? nav.stuckFor + dt : 0;
      if (nav.stuckFor > 0.6) { // blocked: replan once, then give up
        const goal = nav.goal, reach = nav.reach; nav.stuckFor = 0;
        if (!goal || !nav.goTo(player, goal.x, goal.y, { reach }) || !nav.path.length) { nav.clear(); return false; }
      }
      return nav.path.length > 0;
    },
  };
  return nav;
}
