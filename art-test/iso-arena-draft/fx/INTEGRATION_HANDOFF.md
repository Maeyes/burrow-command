# Bunny World Combat FX — Integration Handoff

PixelLab produced the approved raster FX under `fx/approved/`. No combat JavaScript, hit detection, timers, movement, facing, roster, balance or renderer behavior was changed.

## Runtime work required

1. Route every accepted monster-damage event through one shared hook. Set the existing short `flashTimer` and start `global_hit_spark` without pausing AI.
2. Replace the current inline normal attack with an anticipation/lunge/impact/recovery Tackle state. Play `global_tackle_fx` as visual-only accompaniment; collision and damage remain gameplay logic.
3. On Normal/Elite death, stop AI and attacks, play `global_normal_death`, then remove after FX cleanup. For Elite strength, emit a second offset copy or extra runtime pixels; do not interpolate-scale the source.
4. Keep the existing reusable boss freeze/float/right-tilt/blink behavior. At its final phase play `global_boss_death_burst`, then remove after cleanup.
5. Forest I: play `forest1_mushroom_brute_telegraph` during anticipation. PixelLab could not produce a clean object-free impact asset; at the actual attack hit frame add a compact runtime shockwave, brown dirt pixels and a few pale-green spore pixels.
6. Forest II: play `forest2_thornroot_telegraph` from the boss toward the danger endpoint, then play `forest2_thornroot_eruption` once at the authoritative impact frame.
7. Add QA actions for hit flash, Normal death, Elite death, Tackle, boss attack and boss death. Forest I/II `?qa=combat` should force their corresponding boss for deterministic testing.

## Current-code audit pointers

- Damage is currently applied inline in `updatePlayer`, `updateMeteors` and `updateCycloneHits`.
- Normal Tackle is currently inline in `updateMonsters` and has no anticipation/recovery state.
- Shared death entry is `killMonster`; particle creation is `burstMonster`.
- Boss death rendering is already centralized in `drawMonster`.
- Particle cleanup is already centralized in `updateCombatFx`.
- Projection and sorting are `worldToScreen` and the `entity.y` sort in `render`; neither should change.
- Forest boss animation paths are registered in `forestRoster.js` and loaded into `bossFrames`.

## Rendering contract

- Load numbered PNGs in ascending order from each approved directory.
- Use nearest-neighbor rendering with `imageSmoothingEnabled = false`.
- Do not resize source PNGs during import. If runtime scale is required, use integer scale only.
- Use one-shot playback unless the manifest explicitly permits repeating the telegraph.
- FX never define damage areas. Render them from the same authoritative attack state used by hit detection.
- The approved PNGs use binary alpha only and contain no baked shadow, background, text, blur, glow or gradients.

## Phase 2 — Desert I, Desert II and Underground Mine

Phase 2 is an asset-only handoff. It does not change gameplay JavaScript, damage, timing, hitboxes, boss movement, facing, balance or boss-death behavior. The authoritative hit frame must continue to come from gameplay state.

### Desert I — Dune Maw ambush

1. **Telegraph:** place `desert1_dune_maw_telegraph` at the intended emergence point, ground-centered. It may repeat during anticipation without changing the gameplay danger area.
2. **Anticipation:** keep the ground warning at the target while the existing Dune Maw attack animation opens into its strike pose.
3. **Active / authoritative hit:** resolve the hit from gameplay on the existing bite/ambush impact frame.
4. **Impact FX:** play `desert1_dune_maw_eruption` once at the same emergence point. It is ground-anchored and non-directional.
5. **Recovery:** allow the eruption to finish and clean it up independently of the boss recovery animation.

### Desert II — Sunforge Colossus core pulse

1. **Telegraph:** place `desert2_sunforge_telegraph` ground-centered on the authoritative target. The ordered frames charge from restrained amber marks to a brighter broken geometric ring and may repeat during anticipation.
2. **Anticipation:** synchronize the final charged telegraph frame with the existing core/arm charge frames.
3. **Active / authoritative hit:** gameplay resolves the pulse on the existing bright energy frame.
4. **Impact FX:** `desert2_sunforge_impact` is **RUNTIME_RECOMMENDED**. At the target, emit a compact amber center pulse, short angular radial line segments and a few stone pixels. Do not draw a continuous glowing disc or fireball.
5. **Recovery:** remove the runtime pulse immediately after its short radial expansion; the raster telegraph must not remain as a terrain decal.

### Mine — Goblin Leader: Brutal Cleave

1. **Telegraph:** `mine_goblin_leader_cleave_telegraph` is **RUNTIME_RECOMMENDED**. Draw a short broken frontal arc/sector from muted warning line segments at the boss ground position, aimed toward the player. Flip the sector with attack direction.
2. **Anticipation:** hold or pulse the broken sector while the existing weapon wind-up plays.
3. **Active / authoritative hit:** gameplay resolves the cleave on the existing weapon-contact frame.
4. **Impact FX:** play directional, one-shot `mine_goblin_leader_cleave_impact` over the weapon-contact area. It is an accent only; the existing sprite supplies the weapon swing.
5. **Recovery:** clean up the accent immediately and let the existing boss recovery frames remain readable.

### Mine — Goblin Leader: War Stomp

1. **Telegraph:** `mine_goblin_leader_stomp_telegraph` is **RUNTIME_RECOMMENDED**. Draw a broken expanding ground ellipse plus sparse short crack segments centered on the boss; it is ground-anchored and non-directional.
2. **Anticipation:** expand the ellipse in discrete pixel steps during the existing stomp wind-up.
3. **Active / authoritative hit:** gameplay resolves the 360-degree area hit on the existing ground-impact frame.
4. **Impact FX:** `mine_goblin_leader_stomp_shockwave` is **RUNTIME_RECOMMENDED**. Emit one expanding elliptical pixel ring, dirt pixels and a few stone fragments from the boss world position.
5. **Recovery:** stop emitting fragments after the short expansion and remove all runtime particles after their lifetime.

PixelLab generated connected stone-ring platforms for both War Stomp components after the sensible attempt limit. Those candidates are rejected and are not present under `approved/`.

### Mine — Goblin Leader: Leader's Charge

1. **Telegraph:** place directional `mine_goblin_leader_charge_telegraph` from the boss ground origin toward the authoritative charge endpoint. It is authored screen-right and must be flipped for screen-left.
2. **Anticipation:** repeat or hold the sparse lane marks during the existing charge wind-up; do not stretch the source frames to define range.
3. **Active / authoritative hit:** start the gameplay-controlled movement and play directional `mine_goblin_leader_charge_trail` behind the moving boss. Collision remains authoritative.
4. **Impact FX:** on collision or arrival at the endpoint, play `mine_goblin_leader_charge_impact` once, ground-centered at the collision point.
5. **Recovery:** the selected impact sequence ends on a transparent frame; remove the instance after frame 4 and allow the boss recovery animation to continue.

### Phase 2 placement summary

| FX | Form | Placement | Direction | Playback |
| --- | --- | --- | --- | --- |
| Dune Maw telegraph | Raster | Emergence point, ground-center | None | Repeatable during anticipation |
| Dune Maw eruption | Raster | Emergence point, ground-center | None | One-shot |
| Sunforge telegraph | Raster | Attack target, ground-center | None | Repeatable during anticipation |
| Sunforge impact | Runtime recommended | Attack target, ground-center | None | One-shot |
| Cleave telegraph | Runtime recommended | Boss ground position, frontal sector | Aim/flip with attack | Repeatable during anticipation |
| Cleave impact | Raster | Weapon-contact area | Screen-right base; flip left | One-shot |
| Stomp telegraph | Runtime recommended | Boss world position, ground-center | None | Expand during anticipation |
| Stomp shockwave | Runtime recommended | Boss world position, ground-center | None | One-shot |
| Charge lane | Raster | Boss origin toward endpoint | Screen-right base; flip left | Repeatable during anticipation |
| Charge trail | Raster | Behind moving boss | Screen-right base; flip left | One-shot per charge |
| Charge impact | Raster | Collision/endpoint, ground-center | None | One-shot |
