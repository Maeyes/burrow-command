# Handoff — Burrow Command (updated 2026-09-26, end of session)

- **Branch:** `burrow-command` (everything is committed; working tree clean except the user's scratch map
  `art-test/dimraeth-slice/maps/testtttt.json`, intentionally untracked). No git remote for the source repo.
- **Live build:** https://maeyes.github.io/burrow-command/ (built files only, repo `Maeyes/burrow-command`).
- **Design spec (source of truth for what comes next):** `docs/BURROW_COMMAND_PROGRESSION_SPEC.md`.

## Where we are
| Phase (spec §7) | Status |
|---|---|
| Prototype: day farming / night waves / 4 classes / ★ class upgrades / archer towers | ✅ done, live |
| **Phase 1:** save, soft failure + repeat wave, endless waves, warren levels, boss-gated upgrade | ✅ done, live |
| Follow-ups from playtest: wider view, edge arrows, spread-out bunnies, clear hunting zone | ✅ done, live |
| **Phase 2:** named bunnies + EXP/levels, real item drops, forge (craft/rarity/enhance/dismantle), class builds (3 gear slots), remove ★ | ⏭ **next** |
| Phase 3: class mastery, skill cores per build, specializations (mage Fire/Ice/Lightning/Support), team heals/shields, new mage class | later |
| Phase 4: new lands by warren level (desert/snow/magma/asgard), then new themes | later |

Friends' feedback (playtest): "very fun / addictive, like a brain-off mobile-ad game", one friend won all
5 nights while the user lost night 5 (→ progression instead of a fixed end), asked for obstacles/traps,
more upgrades, and many themes (steampunk/techno/robots). The user reported bunnies clumping and not
understanding the flag; fixed in `113fc6a`.

## How the game works now
- **Day (80 s):** bunnies on **ออกล่า** (farm) hunt inside the pink dashed **จุดล่า** zone
  (`HUNT_R` 330 around `S.flag`; click ground to move it) and **carry** loot home; it counts when
  delivered inside `BASE_R` of the hall. A downed carrier drops half. Farmers prefer monsters nobody else
  is on (`pickTarget`, per-tick `m.claims`) and idle spread around the flag (`farmSpot`).
- **Night (≤55 s):** waves come from the 4 map edges. Everyone (and **เฝ้าบ้าน** units by day) holds an
  evenly spaced post on a ring around the hall (`ringPost`, `RING`: melee 235, ranged 175) and fights its
  own sector first. Night kills pay straight into the bank. The hall and archer towers shoot raiders;
  raiders knock down nearby towers before the hall.
- **Economy:** gold only from kills; generic materials (wood/hide/ore) from kills pay for ★ class upgrades
  (+30%/tier, max ★3), towers (40G + 8), warren upgrades. Recruit price +20% per bunny of a class.
- **Progression (phase 1):** 5 waves per warren level, wave 5 = boss (scales with `levelPower()` only).
  Beat it → `S.cleared` → `upgradeWarren()` (gold `30+50L`, mats `6L`). Until upgraded, nights replay wave 4.
  Lost night → `endNight(false)`: hall 20%, −20% gold, all downed, **same wave next night**. `S.wave` only
  advances on wins. Level caps: `hallMax()` (500+80(L−1)), `squadMax()` (6+2L), `towerMax()` (2+L, ≤6).
- **Save:** `localStorage['burrow-command-save-v1']` (versioned) at dawn, on upgrade, on leaving by day.
  "เริ่มหมู่บ้านใหม่" wipes it. `load()` rebuilds units (`recruit(cls,true)`) and towers (`createTower`).
- **View:** zoom .62 at start, wheel .45–1.3. Top overlay canvas (`drawEdgeArrows`) draws the hunting zone
  + label by day and red edge arrows for off-screen raiders at night (gold = boss).

## Files
| File | Role |
|---|---|
| `art-test/dimraeth-slice/warren.html` | Page + HUD (Thai UI). |
| `art-test/dimraeth-slice/warren.js` | The whole game (~650 lines): rules, map generator, units, monsters, waves, save, UI. |
| `art-test/dimraeth-slice/engine/runtime.js` | Engine. This work added `setRuntimeZoomRange` and zoom-correct click picking. |
| `art-test/dimraeth-slice/combat/rosters.js` | `BASE_URL` prefix on monster frame paths (sub-path deploys). |
| `vite.warren.config.ts` | Standalone build → `dist-warren/`; `publicDir: false`; copies forest roster frames; `WARREN_BASE` sets base; writes root `index.html` redirect + `.nojekyll`. |
| `tools/deploy-warren.ps1` | Build for `/burrow-command/`, commit + push `.deploy-warren/` to Pages, rebuild for `/`. Stops on errors. |
| `docs/BURROW_COMMAND_PROGRESSION_SPEC.md` | Agreed design for phases 1–4. |

### warren.js map (top → bottom)
Rules/constants (`CLASSES`, `DAY_S`, `NIGHT_S`, `WAVES_PER_LEVEL`, `SAVE_KEY`, `BURROW_MAX`, `LOSS`,
`hallMax/squadMax/towerMax/warrenCost/levelPower`, `UPGRADE` (★), `MATS`, `HALL`, `TOWER`, `HUNT_R`, `RING`)
→ `buildMap()` → boot (scene, forest roster art, Blessed Bunny, combatFX) → state `S` → helpers
(`later()` game-clock timer, `moveToward()` A* + fallbacks, `separate`) → towers (`placeTower`, `createTower`,
`updateTowers`, `hurtTower`) → bunnies (`recruit`, `deposit`, `heroImage`, `unitActor`) → monsters
(`spawnMonster`, `fieldPoint`, `killMonster`) → combat (`strike`, `hurtUnit`, `ringPost`, `farmSpot`,
`pickTarget`, `updateUnit`, `updateMonster`) → day/night (`startNight`, `endNight`, `startDay`,
`upgradeWarren`) → save/load → `tick()` → camera → UI (`renderUi`, `syncClock`, click handler) → flag/hall
actors, `drawEdgeArrows` → frame hook → boot + dev hooks.

## Run / test / deploy
```bash
npm run dev    # http://localhost:5173/art-test/dimraeth-slice/warren.html
powershell -ExecutionPolicy Bypass -File tools/deploy-warren.ps1   # interactive terminal (git may ask for GitHub login)
```
Dev hooks: `window.__warren` (state), `window.__warrenStep(sec)` (fast-forward synchronously),
`window.__warrenDev` = `{ placeTower, renderUi, save, upgradeWarren }`.
**Balance bot** (browser console, run in chunks of ≤25 × 5 s so a call stays under ~40 s): each step
`__warrenStep(5)`, then click `#upgrade`, place a tower, `[data-buy=<class>]` in rotation, `#repair`,
`#revive`, `[data-up=<class>]`. Last run (phase 1 numbers): Lv 2 on day 6, Lv 3 on day 11, no lost nights;
gold 3k+ by Lv 3 because every cap is hit → **phase 2 must be the gold/material sink**.
To test from a clean slate: `__warren.resetting = true; localStorage.removeItem('burrow-command-save-v1'); location.reload()`.

## Next: phase 2 (spec §4–6)
1. **Bunny identity:** random names (renamable), EXP from kills + surviving nights, level ≤ warren level,
   level adds hp/atk. Save them (bump save to v2 with a v1→v2 migration).
2. **Real items:** replace wood/hide/ore with main-game loot: `MONSTERS_V2[id].loot` + `rollLoot` from
   `src/simulation/loot.ts` (forest roster ids match `MONSTERS_V2`). Warren storage (inventory).
3. **Forge building:** craft from `CRAFT_RECIPES_V2` / `EQUIPMENT_MASTER_V2` gated by warren level
   (`TIER_LEVEL_RANGES`), rarity via `rollRarity` + `EQUIPMENT_RARITY_STAT_MULTIPLIER`, enhance via
   `enhancementRequirement` (aetherstones), dismantle via `dismantleFragments`.
4. **Class builds:** gear is per class build (weapon = class family, armor, accessory); "+ บิลด์ใหม่"
   (warren-level + gold gated); each bunny picks a build; "จัดให้อัตโนมัติ" equips best. Remove ★.
5. Rebalance with the bot for army scale (one item powers a whole class).

## Gotchas
- **Never ship `public/`** (main-game assets incl. art we may not redistribute; hero is **Blessed Bunny
  only**). Before deploying, check `dist-warren` holds only `blessed-bunny`, `fx/approved`,
  `fx-production` and the PixelLab forest roster.
- **Base path:** Pages serves `/burrow-command/`; hand-built asset URLs must use `import.meta.env.BASE_URL`.
  In Git Bash `WARREN_BASE=/x/` is mangled — use `MSYS_NO_PATHCONV=1` or PowerShell.
- **No `setTimeout` in gameplay** — use `later()` (×2 speed and the fast-forward harness depend on it).
- **Draw order:** world actor overlays are depth-sorted with trees/houses and get painted over. Anything
  that must stay visible (zones, labels, arrows) goes on the top overlay canvas (`drawEdgeArrows`).
- **Pathing:** fences/houses need A*; `findPath` returns null when starting inside a collider's clearance
  (slide/nudge fallback handles it). Field monsters spawn on the warren's ground level only.
- **Terrain cache:** `TERRAIN_CACHE_VERSION` in `engine/runtime.js` (now `ground-v6`); bump on terrain
  rendering changes.
- The map editor draft is `localStorage['bw-map-draft']`; don't overwrite it in tests.

## Also on this branch (engine/main game, all committed)
- `303ef2f` smooth wide slopes + 14 editor props (see `ENGINE.md` §11).
- `6a31a2c` `combat/skillfx.js` + `art-test/fx-production/` (skill FX, used by warren.js and game.js).
- `41d68ea` simulation: staff Spell Chain rework, late-game skills, defensive mods, stat reset (189 tests pass).
- `fe7662b` main game UI: skill FX wiring, shard salvage, stat reset, new icons.

## Known issues / ideas
- Narrow screens: shop/squad panels and the help box cover the view; make them collapsible.
- Difficulty feels easy for an optimal bot, hard for a casual player → consider Easy/Normal/Hard.
- Traps/walls (friend request) fit as buildings next to towers.
- Split `warren.js` into modules before phase 2 grows it; turn the console bot into a `tools/` script.
- Later: leaderboard (Supabase), async raids on friends' warrens (needs a backend).
