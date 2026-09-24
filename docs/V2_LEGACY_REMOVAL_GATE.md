# Legacy Removal Gate — Bunny World V2

Date: 2026-09-21
Status: CUTOVER COMPLETE FOR ACTIVE RUNTIME

## Authority rule
There is one authoritative writer per gameplay responsibility. The active runtime is V2.

## Removed legacy runtime
The former `src/bunny` runtime was removed after the root entrypoints were switched to the isometric V2 Arena runtime.

The obsolete source trees `src/core`, `src/data`, `src/config`, `src/economy`, and legacy files under `src/systems` were removed. `src/systems/combatMath.ts` remains because it is the V2 RO-style combat math dependency.

Removed responsibilities include:
- legacy adventure combat;
- Weave and its weapon-XP routing;
- class/job runtime state;
- Battle Power damage path;
- duplicate legacy craft/refine/enhance writers;
- legacy browser save runtime;
- old autoBattle writer;
- obsolete 3D/Sharpfang runtime/test path from `src/bunny`.

## Active V2 ownership
- Combat: `src/simulation/engine.ts` + `src/systems/combatMath.ts`
- Character/progression: `src/simulation/character.ts`
- Weapon Mastery: `src/simulation/mastery.ts` + `masteryMilestones.ts`
- Skills: `src/simulation/skills.ts`
- Procs: `src/simulation/procs.ts`
- Contribution/rewards: `contribution.ts` + `rewards.ts`
- Loot/pity/economy: `loot.ts` + `pity.ts` + `economy.ts`
- Equipment math: `equipmentV2.ts`
- Persistence boundary: `persistence.ts` + `session.ts`
- Multiplayer boundary: `transport.ts` + `zones.ts`
- Arena cutover adapter: `arenaAdapter.ts`
- Monster/drop master: `monsterDataV2.ts`
- Auto control: `auto.ts`

## Runtime entry
`index.html` and `bunny.html` now boot the isometric V2 runtime directly through `art-test/iso-arena-draft/poc.js`.

The Arena file is presentation/input/FX glue. It does not own combat damage, monster/player HP outcomes, Gold, loot, mastery rewards, or respawn timing.

## Verification
Release gate:
1. `npm test` must pass.
2. `npm run build` must pass.
3. `node tools/audit-v2-legacy.mjs` must pass.
4. Search active runtime for direct HP/economy writers before public release.
