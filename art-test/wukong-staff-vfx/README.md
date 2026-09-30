# Wukong — Golden Crescent Staff VFX

Local art-direction prototype created from the user's four-pose Hit and Walk sheets. Open:

`http://localhost:5173/art-test/wukong-staff-vfx/`

The accepted visual direction and continuation rules are documented in [`ART-DIRECTION.md`](./ART-DIRECTION.md). Read it before changing the effect.

## Current prototype

- Crisp layered pixel crescent: white → pale yellow → gold → orange → deep red.
- Staff-tip anticipation comet, small impact star, deterministic debris, and ground shock ring.
- Single strike, walk → strike, walk-only, and dual-clone synchronized strike previews.
- In clone mode, one clone appears on each side. Both face inward toward the original; their attack arcs also sweep inward.
- Original character sheets remain unchanged. Character and procedural VFX are rendered as separate layers.

## Source assets

- `assets/hit.png`: copy of `C:/Users/thosa/Downloads/wukong_Hit-sheet.png` (2480×887).
- `assets/walk.png`: copy of `C:/Users/thosa/Downloads/wukong_walk-sheet.png` (2392×887).
- Four horizontal poses per sheet with existing transparency.
- Manual foot anchors keep every pose on one ground line.

## Controls and export

- Select an animation mode, playback speed, VFX visibility, comparison, and intensity.
- Timeline scrubbing and the impact-inspection button support frame review.
- Standard single-attack export is 24 frames at 30 FPS, 768×640 per cell, 6×4, transparent PNG.
- Current export names: `wukong-staff-fx-golden-crescent-24f-6x4.png` and `wukong-staff-combined-golden-crescent-24f-6x4.png`.
- Clone mode is currently a preview only; the two export buttons still render the standard single attack.

## Scope and state

This prototype is isolated from production gameplay and assets. It does not modify combat logic, calculations, saves, or the production hero. No commit, push, or deployment has been performed. The broader animation-editor work remains paused.
