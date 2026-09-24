# Codex Prompt 2: switch the hero to Blessed Bunny + warp between maps

Paste the whole block below. The shared rules are already included.

```text
Project: C:\bunny-world (Vite, `npm run dev` → http://localhost:5173). The project is not a git repo yet.
Before you start: copy art-test/dimraeth-slice to C:\bunny-world\_snapshots\codex-<YYYYMMDD-HHMM>

Read first:
- docs/HANDOFF_DIMRAETH_2026-09-24.md
- art-test/dimraeth-slice/ENGINE.md (follow every Hard rule)
- art-test/dimraeth-slice/game.js, combat/rosters.js, combat/fx.js, combat/sfx.js (the current state)

Context: game.js is the single game page (ArenaV2Adapter + runtime actors are the source of truth).
Do not port or patch the combat logic in iso-arena-draft/poc.js. Never edit any file in art-test/iso-arena-draft/.
You may read them, or import from them, as reference.

Do not change:
- the map look (terrain, sprites, palettes, lighting, bake)
- renderScale/worldScale 1.45
- the always-on monster name/HP labels
- the code-drawn hurt/death flashes and slash arcs (the only exception is in Part A, step 4)

Working method: do Part A until it is finished and checked, then Part B. Don't leave half-edited files.
If the work gets too big, stop at the last step that works and report what is left.

==================================================
PART A: switch the hero to Blessed Bunny (licensing issue, must be done)
==================================================
The old hero (art-test/isometric-player/combat/dagger, plus the PNGs/spritesheet in the art-test/isometric-player/ root)
comes from another game, so it is a licensing problem. It must be removed from game.js completely.
The new hero is at art-test/isometric-player/blessed-bunny/ (manifest.json gives frames/w/h/footY per anim per direction,
5 authored directions; the west side is mirrored).

Reference: iso-arena-draft/poc.js already uses Blessed Bunny.
See loadBlessedAnim, BLESSED_ROOT, heroIdleFrames/heroHurtFrames/heroDeathFrames, heroMotionFrames.run,
BAKED_ATTACK_FAMILIES, heroAttackFrames, hurtAnimTimer, and the deathElapsed logic.
Rewrite it in the style of dimraeth-slice. Don't copy large chunks of poc.js.

1. Add art-test/dimraeth-slice/combat/hero.js: load blessed-bunny by reading its manifest.
   Anims: idle, walk, run, hurt, death, atk_greatsword/dagger/axe/hammer/bow/swordShield.
   Mirror west/north-west/south-west from the east side. Anchor the feet with footY from the manifest (not the image height).
2. In game.js, remove HERO_ROOT and every load of isometric-player/combat/ or of the PNGs in the isometric-player root.
   Use combat/hero.js for the hero visual (setRuntimePlayerVisual).
3. States: idle when standing, walk/run when moving, attack by the equipped weapon family, hurt when damaged (a short timer), death when HP=0
   (play it once, then hold the last frame).
4. Weapon + slash arc are baked into the atk_* frames for the 6 families above. For those families, turn off the code-drawn slash arc so it isn't drawn twice.
   Staff has no baked attack, so staff keeps the code-drawn slash arc and FX.
5. Attack timing still uses heroCombat.js (createHeroAttackPlayback/beginHeroAttack/updateHeroAttackPlayback).
   If heroCombat.js points frame paths at the old hero, don't use those path functions. Only use the playback timing.
   The frame count comes from the blessed manifest.
6. Keep the hero's own scale (playerScale). Don't scale it by K. Keep it pixel-crisp.
7. Check: `grep -rn "isometric-player/combat\|isometric-player/[a-z-]*\.png\|spritesheet" art-test/dimraeth-slice`
   must find nothing. In Chrome DevTools Network on the game page, no request may go to the old hero assets.
   Do not delete the old asset files. The owner will delete them.

==================================================
PART B: warp between maps (portals)
==================================================
The player moves between maps through portals, not by changing the URL (this will become an MMO with a server later).

1. Map data: portal objects (objects[] type 'portal', OBJECT_TYPES in scenes/custom.js) get new fields:
   id, to (target map name), toPortal (id of the portal to arrive at in the target map).
   In the editor, clicking a portal opens a small form for these fields. Target maps come from /__maps/list.
   Old portals without these fields are just decorations, not warps.
2. In game: when the player steps into a portal's radius, show a prompt like "Warp to <map> [E]" and press E/Enter to confirm.
   Monsters that are chasing the player do not follow.
3. Every warp goes through one function: `requestZoneTransfer({ fromMap, portalId })`
   in art-test/dimraeth-slice/combat/zone.js. It returns `{ map, spawn }` or `{ denied, reason }`.
   The client-side version checks that the player is really standing in that portal and that the target map exists.
   Later a server will replace this function. Do not open a second path that changes maps.
4. Changing map: fade/loading screen with progress → fully tear down the old world
   (runtime actors, actor updaters, FX actors in combat/fx.js, timers, event listeners, the rAF loop; no leaks)
   → load the new map (roster picked by chooseRosterId as it is now) → place the player at the target portal.
   Keep the character state (level, HP, EXP, inventory, equipment, skills, mastery) the same.
   If boot()/runtime.js has no teardown, add a `teardown()` export to runtime.js carefully, without changing the rendering.
5. Add a portal warp sound in combat/sfx.js (procedural Web Audio, same style as the other sounds).
6. The current map belongs to the character state (e.g. character.zone), saved with the existing persistence.
   When the game starts, load the map from character.zone. Fall back to forest2 when it's empty.
   Only ?file= may override it, and only in DEV (import.meta.env.DEV), as it does now.
7. Don't move the bake to a Web Worker yet.

==================================================
Checks before you report
==================================================
- `npx esbuild art-test/dimraeth-slice/game.js --bundle --outfile=NUL --loader:.ts=ts --format=esm` passes
- `npx esbuild art-test/dimraeth-slice/editor.js --bundle --outfile=NUL --format=esm` passes
- `npx vitest run` passes (it was 38 files / 129 tests)
- Part A: take screenshots of the hero idle / walking / attacking (at least dagger + one other family) / hurt / dead.
  Save them in C:\bunny-world\artifacts\codex-hero-qa\ so the owner can look.
  The feet must sit on the ground with no floating or sinking.
- Part B: build 2 test maps with portals that point at each other (maps/warp-test-a.json, warp-test-b.json).
  Warp back and forth 5 times: the level and items stay the same, the monster count and FX don't pile up,
  runtime actor/listener counts stay the same, the console is clean. Refresh the page: you land back on the last map.
- If the pane is hidden, requestAnimationFrame stops, so shim it with setTimeout.
- Update ENGINE.md: combat/hero.js, combat/zone.js, the portal fields, teardown.

Final report: Part A and Part B, each step done/partial/not started, files changed, how you checked it,
the screenshot paths, what is left. Say plainly which parts you did not check.
```
