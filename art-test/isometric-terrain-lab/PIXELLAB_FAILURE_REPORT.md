# PixelLab Contract Failure Report

## Result

PixelLab generation completed, but the transition output does not satisfy the locked master-sheet contract. No master sheet was produced, no assets were sliced into the public terrain folders, and the manifest contains zero production assets.

## Expected contract

- 23 columns × 1 row
- 64 × 64 px per source cell
- 1472 × 64 px master sheet
- 64 × 32 px logical footprint
- anchor (32, 32)
- binary transparent RGBA

## Actual PixelLab output

| Job | Expected cells | Returned cells | Actual dimensions |
| --- | ---: | ---: | --- |
| Base/variants `970e1e38-3a46-4eeb-a382-54a6d552052b` | 7 requested | 16 candidates | 64 × 64 each |
| Transitions `399f0d6e-1835-4899-b01c-c687d5bb2d76` | 16 | 16 | **64 × 28 each** |

PixelLab's transition job metadata described the result as `size: 64x64px`, but every downloaded transition PNG is 64 × 28 px. `npm run terrain:pack` stopped on `grass_dirt_mask_00` with: `expected 64x64, received 64x28`.

## Required regeneration

Regenerate the 16-mask transition set as complete 64 × 64 transparent source canvases with the 64 × 32 diamond aligned to anchor (32, 32), preserving PixelLab's placement rule `NW << 3 | NE << 2 | SW << 1 | SE` (set bit = grass). The regenerated files must pass the packer without padding, cropping, resizing, interpolation, or any other repair.

The accepted base candidates remain staged only. They are not production assets until a coherent conforming transition set permits the entire foundation kit to pass Terrain Lab visual QA.
