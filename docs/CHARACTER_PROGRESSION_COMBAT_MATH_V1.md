# Bunny World — Character Progression Map & Combat Math V1

Status: DESIGN LOCK CANDIDATE
Date: 2026-09-21
Math direction: Ragnarok Online-inspired first baseline, adapted for Bunny World's classless systems.

## 1. Progression map

Bunny World separates progression responsibilities instead of letting every system multiply every other system.

Hero Level
-> unlocks content and Enhancement ceiling
-> grants stat points
-> determines level relationship versus monsters

Base Stats: STR / AGI / VIT / INT / DEX / LUK
-> derive combat stats

Weapon Family
-> chooses physical/magical attack identity, range, cadence and Weapon Mastery family

Weapon Mastery Lv.1-50
-> unlocks weapon techniques/style mechanics at 10/20/30/40/50
-> no generic damage-per-level treadmill

Gear
-> supplies weapon ATK/MATK, armor DEF/MDEF, HP and affixes

Enhancement Lv.1-120
-> deterministic slot investment
-> cannot exceed Hero Level

Refinement +0..+15
-> risky gear investment
-> major long-term sink
-> Master Refinement milestones from any six equipped pieces

Skill Cores + Modifiers
-> primary classless buildcraft

Affixes / Procs / Uniques
-> optimization and interaction layer

The intended dependency order is:

Base Stats + Level
-> derived character stats
-> add equipment stats
-> apply equipment/refinement/enhancement modifiers
-> resolve HIT/FLEE and attack cadence
-> skill coefficient / weapon attack
-> defense reduction
-> critical / elemental / situational modifiers
-> final damage.

Avoid Battle Power as an input to actual damage. Battle Power may remain a UI estimate only.

## 2. RO-inspired stat roles

STR
- primary physical melee ATK contributor
- may later contribute carrying capacity if needed
- no direct magical scaling

AGI
- primary FLEE contributor
- major ASPD contributor

VIT
- Max HP
- soft physical durability contribution
- status resistance can be added later

INT
- primary MATK contributor
- MDEF / Max SP contribution

DEX
- HIT
- ranged physical ATK contribution
- secondary ASPD contribution
- small magic stability/cast interaction if later needed

LUK
- CRIT
- small perfect-dodge / secondary combat utility
- loot effects must remain modest so LUK does not become mandatory

## 3. Derived stats — V1

These are the new target formulas. Existing main-game formulas are legacy until ported.

### Max HP

BaseMaxHP = 100 + HeroLevel * 12
MaxHP = BaseMaxHP + VIT * 10 + EquipmentHP

Do not make VIT the only survivability source; equipment remains important.

### Max SP

BaseMaxSP = 30 + HeroLevel * 2
MaxSP = BaseMaxSP + INT * 3 + EquipmentSP

### Physical ATK

RO-inspired split:

StatusATK_Melee = STR + floor(STR^2 / 100) + floor(DEX / 5) + floor(LUK / 3)

StatusATK_Ranged = DEX + floor(DEX^2 / 100) + floor(STR / 5) + floor(LUK / 3)

PhysicalAttack =
- Sword / Dagger / Axe / Hammer: StatusATK_Melee + WeaponATK
- Bow: StatusATK_Ranged + WeaponATK

WeaponATK is supplied by the equipped weapon after its equipment progression.

### Magical ATK

StatusMATK = INT + floor(INT^2 / 100) + floor(DEX / 5) + floor(LUK / 3)

MagicalAttack = StatusMATK + WeaponMATK

Wand and Scepter use MagicalAttack for their normal weapon techniques unless a skill explicitly says otherwise.

### HIT

HIT = 175 + HeroLevel + DEX + HitBonus

### FLEE

FLEE = 100 + HeroLevel + AGI + FleeBonus

### Basic hit chance

HitChance = clamp(80 + AttackerHIT - DefenderFLEE, 5, 95) / 100

This intentionally keeps RO's readable HIT-vs-FLEE relationship and 5%-95% normal hit floor/cap.

Boss/skill mechanics may explicitly bypass or modify normal accuracy, but never silently.

### CRIT

CritRatePercent = clamp(1 + LUK * 0.30 + CritBonusPercent, 0, 70)

Base critical damage multiplier = 1.50.

Critical hits do not automatically ignore all defense in V1. If a future weapon/passive grants defense-piercing crits, it must say so explicitly.

### ASPD

Keep the already verified RO-like Bunny World curve:

ASPD = min(199, floor(150 + AGI * 0.25 + DEX * 0.10 + EquipmentASPD))

AttacksPerSecond = 50 / (200 - ASPD)

Reference:
150 ASPD = 1.00 hit/s
175 ASPD = 2.00 hits/s
190 ASPD = 5.00 hits/s
193 ASPD ~= 7.14 hits/s
195 ASPD = 10.00 hits/s

Hard cap remains below 200. If later testing shows 195+ creates animation/network/combat readability problems, cap effective APS independently rather than rewriting the stat fantasy.

## 4. DEF / MDEF

Use RO-inspired soft-defense behavior, but avoid importing every historical RO version-specific formula.

Target V1 physical reduction:

PhysicalReduction = TotalDEF / (TotalDEF + 100 + AttackerLevel * 2)

DamageAfterDEF = RawPhysicalDamage * (1 - PhysicalReduction)

Target V1 magical reduction:

MagicReduction = TotalMDEF / (TotalMDEF + 100 + AttackerLevel * 2)

DamageAfterMDEF = RawMagicDamage * (1 - MagicReduction)

This creates diminishing returns and avoids the current flat subtraction problem where defense can become either irrelevant or nearly absolute.

TotalDEF = EquipmentDEF + floor(VIT / 2) + explicit bonuses.
TotalMDEF = EquipmentMDEF + floor(INT / 2) + floor(VIT / 4) + explicit bonuses.

Minimum final damage from a successful damaging hit is 1 unless the effect is explicitly immune/blocked.

## 5. Normal attack resolution

1. Confirm target in weapon range.
2. Resolve HIT vs FLEE.
3. If miss -> 0 damage and MISS feedback.
4. Build PhysicalAttack or MagicalAttack from weapon family.
5. Apply a small weapon variance only if the weapon definition requests it. Do not add arbitrary global +/- huge RNG.
6. Apply appropriate DEF/MDEF reduction.
7. Resolve CRIT where the attack is crit-eligible.
8. Apply elemental/situational/proc modifiers.
9. Round once near final output.
10. Clamp successful hit to minimum 1.

Normal attacks must be resolved per hit. Do not multiply one randomly resolved hit by ASPD and call that several attacks when accurate HIT/CRIT/proc behavior matters.

## 6. Skill damage contract

Every damaging skill should declare:
- scaling: PhysicalAttack / MagicalAttack / hybrid only when intentionally designed
- coefficient
- flat component if any
- hitCount
- defenseType: DEF / MDEF / ignore-explicit
- canCrit
- accuracy rule
- element
- tags

V1 form:

RawSkillDamage = ScalingAttack * SkillCoefficient + FlatSkillPower

Then resolve per-hit accuracy/defense/crit according to the skill definition.

Multi-hit skills divide their intended total coefficient across hits. More hitCount must not automatically mean more total damage; its advantage is interaction with hit/proc mechanics.

## 7. Weapon-family math identity

Sword:
- physical melee
- medium cadence / range
- balanced coefficients

Dagger:
- physical melee
- lowest per-hit coefficient, highest cadence
- benefits naturally from repeated-hit/proc systems

Axe:
- physical melee
- high WeaponATK / heavy coefficient
- slower commitment

Hammer:
- physical melee
- high WeaponATK
- stagger/control budget consumes part of its DPS budget

Bow:
- ranged physical
- DEX-primary StatusATK
- spacing/accuracy identity

Wand:
- magical
- faster magical cadence
- lighter per-hit MATK technique

Scepter:
- magical
- slower/heavier technique coefficients
- control/support budget

Do not use one universal STR scaling for all seven families.

## 8. Level difference

Do not directly multiply player damage by a hidden level penalty merely because an enemy is higher level.

Level matters naturally through:
- HIT/FLEE
- monster stats
- content access
- Enhancement cap
- mastery XP eligibility

This keeps skillful/geared players capable of challenging stronger monsters without an opaque level-wall.

## 9. Monster stat contract

Each monster should eventually expose:
- level
- maxHP
- ATK or MATK
- DEF
- MDEF
- HIT
- FLEE
- CRIT resistance only if specifically needed
- attack interval / ASPD-equivalent
- range
- element/type
- Elite/Boss flags

Normal monsters:
- low-to-moderate durability
- threat mainly from groups/combinations

Elite:
- higher stat budget plus mechanic/affix identity

Boss:
- enough durability for mechanics
- danger from telegraphs/mechanics, not only inflated HP/ATK

Old-map monsters do not scale to player Gear Score.

## 10. Refinement / Enhancement interaction

Enhancement supplies predictable flat equipment growth.

Refinement should modify equipment contribution, not the hero's entire derived stat block. This prevents STR/INT, Skill Core multipliers and refinement from multiplying each other uncontrollably.

Master Refinement applies its existing +2% / +4% / +6% to equipment-derived combat stats after equipment aggregation.

Affix percentage bonuses should specify their bucket. Do not multiply several equivalent '+ATK%' buckets independently unless intentionally designed.

## 11. Proc budget

A hit can produce multiple candidate procs, but:
- each Proc owns chance and internal cooldown;
- proc damage cannot recursively trigger the same or another unrestricted damage proc;
- multi-hit attacks check eligibility according to Proc definition;
- high-ASPD Dagger/Wand builds must not gain unlimited linear proc scaling.

Where needed, use proc coefficient / internal cooldown rather than nerfing ASPD globally.

## 12. Current-code migration notes

Current main-game combat is not yet this model.

Observed legacy behavior to replace during port:
- hero ATK/MATK currently includes large level-based flat offense and custom stat coefficients;
- current adventure damage adds Battle Power and spirit/stat terms directly into raw damage;
- monster attacks currently use a direct dodge percentage instead of HIT vs FLEE;
- monster physical damage currently uses flat DEF subtraction with a 15% raw-damage floor;
- current crit chance/damage use custom DEX/LUK formulas;
- Weave XP is still awarded from weapon attacks.

Preserve the already-correct ASPD relationship (150 = 1 APS, 193 ~= 7.14 APS) while replacing the surrounding legacy combat math incrementally.

## 13. Validation targets before final coefficients

Create deterministic combat-math tests for:
- HIT/FLEE at equal level and +/- level/stat spreads
- ASPD reference points 150/175/190/193/195
- physical vs DEF curve
- magic vs MDEF curve
- melee STR vs Bow DEX vs caster INT scaling
- critical rate and multiplier
- multi-hit total coefficient
- proc ICD under 193 ASPD
- old-map high-level overpower behavior
- boss survivability without gear-score scaling

Then run Arena Draft telemetry for:
- normal time-to-kill
- elite time-to-kill
- boss time-to-kill
- incoming damage / survival
- kills/hour

Use those measurements to tune coefficients; do not rewrite the architecture to chase one encounter.
