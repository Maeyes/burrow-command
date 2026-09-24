// Entry point: ?map=<id>. Register new scenes here and link them in index.html.
//   ?map=custom&file=<name>   a map saved by the editor (maps/<name>.json)
//   ?map=draft                the editor's unsaved draft (localStorage), used by the editor preview
//   &fast=1                   render at scale 1 (quicker preview bake)
import { boot, setRuntimePlayerVisual } from './engine/runtime.js';
import { loadBlessedHero, directionForIndex } from './combat/hero.js';
import forest from './scenes/forest.js';
import town from './scenes/town.js';
import valley from './scenes/valley.js';
import * as B from './scenes/biomes.js';
import { sceneFromMap } from './scenes/custom.js';

const SCENES = { forest, town, valley, ...B };
const q = new URLSearchParams(location.search), id = q.get('map');
// No ?map = the game itself; ?map=<scene> keeps the renderer showcase scenes for dev.
const combatRoute = !id || id === 'forest-combat' || id === 'valley-combat';

if (combatRoute) {
  await import('./game.js');
} else {
  const opts = q.get('fast') ? { renderScale: 1 } : {};
  let scene;
  if (id === 'draft') scene = sceneFromMap(JSON.parse(localStorage.getItem('bw-map-draft') || 'null') || (await import('./scenes/custom.js')).emptyMap(), opts);
  else if (id === 'custom' && import.meta.env.DEV) scene = sceneFromMap(await (await fetch(`./maps/${encodeURIComponent(q.get('file'))}.json`, { cache: 'no-store' })).json(), opts);
  else scene = (SCENES[id] || forest)();
  document.querySelectorAll('[data-map]').forEach(a => a.classList.toggle('active', a.dataset.map === id));
  const blessedHero = await loadBlessedHero();
  setRuntimePlayerVisual(player => blessedHero.visual({
    direction: directionForIndex(player.dir),
    moving: Boolean(player.moving),
    running: Boolean(player.moving),
  }));
  await boot(scene, { canvasEl: document.getElementById('scene'), loadingEl: document.getElementById('loading'), playerSprites: null });
}
