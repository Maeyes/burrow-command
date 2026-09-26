// Skill / attack FX for the Dimraeth runtime.
// Sprite FX: PixelLab sheets in art-test/fx-production/skills/<id>/sheet.png (frames in a row,
// square cells; meta.json gives the frame count). Sheets load lazily the first time a skill,
// weapon swing or warp needs them, so a map only downloads what the hero actually uses.
// Code FX: dash afterimages (white bunny silhouette with a pink aura) and target telegraphs.
// Everything is drawn on one overlay canvas above the scene and under the floating text.
import { projectRuntimePoint, runtimeWalkHeight } from '../engine/runtime.js';

const SHEETS = import.meta.glob('../../fx-production/skills/*/sheet.png', { query: '?url', import: 'default' });
const METAS = import.meta.glob('../../fx-production/skills/*/meta.json', { import: 'default' });
const keyOf = (id, file) => `../../fx-production/skills/${id}/${file}`;

// How each FX is placed. kind: 'projectile' flies hero→target and faces its travel direction;
// 'beam' is stretched from hero to target; 'slash' sits on the target facing away from the hero;
// 'target' / 'ground' play on the target spot; 'self' on the hero; 'attach' follows the hero;
// 'loop' repeats until stopped. size = on-screen width in world units (AoEs use the skill radius).
export const FX_SPECS = {
  // Core skills
  fireball: { kind: 'projectile', size: 70, ms: 260, impact: 'hitFire' },
  iceLance: { kind: 'projectile', size: 84, ms: 240, baseAngle: -Math.PI / 4 }, // art points up-right
  piercingShot: { kind: 'projectile', size: 84, ms: 200 },
  chainLightning: { kind: 'beam', ms: 420 },
  thunderStorm: { kind: 'target', size: 120, ms: 620, anchor: 'bottom' },
  meteorStorm: { kind: 'ground', ms: 820 },
  lightningField: { kind: 'ground', ms: 900, flat: .5 },
  frostNova: { kind: 'self', ms: 560 },
  cyclone: { kind: 'attach', size: 150, ms: 900 },
  groundSlam: { kind: 'self', ms: 620 },
  blackHole: { kind: 'self', ms: 1150, flat: .5 },
  flameTrail: { kind: 'self', ms: 1000 },
  warCry: { kind: 'self', size: 220, ms: 600 },
  healingPulse: { kind: 'self', size: 170, ms: 700 },
  barrier: { kind: 'attach', size: 84, ms: 900, alpha: .45 },
  blink: { kind: 'self', size: 90, ms: 420 },
  bladeRush: { kind: 'slash', size: 130, ms: 380 },
  // Weapon mastery skills (they fire on attack). Entries without their own sheet borrow the closest
  // existing one via `sheet`; GPT stills animated by fx-production/fx_animate.py replace them over time.
  bowlingBash: { kind: 'target', size: 130, ms: 460 }, crescentBreak: { kind: 'slash', size: 170, ms: 460 },
  vanguardTempest: { kind: 'attach', size: 210, ms: 700 },
  crossSlash: { kind: 'slash', size: 120, ms: 380 }, shadowFlurry: { kind: 'target', size: 140, ms: 520 },
  phantomBlades: { kind: 'attach', size: 200, ms: 700 },
  cleavingStrike: { kind: 'target', size: 140, ms: 440 }, executionersSweep: { kind: 'slash', size: 200, ms: 460 },
  ravagerArc: { kind: 'self', ms: 560, flat: .6 },
  crushingImpact: { kind: 'target', size: 140, ms: 520 }, earthbreaker: { kind: 'self', ms: 680 },
  cataclysm: { kind: 'self', ms: 760 },
  powerShot: { kind: 'projectile', size: 110, ms: 200 }, piercingVolley: { kind: 'projectile', size: 120, ms: 220 },
  skyfallBarrage: { kind: 'ground', ms: 900 },
  arcBolt: { kind: 'projectile', size: 80, ms: 220 }, arcCascade: { kind: 'target', size: 150, ms: 520 },
  astralVolley: { kind: 'ground', ms: 900 },
  radiantBurst: { kind: 'target', size: 150, ms: 500 }, gravityPulse: { kind: 'self', ms: 640 },
  astralDominion: { kind: 'self', ms: 820 },
  // Basic attack overlays, per weapon family
  slashGreatsword: { kind: 'slash', size: 110, ms: 260 }, slashDagger: { kind: 'slash', size: 80, ms: 220 },
  slashAxe: { kind: 'slash', size: 104, ms: 260 }, slashHammer: { kind: 'target', size: 80, ms: 260 },
  slashSwordShield: { kind: 'slash', size: 92, ms: 240 }, shotArrow: { kind: 'projectile', size: 56, ms: 180 },
  boltStaff: { kind: 'projectile', size: 52, ms: 220 },
  // Late-game cores (procedural sheets from fx-production/fx_procedural.py)
  tidalWave: { kind: 'target', size: 140, ms: 620, anchor: 'bottom' },
  abyssalGrasp: { kind: 'self', ms: 900, flat: .5 },
  siphonSoul: { kind: 'beam', ms: 600 },
  mjolnirStrike: { kind: 'target', size: 130, ms: 640, anchor: 'bottom' },
  thorsJudgement: { kind: 'target', size: 100, ms: 700, flat: .5 },
  valkyriesCall: { kind: 'attach', size: 150, ms: 800 },
  ragnarok: { kind: 'ground', ms: 1100, flat: .5 },
  // World
  warp: { kind: 'loop', size: 96, ms: 900 }, // pad is 80 world units across
};
// Projectile arrival bursts (code particles).
const IMPACT = {
  fireball: { color: '#ffb347', color2: '#ff5a2a', count: 18, speed: 110 },
  iceLance: { color: '#dff8ff', color2: '#8fdcff', count: 16, speed: 90, gravity: 220 },
  piercingShot: { color: '#fff1a8', color2: '#ffd24a', count: 12, speed: 120 },
  powerShot: { color: '#fff1a8', color2: '#ffd24a', count: 16, speed: 130 },
  piercingVolley: { color: '#fff1a8', count: 10, speed: 110 },
  arcBolt: { color: '#c8a8ff', color2: '#7fb2ff', count: 12, speed: 90 },
  boltStaff: { color: '#c8a8ff', color2: '#7fb2ff', count: 8, speed: 70 },
  shotArrow: { color: '#f4efe0', count: 6, speed: 70 },
  default: { color: '#fff3c4', count: 10, speed: 80 },
};
export const BASIC_ATTACK_FX = { greatsword: 'slashGreatsword', dagger: 'slashDagger', axe: 'slashAxe', hammer: 'slashHammer', swordShield: 'slashSwordShield', bow: 'shotArrow', staff: 'boltStaff' };

export function createSkillFx(sceneCanvas, { beforeEl = null } = {}) {
  const layer = document.createElement('canvas');
  layer.className = 'skillfx-layer';
  layer.style.cssText = 'position:absolute;pointer-events:none;z-index:4;background:transparent!important;box-shadow:none;border:0';
  (beforeEl || sceneCanvas).after(layer);
  const g = layer.getContext('2d');
  const sheets = new Map();   // id -> {img, frames, cell} | 'loading' | null
  const items = [];
  const parts = [];   // code particles: world x/y, height h above ground, velocities in world units/s
  let statusSource = null;
  const zAt = (x, y) => runtimeWalkHeight(x, y) ?? 0;
  const proj = (x, y) => projectRuntimePoint(x, y, zAt(x, y));
  // screen pixels per world unit at a spot (the iso projection squashes y by half)
  // Screen pixels per world unit, measured at ONE height so slopes/ledges nearby can't change the
  // size. A world circle of radius r is an iso ellipse r*a*√2 wide, where a = screen px per world x.
  const pxPerUnit = (x, y) => { const z = zAt(x, y), a = projectRuntimePoint(x, y, z), b = projectRuntimePoint(x + 10, y, z); return Math.abs(b.x - a.x) / 10 * Math.SQRT2; };

  function fit() {
    if (layer.width !== sceneCanvas.width || layer.height !== sceneCanvas.height) { layer.width = sceneCanvas.width; layer.height = sceneCanvas.height; }
    const r = sceneCanvas.getBoundingClientRect(), pr = sceneCanvas.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    Object.assign(layer.style, { left: `${r.left - pr.left}px`, top: `${r.top - pr.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  }

  const sheetId = id => FX_SPECS[id]?.sheet ?? id;
  function load(fxId) {
    const id = sheetId(fxId);
    if (sheets.has(id)) return;
    const sheetUrl = SHEETS[keyOf(id, 'sheet.png')];
    if (!sheetUrl) { sheets.set(id, null); return; }
    sheets.set(id, 'loading');
    Promise.all([sheetUrl(), METAS[keyOf(id, 'meta.json')]?.() ?? Promise.resolve(null)]).then(([url, meta]) => {
      const img = new Image();
      img.onload = () => { const cell = meta?.cell || img.height; sheets.set(id, { img, cell, frames: meta?.frames || Math.max(1, Math.round(img.width / cell)) }); };
      img.onerror = () => sheets.set(id, null);
      img.src = url;
    }).catch(() => sheets.set(id, null));
  }

  function drawSheetFrame(sheet, t, loop) {
    const f = loop ? Math.floor(t * sheet.frames) % sheet.frames : Math.min(sheet.frames - 1, Math.floor(t * sheet.frames));
    return [sheet.img, f * sheet.cell, 0, sheet.cell, sheet.cell];
  }

  // Code fallback while a sheet is still loading (or missing): a soft coloured pulse.
  function drawFallback(item, p, sizePx, t) {
    g.globalAlpha = (1 - t) * .7; g.strokeStyle = item.color || '#ffe7a8'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(p.x, p.y, sizePx * .5 * (.4 + t * .6), sizePx * .25 * (.4 + t * .6), 0, 0, Math.PI * 2); g.stroke();
  }

  const api = {
    /** Warm the cache for FX the hero is likely to use (equipped skills, weapon family, warp). */
    preload(ids) { ids.filter(Boolean).forEach(load); },

    /** Play a sprite FX. from/to are world positions; radius (world units) sizes AoEs. */
    play(id, { from, to, radius = 0, follow = null, color = null } = {}) {
      const spec = FX_SPECS[id]; if (!spec) return null;
      load(id);
      const size = spec.size ?? (radius ? radius * 2.1 : 110);
      const item = { id, spec, from: from && { ...from }, to: to && { ...to }, follow, size, age: 0, life: spec.ms / 1000, color };
      items.push(item); return item;
    },
    stop(item) { const i = items.indexOf(item); if (i >= 0) items.splice(i, 1); },

    /** Dash / movement afterimages: a white silhouette of the current hero frame with a pink aura. */
    ghost(visual, x, y, { scale = 1, life = .32 } = {}) {
      if (!visual?.image) return;
      const src = visual.image, w = src.width, h = src.height;
      // white silhouette of the frame…
      const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
      const sg = sil.getContext('2d'); sg.drawImage(src, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#fff6fb'; sg.fillRect(0, 0, w, h);
      // …with a pink aura glowing around it
      const c = document.createElement('canvas'); c.width = w + 16; c.height = h + 16;
      const cg = c.getContext('2d'); cg.shadowColor = '#ff5fae'; cg.shadowBlur = 10;
      cg.drawImage(sil, 8, 8); cg.drawImage(sil, 8, 8);
      items.push({ id: '__ghost', ghost: c, flipX: visual.flipX, footY: (visual.footY ?? h) + 8, x, y, scale, age: 0, life });
    },


    /** Burst of pixel particles at a world spot (impacts, level up, potions, respawn). */
    burst(x, y, { color = '#fff3c4', color2 = null, count = 14, speed = 90, up = 60, life = .55, size = 3, gravity = 160, h = 18 } = {}) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (.4 + Math.random() * .6);
        parts.push({ x, y, h, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vh: up * (.5 + Math.random()), g: gravity, age: 0, life: life * (.7 + Math.random() * .5), size, color: color2 && i % 2 ? color2 : color });
      }
    },
    /** Rising column of sparkles (level up / heal). */
    pillar(x, y, { color = '#ffe27a', count = 26, life = 1.1 } = {}) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 22;
        parts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, h: Math.random() * 10, vx: 0, vy: 0, vh: 50 + Math.random() * 90, g: -10, age: -Math.random() * .4, life, size: 2 + (i % 3), color, twinkle: true });
      }
      items.push({ id: '__ring', x, y, radius: 34, color, age: 0, life: .7, solid: true });
    },
    /** Status overlays are drawn every frame from this provider: () => [{x,y,slow,stun,armorBreak}]. */
    setStatusSource(fn) { statusSource = fn; },
    /** Ground telegraph ring under an area skill's target spot. */
    ring(x, y, radius, color = '#ffd27a', life = .45) { items.push({ id: '__ring', x, y, radius, color, age: 0, life }); },

    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.age += dt; if (q.age < 0) continue; if (q.age >= q.life) { parts.splice(i, 1); continue; }
        q.x += q.vx * dt; q.y += q.vy * dt; q.vh -= q.g * dt; q.h = Math.max(0, q.h + q.vh * dt); q.vx *= .96; q.vy *= .96; }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; it.age += dt;
        if (it.age >= it.life) {
          if (it.spec?.kind === 'loop') { it.age = 0; continue; }
          if (it.spec?.kind === 'projectile' && it.to) api.burst(it.to.x, it.to.y, IMPACT[it.id] || IMPACT.default);
          items.splice(i, 1);
        }
      }
    },

    draw() {
      fit();
      g.clearRect(0, 0, layer.width, layer.height);
      g.imageSmoothingEnabled = false;
      for (const it of items) {
        const t = Math.min(.999, it.age / it.life);
        g.save();
        if (it.id === '__ghost') {
          const p = proj(it.x, it.y), s = it.scale;
          g.globalAlpha = .55 * (1 - t);
          g.translate(p.x, p.y); if (it.flipX) g.scale(-1, 1);
          g.drawImage(it.ghost, -it.ghost.width / 2 * s, -it.footY * s, it.ghost.width * s, it.ghost.height * s);
          g.restore(); continue;
        }
        if (it.id === '__ring') {
          const p = proj(it.x, it.y), r = it.radius * pxPerUnit(it.x, it.y);
          g.globalAlpha = .8 * (1 - t); g.strokeStyle = it.color; g.lineWidth = it.solid ? 3 : 2; g.setLineDash(it.solid ? [] : [8, 6]);
          if (it.solid) { const k = .4 + t * .8; g.beginPath(); g.ellipse(p.x, p.y, r * k, r * k * .5, 0, 0, Math.PI * 2); g.stroke(); g.restore(); continue; }
          g.beginPath(); g.ellipse(p.x, p.y, r, r * .5, 0, 0, Math.PI * 2); g.stroke();
          g.restore(); continue;
        }
        const spec = it.spec, sheet = sheets.get(sheetId(it.id));
        const self = it.follow ? it.follow() : it.from;
        let at = self, angle = 0, stretch = null;
        if (spec.kind === 'projectile' && it.from && it.to) {
          at = { x: it.from.x + (it.to.x - it.from.x) * t, y: it.from.y + (it.to.y - it.from.y) * t };
          const a = proj(it.from.x, it.from.y), b = proj(it.to.x, it.to.y); angle = Math.atan2(b.y - a.y, b.x - a.x);
        } else if (spec.kind === 'beam' && it.from && it.to) {
          const a = proj(it.from.x, it.from.y), b = proj(it.to.x, it.to.y);
          stretch = { a, b }; angle = Math.atan2(b.y - a.y, b.x - a.x);
        } else if (spec.kind === 'slash' && it.to) {
          at = it.to; if (it.from) { const a = proj(it.from.x, it.from.y), b = proj(it.to.x, it.to.y); angle = Math.atan2(b.y - a.y, b.x - a.x); }
        } else if ((spec.kind === 'target' || spec.kind === 'ground') && it.to) at = it.to;
        if (!at) { g.restore(); continue; }
        const p = proj(at.x, at.y);
        let sizePx = it.size * pxPerUnit(at.x, at.y);
        if (!sheet || sheet === 'loading') { drawFallback(it, p, sizePx, t); g.restore(); continue; }
        const [img, sx, sy, sw, sh] = drawSheetFrame(sheet, t, spec.kind === 'loop');
        // Animated sheets fade inside their own frames (dithered), so draw them fully opaque;
        // only one-frame stills get the code fade below.
        g.globalAlpha = 1;
        // one-frame stills (no generated animation yet): pop in, grow a touch, fade out
        const still = sheet.frames === 1 && spec.kind !== 'projectile', pop = still ? .85 + .3 * t : 1;
        if (still) g.globalAlpha = Math.min(1, t * 8) * (1 - t);
        if (spec.alpha) g.globalAlpha *= spec.alpha;
        if (stretch) {
          const len = Math.hypot(stretch.b.x - stretch.a.x, stretch.b.y - stretch.a.y);
          g.translate(stretch.a.x, stretch.a.y - 18); g.rotate(angle); g.drawImage(img, sx, sy, sw, sh, 0, -len * .25, len, len * .5);
        } else {
          const lift = spec.anchor === 'bottom' ? sizePx * .45 : (spec.kind === 'projectile' || spec.kind === 'slash' || spec.kind === 'attach' ? 22 : 0);
          g.translate(p.x, p.y - lift);
          if (spec.baseAngle !== undefined) g.rotate(angle - spec.baseAngle);
          else if (angle) { if (Math.abs(angle) > Math.PI / 2) { g.scale(-1, 1); angle = Math.PI - angle; } g.rotate(spec.kind === 'slash' ? angle * .5 : angle); }
          sizePx *= pop;
          // flat = ground decal drawn from above; squash it onto the iso floor.
          const h = sizePx * (spec.flat ?? 1);
          g.drawImage(img, sx, sy, sw, sh, -sizePx / 2, -h / 2, sizePx, h);
        }
        g.restore();
      }

      // particles
      for (const q of parts) {
        if (q.age < 0) continue;
        const p = proj(q.x, q.y), t = q.age / q.life;
        g.globalAlpha = (1 - t) * (q.twinkle ? (.6 + .4 * Math.sin(q.age * 30)) : 1);
        g.fillStyle = q.color; const sz = Math.max(1, Math.round(q.size * (1 - t * .5)));
        g.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - q.h - sz / 2), sz, sz);
      }
      g.globalAlpha = 1;
      // status overlays on monsters
      const now = performance.now() / 1000;
      for (const m of statusSource?.() || []) {
        const p = proj(m.x, m.y);
        if (m.slow) {
          g.globalAlpha = .55 + .15 * Math.sin(now * 6); g.strokeStyle = '#9eeaff'; g.lineWidth = 2;
          g.beginPath(); g.ellipse(p.x, p.y, 17, 8, 0, 0, Math.PI * 2); g.stroke();
          g.fillStyle = '#dff8ff';
          for (let k = 0; k < 3; k++) { const a = now * 2 + k * 2.1, fx = p.x + Math.cos(a) * 14, fy = p.y - 16 - ((now * 18 + k * 9) % 26); g.globalAlpha = .8; g.fillRect(Math.round(fx), Math.round(fy), 2, 2); g.fillRect(Math.round(fx) - 2, Math.round(fy), 1, 1); g.fillRect(Math.round(fx) + 3, Math.round(fy), 1, 1); }
        }
        if (m.stun) {
          g.globalAlpha = 1;
          for (let k = 0; k < 3; k++) { const a = now * 5 + k * (Math.PI * 2 / 3), sx = p.x + Math.cos(a) * 13, sy = p.y - 46 + Math.sin(a) * 4;
            g.fillStyle = k === 0 ? '#fff6a8' : '#ffd24a'; g.fillRect(Math.round(sx) - 1, Math.round(sy) - 3, 2, 6); g.fillRect(Math.round(sx) - 3, Math.round(sy) - 1, 6, 2); }
        }
        if (m.armorBreak) {
          g.globalAlpha = .7 + .3 * Math.sin(now * 9); g.fillStyle = '#ff9b52';
          for (let k = 0; k < 2; k++) { const fx = p.x - 10 + k * 18, fy = p.y - 30 - ((now * 22 + k * 11) % 18); g.fillRect(Math.round(fx), Math.round(fy), 2, 3); }
        }
      }
      g.globalAlpha = 1;
    },
  };
  return api;
}
