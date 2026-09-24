# PixelLab Source Record

PixelLab is the sole artist for the Terrain Foundation production candidates. Codex only selected coherent returned candidates, copied complete PNG cells, packed the contract sheet, validated it, sliced it, and registered metadata.

## Base and variant generation

- PixelLab job: `970e1e38-3a46-4eeb-a382-54a6d552052b`
- Seed: `81724`
- Returned: 16 independent 64 × 64 isometric candidates
- Selected without pixel edits: grass `tile_0`–`tile_3`; dirt `tile_8`, `tile_10`, `tile_14`
- Raw output: `pixellab-raw/base-970e1e38/`
- Unselected candidates remain raw and are not registered as production assets.

## Transition generation

- PixelLab job: `399f0d6e-1835-4899-b01c-c687d5bb2d76`
- Seed: `81724`
- Returned: 16 independent 64 × 64 isometric corner-mask cells
- Placement rule: `NW << 3 | NE << 2 | SW << 1 | SE`; set bit = grass
- Selected without pixel edits: all `tile_0`–`tile_15`, preserving numeric mask order
- Raw output: `pixellab-raw/transitions-399f0d6e/`

No source cell was resized, rotated, cropped, interpolated, perspective-corrected, or painted by Codex.
