// Floating combat text and loot sparkles, drawn on a canvas layered over the scene canvas.
// Styling follows the arena prototype: white hits, gold "CRITICAL! ★", cyan mastery procs,
// red damage taken, green heals; loot pops in a colour by how rare the drop was.
import { projectRuntimePoint, runtimeWalkHeight } from '../engine/runtime.js';

export const LOOT_COLORS = { white: '#f4f2e8', green: '#6ee787', blue: '#62b5ff', purple: '#c77dff', gold: '#ffd45c' };
export const lootTierForChance = c => c >= .20 ? 'white' : c >= .10 ? 'green' : c >= .03 ? 'blue' : c >= .005 ? 'purple' : 'gold';

export function createFloaters(sceneCanvas) {
  const layer = document.createElement('canvas');
  layer.className = 'floater-layer';
  // The page styles every canvas with an opaque ground; this layer must stay see-through.
  layer.style.cssText = 'position:absolute;pointer-events:none;z-index:5;background:transparent!important;box-shadow:none;border:0';
  sceneCanvas.after(layer);
  const g = layer.getContext('2d');
  const items = [];
  // Visual-only budget: an AoE kill burst must not queue unlimited canvas text.
  const MAX_FLOATERS = 160;
  const trim = () => { if (items.length > MAX_FLOATERS) items.splice(0, items.length - MAX_FLOATERS); };
  let lastBounds = null, wasDrawn = false;
  const zAt = (x, y) => runtimeWalkHeight(x, y) ?? 0;

  function fit(viewport) {
    if (layer.width !== sceneCanvas.width || layer.height !== sceneCanvas.height) { layer.width = sceneCanvas.width; layer.height = sceneCanvas.height; }
    const r = viewport?.rect ?? sceneCanvas.getBoundingClientRect();
    const pr = viewport?.parent ?? sceneCanvas.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const next = [r.left - pr.left, r.top - pr.top, r.width, r.height];
    if (!lastBounds || next.some((value, i) => value !== lastBounds[i])) {
      [layer.style.left, layer.style.top, layer.style.width, layer.style.height] = next.map(value => `${value}px`);
      lastBounds = next;
    }
  }

  return {
    /** A number or short label over a world position. */
    text(x, y, text, { color = '#ffffff', size = 15, rise = 26, life = 1.2, lift = 24, dx = 0 } = {}) {
      items.push({ kind: 'text', x, y, text: String(text), color, size, rise, life, lift, dx, age: 0 });
      trim();
    },
    /** Loot burst from a defeated monster: one sparkle per item plus a name tag. */
    loot(x, y, drops) {
      drops.forEach(({ label, tier }, i) => {
        const a = i * .93 - 1.4;
        items.push({ kind: 'spark', x, y, tier, vx: Math.cos(a) * 26, vy: Math.sin(a) * 18 - 22, age: 0, delay: .25 + i * .06, life: 1.1 });
        items.push({ kind: 'text', x, y, text: label, color: LOOT_COLORS[tier], size: 12, rise: 30, life: 1.8, lift: 52 + i * 14, dx: 0, age: -(.25 + i * .06) });
      });
      trim();
    },
    update(dt) { for (let i = items.length - 1; i >= 0; i--) { items[i].age += dt; if (items[i].age >= items[i].life) items.splice(i, 1); } },
    draw(viewport) {
      if (!items.length && !wasDrawn) return;
      fit(viewport);
      g.clearRect(0, 0, layer.width, layer.height);
      wasDrawn = items.length > 0;
      if (!wasDrawn) return;
      g.textAlign = 'center';
      for (const f of items) {
        if (f.age < 0) continue;
        const t = f.age / f.life, p = projectRuntimePoint(f.x, f.y, zAt(f.x, f.y)), alpha = Math.min(1, (1 - t) * 3);
        g.save(); g.globalAlpha = alpha;
        if (f.kind === 'text') {
          const y = p.y - f.lift - f.rise * Math.min(1, t * 1.6);
          g.font = `800 ${f.size}px ui-monospace, "IBM Plex Mono", monospace`;
          g.lineWidth = 3; g.strokeStyle = 'rgba(20,12,8,.85)'; g.strokeText(f.text, p.x + f.dx, y);
          g.fillStyle = f.color; g.fillText(f.text, p.x + f.dx, y);
        } else if (f.age >= f.delay) {
          const s = (f.age - f.delay), rare = f.tier === 'purple' || f.tier === 'gold';
          g.shadowColor = LOOT_COLORS[f.tier]; g.shadowBlur = rare ? 14 : 7; g.fillStyle = LOOT_COLORS[f.tier];
          g.translate(p.x + f.vx * s, p.y - 14 + f.vy * s + 40 * s * s); g.rotate(Math.PI / 4);
          const size = rare ? 7 : 5; g.fillRect(-size / 2, -size / 2, size, size);
        }
        g.restore();
      }
    },
  };
}
