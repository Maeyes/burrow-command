# Product Design QA — Whispering Forest Vertical Slice

Detailed review: `C:/bunny-world/art-test/isometric-poc/whispering-forest-qa.md`

## Comparison evidence

- Source truth: eight native 64×64 Bunny rotations under `C:/bunny-world/art-test/isometric-player/` plus the user-provided Whispering Forest specification.
- Implementation: `C:/bunny-world/art-test/isometric-poc/whispering-forest-review.png` (1425×1136).
- Same-input comparison: `C:/bunny-world/art-test/isometric-poc/reference/qa-comparison.png` (1163×809), showing source rotations and final render together.
- Viewport: 1440×1100 CSS px at device scale factor 1; game canvas 1280×720 and 16:9.
- State: playable state with attack-range, target, slash, and damage-number visualization.
- Focused evidence: behind-tree and front-tree states were captured at depths -28 and 78; native rotations were inspected at 2× nearest-neighbor scale.

## Required fidelity surfaces

- Typography: hierarchy and debug labels remain readable without competing with gameplay.
- Layout: 16:9 scene and three-part debug deck fit without overflow at the tested desktop viewport.
- Color: cool blue-green background values, rich forest greens, and restrained warm gold preserve the Bunny silhouette.
- Image fidelity: Bunny PNGs are used directly at native 64×64 with smoothing disabled; procedural environment art is explicitly temporary.
- Copy: objective, telemetry, controls, scale tests, and experimental-status labels are accurate.

## Findings and comparison history

- P2 fixed: debug grid competed with atmosphere; now disabled by default.
- P2 fixed: parallax labels could be hidden by depth-sorted objects; now rendered last.
- P2 fixed: blocked click movement reported desired velocity; telemetry now uses actual displacement.
- P2 fixed: residual rock-collision drift; blocked targets now stop at 0.0 px/s.
- P3 remains: no locomotion animation exists, so static rotation movement shows feet sliding.
- P3 remains: procedural props establish composition and mechanics, not final handcrafted asset fidelity.

## Interaction and browser verification

- Click-to-move continuous heading: passed.
- Eight-direction full-circle facing and 7° hysteresis: passed; all eight PNGs observed.
- Tree behind/front depth states: passed.
- Tree and rock base collision: passed.
- Debug toggles: passed.
- Combat readability trigger: passed.
- Browser console warnings/errors: none.

final result: passed
