# APPROVED ART DIRECTION — Wukong Golden Crescent Staff VFX

**Decision date:** 2026-09-29
**Status:** User-selected visual direction. Preserve this baseline when iterating.
**Preview:** `http://localhost:5173/art-test/wukong-staff-vfx/`

## Read this first

The preferred effect is a **Layered Pixel Crescent Slash VFX** for a heavy staff swing. It is a broad, filled crescent with crisp pixel edges and clearly separated hot-color bands. It is not a thin outline, smooth vector ribbon, blue energy blade, lightning effect, or soft blurred glow.

Future agents should begin from the current implementation in `staff-vfx.js`. Do not replace this direction with a newly generated asset sheet or another editor workflow unless the user explicitly asks.

## Approved visual language

### Main crescent

- One large overhead crescent follows the staff tip from its highest wind-up position to its lowest impact position.
- Both endpoints taper to the weapon path; the middle has the greatest width.
- Current maximum band width is **96 preview pixels**.
- The outer cutting edge is white-hot. Color bands progress inward through pale yellow, gold, orange, and deep red.
- Current flat palette:
  - White: `#ffffff`
  - Pale yellow: `#fff6a0`
  - Gold: `#ffe128`
  - Orange: `#ff9d13`
  - Hot orange: `#ed4b0b`
  - Deep red: `#b91d0b`
- Render on a 4-pixel integer grid. Preserve crisp square pixels.
- No antialiasing, soft motion blur, smooth gradients, or large blurry glow.
- A few detached white/orange pixel flecks are allowed around the outside edge.

### Supporting effects

Keep the crescent dominant. Supporting effects must remain smaller and occur at different times:

1. **Staff Tip Comet:** short white/gold/orange charge at the raised staff tip during anticipation.
2. **Impact Star:** small white/gold eight-direction pixel accent at contact. It must not become a large floating symbol.
3. **Heavy Debris:** deterministic white, yellow, and orange pixel streaks emitted from contact.
4. **Ground Shock Ring:** low expanding orange/gold ellipse on the ground after impact.
5. **Follow-through:** crescent, debris, and ring fade quickly during recovery.

Avoid showing every supporting element at maximum strength simultaneously. The intended reading order is weapon tip → crescent → impact → ground response → fade.

## Timing baseline

The standard strike uses four source poses and a procedural 30 FPS VFX timeline:

| Time | Character / VFX event |
| --- | --- |
| 0.00–0.14 s | Wind-up and Staff Tip Comet |
| 0.14–0.34 s | Crescent grows along the full Bézier path |
| 0.34–0.48 s | Impact pose, small Impact Star, debris begins |
| 0.34–0.66 s | Ground Shock Ring expands and fades |
| 0.42–0.65 s | Crescent fades during recovery |
| 0.65–0.80 s | Remaining fragments disappear |

The character poses are held at 0–0.23, 0.23–0.34, 0.34–0.48, and 0.48–0.80 seconds. The VFX interpolates every rendered frame; it does not invent additional character artwork.

## Geometry and attachment

- Character frames use one scale and manual foot anchors so the feet do not jump.
- The crescent is a cubic Bézier curve between a manually recorded raised staff endpoint and the low contact endpoint.
- Bézier control points enlarge the overhead silhouette while preserving exact weapon-linked endpoints.
- Every effect must remain attached to the weapon or contact point. Floating slash art is unacceptable.
- Source sprites are never repainted or destructively modified.

## Approved clone sequence

Mode name: **ร่างแยกคู่ → ฟาดพร้อมกัน** / dual-clone synchronized strike.

- The original remains in the center.
- One semi-transparent clone materializes on the left and one on the right using white/gold/orange pixel portal marks.
- The left clone faces right toward the original.
- The right clone faces left toward the original.
- The two clone crescents therefore sweep inward, creating a pincer strike around the center.
- The center original also strikes on the same impact beat.
- Clone scale is `0.60`; center scale is `0.72` in the current preview.
- Clone offsets are approximately `−215` and `+215` preview pixels with a small downward offset.
- Keep all three characters and complete crescents inside the stage. Do not crop the outer arcs.

The clone sequence currently exists only in the live preview. Standard export remains a single 24-frame strike. If clone export is requested, design a larger canvas and a separate export contract rather than silently changing the existing single-strike sheet.

## Prompt for another AI

> Continue the existing Bunny World Wukong VFX prototype using the approved **Layered Pixel Crescent Slash** art direction. Preserve the broad filled crescent with crisp 4-pixel edges and flat bands ordered white, pale yellow, gold, orange, and deep red. Keep the crescent attached to the staff from the highest wind-up tip to the lowest impact tip. Preserve the small staff-tip comet, restrained impact star, deterministic debris, and low ground shock ring. Do not introduce blue or purple energy, lightning, a straight laser-like slash, soft gradients, antialiasing, or large blurred glow. In dual-clone mode, retain the original in the center, place one clone on each side, make both clones face inward toward the original, and synchronize all three impact beats. Preserve source sprites and production game files.

## Negative prompt / rejected directions

`blue energy, purple energy, lightning, laser beam, straight slash, thin outline, complete circle, smooth vector edge, anti-aliased edge, soft blur, excessive glow, floating VFX, independently generated limbs, inconsistent pivot, character hidden by effects`

## Technical files

- `index.html`: preview UI and presentation.
- `staff-vfx.js`: pose alignment, timing, Bézier path, pixel rasterization, supporting effects, clone formation, and exports.
- `assets/`: local copies of the user-provided transparent source sheets.
- `exports/`: historical test exports; filenames may include superseded directions. Generate a new export from the current preview when a current deliverable is required.

## Change discipline

- Treat this document as the accepted baseline, not as permission to integrate into production.
- Preserve unrelated WIP and untracked files.
- Do not modify production assets, gameplay, combat calculations, or data fetching.
- Do not commit, push, deploy, or replace production assets without a new explicit instruction.
- Validate visual changes at the impact frame and through full playback; technical correctness alone does not approve the art.
