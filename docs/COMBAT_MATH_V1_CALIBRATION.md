# Bunny World — Combat Math V1 Calibration Sheet

Status: INITIAL NUMERIC BASELINE
Date: 2026-09-21

This sheet stress-tests CHARACTER_PROGRESSION_COMBAT_MATH_V1 before code migration. Values are reference builds, not item-balance promises.

## 1. ASPD sanity checks

Formula:
ASPD = floor(150 + AGI*0.25 + DEX*0.10 + EquipmentASPD)
APS = 50/(200-ASPD)

| AGI | DEX | Equip ASPD | ASPD | APS |
|---:|---:|---:|---:|---:|
| 5 | 5 | 0 | 151 | 1.02 |
| 50 | 30 | 0 | 165 | 1.43 |
| 80 | 60 | 0 | 176 | 2.08 |
| 100 | 100 | 0 | 185 | 3.33 |
| 120 | 100 | 3 | 193 | 7.14 |

Conclusion: 193 requires a deliberately AGI-heavy build plus late stat/equipment support; it is not reached accidentally.

## 2. HIT/FLEE sanity checks

HIT = 175 + Lv + DEX
FLEE = 100 + Lv + AGI
Hit% = clamp(80 + HIT - FLEE, 5, 95)

Equal-level examples:
- DEX 30 attacker vs AGI 30 target -> raw 155%, capped 95%.
- DEX 20 attacker vs AGI 80 target -> raw 95%, capped 95%.
- DEX 20 attacker vs AGI 120 target -> 55%.

Observation: RO's constant offsets make ordinary PvE highly accurate unless the defender is deliberately evasive. This is desirable for normal monsters; FLEE-focused elites/players create the accuracy check.

## 3. Stat-attack reference points

Melee StatusATK = STR + floor(STR²/100) + floor(DEX/5) + floor(LUK/3)
Ranged StatusATK = DEX + floor(DEX²/100) + floor(STR/5) + floor(LUK/3)
StatusMATK = INT + floor(INT²/100) + floor(DEX/5) + floor(LUK/3)

| Build | Relevant stats | Status power |
|---|---|---:|
| early melee | STR20 DEX15 LUK5 | 28 |
| mid melee | STR50 DEX30 LUK10 | 84 |
| late melee | STR100 DEX60 LUK20 | 218 |
| mid bow | DEX50 STR20 LUK10 | 82 |
| late bow | DEX100 STR40 LUK20 | 214 |
| mid caster | INT50 DEX30 LUK10 | 84 |
| late caster | INT100 DEX60 LUK20 | 218 |

The quadratic term gives RO-like payoff for specializing without requiring a hidden class multiplier.

## 4. DEF curve sanity checks

Reduction = DEF / (DEF + 100 + AttackerLv*2)

At attacker Lv50:
| DEF | Reduction |
|---:|---:|
| 20 | 9.1% |
| 50 | 20.0% |
| 100 | 33.3% |
| 200 | 50.0% |
| 400 | 66.7% |

At attacker Lv100:
| DEF | Reduction |
|---:|---:|
| 50 | 14.3% |
| 100 | 25.0% |
| 200 | 40.0% |
| 400 | 57.1% |

This is intentionally soft/diminishing. Monster DEF must rise with progression; otherwise high-level attackers naturally penetrate a fixed old-map DEF more efficiently, reinforcing the desired old-map power fantasy.

## 5. Example normal hits

These examples isolate combat math before Skill Core/Proc bonuses.

Example A — Lv30 Sword:
STR50 DEX30 LUK10 -> StatusATK 84.
Assume WeaponATK 60 -> PhysicalAttack 144.
Enemy DEF50.
Reduction = 50/(50+100+60)=23.81%.
Normal hit ~= 110.
Critical hit at 1.5x ~= 165.

Example B — Lv60 Bow:
DEX80 STR30 LUK20 -> StatusATK = 80+64+6+6 = 156.
Assume WeaponATK 90 -> 246.
Enemy DEF100.
Reduction = 100/(100+100+120)=31.25%.
Normal hit ~= 169.
Critical ~= 254.

Example C — Lv60 Wand:
INT80 DEX50 LUK20 -> StatusMATK = 80+64+10+6 = 160.
Assume WeaponMATK 85 -> 245.
Enemy MDEF80.
Reduction = 80/(80+100+120)=26.67%.
Normal magical hit ~= 180.

## 6. Skill coefficient baseline

Initial coefficient bands for later playtest:
- quick/safe single hit: 1.20-1.50x scaling attack
- committed single-target: 1.60-2.20x
- broad AoE: 1.00-1.50x total per target
- multi-hit: 1.50-2.50x TOTAL split across hits
- signature mastery technique: 2.50-4.00x total, longer cooldown/commitment
- persistent zones: tune by total expected ticks, not coefficient per tick

These are budget bands, not locked values.

## 7. CRIT sanity checks

Crit% = 1 + LUK*0.30 + explicit bonus percentage points.

Before gear:
LUK5 -> 2.5%
LUK30 -> 10%
LUK60 -> 19%
LUK100 -> 31%
LUK150 -> 46%

A 70% cap prevents crit from becoming automatic through ordinary stat stacking. Specific future mechanics may temporarily exceed normal behavior only when explicitly authored.

## 8. Main conclusion

The V1 equations are numerically stable enough to implement as an isolated combat-math module and test before replacing live adventure combat.

Do NOT port all progression systems simultaneously.

Recommended implementation sequence:
1. Pure derived-stat and hit/defense functions + unit tests.
2. Arena Draft adapter behind a feature flag or isolated test path.
3. Compare TTK/DPS at Mossveil Woods, Mossveil WoodsI, Desert I, Desert II, Mine.
4. Tune monster HP/DEF/FLEE and weapon base ATK/MATK.
5. Only then replace legacy main-game adventure math.
