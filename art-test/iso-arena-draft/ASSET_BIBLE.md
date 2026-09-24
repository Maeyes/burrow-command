# BUNNY WORLD — ISO ASSET BIBLE v1

## Locked visual foundation
- Projection: standard 2:1 isometric.
- Screen axes: world X runs down-right; world Y runs down-left at ±26.565°.
- Rendering: crisp pixel art; no baked perspective distortion, blur, bloom, fog, or smooth-painting effects.
- Runtime may add restrained HD-2D lighting, shadows, fog, bloom, particles, and depth treatment.
- Visual target: dense, readable fantasy-isometric field language established by `iso-arena-draft`, with ISO-CORE / Dimraeth as direction references.
- Preserve the current dark-green forest palette, environmental density, readable combat clearing, and character-to-world relationship unless deliberately testing one variable.

## Canonical grid
- Logical tile footprint: 64 × 32 px (2:1 diamond) at reference zoom.
- Half tile: 32 × 16 px.
- Every world object has a ground/feet anchor on the logical grid.
- Tall assets extend upward from their anchor; never move the anchor to visually center the sprite.
- Collision footprint and visual footprint are separate metadata.
- Depth key is based on the ground anchor, not sprite top-left.

## Pixel rules
- Nearest-neighbor rendering only.
- Integer pixel placement at reference zoom where possible.
- No antialiased vector edges inside source assets.
- No baked drop shadow unless the asset specifically requires a contact shadow; runtime owns dynamic shadows.
- Transparent PNG for objects/characters/VFX sprites.
- Terrain tiles must be seamless on their intended edges.

## Library taxonomy

### 01 Terrain
Base grass, dirt, stone, mud/wet ground, corrupted/magical ground. Include clean base tiles before variants.

### 02 Terrain transitions
Grass↔dirt, grass↔stone, cliff/ledge edges, corners, inner corners, banks and other biome-specific boundaries.

### 03 Paths
Straight ISO paths, bends, junctions, worn edges, broken/overgrown variants. Paths must respect the same 64×32 grid.

### 04 Vegetation
Small grass/flowers, bushes, saplings, medium trees, canopy trees, roots/stumps/logs. Supply silhouette variants without changing camera angle.

### 05 Rocks and cliffs
Pebbles, rocks, boulders, cliff faces, cliff caps, corner pieces and climb-blocking formations.

### 06 Structures and ruins
Shrines, pillars, walls, gates, ruined walls, foundations, bridges and biome landmarks. Modular pieces must share grid anchors.

### 07 Props
Crates, barrels, signs, lamps, fences, training props, camp objects and environmental storytelling pieces.

### 08 Foreground occluders
Large canopy, tall ruins, arches and other assets intentionally allowed to pass in front of Bunny/monsters. Must retain a ground anchor for sorting.

### 09 Characters and monsters
- 8-direction isometric is the production target.
- Feet pivot/ground anchor is mandatory.
- Consistent world scale across directions and frames.
- Normal monsters should read smaller than the hero or near hero scale depending on species; bosses deliberately break scale upward.
- Existing Training Yard one-direction sheets are prototype-only and are not the directional production standard.

### 10 VFX
Slash, hit spark, crit, Cyclone, Meteor, elemental impact, heal/buff, death burst and loot effects. Keep gameplay silhouettes readable under dense effects.

## Scale ladder at reference zoom
- Micro ground detail: 8–24 px visual extent.
- Small prop/vegetation: ~24–48 px tall.
- Bunny reference character: current `isometric-player` scale is the provisional character baseline.
- Normal monster: generally ~0.75–1.15× Bunny visual mass, species dependent.
- Elite: ~1.25–1.6× Bunny visual mass.
- Boss: ~1.7–2.4× Bunny visual mass, with exceptions for encounter design.
- Medium tree: roughly 2–3× Bunny height above its ground anchor.
- Landmark/canopy assets may exceed the frame and rely on occlusion/fade treatment.

## Required metadata per asset
`id`, `category`, `biome`, `sourceFile`, `anchorX`, `anchorY`, `footprintTiles`, `collision`, `occlusion`, `variants`, and animation metadata where applicable.

## First production kit — Greenfield / Training Yard
Build only enough to prove a real field before expanding the library:
1. grass base + 3 subtle variants
2. dirt/path base + straight/bend/junction pieces
3. grass↔dirt transition set
4. small grass/flower clusters
5. bush variants
6. 3 tree silhouette families with variants
7. small/medium/large rocks
8. stump + fallen log
9. training fence/sign/dummy props
10. shrine/ruin landmark kit
11. foreground canopy pieces
12. contact-shadow/decal set

## Acceptance test
An asset is accepted only if it can be dropped into the standard-ISO test scene without rotation, perspective correction, rescaling to hide a camera mismatch, or manual anchor guessing. A mixed scene must still look like one coherent world.
