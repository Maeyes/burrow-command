# Greenfield Terrain Foundation — Generation Contract v1

This is the deterministic interface between PixelLab (artist) and Codex (asset pipeline). It is locked before production generation. The machine-readable source of cell order is `generation-contract.json` in this directory.

## Master sheet geometry

| Property | Locked value |
| --- | ---: |
| Columns | 23 |
| Rows | 1 |
| Cell size | 64 × 64 px |
| Total sheet size | 1472 × 64 px |
| Logical footprint per cell | 64 × 32 px |
| Ground anchor per cell | (32, 32) |
| Ordering | Row-major, left to right |
| Background | Transparent RGBA |

The 64 × 64 source canvas is intentionally distinct from the 64 × 32 logical footprint. No source cell may be resized, rotated, perspective-corrected, or arbitrarily cropped to fit. PixelLab may return separate cells or a PixelLab-native atlas; Codex may only copy complete, already conforming 64 × 64 cells losslessly into this sheet.

## Cell order

| Column | Asset ID | Meaning |
| ---: | --- | --- |
| 0 | `grass_base` | canonical grass |
| 1–3 | `grass_variant_01` … `grass_variant_03` | subtle visual-only grass variants |
| 4 | `dirt_base` | canonical worn dirt |
| 5–6 | `dirt_variant_01` … `dirt_variant_02` | subtle visual-only dirt variants |
| 7–22 | `grass_dirt_mask_00` … `grass_dirt_mask_15` | complete four-corner grass↔dirt mask set |

Transition masks use PixelLab's returned placement rule: `NW << 3 | NE << 2 | SW << 1 | SE`, where a set bit means grass (the first terrain) occupies that corner. Thus mask `00` is all-dirt and mask `15` is all-grass. The 16 masks include four outer corners, four edges, four inner corners, two diagonal ambiguity cases, all-grass, and all-dirt. All 16 are technically necessary for deterministic four-corner autotiling; the diagonal cases are not new terrain types.

Contract v2 corrects the semantic bit labels to PixelLab's authoritative placement metadata discovered during the first generation. Sheet geometry, numeric cell order, asset IDs, and art requirements are unchanged.

## PixelLab production prompt/specification

Create original native pixel-art terrain for Bunny World's Greenfield / Training Yard. Use a standard 2:1 isometric diamond with a 64 × 32 logical footprint, world X down-right and world Y down-left, at approximately ±26.565°. Use crisp intentional pixel clusters, no accidental antialiasing, coherent pixel density, upper-left lighting, rich dark-natural green grass, and restrained warm earth for an organic worn fantasy-field path. The mood is atmospheric, slightly mysterious, charming but not childish, and premium indie fantasy RPG. Texture must remain readable beneath characters and avoid micro-noise.

Produce four mutually coherent grass cells (one base plus three subtle variants), three mutually coherent dirt cells (one base plus two subtle variants), and one coherent 16-mask grass-to-dirt corner transition set. Variants change texture only, never topology, collision, footprint, projection, or edge colors. Transition cells must share exact grass and dirt materials with the bases and join without square-looking boundaries.

Every delivered cell must be a 64 × 64 transparent RGBA PNG containing one 64 × 32 standard-isometric terrain tile aligned to anchor (32, 32). No text, labels, numbers, borders, frames, previews, UI, or watermark.

## Forbidden output

- 3D or low-poly renders, pseudo-pixel filters, smooth/vector/painterly art
- top-down square tiles rotated afterward, side-view tiles, perspective projection
- bloom, fog, blur, glow, depth of field, lens effects, or large soft shadows
- trees, bushes, flowers, rocks, cliffs, structures, props, characters, monsters, VFX, or UI
- resampling, interpolation, post-generation rotation, perspective warping, or silent repair

## Slicing and validation

1. Input must be a PNG of exactly 1472 × 64 px.
2. Width must divide evenly by 23; height must divide evenly by 1.
3. Computed cells must be exactly 64 × 64 px.
4. Slicing is integer-coordinate pixel copying only; no interpolation or resampling.
5. Every cell must contain visible pixels and transparent canvas pixels.
6. Alpha must be binary (0 or 255); partial alpha is rejected as accidental smoothing.
7. Output names and folders come only from `generation-contract.json`.
8. Any mismatch fails the import. Regenerate at source; never stretch, crop, rotate, repair, or guess.

## Acceptance

After mechanical validation, Terrain Lab must confirm the canonical projection, deterministic anchor, complete tile grid, seamless grass field, organic path with straight/turn/corners/clearing, subtle variants, coherent palette/material scale, and no visible seams. Passing mechanical import alone does not grant art approval.

## Future-only record

Production characters and monsters target eight isometric directions (`N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`) with consistent feet pivot, scale, and ground anchor. Prototype one-direction Training Yard sheets are not the production standard. Normal monster visual mass is approximately 0.75–1.15× Bunny, elite 1.25–1.6×, and boss 1.7–2.4× unless an encounter-specific exception is justified. This phase does not implement characters or monsters.
