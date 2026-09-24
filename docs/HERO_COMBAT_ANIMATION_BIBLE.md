# Bunny World Hero Combat Animation Bible

## Scope and source of truth

This document covers the current Canvas-based 2D isometric Hero used by `art-test/iso-arena-draft/poc.js`. It does not redesign the Hero, weapon roster, combat formulas, movement, targeting or the approved 2:1 projection.

Canonical Hero source:

- PixelLab character: `d2efac6c-52f1-4bbe-a131-ddeb6e78800e` (`change to white rabb`)
- Runtime rotations: `art-test/isometric-player/{direction}.png`
- PixelLab export metadata: `art-test/isometric-player/spritesheet/Cute_chibi_anthropomorph-change_to_white_rabb.json`
- Runtime canvas: 64×64 pixels, transparent RGBA
- Runtime feet/world pivot: `(32, 64)` — bottom-center of the 64×64 canvas
- Opaque art currently ends at y=61 or y=62, leaving 1–2 transparent pixels below the feet. The world pivot remains the canvas bottom and must not be inferred from the changing opaque bounds.

The older metadata value `cell-center` describes the 96×96 PixelLab export cell layout, not the current runtime world anchor.

## Direction convention

Production order is:

`S, SE, E, NE, N, NW, W, SW`

Folder names are:

`south`, `south-east`, `east`, `north-east`, `north`, `north-west`, `west`, `south-west`.

All eight attack directions require unique reviewed frames. East/west and diagonal pairs may be used as generation references, but runtime mirroring is not approved by default because hand occupancy, weapon occlusion, coat tails and the asymmetrical top hat must remain correct. Mirroring may only be enabled per animation after a visual review proves the pair equivalent.

## Weapon families and handedness

The exact production families from `src/data/equipment.ts` are:

| Family | Hands | Motion identity |
| --- | --- | --- |
| sword | one | balanced, readable medium slash |
| dagger | one; supports a second dagger in offhand | very fast short slashes/stabs |
| axe | two | heavy diagonal/overhead chop |
| hammer | two | crushing strike; impact-led FX |
| bow | two | nock, draw, release; separate arrow |
| wand | one | light, quick casting flick |
| scepter | one | deliberate heavy magical release |

`axe`, `hammer` and `bow` clear the offhand under the existing equipment rules. Only a dagger weapon instance may occupy the offhand, and main/offhand must be distinct owned instances.

## Body, weapon, FX and gameplay separation

1. **Hero body animation** owns pose, weight transfer, hands and stable feet.
2. **Equipped weapon visual** follows reviewed hand/occlusion data. PixelLab attack generation may include the correct weapon in the body frames when hand interaction cannot be represented safely as a paperdoll layer; no trail or impact may be baked in.
3. **Weapon trail FX** is a separate visual event.
4. **Impact FX** is a separate visual event at contact.
5. **Projectile FX** owns travel and projectile impact for bow/wand/scepter.
6. **Gameplay hit timing** remains authoritative combat logic and listens for the animation's `gameplayImpact` event. The FX renderer never calculates damage.

## Naming and folders

Body frame path:

`art-test/isometric-player/combat/{family}/{attack-name}/{direction}/frame_000.png`

FX frame path:

`art-test/isometric-player/fx/{category}/{fx-id}/frame_000.png`

Animation IDs use `hero_{family}_attack_XX`. FX IDs describe the visual rather than a damage rule.

## Animation contract

Every runtime definition supplies:

- `animationId`
- `weaponFamily`
- `attackName`
- `frames` and `fps`
- `startupFrames`
- `activeFrames`
- `impactFrame`
- `recoveryFrames`
- `loop: false`
- all eight `directions`
- `fxEvents`

Playback is normalized to the existing authoritative attack interval. A faster interval increases playback rate instead of changing the ASPD formula. Events crossed between two updates still fire exactly once, so high ASPD cannot skip the gameplay-impact event. The controller briefly prioritizes the impact pose for readability.

## Required attacks and target timing

| Family | Attack | Target frames | Impact | FX |
| --- | --- | ---: | ---: | --- |
| sword | attack_01 diagonal slash | 8 | 4 | medium trail, small sharp spark |
| sword | attack_02 reverse horizontal | 8 | 4 | reverse medium trail, small sharp spark |
| sword | attack_03 overhead (optional) | 10 | 5 | stronger trail, compact impact |
| dagger | attack_01 main-hand quick slash/stab | 6 | 3 | thin short trail, small spark |
| dagger | attack_02 offhand slash | 6 | 3 | opposite-hand trail, small spark |
| dagger | attack_03 cross finisher | 8 | 4 | paired thin trails, rapid sparks |
| axe | attack_01 two-hand chop | 10 | 6 | thick curved trail, debris impact |
| hammer | attack_01 crushing strike | 12 | 7 | dust, rubble, compact shock |
| bow | attack_01 nock/draw/release | 10 | 6 | release accent, projectile spawn |
| wand | attack_01 casting flick | 8 | 4 | light magic release, projectile spawn |
| scepter | attack_01 channel/release | 12 | 7 | strong magic release, projectile spawn |

These are generation targets, not damage or balance definitions. Final impact frames may move only after reviewing the generated motion; metadata and visuals must be updated together.

## PixelLab generation contract

Use the canonical PixelLab character as the character reference. For Sword, first create a reviewed one-handed sword state; the existing `with greatsword` sibling is not a valid substitute. Generate one attack and one direction group at a time, review identity and anchor consistency, then continue. Do not request hundreds of candidates.

Body prompt requirements:

> Animate this exact Bunny World Hero. Preserve exact character identity, proportions, clothing, ears, pixel density, isometric direction, lighting convention and the `(32,64)` feet pivot. Create the specified weapon-family attack with anticipation, acceleration, readable impact, follow-through and recovery. Transparent 64×64 RGBA. No floor, shadow, text, UI, hit spark, slash trail, glow or particles. Weapon and hands must remain anatomically consistent and the weapon must not mutate or change hands.

FX are generated separately with no Hero, weapon, environment or terrain. Each FX manifest entry must define canvas size, pivot, direction and impact synchronization.

## Validation gates

- Exactly 64×64 frames for the current Hero slice; no repair/resampling.
- Transparent RGBA with crisp pixel edges.
- Feet pivot remains `(32,64)` in every frame.
- No scale popping or canvas drift.
- Same Hero identity, clothing and ear structure throughout.
- Weapon length, hand and silhouette remain coherent.
- No baked trail, impact, glow, floor or shadow.
- Eight unique directional sets; no unreviewed horizontal flip.
- The animation event impact frame matches gameplay contact.
- Movement, target selection and damage formulas remain outside the renderer.

## Current production status

The architecture and Sword metadata are ready. Production Sword body/weapon frames and separate Sword FX are missing, so the live prototype must retain its existing static Hero pose until those assets pass validation. PixelLab sibling states for dual daggers and greatsword are references only and are not approved Sword attack art.
