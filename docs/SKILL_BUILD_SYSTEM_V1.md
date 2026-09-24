# Bunny World — Skill & Build System v1

Status: DESIGN LOCK CANDIDATE
Date: 2026-09-21

## 1. Core philosophy

Bunny World is classless. A hero build is defined by:

Stats + Weapon + Gear + Affixes + Active Skill Cores + Skill Modifiers + Procs.

Weapons define combat style, range, attack cadence and weapon-only techniques, but do not define a permanent class. A player can change build by changing equipment and skill loadout.

The system should create build diversity through interactions, not through hundreds of near-duplicate skills.

## 2. Skill taxonomy

### Active Skill Core
A standalone active ability equipped into a hero skill slot. Examples: Thunder Storm, Cyclone, Meteor Storm, Dash.

### Weapon Skill
An active technique requiring a compatible weapon family. Examples: Dual Dagger Cross Slash, Sword Bowling Bash. These reinforce weapon identity without creating classes.

### Passive Core
A limited-slot passive that changes build behavior. Passives should be meaningful choices, not mandatory stat tax.

### Proc
An effect triggered by another event and usually supplied by gear, affixes, uniques or later systems. Examples: On Hit -> Chain Lightning; On Kill -> Frost Nova.

### Skill Modifier
A reusable modifier attached to a compatible Active Skill Core. Compatibility is determined primarily by tags, not hard-coded skill names.

## 3. Skill tags

Initial vocabulary:
- Attack
- Spell
- Melee
- Ranged
- AoE
- Projectile
- Movement
- Defensive
- Physical
- Lightning
- Fire
- Cold
- Wind
- MultiHit
- Duration
- Channel
- Weapon

Tags are data contracts. Damage formulas, modifiers, affixes, Auto rules and UI filtering should query tags.

## 4. Loadout v1

Initial target:
- 3 Active Skill Core slots
- 1 Movement slot
- 2 Passive Core slots
- Weapon Skill supplied by equipped weapon
- Each Active Skill Core supports up to 2 Modifier slots in v1

Do not add more slots until playtesting proves the need.

## 5. Active Skill Core master list v1

| ID | Skill | Tags | Role | Base behavior | Auto-use intent |
|---|---|---|---|---|---|
| cyclone | Cyclone | Attack, Melee, AoE, Physical, MultiHit | close AoE | Spin around hero and repeatedly damage nearby enemies | use when >=2 enemies are close |
| thunderStorm | Thunder Storm | Spell, AoE, Lightning, MultiHit | burst AoE | Repeated lightning strikes around a selected enemy cluster | use on dense cluster |
| meteorStorm | Meteor Storm | Spell, AoE, Fire, MultiHit | delayed heavy AoE | Meteors fall into a target area with repeated impacts | use on dense/high-HP group |
| dash | Dash | Movement | reposition | Fast movement in current/selected direction | escape hazard or close distance |
| blink | Blink | Spell, Movement | instant reposition | Short instant displacement | escape high-priority hazard |
| barrier | Barrier | Spell, Defensive, Duration | mitigation | Temporary damage-absorbing barrier | use below HP threshold or before heavy hit |
| warCry | War Cry | AoE, Duration | self/offense buff | Temporary offensive buff centered on hero | use when entering combat with multiple targets |
| frostNova | Frost Nova | Spell, AoE, Cold | control | Burst around hero that damages and slows/freezes eligible enemies | use when surrounded |
| chainLightning | Chain Lightning | Spell, Lightning | spread damage | Strike one enemy then jump to nearby enemies | use when multiple targets are chainable |
| fireball | Fireball | Spell, Projectile, Fire, AoE | ranged burst | Projectile explodes on impact | use against ranged/approaching target |
| piercingShot | Piercing Shot | Attack, Ranged, Projectile, Physical | line clear | Projectile passes through enemies | use when enemies align |
| groundSlam | Ground Slam | Attack, Melee, AoE, Physical | frontal burst | Heavy frontal impact/cone | use with clustered targets in front |
| bladeRush | Blade Rush | Attack, Melee, Movement, Physical | engage | Rush through/into target with weapon damage | use to engage distant target |
| iceLance | Ice Lance | Spell, Projectile, Cold | single-target | High focused projectile damage with cold interaction | prioritize elite/boss |
| healingPulse | Healing Pulse | Spell, Defensive | recovery | Restore a limited amount of survivability on cooldown | use below configured HP threshold |
| vortex | Vortex | Spell, AoE, Duration, Cold | persistent zone | Create a damaging slowing area | use under stationary/dense enemies |
| lightningField | Lightning Field | Spell, AoE, Lightning, Duration | proximity DPS | Temporary electrical field around hero | use when sustained melee density is high |
| flameTrail | Flame Trail | Spell, Fire, Duration, Movement | kite damage | Leave damaging ground while moving | use while repositioning from pursuing enemies |

The first implementation references are Cyclone, Thunder Storm and Meteor Storm because prototypes already exist in Arena Draft. Their current tuning is prototype data, not final balance.

## 6. Weapon Skill families v1

Weapon skills are authored separately from general Active Skill Cores.

- Dual Dagger: Cross Slash — fast close burst; weapon identity favors speed and repeated hits.
- Sword: Bowling Bash — strong frontal/knockback-oriented melee technique.
- Axe: Cleaving Strike — wide heavy arc.
- Hammer: Crushing Impact — slower impact with stagger-oriented identity.
- Bow: Power Shot — aimed high-impact ranged attack.
- Wand: Arc Bolt — quick magical ranged weapon technique.
- Scepter: Radiant Burst — short magical burst/support-oriented weapon technique.

Exact balance and additional 3-action animation sets are deferred until Codex asset generation resumes.

## 7. Modifier Rune master list v1

Modifiers must have compatibility rules and trade-offs. Avoid universal best-in-slot modifiers.

| ID | Modifier | Compatible idea | Effect direction | Trade-off |
|---|---|---|---|---|
| expandedArea | Expanded Area | AoE | larger area | lower damage |
| concentratedForce | Concentrated Force | AoE | smaller area, higher damage | reduced coverage |
| rapidCasting | Rapid Casting | Spell | faster execution/cooldown pressure | reduced per-cast damage or higher resource cost |
| echo | Echo | Spell | repeat cast after delay | repeated cast has reduced power |
| extraStrike | Extra Strike | MultiHit | additional hit/strike | lower damage per hit |
| chain | Chain | Lightning/Projectile | jump to additional target | reduced damage per jump |
| fork | Fork | Projectile | split after first contact | split projectiles deal reduced damage |
| lingering | Lingering | Duration/AoE | effect lasts longer | lower tick power |
| overcharge | Overcharge | Lightning | stronger burst/crit interaction | longer cooldown |
| combustion | Combustion | Fire | add burn/stronger burn | weaker initial impact |
| chillingWake | Chilling Wake | Cold | stronger slow/control | reduced direct damage |
| execution | Execution | Attack | bonus against low-HP targets | little/no benefit at high HP |
| bloodPrice | Blood Price | Attack/Spell | substantial offensive gain | consumes hero HP or reduces recovery |
| lifeDrain | Life Drain | damaging skills | recover limited HP from damage | reduced damage ceiling |
| mobileCast | Mobile Cast | eligible non-Movement skills | retain movement while executing | reduced power or slower cast |

Names are working names; mechanics matter more than final naming.

## 8. Proc framework

Proc triggers v1:
- On Hit
- On Critical Hit
- On Kill
- On Skill Use
- On Dodge
- On Taking Damage
- At Low HP

Proc payloads should reuse Skill/Effect definitions where practical.

Rules:
- Procs have internal cooldown/chance/budget controls.
- A proc must not recursively trigger itself or create infinite proc chains.
- Proc source is recorded for debugging and combat logs.
- Gear affixes can reference proc IDs rather than embedding bespoke combat code.

## 9. Acquisition and drops

Skill progression is loot-driven, not level-unlock-driven.

Potential sources:
- Normal monsters: common Skill Cores, common Modifiers, materials.
- Elites: improved Skill Core/Modifier chances and build-defining drops.
- Bosses: themed skills, modifiers, weapon skills/blueprints or unique build pieces.
- Dungeons / Endless Tower: targeted higher-tier skill rewards.
- Unique Events: unusual skills/modifiers/procs with special conditions.

A player's level may gate content or equipment but should not simply auto-grant the entire skill catalogue.

Duplicate Skill Cores must have a use before drop tables are finalized. Candidate sinks: upgrade mastery, dismantle into skill essence, or reroll/awaken. Do not implement a duplicate sink until its economy is designed.

## 9A. Drop-rate baseline v1

These are playtest baselines, not final economy numbers. Rebalance them against measured kills/hour and boss clears/hour.

| Source | Drop | Baseline |
|---|---|---:|
| Normal | Gold | 100% |
| Normal | monster material | 35–60% |
| Normal | level-bracket Aetherstone | 8–15% |
| Normal | Modifier Rune | 0.5–1.5% |
| Normal | designated Skill Core | 0.1–0.3% |
| Elite | material | 100% |
| Elite | Aetherstone | 25–40% |
| Elite | Modifier Rune | 5–10% |
| Elite | Skill Core | 2–5% |
| Boss | boss material | 100% |
| Boss | Modifier Rune | 15–25% |
| Boss | signature Skill Core | 10% base |
| Boss | Blueprint | 5–10% |
| Boss | Unique / World item | 0.5–1% |

### Signature Skill Core pity

- Boss signature Skill Core starts at 10%.
- Each failed eligible boss clear adds +2 percentage points for that specific signature Core.
- Example: 10% -> 12% -> 14% -> 16% ...
- Hard pity: if the player has not obtained that signature Core by the 10th eligible clear, the 10th clear guarantees it.
- Obtaining the signature Core resets its pity counter.
- Normal-monster jackpot Skill Core drops have no pity.
- Pity is scoped to the intended Core/source pair; do not use one global pity counter.

### Skill Core rarity rule

A Skill Core grants its complete base gameplay identity when obtained. Do not create Common/Rare/Epic/Legendary copies of the same Skill Core whose primary difference is raw damage. Gear, Modifier Runes, affixes, blueprints and uniques carry most item rarity/build chase.

Duplicate Skill Cores are reserved for a future Skill Essence/Mastery sink. Mastery should favor customization/unlocks rather than unlimited linear damage scaling.

### Auto loot fairness

Manual, Semi-Auto and Full Auto use the same loot tables. Do not secretly reduce drop rates for Auto. Auto can be less efficient naturally through travel, survival, targeting and clear-speed constraints.

### Economy pacing target

- Common materials: minute-scale acquisition.
- Modifier Runes: tens-of-minutes scale.
- Skill Cores: hour-scale targeted chase, protected by boss pity where applicable.
- Blueprints: hour-scale chase.
- Unique items: multi-hour / long-term chase.

Percentages must be validated against actual encounter frequency. A nominal 10% boss drop has radically different economy impact if the boss is cleared every 30 seconds versus every 10 minutes.

## 10. Auto / Semi-Auto contract

Control modes:
- Manual: player controls movement, targeting/attacks and skills.
- Semi-Auto: auto-acquire + basic attack; player controls movement, skills, dodge and boss execution. Manual input overrides Auto immediately.
- Full Auto: AI handles roaming, target acquisition, basic attacks and eligible skill decisions.

Every active skill should expose an Auto policy rather than bespoke AI code.

Suggested data:
- minimumEnemyCount
- targetPreference
- hpThreshold
- dangerThreshold
- reserveForElite
- reserveForBoss
- minimumExpectedTargets
- canAutoUse

Auto must use the same combat information available to gameplay systems. Dodge should respond to telegraphs/hazard zones and available movement resources, not cheat or guarantee avoidance.

## 11. Enemy-design consequence

Because Bunny World has crafting rarity, affixes, refinement, enhancement and build synergies, enemy progression must provide room for power growth.

- Normal monsters: fast farm targets; danger comes from groups and combinations.
- Elites: more durable/dangerous and test build weaknesses through mechanics/affixes.
- Bosses: durable enough to express mechanics, with readable telegraphs and meaningful attacks.
- Old maps do not scale directly to current gear score. Returning with a strong build should visibly increase clear speed.
- Difficulty should not be created solely by HP/ATK inflation.

## 12. Encounter direction

Target world behavior:
- Monsters are distributed through authored map population rather than always spawning in a ring around Hero.
- Auto-roam can scan -> choose target/group -> travel -> fight -> continue.
- Periodic dense encounters/hotspots can create AoE payoff without permanently surrounding the player with spawned enemies.
- Map population, respawn rate and encounter density become tuning variables.

## 13. Data model target

A future implementation can normalize around records similar to:

SkillDefinition:
- id
- displayName
- category
- tags[]
- cooldownMs
- targeting
- behaviorId
- autoPolicy
- allowedModifiers[]
- acquisitionTags[]
- fxId
- animationId

ModifierDefinition:
- id
- displayName
- requiredTags[]
- excludedTags[]
- transform/effect parameters
- tradeoff parameters
- rarity/weight

ProcDefinition:
- id
- trigger
- conditions
- chance
- internalCooldownMs
- payloadEffectId
- tags[]

Do not hard-code individual skill/modifier combinations when tag-driven composition can express them safely.

## 14. Implementation order

1. Lock this system and trim/rename the master lists.
2. Implement SkillDefinition / ModifierDefinition / ProcDefinition registries.
3. Convert existing Cyclone, Thunder Storm and Meteor Storm prototypes into SkillDefinitions without changing their gameplay feel first.
4. Implement 3 Active Skill slots + 1 Movement slot in runtime state.
5. Implement modifier resolver with 3-5 modifiers first, not all 15.
6. Implement Auto policy against the same definitions.
7. Build Monster Drop Master List using the finalized skill/modifier IDs.
8. Port the proven Arena Draft combat architecture into the main game.
9. Build final HUD around the real loadout/cooldown/Auto model.
10. Expand skills and PixelLab FX only after the data pipeline is proven.

## 15. Guardrails

- No permanent class selection.
- No universal best skill/modifier.
- No modifier that silently changes authoritative hit detection without declaring the gameplay change.
- Visual FX never define damage areas; gameplay data remains authoritative.
- Avoid duplicate skills whose only distinction is larger numbers.
- A new skill should add a new tactical/build interaction.
- A new modifier should work across multiple compatible skills whenever possible.
- Manual play must always be able to override Auto immediately.
- Do not balance old content by secretly matching the player's gear score.
