// Auto Hunt brain: decides WHICH monster to fight, when to rest and when to come home.
// Pure logic (no DOM / runtime access) — game.js feeds it plain snapshots and acts on the answer.

export const AUTOHUNT_DEFAULTS = Object.freeze({
  leashRadius: 950,        // never wander further than this from where Auto Hunt was switched on
  maxLevelAbove: 4,        // skip normal monsters more than N levels above the hero
  restBelow: 0.4,          // stand still and regenerate under this HP fraction…
  resumeAbove: 0.8,        // …until back above this one
  packRadius: 210,         // other mobs this close to a candidate will join the fight
  dangerRadius: 320,       // elites/bosses this close make a candidate unattractive
  blacklistSeconds: 18,    // unreachable / stuck targets are ignored for a while
  pathCandidates: 6,       // how many nearest candidates get a real path check
  thinkEvery: 0.35,        // seconds between target decisions
  retreatBelow: 0.22,      // mid-fight HP fraction that triggers a run to the safe zone…
  finishIfTargetBelow: 0.2,// …unless the current target is almost dead anyway
  maxRetreatTravel: 1400,  // a safe zone further than this (walking distance) is not worth running for
});

/**
 * @typedef {{id:string,x:number,y:number,level:number,hp:number,maxHp:number,alive:boolean,
 *            elite?:boolean,boss?:boolean,aggroed?:boolean}} HuntMonster
 * @typedef {{x:number,y:number,hp:number,maxHp:number,level:number,alive:boolean,attackRange:number}} HuntHero
 */

export function createAutoHunt(options = {}) {
  const cfg = { ...AUTOHUNT_DEFAULTS, ...options };
  const hunt = {
    on: false,
    anchor: null,
    resting: false,
    blacklist: new Map(),   // id -> until (seconds)
    clock: 0,
    thinkIn: 0,
    status: 'OFF',
    config: cfg,

    start(hero) { hunt.on = true; hunt.anchor = { x: hero.x, y: hero.y }; hunt.resting = false; hunt.retreating = false; hunt.thinkIn = 0; hunt.status = 'HUNTING'; },
    stop() { hunt.on = false; hunt.resting = false; hunt.retreating = false; hunt.status = 'OFF'; },
    toggle(hero) { hunt.on ? hunt.stop() : hunt.start(hero); return hunt.on; },
    ban(id, seconds = cfg.blacklistSeconds) { hunt.blacklist.set(id, hunt.clock + seconds); },
    banned(id) { const t = hunt.blacklist.get(id); if (t === undefined) return false; if (t <= hunt.clock) { hunt.blacklist.delete(id); return false; } return true; },

    /** Is the hero strong enough to take this monster at all? */
    eligible(m, hero) {
      if (!m.alive || hunt.banned(m.id)) return false;
      if (m.aggroed) return true;                                   // it is already on us: always fair game
      if (m.boss) return false;                                     // bosses are never auto-pulled
      const gap = m.level - hero.level, hpFrac = hero.hp / Math.max(1, hero.maxHp);
      if (m.elite) return gap <= 1 && hpFrac >= 0.8;
      if (gap > cfg.maxLevelAbove) return false;
      if (hunt.anchor && Math.hypot(m.x - hunt.anchor.x, m.y - hunt.anchor.y) > cfg.leashRadius) return false;
      return true;
    },

    /** Score a candidate; higher is better. `travel` is the real walking distance to it. */
    score(m, hero, monsters, travel, currentId) {
      const gap = m.level - hero.level;
      let s = 100 - travel / 10;                                   // closer is better
      s += gap >= 0 ? Math.min(gap, 3) * 6 : gap * 4;              // a little above = good exp; far below = wasteful
      if (gap > 2) s -= (gap - 2) * 10;                            // …but don't overreach
      s += (1 - m.hp / Math.max(1, m.maxHp)) * 15;                 // finish wounded mobs first
      if (m.id === currentId) s += 12;                             // stickiness: no target ping-pong
      if (m.elite) s -= 10;
      let pack = 0, danger = 0;
      for (const o of monsters) {
        if (o === m || !o.alive) continue;
        const d = Math.hypot(o.x - m.x, o.y - m.y);
        if ((o.elite || o.boss) && d < cfg.dangerRadius) danger++;
        else if (d < cfg.packRadius) pack++;
      }
      s -= pack * 9 + danger * 40;
      return s;
    },

    /** Someone is hitting us while we chase a passive mob → switch to the nearest attacker. */
    defendTarget(hero, monsters, currentId) {
      const cur = monsters.find(m => m.id === currentId);
      if (cur?.aggroed) return null;
      let best = null, bd = Infinity;
      for (const m of monsters) {
        if (!m.alive || !m.aggroed) continue;
        const d = Math.hypot(m.x - hero.x, m.y - hero.y);
        if (d < bd) { bd = d; best = m; }
      }
      return best ? best.id : null;
    },

    /**
     * Pick the next monster. `pathLength(m)` must return the walking distance to attack range,
     * or null when unreachable (those mobs get blacklisted).
     */
    choose(hero, monsters, pathLength, currentId = null) {
      const pool = monsters.filter(m => hunt.eligible(m, hero));
      // 1) defend first: monsters already attacking us, nearest first
      const attackers = pool.filter(m => m.aggroed).sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y));
      if (attackers.length) return { id: attackers[0].id, reason: 'defend' };
      // 2) otherwise best score among the nearest few that are actually reachable
      const near = pool.sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y)).slice(0, cfg.pathCandidates);
      let best = null;
      for (const m of near) {
        const travel = pathLength(m);
        if (travel === null) { hunt.ban(m.id); continue; }
        const sc = hunt.score(m, hero, monsters, travel, currentId);
        if (!best || sc > best.score) best = { id: m.id, score: sc, reason: 'best' };
      }
      return best;
    },

    /**
     * Per-frame driver. Returns what game.js should do this frame:
     *  { action:'rest' } stand still · { action:'fight', id } start/keep fighting id ·
     *  { action:'home' } walk back to the anchor · { action:'wait' } nothing to do · null when off.
     */
    tick(dt, hero, monsters, { fighting, currentId, beingAttacked, pathLength, safe = null }) {
      if (!hunt.on) return null;
      hunt.clock += dt;
      if (!hero.alive) { hunt.status = 'DEAD'; return { action: 'wait' }; }
      const hpFrac = hero.hp / Math.max(1, hero.maxHp);
      if (hunt.resting && hpFrac >= cfg.resumeAbove) { hunt.resting = false; hunt.retreating = false; }
      // Safe-zone retreat: HP critical while monsters are on us → run to the nearest warp safe zone
      // (monsters can't follow or attack there), rest there, then come back out.
      if (safe) {
        if (hunt.retreating && safe.inside) { hunt.resting = true; hunt.status = 'RESTING (SAFE)'; return { action: 'rest' }; }
        const target = monsters.find(m => m.id === currentId);
        const targetNearlyDead = target && target.hp / Math.max(1, target.maxHp) <= cfg.finishIfTargetBelow && !monsters.some(m => m.aggroed && m.id !== currentId);
        const inDanger = beingAttacked && !targetNearlyDead && (hpFrac < cfg.retreatBelow || (hunt.resting && hpFrac < cfg.restBelow));
        if (!hunt.retreating && inDanger && !safe.inside && hunt.clock >= (hunt.retreatCheckAt ?? 0)) {
          hunt.retreatCheckAt = hunt.clock + 1;             // path check at most once a second
          const travel = safe.travel?.();
          if (travel !== null && travel !== undefined && travel <= cfg.maxRetreatTravel) hunt.retreating = true;
        }
        if (hunt.retreating && !safe.inside) { hunt.resting = true; hunt.status = 'RETREATING'; return { action: 'retreat' }; }
      }
      if (!hunt.resting && !fighting && !beingAttacked && hpFrac < cfg.restBelow) hunt.resting = true;
      if (hunt.resting && !beingAttacked) { hunt.status = 'RESTING'; return { action: 'rest' }; }

      if (fighting) {
        hunt.status = 'FIGHTING';
        hunt.thinkIn -= dt;
        if (hunt.thinkIn <= 0) {
          hunt.thinkIn = cfg.thinkEvery;
          const def = hunt.defendTarget(hero, monsters, currentId);
          if (def) return { action: 'fight', id: def };
        }
        return { action: 'fight', id: currentId };
      }

      hunt.thinkIn -= dt;
      if (hunt.thinkIn > 0) return { action: 'wait' };
      hunt.thinkIn = cfg.thinkEvery;
      const pick = hunt.choose(hero, monsters, pathLength, currentId);
      if (pick) { hunt.status = pick.reason === 'defend' ? 'DEFENDING' : 'HUNTING'; return { action: 'fight', id: pick.id }; }
      const away = hunt.anchor ? Math.hypot(hunt.anchor.x - hero.x, hunt.anchor.y - hero.y) : 0;
      hunt.status = away > 160 ? 'RETURNING' : 'SEARCHING';
      return { action: away > 160 ? 'home' : 'wait' };
    },
  };
  return hunt;
}
