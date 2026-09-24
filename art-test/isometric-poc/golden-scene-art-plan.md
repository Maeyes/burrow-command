# Bunny World — Whispering Forest Golden Scene Art Plan

Status: blockout complete; production art generation is **not approved and has not started**.

## Locked scene contract

- Projection: 2:1 isometric camera plane; no horizon or parallax dependency.
- Player: current Bunny master, native 64×64 at 1×, feet pivot is world position.
- Light: upper-left. Cast shadow: lower-right.
- Runtime depth: feet/base world Y.
- Collision: trunk/base or stone base only; never the complete sprite rectangle.
- Composition: Moonroot Shrine event area → small west clearing → medium central combat bowl → east ruin exit.
- Density rule: detail gathers at the perimeter; clearings and trail junctions remain readable for 5–10 combatants.

## Minimum Golden Kit (16 core assets)

| Priority | Asset | Target canvas | Reuse / variants | Mirror / recolor | Split occluder | Authored shadow |
|---|---|---:|---|---|---|---|
| P0 | Forest grass base + 3 organic edge stamps | 64×32 each | universal ground language | recolor yes; mirror yes | no | no |
| P0 | Dirt/stone trail straight + bend + junction | 96×48 each | all forest routes | mirror bends only | no | no |
| P0 | Broad-canopy tree family | 160×192 | 2 trunk/canopy variants | recolor yes; mirror canopy only | **yes** | **yes** |
| P0 | Moonroot tree family | 176×208 | landmark-adjacent + magic grove | limited recolor; no full mirror | **yes** | **yes** |
| P0 | Spire/young tree family | 128×176 | boundary rhythm + narrow corridors | recolor/mirror yes | **yes** | **yes** |
| P0 | Rock family: small / medium / large | 128×96 sheet | 3 sizes, moss mask variant | recolor/mirror yes | no | large only |
| P0 | Broken wall module | 144×112 | rotate placement via authored alternatives | recolor yes; mirror yes | optional top cap | **yes** |
| P0 | Ruin pillar | 96×144 | intact + broken-top crop | recolor yes; mirror yes | optional top cap | **yes** |
| P0 | Small ruined arch | 176×176 | corridor / gate landmark | recolor yes; mirror no | **yes** | **yes** |
| P0 | Ancient Moonroot Shrine | 224×224 | reusable event landmark with sockets | palette variants only; no mirror | **yes** | **yes** |
| P0 | Bush cluster | 96×80 | 3 silhouette variants | recolor/mirror yes | yes for tall variant | optional |
| P0 | Fern / grass / flower cluster sheet | 128×96 | scatter stamps | recolor/mirror yes | no | no |
| P0 | Mushroom / magical plant sheet | 96×96 | warm/cool emissive variants | recolor/mirror yes | no | no |
| P1 | Fallen log | 144×80 | 2 moss masks | recolor/mirror yes | optional | **yes** |
| P1 | Ground storytelling decals | 128×96 sheet | roots, chips, petals, footprints | recolor/mirror yes | no | no |
| P1 | Warm lantern / shrine light prop | 64×80 | ruins, trail, events | recolor yes; mirror yes | no | small authored pool |

P2, deliberately deferred: extra seasonal recolors, a fourth tree family, animated foliage, water, production monsters, and expanded UI ornamentation.

## Split structure and metadata

Every tall P0 object should export `base`, `foreground/occluder`, optional `shadow`, and footprint metadata. Tree collision is a 2:1 ellipse around the trunk roots. Wall/arch collision follows masonry at ground level. Canopies and arch crowns do not collide. Shadows are separate so lighting can be tuned scene-wide.

Suggested metadata per asset:

```json
{
  "pivot": { "x": 0.5, "y": 1.0 },
  "depthAnchor": "feet",
  "footprint": { "shape": "ellipse", "rx": 17, "ry": 10 },
  "layers": ["shadow", "base", "occluder"],
  "light": "upper-left",
  "shadow": "lower-right"
}
```

## PixelLab approval packet (estimate only)

No call has been made. The recommended paid path is PixelLab `Generate with style (Pro)` / `Create S-XL image (Pro)` for the tall/environment objects, plus `Create isometric tile` for the grass/trail primitives. PixelLab currently lists an estimated **$0.095 per Pro call up to 256×256** and **$0.0166 per 64×64 isometric-tile call**; actual GPU cost may vary.

- Assets to create: the 13 P0 rows above (16 core assets when size families/modules are counted separately); P1 is optional after the gate.
- Tool: PixelLab Pro style generation for objects; PixelLab isometric tile generation for the base ground; manual pixel cleanup/splitting afterward.
- Dimensions: 64×32–96×48 ground pieces; 96×80–224×224 transparent objects, as listed above.
- Reference/style source: this Golden Scene blockout, current Bunny master for pixel density/scale, and a new original Bunny World palette sheet derived from the blockout. No copied game assets or layouts.
- Initial generation count: about **14 calls** (2 tile calls + 12 Pro object/style calls).
- Review/refinement reserve: **8 Pro calls** for the three tree families, shrine, arch, wall, rocks, and foliage consistency.
- Working total: about **22 calls**. API-equivalent estimate: `20 × $0.095 + 2 × $0.0166 ≈ $1.93 USD`, before tax/subscription and manual cleanup. A conservative budget cap is **$2.25 USD** for this pass.
- Why necessary: P0 replaces the temporary geometry that currently limits silhouette, material, occlusion, and lighting proof. It is the smallest kit that can prove the art direction without baking a screen.
- Reuse: the same kit can recombine into shrine approaches, deep-forest corridors, combat bowls, ruin pockets, and event clearings. Palette/moss masks and mirrored safe pieces add variety without new structural assets.

## Technical risks

1. Tall occluders need reliable base/foreground splits; a single flattened PNG will produce sorting errors.
2. 2:1 camera-plane movement must stay visually natural while logical movement remains continuous and untiled.
3. Integer-friendly camera movement can shimmer if sub-pixel world positions are rounded inconsistently.
4. Five to ten entities plus multi-layer trees require stable depth keys and deterministic tie-breaking.
5. Authored shadows must remain independent of object sprites or later time-of-day changes become costly.

## Art-production risks

1. Cross-call style drift is highest on tree foliage clusters and mossy stone materials.
2. A 64×64 Bunny sets a strict pixel-density ceiling; oversized objects can become noisy or look painted.
3. Moonroot Shrine must be memorable without introducing a second visual language.
4. Organic ground transitions need enough stamps to hide repetition, but too many variants would break the 10–20 asset target.
5. AI output will still need manual pixel cleanup, palette consolidation, layer separation, pivots, footprints, and authored shadows.

## Reuse forecast

The P0 kit should cover roughly **70–80% of the environment needs for 4–6 distinct Whispering Forest areas** when recomposed with different path graphs, density masks, moss/flower palettes, and landmark/event sockets. The remaining 20–30% should be area-specific landmarks, encounter props, and one-off storytelling accents—not full-screen backgrounds.

## Quality gate snapshot

- Pass at blockout: scale, 2:1 world read, no horizon/parallax, non-grid composition, combat capacity, base-only collision, feet-Y sorting, tree occlusion, shadow direction, landmark placement, modularity.
- Pending production art: consistent pixel clusters, final material richness, final organic ground transitions, final Bunny/environment palette integration, and authored split-layer assets.
