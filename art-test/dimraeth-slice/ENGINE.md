# Bunny World — Dimraeth-style iso map engine

Read this first before changing anything in `art-test/dimraeth-slice/`.
The visual style of this folder was approved by the project owner as *exactly* the target look.
Keep it. New work should add scenes, materials and sprite builders, not change the look.

Run: `npm run dev` → `http://localhost:5173/art-test/dimraeth-slice/?map=forest|town|valley`
Keys: WASD / arrows / click to walk · `L` day ↔ dusk · `H` hide HUD.

---

## 1. Hard rules (the look depends on these)

1. **One projection.** `isoX = (x - y) / 2`, `isoY = (x + y) / 4 - z` (`engine/util.js`). World +x = screen down-right, +y = down-left, z = height in screen px. 1 tile = `T` = 64 world units = 64×32 px diamond. Never add a second projection.
2. **One light.** Light comes from screen top-left (`L3` for sprites, `LW` for cylinders). Faces that face +y are lit (×1.0), faces that face +x are shaded (×0.72–0.74), tops are brightest (×1.1–1.18). Cast shadows fall toward +x.
3. **Palettes only.** Every pixel comes from a ramp in `engine/palettes.js` (dark → light, darks lean blue/green, lights lean yellow). Add a new ramp for a new material; don't use free colours.
4. **Dither, don't blend.** Continuous values → `Math.round(value + bayer(px, py) * ~0.9)` → index into a ramp. No anti-aliasing, no smooth gradients inside sprites. (Lighting overlays in `runtime.js` are the only smooth layer.)
5. **Selective outline.** Foliage/rocks: bottom/right edge = darkest ramp colour, top/left edge = +1 level (rim light) — `outline()` in `sprites.js`.
6. **Shadows are cool.** Darken with the blue-tinted multiply used in `bakeGround()` (`r*.88, g*.95, b*1.12+6`), never plain black.
7. **Man-made things align to the world axes.** That is what makes the scene read as isometric: roads, walls, fences, buildings, stairs, bridges are rectangles in world space.
8. **Deterministic.** Use `hash2`, `vnoise`, `fbm`, `rng(seed)`. Never `Math.random()` for anything baked (only for runtime particles).

## 2. Files

| File | What it does |
|---|---|
| `main.js` | Routes `?map=`. Both legacy combat URLs (`forest-combat`, `valley-combat`) delegate to the single `game.js`; non-combat scenes still call `boot()` directly. |
| `game.js` | The only combat game page: ArenaV2Adapter, HUD, inventory, skills/mastery, runtime actors, minimap integration, SFX/FX hooks and map/roster selection. |
| `src/simulation/masteryLoadout.ts` | Authoritative Weapon Mastery build loadout: passive capacity grows from 1→5 with the character's highest Weapon Mastery tier (Lv10/20/30/40/50), plus one on-hit active for each Lv10/Lv20/Lv30 mastery band. Cross-family mixing is allowed; combat reads installed loadout entries rather than all earned mastery levels. |
| `src/simulation/skillModifiersV2.ts` | Skill Mod duplicate stacking authority. The second identical mod scales the first mod's percentage multiplicatively (for example 20% → 24%), rather than adding another full +20%. Upgraded Mod rarity also scales both copies' authored percentages before duplicate stacking. |
| `src/simulation/skillCoreService.ts` | Shared upgrade authority for Skill Cores, Skill Mods and Movement Cores: same rarity, gold and success schedule; Core/Movement require 2 spare duplicates and Mod requires 6 (3×). The currently installed Core/Movement and all attached Mod copies are reserved and cannot be consumed. Rarity adds 10% per successful tier to damaging Core/Mod effects, and Movement Core gains exactly +1 world-unit travel distance per tier. The Skill window shows owned, reserved and available copies alongside required duplicates, current Gold vs cost, success chance and before/after effect; upgrade controls are disabled when materials/Gold are insufficient. All installed copies of one Mod ID share that Mod ID's rarity under the existing item-ID progression model. Movement skills use the authored walkability callback to travel their upgraded distance on large maps without legacy arena clamping or passing through blocked tiles. |
| Barrier HUD/minimap | Barrier is authoritative absorb-before-HP with a white overlay bar, white absorbed-damage floaters and hero shield FX. The minimap renders bosses with a pulsing crown marker and clamps off-crop bosses to the minimap edge so their direction remains visible. |
| `combat/rosters.js` | Adapts Forest/Desert/Mine roster modules from `iso-arena-draft` without copying their data; resolves the current pool and presentation assets. |
| `combat/hero.js` | Loads the Blessed Bunny manifest + frames, mirrors west directions, owns hero idle/walk/run/hurt/death/baked weapon attack presentation and manifest `footY` anchoring. |
| `engine/util.js` | Constants, projection, noise, dithering, helpers. |
| `engine/palettes.js` | All colour ramps. |
| `engine/sprites.js` | Procedural sprite builders (trees, bushes, rocks, grass, buildings, bridges, fountains, pillars, walls…) + `LIB` (shared variants built once). |
| `engine/terrain.js` | Height grid, stairs, rivers, waterfalls, ground colours and the ground bake. |
| `engine/world.js` | Places buildings/props/trees/scatter on the terrain (`blocked()` placement rules). |
| `engine/runtime.js` | Game loop: movement, depth sorting, terrain occlusion, lighting, particles, input. |
| `engine/state.js` | Shared mutable world state `WS`. |
| `scenes/*.js` | One file per map. A scene is **data**: layout + a few functions. |
| `_backup/` | Old single-file versions. Don't edit. |

## 3. How a frame is made

**Load (once, ~3–8 s):**
1. `buildLibraries()`: generate ~60 sprite variants.
2. `buildTerrain(scene)`: build a 512×512 grid of 16×16-unit cells, each with a height (px) and a material (`GROUND` / `STAIR` / `WATER`). Stairs and rivers are carved in.
3. `placeStructures()` then `placeScatter()`: fill `WS.objects`, `colliders`, `lights`, `shadows`, `baked`.
4. `bakeGround()`: for every screen pixel of a 3080×1920 canvas, cast a ray down through the cell grid (DDA). The hit is either a cell **top** or a vertical **face** between two cells. Colour it by material. Store the hit height in `zbuf`. Then paint `baked` props, flowers and ellipse shadows into the same image.
5. `maskStaticObjects()`: erase sprite pixels hidden behind higher terrain (uses `zbuf`).

**Every frame:**
blit the ground → animate water (glints + waterfall streaks) → player shadow → depth-sort visible objects (+ player, masked against `zbuf`) → particles → lighting (multiply layer + bloom + golden-hour grade + vignette).

## 4. Terrain model

- Cell size `C = 16` world units. Heights are in screen px. Typical values: terrace step 44–56, stair step 6–9, river surface −12 below the bank.
- **Faces are automatic.** A cell higher than its +x / +y neighbour shows a face on that side. Face material comes from the higher cell:
  - ground → rock cliff (`cliffColor`) with a grass overhang, or an earth bank (`bankColor`) if the lower cell is water and the drop is small
  - stair → riser (`riserColor`) on the climbing side, rock on the sides
  - water → waterfall (`fallColor`, animated in `drawWater()`)
- Faces that face −x/−y are never visible. So **cliffs you want to see must face +x or +y (the viewer)**. Put high ground toward the north (small x+y) and let rivers fall toward +y/+x.
- `terrain.walkHeight(x, y)` gives the walkable height (`null` = water); bridges override it. The player can step up to `STEP_UP = 12` px.
- `terrain.pick(sx, sy)` gives the visible surface under an absolute screen pixel. Used for click-to-move and scatter.

### Occlusion (why things behind cliffs hide correctly)
A sprite pixel `h` px above an object's feet is the 3D point `(x, y, z + h)` on that pixel's view ray. `zbuf` holds the terrain hit height on the same ray. If `zbuf > z + h`, the terrain is nearer the viewer, so that sprite pixel is hidden. Static sprites are masked once at load. The player is masked every frame (`occluded()` in `runtime.js`).

### Depth sorting between objects
`compare()` in `runtime.js`:
- Objects with `flat: true` (portals, bridge decks) draw first.
- Otherwise use a separating-axis test on world-space `box`es (`{x0,x1,y0,y1}`).
- Otherwise fall back to `x + y` of the box centres plus a height bias.

Long things (walls, fences) are split into short segments, each with its own box.

## 5. Scene format (see `scenes/valley.js` for every feature)

```js
{
  id, title,
  terrain: {
    height(x, y) -> px,                    // base heights (terraces, plateaus)
    stairs: [{ x0,x1,y0,y1, dir:'-x'|'-y', from, to }],  // climbs toward dir, one step per cell row
    rivers: [{ pts:[[x,y],...], width:n|[start,end], depth:12 }],
  },
  paved:   [{ x0,x1,y0,y1, style:'road'|'plaza' }],
  bridges: [{ x0,x1,y0,y1 }],               // deck spans along world x; height is automatic
  buildings: [{ x0,x1,y0,y1, wallH, roofH, ridge:'x'|'y', roof:RAMP, wall:'timber'|'stone'|'wood',
                door:{face:'x'|'y',at}, windows:[{face,at}], chimney, flowers, moss, awning, sign, tower, banner, floors }],
  plots, camps, yards, crates, logs, benches, barrels, lanterns, stalls, trees, fountain, wall, portals,
  props: [{ type:'pillar'|'altar'|'rubble', x, y, ... }],
  spawn: {x, y},
  baseDensity(x, y) -> 0..1,  densNoise, highDensity,   // forest density (edges dense, clearings empty)
  cliffStyle: 'natural',      // forest escarpment (earth band, roots, big boulders, moss); default = cut-stone blocks
  worn: 0..1,                  // how broken and dirty the roads look
  treePathClear, canopyClear,  // extra clearance so crowns don't hide roads/facades
  townLawn,                    // rect with fewer dirt patches
}
```
Coordinates are world units. Scenes use helpers `R4(x0,x1,y0,y1)` / `P(x,y)` in tile units.

## 6. Recipes

**New map:** copy `scenes/valley.js` → `scenes/<name>.js`, register it in `main.js`, add a link in `index.html`.

**New biome** (desert, snow, lava, underwater…):
1. Add ramps to `palettes.js`: ground, cliff, liquid, foliage.
2. Add a `scene.biome` switch in `groundColor` / `cliffColor` / `waterColor` (`terrain.js`). Keep the structure (fields → level → dither → ramp) and swap the ramps.
3. Add a sprite library in `buildLibraries()` (e.g. cacti = `paintClumps` with a tall narrow envelope; snowy pine = `pineTree` + white top levels).
4. Lava = a river with a glowing ramp + `WS.lights` along its path + ember particles.
5. Tune `drawLighting()` ambient / grade per biome (underwater: teal multiply + caustic overlay; cave: very dark ambient, torch lights only).

**New prop type:** write a builder in `sprites.js` using `rasterFaces` (boxes, roofs, pyramids), `cylinderSprite` (round things) or `paintClumps` (organic). Place it in `world.js`. Give it a `box` for sorting, a collider, and a shadow.

**Landmark art from PixelLab / hand-drawn:** quantise the image to the scene ramps, add the selective outline, anchor the feet at the ground point, then place it like any sprite. Don't paste unprocessed art. It won't match.

## 7. Known limits / next steps

- Bake time: forest ~3–6 s, town ~7–10 s. Before shipping, move `bakeGround` to a Web Worker and/or cache the result. Bigger maps need chunked baking.
- Cells are 16 units, so river banks and terrace edges are small iso staircases. Smoothing needs sub-cell edge offsets.
- Dynamic game actors can be registered with `setRuntimeActors()` and are terrain-height/depth sorted and masked through the same `occluded()` path as the player. Combat/AI ownership stays in the game layer. Actors may provide `getImage()` for animated frames and `drawOverlay(ctx, screenPoint)` for HP/name/target UI; use `projectRuntimePoint()` / `canRuntimeActorStand()` when adapting game simulation coordinates.
- Bridges span along world x only. Add a `dir` for y-spanning decks.
- No ramps (smooth slopes). Use stairs, or add a slope material whose top height varies within the cell.
- The runtime does not pause when the tab is hidden (`requestAnimationFrame` simply stops). Never `await requestAnimationFrame` during loading; use `yieldFrame()`.
- Combat integration: `game.js` is the single combat page and keeps `ArenaV2Adapter` authoritative for combat/HP/rewards. `main.js` routes both legacy URLs (`?map=forest-combat` and `?map=valley-combat`) into it. Maps provide scene/layout data only; editor monster markers become `scene.gameplay.spawnPoints`. `?file=<name>` is honoured only in `import.meta.env.DEV`; production always uses the bundled default Forest II map and never selects a combat map from the URL.
- Zone transfer: configured editor portals carry `id`, `to`, and `toPortal`. `combat/zone.js::requestZoneTransfer({fromMap,portalId,...})` is the single transfer authority/seam; it validates portal proximity and target existence. `game.js` shows `Warp to <map> [E]`, persists `character.currentMapId`, clears combat/FX/runtime state, and reloads the unified combat page at the target map/portal. `engine/runtime.js::teardown()` cancels the rAF and removes boot-owned listeners/actors; `combat/fx.js::teardown()` clears queued/assets. `combat/sfx.js` owns the procedural warp sound.
- Hero presentation: combat pages use only `combat/hero.js` + `art-test/isometric-player/blessed-bunny/manifest.json`. Five authored directions are mirrored for west/north-west/south-west and every frame is anchored with the manifest `footY`; hero art keeps `playerScale` and is never multiplied by `K`. `game.js` calls `boot(..., {playerSprites:null})`, so the combat page does not request the legacy root hero PNGs. Idle, walk, run, hurt, one-shot death (holding its final frame), and weapon attacks are selected from authoritative runtime/combat state. Greatsword/dagger/axe/hammer/bow/swordShield attack frames already contain weapon + slash art, so their playback definition emits gameplay impact only; staff has no baked Blessed attack and keeps the runtime code-drawn slash arc plus normal hit FX. `heroCombat.js` is used only for attack timing/playback state, never for its legacy frame-path helper.
- Combat FX: `combat/fx.js` imports `fx/manifest.json` and resolves frames only from `iso-arena-draft/fx/approved/**` through Vite's asset graph. It always loads approved `global` FX plus the exact selected map group (`forest2`, `desert1`, `mine`, etc.); if no exact approved group exists it falls back to global only. Active FX are temporary `kind:'actor'` runtime actors with `getImage()`, integer `visualScale`, `shadow:false` and `terrainOcclusion:true`, so they participate in actor depth sorting and the `occluded()` terrain mask instead of drawing directly on the canvas. Hit/death FX inherit the target monster's `visualScale`; `K` still owns world projection/render scale and is not applied a second time to PixelLab actor art.
- Runtime actor occlusion: `kind:'actor'` supports opt-in `terrainOcclusion:true` and optional `zOffset`. Occluded actors are nearest-neighbour scaled before masking; normal monster actors keep their existing render path unless they opt in. `drawOverlay()` remains after sprite drawing so always-on monster name/HP overlays are unchanged.
- Combat SFX: `combat/sfx.js` synthesizes 8-bit `swing`, `hit`, `crit`, monster `death`, `level up`, and `pickup/loot` using Web Audio oscillators/noise/envelopes only. `AudioContext` is created/resumed only after the first pointer/key gesture. Per-sound cooldowns prevent rapid identical sounds from stacking. The production combat HUD exposes `#sfx-toggle`; `M` remains reserved for Monster Index.
- Roster routing: `combat/rosters.js` imports the existing Forest, Desert and Mine roster modules from `iso-arena-draft` read-only. Selection order is `map.roster` → scene biome → `forest`. Forest/Desert use their PixelLab sequence roots; Mine uses roster metadata plus the existing Sunnyside Goblin/Skeleton strips and `MINE_BOSS_ROOT`. Spawn markers use the selected pool; maps without markers fall back to the game page's default spawn pattern (Valley preserves its six authored positions).
- Build routing: `index.html` loads `main.js`; `main.js` statically references the `game.js` dynamic import so Vite includes the unified combat chunk and its approved FX assets. The obsolete `forest-combat.js` and `valley-combat.js` pages are removed; only their URL values remain as compatibility routes.

## 8. Native render scale (`K`)

`K` (in `engine/util.js`) multiplies the projection. Set it per scene with `renderScale: 1.45`, or per page with `boot(scene, { renderScale })`. The legacy `worldScale` option is treated as renderScale.
- Terrain heights, sprite design sizes, shadow sizes and scatter spacing stay in **design px**. Only the output is ×K, so a bigger world stays pixel-crisp instead of being upscaled.
- `rasterFaces` passes patterns their `u,v` in design units, so bricks, windows and doors scale with the building.
- Foliage builders are called with `size * K` (see `buildLibraries`). Canvas-drawn runtime props (fences, lanterns, fire, flags, portals) draw in design px inside `ctx.scale(K)`.
- The hero and PixelLab monsters are **not** scaled by K. They keep their own `playerScale` / actor `visualScale`.
- Bake time grows with K². At 1.45 it is ~5–13 s per map. A Worker plus a cache is the next step.

## 9. Biome kits (`engine/biomes.js`)

A scene sets `biome: 'forest' | 'desert' | 'snow' | 'mine' | 'magma' | 'underwater' | 'asgard' | 'city'`. A kit provides:
- ramps: `ground, dirt, cliff, moss, liquid, foam` (used by the ground bake), plus `flowers`
- `cliffStyle`: `'natural'` (earth and boulders), `'strata'` (sandstone), `'lavaVein'` (basalt with glowing fissures), `'marble'` (ashlar with gold trim). Omit it for cut-stone blocks. A scene can override it.
- libraries: `trees.a / trees.b` (split by a noise zone), `trees.accent`, `bush, flowerBush, rock, tuft, tuftDark, reed`, `treeDensity`. Keys map to `LIB[...]` builders in `buildLibraries(kit)`.
- `light`: `day / dusk` ambient, `grade` overlay, `vignette`, `alwaysLights` (caves/magma: lights at full strength by day), `caustics` (underwater)
- `particles`: `leaf | sand | snow | dust | ember | bubble | mote`
- liquids: `glowLiquid` (lava gets lights along it), `frozen`, `cloudLiquid` (Asgard cloud sea)
- sprites with `glow` (crystals, ember trees) emit a light automatically.

Water bodies: `terrain.rivers` (polylines) **and** `terrain.waterMask(x,y)` + `waterDepth` (lakes, lava pools, cloud sea around islands, city canals).

## 10. Maps (`?map=`)

| id | biome | notes |
|---|---|---|
| forest, town, valley | forest | original slices (K = 1) |
| forest-combat, valley-combat | selected scene | compatibility URLs for the unified `game.js`; `forest-combat` defaults to bundled `forest2`, `valley-combat` loads `scenes/valley.js` |
| forest2 | forest | lake + long boardwalk, natural cliffs |
| desert1 / desert2 | desert | mesas + oasis / canyon river with falls + bridge |
| mine1 / mine2 | mine | cave rooms walled by 110 px rock, crystals / crystal lake with an island altar |
| snow1 / snow2 | snow | frozen lake / three glacier terraces, river, stairs |
| magma1 / magma2 | magma | lava rivers + bridge / caldera lake with an island altar |
| underwater1 / underwater2 | underwater | reef + trench / sunken Atlantis temple |
| asgard1 / asgard2 | asgard | floating isle over a cloud sea / Hall of Valor |
| city | city | street grid, townhouse rows, canal + bridges, keep, walls |

All new maps live in `scenes/biomes.js`. The helpers there are `blob()` (noisy ellipse), `edgeDensity()` and `caveHeight()`.

## 11. Map editor (`editor.html`)

`http://localhost:5173/art-test/dimraeth-slice/editor.html`. You paint *intent* on a 160×160 cell grid (4 cells per tile, 40×40 tiles) in the same iso orientation as the game:
terrain level 0–3 (44 px per level), water, road, spawn. The engine derives every edge (cliffs, banks, foam, waterfalls, worn road borders), so there are no tilesets or autotile rules.
- Draft autosaves to `localStorage['bw-map-draft']`. Preview loads `index.html?map=draft&fast=1` in an iframe.
- **Save** POSTs to the dev-only Vite middleware `/__maps/save` (see `vite.config.ts`), which writes `maps/<name>.json`. Play it with `?map=custom&file=<name>`.
- Map format and translation to a scene: `scenes/custom.js` (`sceneFromMap`). Maps also carry `roster` (`''` = automatic, or `forest` / `desert` / `mine`). The editor **Monsters** dropdown saves it; `game.js` falls back to the scene biome when it is empty. Painted roads become `scene.pavedField` (a signed distance field). `pavedAt` / `pathDist` in terrain.js read it.
- Forest brush: `forest` grid (0 auto, 1 clearing, 2 sparse, 3 forest, 4 dense) -> `baseDensity`.
- Objects: `objects[]` in tiles, types in `OBJECT_TYPES` (tree, bush, rock, lantern, camp, house{roof,floors,ridge}, crate, barrel, altar, pillar, portal, monster).
  Wild/village props: pine, stump, log{axis}, mushroom, flowers, fern, cactus, coral, fence{axis,len}, well, signpost, stall, cart, hay. Sprite-library props are listed in `PROPS` (world.js) and built lazily with `libOf(key)` (sprites.js), so they work in any biome.
  `monster` markers are exported as `scene.gameplay.spawnPoints` for the combat layer. They are not drawn in game.
- `autoStairs()`: road cells crossing to a higher level make a slope on the lower side. Its look is `style`: `slope` (smooth stepless earth incline, widened to at least 10 cells ≈ 3 characters, ~5.5 px rise per cell; the default for forest/desert/snow/mine/magma/underwater), `ramp` (earth track with 4.5 px steps), `wood` (wooden steps), `stone` (city/asgard). `slope` cells store a linear surface (`S0`/`SG` in terrain.js) that `castRay`, `heightAt` and `walkHeight` read exactly. Bump `TERRAIN_CACHE_VERSION` in runtime.js whenever ground rendering changes. Set per biome with `kit.stairStyle`, per map with `map.slopeStyle` (editor dropdown 'ทางขึ้นเนิน'), or per stair with `stairs[].style`.
- Roads: `road` grid value 1 = stone road (`pavedField`, cobbles), 2 = dirt trail (`trailField`, packed earth with ruts and frayed grassy edges). Both make slopes/stairs where they meet a higher terrace.
- Liquids: `water` grid value 1 = the biome's liquid, 2 = lava (any biome). Engine per-cell `LQ` picks the lava ramps, glow lights, orange glints and ember falls.
- Editor maps are blank by default (`bareByDefault`, `noEdgeForest`): trees, bushes and rocks only grow where forest is painted. Engine stairs support `-x/-y` (risers visible) and `+x/+y` (climbing away from the camera).
- Bridges are hand-painted (`bridge` grid, 'สะพาน' brush). `bridgesFromMask()` turns each connected patch into one deck spanning its longer side. There are no auto bridges any more (the user asked to place them manually).
- Organic edges: `sceneFromMap` samples level/water through a small noise warp (`organic: false` in the map turns it off), so straight strokes give meandering banks and cliffs. There is no warp near stairs or bridges.
- Cliff and bank look follow the biome: forest/snow/mine/underwater use `natural` (earth, boulders, roots); city uses `blocks`. Natural riverbanks have a ragged turf lip, soil with roots and waterline stones.
- Planned (phase 3): PixelLab/PNG asset upload (palette-quantised to the biome ramps + outline + feet anchor) as new object types.

## 12. Landmarks and bridge styles (2026-09-24)

- Bridge look follows the biome: `kit.bridgeStyle` = `wood` (default), `basalt` (magma: flagstones, cooled lava seams, arched side walls) or `marble` (asgard: marble deck, gold-capped balustrade). A bridge may set `style` to override it. Stone styles draw their parapets inside the deck sprite and add edge colliders instead of fence runs.
- `templeSprite()`: Asgard marble peristyle (3-step base, fluted columns, gold frieze, pediment with a sun disc). Editor object `temple` (4.5 × 3 tiles).
- `palaceSprite()`: an original undersea palace (pearl hall, glowing arched windows, spiral-shell towers, scallop dome). Editor object `palace` (4 × 3.25 tiles). It is built with `composeSprites()`, which stacks cylinder and face sprites back to front.
- Editor object `palm`: the desert palm, which can be placed in any biome.


### Event Time presentation

The DEV GM Event control in `ui/system.js` applies reward multipliers through `ArenaV2Adapter.setGmEventMultipliers()` and calls `ui/eventBanner.js`. The Event Time announcement is presentation-only: an animated golden center-screen banner appears once on **OFF → ON**, while a compact top ribbon continues showing active multipliers. Editing multipliers while live updates only the ribbon; turning the event off clears both. `ui/ui.css` owns the FX and includes a reduced-motion fallback. No reward/balance logic is duplicated in the banner.


### Shield Block rebalance

Every successful Block now mitigates **50% incoming damage**, increased to **70%** when the `swordShield:firmGuard` mastery passive is installed (with a shield equipped). Existing no-shield Guard penalties remain in place. All six T1–T6 offhand shield templates receive a **slot-bound** Block chance bonus from shield refinement: **+5 = +2 percentage points, +10 = +4 total, +15 = +6 total**. Bonuses are cumulative and follow the offhand shield slot when gear is swapped; they do not apply to an offhand dagger or invalid two-handed/shield combination. Installed Guard adds 8%; Perfect Guard raises mastery contribution to 12%. Total effective Block chance (mastery + shield refinement + any valid equipped-shield innate) is capped at **35%**. Character Status shows current effective Block chance and mitigation, while the existing gear refinement UI displays per-milestone Block bonuses.


### Innate weapon passives (equipped weapon, no Mastery slots)

`src/simulation/weaponInnatePassives.ts` derives bonuses exclusively from the actually equipped main-hand template and the valid offhand shield or dagger; it recognizes the original non-craftable `starterDagger`. The adapter recalculates and replaces all innate stats whenever equipment or character state changes. Mastery Loadout passives still require their normal slots, and these innate bonuses do not occupy them.

| Main weapon | Innate bonus |
| --- | --- |
| Dagger | ASPD +3, CRI +3, CRI DMG +6%; a real second dagger in Offhand adds 50% of these bonuses (total +4.5/+4.5/+9%). |
| Hammer | Max HP +6%, total DEF +3%. |
| Greatsword | Physical ATK +5%, affecting basic hits and physical skills. |
| One-handed sword (`swordShield`/Scepter family) | Physical ATK +3.5% whether or not a shield is equipped (70% of the Greatsword innate bonus). |
| Shield (any T1–T6 offhand shield) | Block chance +5 percentage points with any compatible main weapon, including Dagger and Staff; independently stacks with shield refinement. |
| Staff | MATK +5%. |
| Axe | Ignore 10% enemy physical DEF and heal for 2% of actual physical hit damage; on AoE physical skills, the first successfully hit target contributes full lifesteal, and additional targets contribute half. Echo-generated bonus hits do not lifesteal a second time. |
| Bow | Ranged physical ATK +5% and HIT +5. |

The new total Block cap is **35%**, combining Guard (8% or 12% with selected Perfect Guard), shield-refine bonuses (+5/+10/+15 => +2/+4/+6 percentage points), and innate from any equipped shield (+5 points). Example Dagger + Shield or One-handed Sword + Shield with Perfect Guard and shield +15 gives **23%**. Existing successful-Block 50% mitigation / 70% with Firm Guard and no-shield penalties are unchanged. Character Status reports the active Weapon Innate and relevant battle stats; the equipment detail card describes the item's innate effect. An offhand dagger adds its 50% bonus only with a main-hand Dagger. The shield innate is independent of main-hand family as long as that family can equip a shield, but never applies alongside a two-handed main weapon.
