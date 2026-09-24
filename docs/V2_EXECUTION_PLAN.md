# Bunny World V2 — Clean Rewrite Execution Plan

Status: ACTIVE
Date: 2026-09-21

## Premise
There are no live players or save-compatibility requirements. Legacy systems may be deleted or replaced instead of preserved. V2 is multiplayer-ready from the foundation, while the current playable client can run the same authoritative simulation locally until a network server is introduced.

## 1. Freeze the V2 contracts
Lock one source of truth for:
- RO-inspired Combat Math V1.
- classless progression.
- seven Weapon Masteries.
- Skill Core / Modifier / Proc taxonomy.
- Equipment / Craft / Enhancement / Refinement economy.
- monster/drop master.
- Account vs Character ownership.
- server-authoritative rule: client requests actions; authoritative simulation decides results.

Deliverable: V2 architecture/contracts docs and typed boundaries.

## 2. Build the authoritative simulation core
Create a UI-free deterministic simulation layer for:
- Player entity.
- Monster/Boss entity.
- movement intent.
- target selection.
- basic attacks.
- skill commands.
- cooldowns.
- HIT/FLEE/CRIT/ASPD.
- DEF/MDEF and damage.
- death/respawn.
- combat events.

The simulation must not depend on DOM, Phaser rendering, localStorage, or UI.

## 3. Replace legacy character progression
Replace old class/job and Weave combat progression with:
- Hero Level.
- STR/AGI/VIT/INT/DEX/LUK.
- Weapon Mastery per seven weapon families.
- Skill Core loadout.
- equipment-derived stats.
- Enhancement / Refinement / Affixes.

Remove Battle Power from damage calculations. Battle Power may remain UI-only if useful.

## 4. Rebuild monsters and encounters on V2
Port current Arena Draft source-of-truth maps/rosters:
- Forest I.
- Forest II.
- Desert I.
- Desert II.
- Mine.

Implement distributed population + periodic swarm encounters.
Normal/Elite/Boss identities remain data-driven.
No gear-score scaling.

## 5. Rebuild skills and weapon mastery
Implement:
- 3 Active Skill Core slots.
- Movement slot.
- 2 Passive slots.
- up to 2 modifiers per active core initially.
- Proc engine with ICD/anti-recursion.
- seven mastery tracks Lv1-50.
- Lv10/20/30/40/50 milestone behavior.
- Auto metadata for eligible skills.

## 6. Rebuild loot and economy
Server/simulation owns:
- Gold.
- monster materials.
- universal Ore 6%.
- universal Astralite 1.5%.
- Aetherstone.
- Modifier Rune.
- Skill Core.
- Blueprint.
- boss/signature material.
- Unique/World items.
- boss Skill Core pity.

Drops are generated authoritatively, never accepted from the client.

## 7. Rebuild equipment lifecycle
One coherent pipeline:
Drop/Blueprint -> Craft -> Equipment Instance -> Equip -> Enhance -> Refine -> Option/Re-option -> Dismantle.

Implement:
- craft rarity table.
- Enhancement 1-120.
- Refinement +0..+15.
- safe floors.
- Protection Lv1/Lv2.
- Master Refinement any-six +5/+10/+15.
- Option/Re-option stones.
- dismantle outputs.

Remove duplicate legacy craft/upgrade logic.

## 8. Implement control modes on the same simulation
Manual:
player commands movement/attack/skills.

Semi-Auto:
simulation chooses target/basic attack; player owns movement/active skills/dodge.

Full Auto:
simulation performs scan -> target -> move -> attack -> eligible skill.

All modes use identical combat/drop/mastery rules. Manual input overrides Auto immediately.

## 9. Introduce Account and Character state
Account:
- identity/auth reference.
- account settings.
- future account-wide data.

Character:
- hero/progression.
- stats.
- inventory/equipment.
- skills/mastery.
- currencies/materials.
- map/progression state.

No browser-owned authoritative save.

## 10. Add persistence repository boundary
Simulation writes snapshots/events through a persistence interface.

Development adapter:
- local/in-memory or current DB adapter for fast iteration.

Production adapter:
- server database.

The client never writes authoritative Gold/items/stats directly.

## 11. Add Reset Character
Authenticated server operation:
Settings -> Reset Character -> destructive confirmation -> server transaction -> clean initial Character state.

Reset Character does not delete Account.
Delete Account remains a separate, stronger operation.
Development-only reset/seed commands must be unavailable in production.

## 12. Add multiplayer transport
Move authoritative simulation behind server runtime.
Client sends commands/intents over network, not outcomes.

Examples:
- MoveIntent
- BasicAttackIntent
- CastSkillIntent
- DodgeIntent
- EquipIntent

Server broadcasts authoritative snapshots/events.

Initial target: WebSocket-style real-time transport; exact library chosen when server implementation begins.

## 13. Zone/instance architecture
World is divided into scalable instances rather than one giant process:
- Forest I instances.
- Forest II instances.
- Desert instances.
- Mine instances.
- party dungeon instances.
- larger World Boss instances.

Zone server owns monsters, combat, positions and encounter state for players inside it.

## 14. Multiplayer gameplay rules
Define:
- party.
- contribution.
- personal loot.
- shared monster HP.
- revive/death.
- player visibility.
- chat.
- reconnect.
- disconnect behavior.
- instance transfer.
- World Boss participation.

No PvP required for V2 foundation.

## 15. Security and anti-cheat boundary
Never trust client values for:
- position beyond validated movement intent.
- damage.
- cooldown completion.
- item creation.
- Gold.
- EXP.
- mastery XP.
- drops.
- craft/refine results.

Add command validation, rate limits, transaction/idempotency rules and audit logs for valuable economy actions.

## 16. Telemetry and balancing
Measure by map/build:
- DPS.
- TTK Normal/Elite/Boss.
- damage taken.
- deaths.
- kills/hour.
- Gold/hour.
- Ore/Astralite/Aetherstone/hour.
- Skill Core/Blueprint acquisition.
- mastery XP/hour.
- refine attempts/cost.

Tune data, not architecture.

## 17. Remove legacy systems
Once V2 paths pass tests:
- remove Weave.
- remove old class/job combat dependency.
- remove Battle Power damage dependency.
- remove duplicate combat formulas.
- remove legacy craft/upgrade paths.
- remove authoritative local save paths.
- remove dead life-skill/cozy-era dependencies still leaking into current combat game.

## 18. Content completion
Build remaining content on stable V2:
- final Mine tuning.
- Snow biome.
- Magma biome.
- dungeons.
- Endless Tower.
- World Boss expansion.
- Unique Events.
- additional Skill Cores/Modifiers/Uniques.
- Hero weapon animation/FX completion.

## 19. Multiplayer test phases
A. one local client + authoritative local simulation.
B. two clients against one local server.
C. 5-10 players in one zone.
D. party dungeon.
E. World Boss load test.
F. persistence/reconnect/restart test.
G. economy exploit/duplicate-command test.

## 20. Release gate
Before public alpha:
- deterministic combat tests pass.
- persistence survives restart.
- reconnect restores authoritative state.
- no client-authoritative economy.
- Reset Character works transactionally.
- rollback/backup process exists.
- economy telemetry is sane.
- multiplayer zone load target passes.
- production DEV reset/seed endpoints disabled.

Only after these gates should Bunny World V2 be treated as the new main game.
