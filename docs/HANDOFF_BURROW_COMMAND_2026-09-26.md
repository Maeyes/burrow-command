# Handoff — Burrow Command prototype (2026-09-26)

Branch: `burrow-command` (from `maps-fix`). Live build: https://maeyes.github.io/burrow-command/

## What it is
A small single-player prototype on the Dimraeth engine: a bunny squad defends its warren.
- **Day (80 s):** bunnies in *farm* stance hunt around a pink flag (click ground to move it) and
  **carry** loot home. Loot counts only when delivered inside `BASE_R` of the burrow hall.
  A bunny that falls drops half of what it carries.
- **Night (≤55 s):** waves come in from the 4 map edges along the dirt trails and attack the burrow
  hall. Kills at night pay straight into the bank. The hall has an archer loft (`HALL`).
- **Economy:** gold **only from kills**. Materials (wood/hide/ore) drop from kills and pay for class
  upgrades (★1–★3, +30% hp/atk each). Repair the hall and revive fallen bunnies with gold.
  Each extra bunny of a class costs +20%.
- **Win:** survive 5 nights (night 5 has the forest boss mid-wave). **Lose:** hall HP 0.
- Downed bunnies wake up at dawn; everyone is fully healed at dawn (anti death-spiral).

## Files
| File | Role |
|---|---|
| `art-test/dimraeth-slice/warren.html` | Page + HUD markup/CSS (Thai UI). |
| `art-test/dimraeth-slice/warren.js` | Whole prototype: rules, map generator, units, monsters, waves, UI. |
| `art-test/dimraeth-slice/combat/rosters.js` | Prefixes `import.meta.env.BASE_URL` on site-absolute monster frame paths (sub-path deploys). |
| `vite.warren.config.ts` | Standalone build → `dist-warren/`. `publicDir: false`. Copies the forest roster frames. `WARREN_BASE` env sets the base path. Preview port 4174, allows `*.trycloudflare.com`. |
| `tools/deploy-warren.ps1` | Builds with `WARREN_BASE=/burrow-command/`, pushes `dist-warren` to github.com/Maeyes/burrow-command (`main`, Pages from root), then rebuilds with base `/`. Uses `.deploy-warren/` as the git work dir. |
| `.claude/launch.json` | `warren-preview` (4174) and `warren-pages-check` (4175, base `/burrow-command/`). |

### warren.js layout (top → bottom)
1. **Rules/constants**: `CLASSES`, `DAY_S`, `NIGHT_S`, `NIGHTS_TO_WIN`, `BURROW_MAX`, `REPAIR_*`, `REVIVE_COST`, `UPGRADE`, `HALL`, `MATS`. Balance lives here.
2. `buildMap()`: generates the 160×160-cell editor map in code (clearing, 4 dirt trails, cobbled yard, raised meadow NE, pond SW, village props). No JSON file.
3. Boot: `sceneFromMap`, forest roster art (`getRoster('forest','forest1')`), Blessed Bunny (`loadBlessedHero`), `combatFX.init`.
4. State `S` (gold, mats, tier, burrow, day/night, clock, flag, units, monsters, `time` + `events`).
5. `later(sec, fn)`: **game-clock timer**. Use it instead of `setTimeout` for anything gameplay (respects ×2 speed and the dev fast-forward).
6. `moveToward()`: straight line when `canWalkStraight`, else `findPath` (combat/nav.js A*), with slide/nudge fallbacks and progress-based `stuck` detection. `resolveRuntimeActor` handles colliders.
7. Units (`recruit`, `deposit`, `heroImage` picks Blessed Bunny frames per unit, `unitActor`).
8. Monsters (`spawnMonster`, `fieldPoint` spawns 60% near the flag, same ground level as the warren, never inside 330 of the hall; `killMonster` gives loot).
9. Combat (`strike`, `hurtUnit`, `updateUnit`, `updateMonster`, `lunge`).
10. Day/night (`startNight`, `startDay`, `endGame`), `tick(dt)`.
11. Camera: the runtime player is an invisible camera rig (`setRuntimePlayerVisual(() => ({image:null}))`, `setRuntimePlayerControl(true)`); WASD/arrows pan, Space recentres.
12. UI (`renderUi`, `syncClock`, one delegated click handler), flag + hall overlay actors, `setRuntimeActorUpdater` frame hook.
13. Dev: `window.__warren` (state) and `window.__warrenStep(sec)` (fast-forward the sim synchronously).

## Run / test / deploy
```bash
npm run dev            # http://localhost:5173/art-test/dimraeth-slice/warren.html
npx vite build --config vite.warren.config.ts          # → dist-warren/
npx vite preview --config vite.warren.config.ts        # http://localhost:4174/
powershell -File tools/deploy-warren.ps1               # publish to GitHub Pages
```
**Balance check without playing:** open the page, then in the console fast-forward with a bot, e.g.
`__warrenStep(5)` in a loop, clicking `[data-buy=…]`, `#repair`, `#revive`, `[data-up=…]`. Keep each
call under ~40 s wall time (split into chunks). Last bot run (always buys, upgrades, repairs) won with
the hall at ~60–80%. The user lost on night 5 before the last nerf, so the current numbers are
*after* that nerf (hall 500 HP, boss 650 HP/20 atk, count `2+3n+max(0,n-3)`, power `1+0.22(n-1)`).

## Gotchas (read before changing things)
- **Dependency:** `warren.js` imports `combat/skillfx.js`, which globs
  `art-test/fx-production/skills/*`. Both are committed on this branch (6a31a2c). The main game's
  in-progress changes (`game.js`, `ui/*`, `src/simulation/*`) are **not** committed; they're unrelated to
  the prototype.
- **Never publish `public/`**: it holds the main game's assets, including art from another game we
  may not redistribute (the hero must be **Blessed Bunny only**). `vite.warren.config.ts` has
  `publicDir: false`; keep it. Check `dist-warren` for anything outside `blessed-bunny`,
  `fx/approved`, `fx-production` and the PixelLab forest roster before deploying.
- **Base path**: Pages serves at `/burrow-command/`. Asset URLs built by hand must go through
  `import.meta.env.BASE_URL` (see `rosters.js`). In Git Bash, `WARREN_BASE=/x/` gets mangled to
  `C:/Program Files/Git/x/`. Build from PowerShell (the deploy script does).
- **No `setTimeout` in gameplay**: it breaks ×2 speed and the fast-forward harness. Use `later()`.
- **Pathing**: the village fences/houses need A*; `findPath` returns null when the start sits inside
  a collider's clearance. The slide + random-nudge fallback in `moveToward` handles that. Field monsters
  must spawn on the warren's ground level (the NE meadow is unreachable, no ramp).
- **Terrain cache**: ground bakes are cached in IndexedDB by `TERRAIN_CACHE_VERSION` in
  `engine/runtime.js` (now `ground-v6`). Bump it whenever terrain rendering changes.
- The map editor draft lives in `localStorage['bw-map-draft']`; don't overwrite it in tests.

## Related engine work on `maps-fix` (commit 303ef2f)
Smooth wide slopes (`stairStyle: 'slope'`, planes `S0/GXs/GYs/FL` in `engine/terrain.js`, one slope per
road patch in `scenes/custom.js#autoStairs`) and 14 editor props (`OBJECT_TYPES`, `PROPS` in
`engine/world.js`, `libOf()` in `engine/sprites.js`). See `art-test/dimraeth-slice/ENGINE.md` §11.

## Known issues / next steps
1. Narrow screens: shop and squad panels cover a lot of the view. Make them collapsible.
2. Staff/mage class is missing (no baked Blessed staff attack; use the code slash like `game.js`).
3. Proposed roadmap (agreed with the user):
   - **A. Single-player depth:** buildings (archer tower first, walls, traps) paid with materials,
     class skills from `SKILLS_V2`, named bunnies with levels, night ambience.
   - **B. Content:** more biomes (desert, snow, magma rosters already exist), a save.
   - **C. Leaderboard:** nights survived / kills (Supabase or similar).
   - **D. Async raids on friends' warrens**, Clash-of-Clans style. Needs a backend holding each
     player's layout and army; defence is AI-run, so the defender needn't be online.
4. Split `warren.js` into modules (`units`, `monsters`, `economy`, `waves`, `ui`) before step A grows it.
5. Turn the console balance bot into a `tools/` script.
