# Bunny World — Monster Drop Master v1

Status: DESIGN LOCK CANDIDATE
Date: 2026-09-21

## Scope

This table targets the CURRENT Arena Draft progression only:
Forest I (Lv.1–15) -> Elderroot Wilds (Lv.16–30) -> Duneshade Basin (Lv.31–45) -> Duneshade BasinI (Lv.46–60) -> Underground Mine.

Arena Draft roster files are the source of truth for monster identities. The old main-game MONSTERS table is legacy content and must not be silently mapped onto these monsters during the port.

Weapon Skills are excluded from monster drops. They belong to Weapon Mastery.

## Global drop rules

- Gold: 100% from combat enemies; amount is tuned later from measured kills/hour.
- Normal common monster material: 35–60%.
- Normal Aetherstone: 8–15%.
- Normal Modifier Rune: 0.5–1.5% when assigned.
- Normal Skill Core jackpot: 0.1–0.3% when assigned; no pity.
- Elite common/signature material: 100%.
- Elite Aetherstone: 25–40%.
- Elite Modifier Rune: 5–10%.
- Elite Skill Core: 2–5% when assigned.
- Boss signature material: 100%.
- Boss Modifier Rune: 15–25%.
- Boss signature Skill Core: 10% base; +2 percentage points per failed eligible clear; hard pity on 10th eligible clear; reset on obtain.
- Boss Blueprint: 5–10%.
- Boss Unique/World item: 0.5–1%.
- Manual, Semi-Auto and Full Auto use identical loot tables.
- All rolls are independent unless a future loot-budget system explicitly changes this.

## Universal Ore + Astralite drops

Every combat monster in this master list, including Normal, Elite and Boss enemies, independently rolls:
- Ore: 6%.
- Astralite: 1.5%.

These rolls are additional to Gold, common/signature materials, Aetherstone, Modifier Rune, Skill Core, Blueprint and Unique rolls. They do not replace those rewards.

Ore type follows the monster/map progression bracket rather than using one universal ore:
- Forest I: Copper Ore.
- Elderroot Wilds: Iron Ore.
- Duneshade Basin: Moonstone Shard.
- Duneshade BasinI: Silver Ore.
- Underground Mine: Mithril Ore (provisional until Mine's final level bracket is locked).

Default successful roll quantity is x1 unless a future economy pass explicitly changes quantity. Do not raise the 6% / 1.5% rates for Elite or Boss by default; their reward advantage already comes from their other loot pools.

Astralite remains the universal Refinement material for +0..+15. Aetherstone remains a separate Enhancement material and continues to use its own drop rates below.

## Material vocabulary

Generic materials remain useful as common crafting inputs:
- fang — physical/weapon hunting material.
- hide — defensive/leather material.
- core — magical/utility material.

Regional/signature materials create target-farming identity:
- bruteSpore — Mushroom Brute.
- ancientRootHeart — Thornroot Warden.
- duneMawFang — Dune Maw.
- sunforgeCore — Sunforge Colossus.
- leaderEmblem — Goblin Leader.

These IDs are design targets; they are not implemented item definitions yet.

Aetherstone progression:
- Forest I / Elderroot Wilds: verdantAetherstone.
- Duneshade Basin / Duneshade BasinI: azureAetherstone.
- Mine: provisional azureAetherstone until Mine's final level bracket is locked.

## Forest I — Mossveil Woods (Lv.1–15)

| Monster | Tier | Common material | Aetherstone | Modifier | Skill Core | Special |
|---|---|---|---|---|---|---|
| Stone Mossblob | Normal | hide 45% | Verdant 10% | lifeDrain 0.7% | — | — |
| Mossblob | Normal | hide 45% | Verdant 10% | — | — | — |
| Elite Mossblob | Elite | hide x1 100% | Verdant 30% | lifeDrain 7% | barrier 3% | — |
| Poison Spore | Normal | core 40% | Verdant 10% | lingering 0.8% | vortex 0.15% | — |
| Spore | Normal | core 40% | Verdant 10% | lingering 0.5% | — | — |
| Elite Spore | Elite | core x1 100% | Verdant 30% | lingering 7% | vortex 3% | — |
| Mushroom Brute | Boss | — | Verdant 40% | expandedArea 20% | cyclone 10% + pity | bruteSpore x1 100%; T1 Blueprint 8%; Unique 0.5% |

Design intent: Cyclone is the first major AoE power milestone. Vortex/Barrier are optional early jackpot/build tools, not required progression.

## Elderroot Wilds — Elderroot Wilds (Lv.16–30)

| Monster | Tier | Common material | Aetherstone | Modifier | Skill Core | Special |
|---|---|---|---|---|---|---|
| Acorn Guard | Normal | hide 50% | Verdant 12% | execution 0.7% | — | — |
| Flash Acorn Guard | Normal | fang 45% | Verdant 12% | execution 0.8% | groundSlam 0.15% | — |
| Elite Acorn Guard | Elite | hide x1 100% | Verdant 35% | execution 7% | groundSlam 3% | — |
| Female Twig Imp | Normal | core 45% | Verdant 12% | rapidCasting 0.8% | — | — |
| Male Twig Imp | Normal | core 45% | Verdant 12% | rapidCasting 0.8% | chainLightning 0.15% | — |
| Elite Twig Imp | Elite | core x1 100% | Verdant 35% | rapidCasting 7% | chainLightning 3% | — |
| Thornroot Warden | Boss | — | Verdant 45% | lingering 20% | frostNova 10% + pity | ancientRootHeart x1 100%; T2 Blueprint 8%; Unique 0.6% |

Design intent: Elderroot Wilds starts explicit physical-vs-magic farming routes while retaining reasons to revisit Forest I.

## Duneshade Basin — Duneshade Basin (Lv.31–45)

| Monster | Tier | Common material | Aetherstone | Modifier | Skill Core | Special |
|---|---|---|---|---|---|---|
| Duneling | Normal | hide 50% | Azure 10% | mobileCast 0.7% | — | — |
| Dune Runner | Normal | fang 50% | Azure 10% | mobileCast 0.9% | dash 0.2% | — |
| Elite Duneling | Elite | fang x1 100% | Azure 30% | mobileCast 7% | dash 4% | — |
| Cactling Bandit | Normal | fang 50% | Azure 10% | combustion 0.8% | — | — |
| Bloom Cactling | Normal | core 45% | Azure 10% | combustion 0.9% | fireball 0.2% | — |
| Elite Cactling Bandit | Elite | fang x1 100% | Azure 30% | combustion 8% | fireball 4% | — |
| Dune Maw | Boss | — | Azure 40% | echo 20% | meteorStorm 10% + pity | duneMawFang x1 100%; T3 Blueprint 8%; Unique 0.7% |

Design intent: movement and Fire buildcraft arrive together; Meteor Storm is the area's signature heavy AoE chase.

## Duneshade BasinI — Sunscorch Expanse (Lv.46–60)

| Monster | Tier | Common material | Aetherstone | Modifier | Skill Core | Special |
|---|---|---|---|---|---|---|
| Dust Djinn | Normal | core 50% | Azure 12% | rapidCasting 1.0% | — | — |
| Mirage Djinn | Normal | core 50% | Azure 12% | mobileCast 1.0% | blink 0.2% | — |
| Elite Dust Djinn | Elite | core x1 100% | Azure 35% | rapidCasting 8% | blink 4% | — |
| Sunscarab | Normal | hide 50% | Azure 12% | chain 0.8% | — | — |
| Solar Scarab | Normal | core 50% | Azure 12% | overcharge 1.0% | lightningField 0.2% | — |
| Elite Sunscarab | Elite | core x1 100% | Azure 35% | chain 8% + overcharge 5% | lightningField 4% | — |
| Sunforge Colossus | Boss | — | Azure 45% | extraStrike 20% | thunderStorm 10% + pity | sunforgeCore x1 100%; T3 Blueprint 8%; Unique 0.8% |

Design intent: this is the first concentrated Lightning target-farm region. Thunder Storm is guaranteed eventually through source-specific pity.

## Underground Mine — level bracket TBD

Mine has authored progression zones rather than a locked level range. Rates below are usable, but Aetherstone tier and Blueprint tier stay provisional until the Mine level bracket is fixed.

| Monster | Tier | Common material | Aetherstone | Modifier | Skill Core | Special |
|---|---|---|---|---|---|---|
| Mine Goblin | Normal | fang 45% | Azure 10%* | concentratedForce 0.6% | — | ore side-drop |
| Goblin Axer | Normal | fang 55% | Azure 10%* | execution 1.0% | — | ore side-drop |
| Skeleton | Normal | core 45% | Azure 10%* | bloodPrice 1.0% | — | ore side-drop |
| Goblin Foreman | Elite | hide x1 100% | Azure 35%* | concentratedForce 8% | warCry 4% | improved ore side-drop |
| Goblin Leader | Boss | — | Azure 45%* | concentratedForce 20% | bladeRush 10% + pity | leaderEmblem x1 100%; Blueprint 8%*; Unique 0.8% |

* provisional until Mine progression level/tier is locked.

Mine ore side-drops preserve the current direction that ores come from monsters rather than a mining life-skill.

## Active Skill Core coverage after this table

Target-farmable in current five areas:
- barrier
- vortex
- cyclone
- groundSlam
- chainLightning
- frostNova
- dash
- fireball
- meteorStorm
- blink
- lightningField
- thunderStorm
- warCry
- bladeRush

Reserved for later content:
- piercingShot
- iceLance
- healingPulse
- flameTrail

Do not force all Skill Cores into the first five areas. Snow, Magma, Dungeon, Endless Tower and Unique Events need meaningful future rewards.

## Blueprint policy

Blueprints remain consumable per craft in v1.

Do not make a blueprint both extremely rare and mandatory for every rarity reroll. Current boss baseline is 8% for the mapped tier, but final rates must be calibrated against boss clears/hour and alternate blueprint sources.

Normal/Elite blueprint distribution is intentionally NOT locked in this document yet. Before adding it, define:
1. expected crafts/hour,
2. expected boss clears/hour,
3. whether generic tier blueprints remain the final model or become item/family-specific blueprints.

## Craft integration

Target first-craft recipe:
Blueprint x1
+ Ore x2
+ Common Monster Material
+ Signature/Boss Material where tier/design requires
+ Gold
-> one Equipment Instance
-> roll CRAFT_RARITY_TABLE

Crafting rarity must have one source of truth. During the main-game port, consolidate the legacy first-craft path in upgradeEquipment() with craftEquipment()/CRAFT_RARITY_TABLE.

## World Boss — Option economy

World Boss is the primary scheduled source for Option-system stones and appears every 2 hours.

- Option Stone: adds a new random affix line to eligible equipment, up to the rarity cap.
- Re-option Stone: rerolls existing unlocked affix lines. Locked lines are preserved and increase the stone cost.
- World Boss participation reward currently grants Option Stone x1 + Re-option Stone x1 after an eligible successful kill.
- These stones are not part of normal monster drop tables.
- Existing Stone Fragment conversion remains a secondary sink/source unless a later economy pass removes it.

Current rarity affix caps are authoritative:
- Normal: 0
- Good: 0
- Rare: 0
- Epic: 1
- Legend: 2
- Mythic: 3
- White Ascended: 4

Current Option Stone cost by line being added is 1 / 2 / 4 / 8 stones. Re-option costs 1 + number of locked affix lines.

World Boss reward quantity can be tuned later against actual attendance and reroll consumption, but the 2-hour source identity and rarity-bound option cap are locked.

## Refinement economy v1

Refinement is a separate RNG investment track from deterministic Enhancement.

### Refinement success curve

Chance is keyed by the CURRENT refinement level:

| Attempt | Success |
|---|---:|
| +0 -> +1 | 100% |
| +1 -> +2 | 95% |
| +2 -> +3 | 90% |
| +3 -> +4 | 85% |
| +4 -> +5 | 75% |
| +5 -> +6 | 65% |
| +6 -> +7 | 55% |
| +7 -> +8 | 45% |
| +8 -> +9 | 35% |
| +9 -> +10 | 25% |
| +10 -> +11 | 20% |
| +11 -> +12 | 15% |
| +12 -> +13 | 10% |
| +13 -> +14 | 7% |
| +14 -> +15 | 5% |

Safe Floors remain +0 / +6 / +9 / +12 / +15. On failure, refinement falls by one level but never below the highest reached Safe Floor.

Each post-craft refinement attempt consumes Astralite x1. Astralite is supplied by the universal 1.5% monster side-drop.

### Gold sink

Current implementation: goldCost = ceil(item.baseGoldCost × nextRefinementLevel × 10 × discount).

Normal discount = 1.00. The legacy Starforged secret-class path currently applies 0.85; review this when old class/Weave systems are retired.

Gold cost therefore scales linearly with target refinement level and differs by item baseGoldCost. Rebalance only after Gold/hour and attempt counts are measured.

### Master Refinement

Current implementation requires at least SIX equipped pieces at each threshold:
- 6 pieces at +5 or higher -> Tier 1 -> +2% combat gear stats.
- 6 pieces at +10 or higher -> Tier 2 -> +4%.
- 6 pieces at +15 -> Tier 3 -> +6%.

The multiplier applies to equipment-derived ATK, MATK, DEF, MDEF and Max HP.

The equipment model now has more than six possible slots, so the exact qualifying-slot rule must be reviewed before final HUD/main-game port rather than silently changed.

### Economy relationship

Refinement consumes Gold + Astralite and risks regression. Enhancement consumes Gold + bracket Aetherstone and has no RNG. Crafting consumes Gold + Blueprint + Ore + materials. Options consume Option/Re-option Stones sourced primarily from the 2-hour World Boss. Tune these sinks together from telemetry.

## Economy validation gates

Do not call these percentages final until telemetry/playtest can answer:
- normal kills/hour by map,
- elite kills/hour,
- boss clears/hour,
- average blueprint acquisition/hour,
- crafts/hour,
- Skill Core time-to-first-drop,
- pity activation frequency,
- materials entering vs consumed per hour.

If a player obtains crafting inputs much faster than blueprints, blueprint scarcity becomes the whole economy. If blueprints flood faster than materials, the blueprint loses meaning. Tune them as one loop.

## Next design dependency

Weapon Mastery should be specified before implementation/port:
- Sword / Dagger / Axe / Hammer / Bow / Wand / Scepter
- mastery earned through eligible combat with that family
- Lv.1–50 target
- milestone unlocks around Lv.10/20/30/40/50
- Weapon Skills belong here, not in monster drops
- add anti-trivial-farming rules before final XP rates
