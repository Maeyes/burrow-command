# Bunny World — Refinement Economy V2

Status: DESIGN LOCK CANDIDATE
Date: 2026-09-21

## Goals

Refinement is a long-term Gold/material sink with meaningful risk. It must coexist with Crafting, Enhancement, Options, gear dismantling, and Master Refinement without making ordinary progression punitive.

## Core loop

Monster farming -> Gold + Astralite + Gear -> Refinement.
Unwanted high-rarity gear -> Dismantle -> Protection resource.
High refinement -> optionally spend Protection resource to prevent regression on failure.

Protection never guarantees refinement success. A failed protected attempt still consumes Gold, Astralite, and the protection resource; it only prevents the refinement level from falling.

## Success chance — current baseline

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

This curve is retained as the starting baseline. Final balance requires simulation against material income.

## Safe Floors

Safe Floors: +0 / +6 / +9 / +12 / +15.

Without protection, a failed attempt loses one refinement level but never falls below the highest applicable Safe Floor.

Example: fail +11 -> +12 = falls to +10. Fail while already at +9 cannot fall below +9.

## Astralite

Astralite is the universal refinement stone.

Source baseline:
- Every combat monster independently rolls Astralite at 1.5%.
- Successful roll currently gives x1.

Target attempt-cost curve (V2 candidate):

| Target range | Astralite per attempt |
|---|---:|
| +1 to +3 | 1 |
| +4 to +6 | 2 |
| +7 to +9 | 4 |
| +10 to +12 | 8 |
| +13 to +15 | 16 |

This is step-exponential rather than doubling every individual level.

## Gold cost

Do not simply multiply the legacy linear formula by the Astralite step multiplier. Tier, target level, low success chance, and regression already compound the expected cost.

V2 target model:

GoldCost = BaseRefineGold(Tier) × LevelFactor(targetLevel) × StageMultiplier(targetLevel)

Exact BaseRefineGold, LevelFactor, and StageMultiplier values remain BALANCE TBD.

The old implementation:
ceil(item.baseGoldCost × targetRefinementLevel × 10 × discount)
is retained only until V2 values are calibrated.

Required calibration inputs:
- Gold earned per hour by progression bracket.
- Astralite earned per hour.
- Average attempts to each milestone.
- Expected Gold/Astralite cost from +0 to +5 / +10 / +15.
- Number of equipped items players are expected to refine concurrently.

## Protection resource

Two protection tiers are locked:

- Refinement Protection Lv.1.
- Refinement Protection Lv.2.

Acquisition:
- Dismantling eligible high-rarity gear yields Refinement Protection Lv.1 x1-2.
- Refinement Protection Lv.1 x10 can be combined into Refinement Protection Lv.2 x1.

Usage bands:
- Refinement attempts from +5 through +10 use Protection Lv.1.
- Refinement attempts from +10 through +15 use Protection Lv.2.
- Boundary implementation must use the TARGET refinement level to avoid overlap: target +6..+10 consumes Lv.1; target +11..+15 consumes Lv.2. Reaching +5 itself requires no protection under this high-refine protection system.

Protection never increases success chance. On a failed protected attempt, the item remains at its current refinement level instead of regressing. Gold, Astralite and the protection resource are still consumed.

Protection quantity per attempt must increase exponentially with refinement progression. Exact quantities remain BALANCE TBD and must be simulated together with success chance, Astralite cost, Gold cost, and the 10:1 Lv.1 -> Lv.2 conversion.

## Dismantle economy

Current code converts dismantled equipment into Stone Fragment and Stone Fragment can be converted into Option Stone or Re-option Stone.

V2 must avoid making one Legendary dismantle over-supply both Option and Refinement economies.

Locked direction:
- Legendary-or-higher unwanted gear must have meaningful salvage value for Refinement Protection.
- Final implementation must explicitly choose whether high-rarity dismantling gives:
  A. a player-selected salvage output, or
  B. separate deterministic outputs with tightly balanced quantities.
- Do not silently grant large quantities of both Option resources and Protection from one item.

Exact yields by Legendary / Mythic / White Ascended remain BALANCE TBD.

## Master Refinement

Master Refinement intentionally counts ANY six equipped pieces. It is not restricted to a fixed set of core slots.

Current milestones:
- Any 6 equipped pieces at +5 or higher -> Master Refinement I -> +2% equipment combat stats.
- Any 6 equipped pieces at +10 or higher -> Master Refinement II -> +4%.
- Any 6 equipped pieces at +15 -> Master Refinement III -> +6%.

Affected equipment-derived stats:
ATK / MATK / DEF / MDEF / Max HP.

This creates a reason to spread refinement investment across the loadout rather than only maxing one weapon.

## Economy relationships

Crafting:
Gold + Blueprint + Ore + Common/Signature Material.

Enhancement:
Gold + Verdant/Azure/Violet Aetherstone; deterministic.

Refinement:
Gold + Astralite; RNG; optional Protection at high refinement.

Options:
Option Stone adds affix lines up to rarity cap.
Re-option Stone rerolls existing lines.
Primary scheduled source is the World Boss every 2 hours.

The economy must be tuned as one system. Increasing Gold or material supply in one loop can materially change the value of the others.


## Balance decision — V2 calculated baseline

The current unprotected refinement curve is intentionally harsh at the top. Using the locked success rates, safe-floor regression rules, and candidate Astralite costs, the approximate expected attempts from +0 are:

| Goal | Expected attempts | Expected Astralite |
|---|---:|---:|
| +5 | 6.5 | 9.4 |
| +10 | 30.4 | 115.9 |
| +12 | 177.1 | 1,289.2 |
| +15 | 3,149.9 | 48,855.0 |

These are mathematical expectations, not guarantees. Individual outcomes can be dramatically better or worse.

This confirms the intended design: +15 is prestige/endgame chase, not required progression. The game must remain endgame-playable below +15.

If every target from +11 onward is protected from regression, expected +0 -> +15 falls to roughly 86.4 attempts and 917.8 Astralite before Protection cost. Therefore Protection is extremely powerful and must remain scarce.

### Protection quantity recommendation

Because Lv.2 already costs 10 Lv.1 to synthesize, do NOT use a raw 1/2/4/8/16 quantity curve for every +11..+15 attempt; combined with 5-20% success this would require thousands of Lv.1 stones in expectation.

Use a capped step-exponential quantity curve:

Lv.1 protection, target +6..+10:
- +6: 1
- +7: 1
- +8: 2
- +9: 2
- +10: 4

Lv.2 protection, target +11..+15:
- +11: 1
- +12: 1
- +13: 1
- +14: 2
- +15: 4

The curve still accelerates at milestone pressure points, while the 10:1 Lv.1 -> Lv.2 conversion supplies the larger economic jump for the upper band.

Protection remains optional. A player may always attempt without it and accept regression risk.

### Dismantle recommendation

Eligible Legendary equipment: Protection Lv.1 x1-2, randomized.
Mythic and White Ascended yields should NOT be multiplied aggressively until actual rarity acquisition/hour is measured. Preserve their value primarily through gear quality; do not turn them into mandatory protection fodder.

### Enhancement economy recommendation

Enhancement remains guaranteed and hero-level capped. Keep one bracket Aetherstone per enhancement level for V1. Do not add exponential Aetherstone quantity yet: 120 levels across multiple slots already create a large deterministic material sink.

Keep current Gold formula as the initial test baseline:
Gold = ceil(item.baseGoldCost × targetEnhancementLevel × 4).

Measure Aetherstone/hour and Gold/hour before increasing stone quantity.

### Gold-drop calibration rule

Arena Draft currently grants only 4-12 Gold per kill regardless of biome. Treat this as prototype-only, not final economy.

Final Gold/kill must be calibrated from measured kills/hour. Target principle:
- routine farming should fund ordinary Craft/Enhancement progression;
- Refinement +10 and above should materially drain accumulated Gold;
- +15 should never be balanced as a routine weekly obligation;
- Gold must not be the sole bottleneck when Astralite/Protection are already scarce.

Do not lock map Gold amounts until combat pacing (kills/hour) is measured after the distributed-population + swarm encounter model is implemented.

## Before implementation lock

Run expected-cost simulations for +0 -> +5, +0 -> +10, +0 -> +12, and +0 -> +15 under:
1. no protection,
2. protection from +10,
3. protection from +12.

Then translate expected costs into farming hours using measured Gold/hour, Astralite/hour, and Legendary salvage/hour.

Do not finalize Gold cost or Protection yield before this simulation.
