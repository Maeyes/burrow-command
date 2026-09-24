# Codex prompts: combat migration (2026-09-24)

Send them **one at a time, in order**. Get the audit after each one before sending the next.

---

## Shared rules (paste at the top of every prompt)

```text
Project: C:\bunny-world (Vite, `npm run dev` → http://localhost:5173). The project is not a git repo yet.
Before you start: copy art-test/dimraeth-slice to C:\bunny-world\_snapshots\codex-<YYYYMMDD-HHMM>

Read first:
- docs/HANDOFF_DIMRAETH_2026-09-24.md
- art-test/dimraeth-slice/ENGINE.md (follow every Hard rule)

Context: we are moving the game from /art-test/iso-arena-draft/ to the dimraeth-slice engine.
The two combat systems are different. Do not port or patch the combat logic in poc.js.
ArenaV2Adapter (src/simulation/) plus the runtime actors (engine/runtime.js) are the source of truth.
Never edit any file in art-test/iso-arena-draft/. Read them as reference, or import from them.

Do not change:
- the map look (terrain, sprites, palettes, lighting, bake)
- renderScale/worldScale 1.45
- the always-on monster name/HP labels
- hurt/death flashes and slash arcs (they are drawn in code; don't replace them with sprites)

Working method:
- Do only the task in this prompt. Don't start other tasks.
- Finish it and check it before you report. Don't leave half-edited files.
- If the task gets too big, stop at the last step that works and report what is left.

Checks before you report:
- `npx esbuild art-test/dimraeth-slice/<entry>.js --bundle --outfile=NUL --loader:.ts=ts --format=esm` passes
- `npx vitest run` still passes
- open the page in a browser; the console shows no errors
  (if the pane is hidden, requestAnimationFrame stops, so shim it with setTimeout)
- update ENGINE.md to match the code

Final report: each step done/partial/not started, files changed, how you checked it, what is left.
Say plainly which parts you did not check.
```

---

## Prompt 1: one game page, one combat system, one roster per map

```text
[paste the shared rules]

Task: merge the game pages into one page. Combat, HUD, FX and SFX live in one place. A map is only data.

Current state:
- art-test/dimraeth-slice/forest-combat.js is one game page. It already reads ?file=<map>.
  It has the forest roster hard-coded (the ROOT constant points at pixellab-forest-roster and the monster list is Forest I only).
- valley-combat.js is a second page that sets up its own combat. It has fallen behind forest-combat (no HUD, SFX or FX hooks).
- combat/sfx.js and combat/fx.js exist and are hooked into forest-combat.

Steps:
1. Create art-test/dimraeth-slice/game.js from forest-combat.js. Every combat feature must stay:
   combat, HUD, inventory, skills, mastery, minimap, SFX/FX hooks, monster labels.
2. Remove the hard-coded roster. Add art-test/dimraeth-slice/combat/rosters.js that maps a roster id to its data:
   - 'forest' → import from ../iso-arena-draft/forestRoster.js
   - 'desert' → desertRoster.js
   - 'mine'   → mineRoster.js (+ the boss from bossCombat.js if it's in there)
   Read each file for its export names and asset root. Don't copy the data.
3. Pick the roster in this order: map.roster (a new field in the map JSON) → the scene's biome → 'forest'.
   Add a "Monsters" dropdown to the editor (editor.html/editor.js) that saves map.roster.
   The Monster Index panel and any text naming "Forest I" must use the current roster.
4. Monster spawn: when a map has gameplay.spawnPoints (monster markers from the editor), use them.
   Otherwise fall back to the current default spawn.
5. Point ?map=forest-combat and ?map=valley-combat in main.js at game.js (valley loads scenes/valley.js the way it does now).
   Keep the old URLs working. Once game.js does everything valley-combat.js did,
   delete forest-combat.js and valley-combat.js (the snapshot has copies).
6. Make ?file= dev-only: honour it only when import.meta.env.DEV is true. In a production build the page must not pick a map from the URL.

Check: open ?map=forest-combat&file=forest2, &file=desert1, &file=mine and ?map=valley-combat.
The desert map must show desert monsters and the mine map mine monsters.
Hit a monster, kill it, level up, open the inventory. Everything must still work and the console must be clean.
```

---

## Prompt 2: warping between maps (portals)

```text
[paste the shared rules]

Prerequisite: prompt 1 is done (game.js is the single page).

Task: the player moves between maps through portals, not by changing the URL.

Steps:
1. Map data: portal objects (objects[] type 'portal', see OBJECT_TYPES in scenes/custom.js)
   get new fields: id, to (target map name), toPortal (id of the portal to arrive at in the target map).
   In the editor, clicking a portal opens a small form for these fields. Target maps come from /__maps/list.
2. In game: when the player steps into a portal's radius, show a prompt like "Warp to <map>" and press E/Enter to confirm.
   Monsters that are chasing the player do not follow.
3. Every warp goes through one function: `requestZoneTransfer({ fromMap, portalId })`
   in art-test/dimraeth-slice/combat/zone.js. It returns `{ map, spawn }` or a denial with a reason.
   The client-side version checks that the player is really standing in that portal and that the target map exists.
   Later a server will replace this function. Do not open a second path that changes maps.
4. Changing map: show a fade/loading screen → fully tear down the old world
   (actors, runtime updaters, timers, listeners, audio nodes; no leaks) → load the new map → place the player at the target portal.
   Keep the character state (level, HP, EXP, inventory, equipment, skills, mastery) the same.
5. The current map belongs to the character state (for example a character.zone field, saved with the existing persistence).
   When the game starts, load the map from character.zone. Fall back to forest2 when it's empty.
   Only ?file= in DEV mode may override it.
6. Bake times are 5–13 s per map. For now, show a loading screen with progress. Don't do the Web Worker yet.

Check: build two test maps with portals that point at each other. Warp back and forth 5 times:
the level and items stay the same, the monster count doesn't pile up, the console is clean, and the tab's memory doesn't keep climbing.
Refresh the page: you land back on the last map.
```

---

## Prompt 3: FX and SFX

```text
[paste the shared rules]

Prerequisite: prompts 1–2 are done.

Current state: combat/fx.js is hooked into combat events and update(dt), but it draws nothing.
combat/sfx.js has the scaffolding and the hooks, but no sounds. The old game has no audio files or audio code at all.
Read first: art-test/iso-arena-draft/fx/INTEGRATION_HANDOFF.md and fx/manifest.json

1. Draw the FX:
   - Load only the FX in iso-arena-draft/fx/approved/ as listed in manifest.json. Check the paths are right both in dev and after a build.
   - Pick the FX set from the current roster/biome (forest1/forest2/desert1/desert2/mine), falling back to global.
   - Draw them through the engine runtime, as an actor with getImage/drawOverlay (see setRuntimeActors and projectRuntimePoint in engine/runtime.js),
     so FX are depth-sorted and hidden behind hills and cliffs like other actors (via occluded()).
     Don't draw straight onto the canvas without depth.
   - Scale them to match the monsters' visualScale. They must stay pixel-crisp (imageSmoothingEnabled=false).
   - On a map change (prompt 2), clear every FX left over from the old map.
2. Make the sounds play:
   - Generate 8-bit style sounds with Web Audio (oscillator + noise + envelope) in combat/sfx.js. No audio files.
   - Sounds needed: swing, hit, crit, monster death, boss death, level up, loot/pickup, portal warp.
   - Start the AudioContext after the player's first click or key press. Add a mute button and the M key; save the mute state.
   - Rate-limit each sound so repeats don't stack up and distort.

Check: on forest, desert and mine maps you see a hit spark when a hit lands and an effect when a monster dies,
and FX behind a cliff are hidden correctly. Every sound plays and mute works. The console is clean.
```
