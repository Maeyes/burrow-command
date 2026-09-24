# Bunny World — Isometric Whispering Forest Vertical Slice QA

Date: 2026-09-19  
Scope: `art-test/isometric-poc/` only  
Production architecture/assets changed: **No**  
PixelLab generation used: **No**

## Evidence

- Bunny source rotations: `C:/bunny-world/art-test/isometric-player/*.png` — native 64×64 PNG, eight directions.
- Review render: `C:/bunny-world/art-test/isometric-poc/whispering-forest-review.png` — 1425×1136 browser capture.
- Source/render comparison: `C:/bunny-world/art-test/isometric-poc/reference/qa-comparison.png` — 1163×809.
- Browser viewport: 1440×1100 CSS px, device scale factor 1.
- Game viewport backing canvas: 1280×720; rendered frame ratio 16:9.
- Rendering: Canvas smoothing disabled; CSS resolves to pixelated/crisp-edges.
- Browser console: no warnings or errors in the final interaction passes.

## 1. Player scale

**Result: Pass for art-direction validation.**

- Bunny remains native 64×64 at 1× and is never redrawn, recolored, or interpolated.
- The camera leaves enough ground for several enemies and attack spacing while the player remains readable.
- Comparison against 34px small, 48px medium, and 72px elite placeholders gives a useful combat hierarchy.
- The black/white silhouette separates from the compressed dark-green environment values.

## 2. Camera framing

**Result: Pass.**

- Fixed 16:9 gameplay viewport with a soft-follow camera.
- Visible ground supports roughly a 96×48 attack footprint plus multiple monsters.
- Procedural world bounds provide approximately 2–3 screens of exploration space.
- The horizon reserves room for landmarks without reducing the playable floor to a narrow strip.

## 3. 360° movement quality

**Result: Pass with one known presentation limitation.**

- Movement uses float world positions with no tile snapping.
- Click-to-move reached a decimal position at heading 107°; physics heading remained continuous while the sprite selected south-east.
- Movement speed is normalized before applying velocity, including diagonal keyboard input.
- Direct clicks into colliders stop with actual velocity `0.0 px/s`; residual drift found in the first pass was fixed.
- Known limitation: static rotations necessarily show feet sliding. Final locomotion cannot be judged until a walk cycle exists.

## 4. Eight-direction facing quality

**Result: Pass.**

- A full automated circular review sampled N, NE, E, SE, S, SW, W, and NW.
- Continuous heading is quantized to the nearest available 45° sprite.
- Direction hysteresis is 7° beyond the normal 22.5° boundary.
- Circle samples transitioned through all eight rotations without rapid boundary oscillation.

## 5. Isometric perspective

**Result: Pass for POC; production geometry still needs an asset guide.**

- Ground authoring/debug grid follows a 2:1 diamond convention.
- Feet/base anchors align consistently with the projected ground.
- Organic moss, trail, stones, plants, and irregular props hide most obvious grid repetition while physics remains continuous.
- Before production, document footprint, elevation, and pivot rules in pixels.

## 6. Depth and occlusion

**Result: Pass.**

- Player, monsters, trees, rocks, bushes, logs, and ruins sort by feet/base world Y.
- QA states confirm the Bunny is concealed behind the moonroot canopy at depth -28 and drawn in front at depth 78.
- Collision remains at the trunk/base rather than the canopy dimensions.
- Production recommendation: export wide trees and ruins as `base` plus `foreground/occluder` layers. Whole-object sorting will become limiting when canopies overlap multiple actors.

## 7. Collision

**Result: Pass for continuous POC collision.**

- Continuous elliptical footprints cover tree trunks, large rocks, ruins, logs, and tall bushes.
- Player boundary clamp is independent of the visual sprite rectangle.
- Tree test stopped at `285.5 / 29.5` near a tree centered at `310 / 20`.
- Rock retest stopped at `-184.4 / 47.0` with velocity `0.0 px/s` near a rock centered at `-210 / 35`.
- Debug collision ellipses match base footprints rather than canopies.

## 8. Combat readability

**Result: Pass for visualization.**

- Attack range is visible without overwhelming the scene.
- Player and monster hitboxes toggle independently.
- Nearest-monster indicator remains readable against grass and trail.
- Placeholder slash clusters and damage number `128` are legible at native scale.
- Small, medium, and elite footprints remain distinguishable around the player.
- No combat mechanics or production gameplay systems were introduced.

## 9. Parallax

**Result: Pass for composition/factor validation.**

- Layer 0 sky: fixed.
- Layer 1 far mountains: 0.075×.
- Layer 2 ancient castle: 0.17×.
- Layer 3 far forest: 0.30×.
- Layer 4 gameplay plane: 1.0×.
- Layer 5 foreground foliage: 1.10×.
- Mist, magical particles, and drifting leaves remain subtle enough not to cover combat information.
- No visible layer gaps appeared during tested movement. Final seamlessness must be retested with production rasters.

## 10. Problems found

1. Grid lines competed with the atmosphere; grid now defaults off and is debug-only.
2. Parallax labels were depth-occluded; they now render as a final overlay.
3. Collision telemetry reported desired speed while blocked; it now uses actual displacement.
4. Click targets produced approximately 1.2 px/s residual drift at a rock; blocked targets now stop at 0.0 px/s.
5. Static Bunny rotations cause feet sliding during locomotion.
6. Procedural shapes validate layout and mechanics but are not a premium handcrafted reference themselves.
7. Browser automation cannot hold two physical keys for a long manual chord; diagonal normalization is implemented and needs one human WASD feel pass.

## 11. Required before production

1. Human review and lock the 1× camera framing shown here.
2. Lock environment pixel density, palette range, light direction, and the 2:1 footprint guide using Bunny 64×64 as scale master.
3. Define one-scene raster deliverables: ground modules, 2–3 tree families with split occluders, rocks, ruins, foliage, and five parallax layers.
4. Require transparent backgrounds, integer dimensions, feet/base pivot metadata, and authored collision footprints.
5. Produce one Bunny walk cycle or explicitly accept sliding for the next review.
6. Replace only one representative monster silhouette before assessing final combat contrast.
7. Generate and review one production-quality Whispering Forest scene before any broader biome or asset library.

## Final answer

**พร้อมแบบมีเงื่อนไขสำหรับเริ่ม ONE production-quality Whispering Forest pilot ด้วย PixelLab แต่ยังไม่พร้อมสำหรับ bulk generation ทั้งเกม**

Camera, scale, movement model, facing, depth, collision, combat spacing, and parallax composition are stable enough to specify one golden-reference scene. Before any paid call, the user must approve the exact PixelLab tool, asset list, generation estimate, dimensions, and Bunny/style references. No PixelLab generation was performed in this phase.

final result: passed
