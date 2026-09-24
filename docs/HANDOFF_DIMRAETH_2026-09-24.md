# Handoff: Dimraeth-style iso map engine + map editor (2026-09-24)

Read these first: `art-test/dimraeth-slice/ENGINE.md` (the engine handbook and the rules that must not be broken) and `docs/ISO_MAP_AUDIT_2026-09-24.md` (history).

## Status
- **The look is approved** (the user said "1000%"). This is fully procedural pixel art, no images. Keep the style; don't swap in tiles or AI assets without asking.
- Run `npm run dev` (in `C:\bunny-world`), then open:
  - Maps: `http://localhost:5173/art-test/dimraeth-slice/?map=<id>` (dropdown in the HUD)
  - Map editor: `http://localhost:5173/art-test/dimraeth-slice/editor.html`
  - Maps saved from the editor: `?map=custom&file=<name>`; the unsaved draft: `?map=draft`
- Snapshot taken before the big refactor: `C:\bunny-world\_snapshots\dimraeth-slice-20260924-1314`. The project is **not** a git repo yet.

## What exists
| Part | Location |
|---|---|
| Engine: height grid, stairs/ramps, rivers, lakes, lava, waterfalls, zbuf occlusion, native render scale K, biome kits, lighting, minimap | `art-test/dimraeth-slice/engine/*` |
| Hand-authored maps: forest, town, valley + 14 biome maps (forest2, desert1/2, mine1/2, snow1/2, magma1/2, underwater1/2, asgard1/2, city) | `scenes/*.js`, `scenes/biomes.js` |
| Map editor (phase 1–2 done): brushes for level 0–3, water, lava, stone road, dirt trail, **bridge (hand-painted)**, forest dense/sparse/clear, objects (tree, bush, rock, lantern, camp, house, crate, barrel, altar, pillar, portal, monster spawn), spawn point, slope-style dropdown, undo/redo, iso preview, Save/Load | `editor.html`, `editor.js`, `scenes/custom.js` |
| Save endpoint (dev only) `/__maps/save`, `/__maps/list` → `art-test/dimraeth-slice/maps/*.json` | `vite.config.ts` |
| Combat prototypes (Codex's), with fixes | `forest-combat.js`, `valley-combat.js`; `src/simulation/arenaAdapter.ts` (`respawnPoint`) |

## Decisions the user made (keep them)
- `worldScale 1.45` in forest-combat and always-on monster name/HP labels are **intentional**.
- Forest-type biomes use **natural cliffs** (earth band, boulders, roots). Brick/blocks only for city.
- Slopes follow the biome: forest/desert/snow/magma/underwater = **earth ramp**, mine = **wooden steps**, city/asgard = **stone stairs**. The editor can override.
- **No auto bridges**: the user paints bridges with the "สะพาน" brush.
- Editor maps start **blank** (nothing grows unless forest is painted, no forest border).
- Minimap = downscaled baked ground image, iso-oriented, crown colours taken from each sprite.
- Snow maps: no campfires.

## Open item (was being worked on when the session ended)
**Waterfalls sit too close to the bank.** The user wants the drop point pulled away from the shore by ~2–3 cells: the fall should begin further out, not right at the edge. Context: `settleWater()` in `scenes/custom.js` already prevents "walls of waterfall" when water is painted *along* a cliff. The new request is about where the fall starts on a genuine crossing. A possible approach: in `sceneFromMap`, where a water run crosses a level edge, move the upper-level edge of the water back (lower 2–3 upper cells nearest the fall to the lower level, or extend the lower pool upstream), so the lip sits out from the bank. Also update the editor preview (`derive()` / fall markers in `editor.js`) to match.

## Other pending ideas (offered, not started)
1. Editor phase 3: upload PNG/PixelLab assets → quantise to the biome palette + outline + feet anchor → new object type.
2. Animated flowing liquid texture (scrolling pixel texture masked to water/lava, shore-distance blend), per the user's water/lava guide image.
3. Faster loading: bake in a Web Worker + cache (maps take 5–13 s at K = 1.45).
4. `git init` the project before further big changes.

## Gotchas
- `requestAnimationFrame` pauses when the browser pane is hidden. Loading uses `yieldFrame()` (setTimeout). When testing in a hidden pane, shim rAF with setTimeout.
- `window.__slice` (runtime) and `window.__combat` (combat debug) are exposed for console testing.
- Codex also edits files in `art-test/dimraeth-slice/`. Re-read files before editing; keep ENGINE.md in sync.
