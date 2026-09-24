// Shared constants, deterministic noise and iso projection helpers.
// Everything in the engine is seeded/deterministic: the same scene always bakes the same image.

export const W = 1280, H = 720;   // canvas size (screen pixels)
export const T = 64;              // one logical tile = 64 world units = 64x32 px diamond
export const S = 40 * T;          // playable world is [0,S] x [0,S]

// ---------- projection (2:1 isometric, identical to iso-arena-draft) ----------
// world +x runs down-right on screen, world +y runs down-left, z is height in *design* px.
// K = native render scale. Everything (ground bake, sprites, heights) is generated at K, so a
// bigger world stays crisp instead of being upscaled. Heights and sprite design sizes stay in
// design px; only the output is multiplied. Set once per page with setRenderScale() before building.
export let K = 1;
export function setRenderScale(k) { K = k; }
export const isoX = (x, y) => (x - y) / 2 * K;
export const isoY = (x, y, z = 0) => ((x + y) / 4 - z) * K;
// inverse at height z (design px): screen (sx, sy) -> world
export const unIso = (sx, sy, z = 0) => { const a = sx / K, b = sy / K + z; return [a + 2 * b, 2 * b - a]; };

// ---------- noise ----------
export function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y) => vnoise(x, y) * .55 + vnoise(x * 2.03 + 17, y * 2.03 + 9) * .3 + vnoise(x * 4.1 + 41, y * 4.1 + 3) * .15;
export function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 4x4 ordered dither: added to a continuous level before rounding -> pixel-art gradients.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16 - .47);
export const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const pal = a => a.map(hex);
export const shadeCol = (c, k) => [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const inRect = (x, y, r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m;

// ONE light direction for the whole world: from screen top-left.
export const L3 = (() => { const v = [-.55, -.7, .45], l = Math.hypot(...v); return v.map(c => c / l); })(); // sprite space
export const LW = (() => { const v = [-.62, .5], l = Math.hypot(...v); return v.map(c => c / l); })();     // world plane (cylinders)

export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export const yieldFrame = () => new Promise(r => setTimeout(r, 0)); // NOT requestAnimationFrame: it pauses in hidden tabs
