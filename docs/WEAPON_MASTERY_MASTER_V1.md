# Bunny World — Weapon Mastery Master V1

Status: DESIGN LOCK CANDIDATE
Date: 2026-09-21

## 1. Purpose

Weapon Mastery replaces the old Weave-style combat mastery as the weapon-expertise progression layer.

Bunny World remains classless. Weapon Mastery does not create permanent classes and does not replace Skill Cores, Modifiers, Gear, Affixes, Enhancement or Refinement.

The seven mastery families are:
Sword / Dagger / Axe / Hammer / Bow / Wand / Scepter.

Mastery is earned by actually contributing to eligible combat while the corresponding weapon family is equipped. Manual, Semi-Auto and Full Auto use the same mastery rules.

Cap: Mastery Lv.50 per weapon family.

## 2. Progression philosophy

Do not grant generic +damage every mastery level.

Levels between milestones represent progress toward the next technique. Meaningful gameplay unlocks occur at Lv.10 / 20 / 30 / 40 / 50.

- Lv.1: family available; base weapon identity.
- Lv.10: Weapon Skill I.
- Lv.20: Style Passive I.
- Lv.30: Weapon Skill II.
- Lv.40: Advanced Style Passive.
- Lv.50: Signature Technique.

A player may level every family. Switching weapons is intentionally viable; there is no permanent class lock.

## 3. Mastery XP rules

Mastery XP is awarded for eligible combat contribution, not for merely swinging a weapon.

Recommended XP unit:
- Normal enemy: base 1 contribution unit.
- Elite: base 5 units.
- Boss: base 20 units.
- World/scheduled boss: encounter-specific reward, later tuning.

Eligibility multiplier by enemy level relative to Hero Level:
- enemy >= Hero Lv - 10: x1.00
- Hero Lv - 20 through Hero Lv - 11: x0.50
- Hero Lv - 30 through Hero Lv - 21: x0.10
- more than 30 levels below Hero: x0

This prevents endgame characters from efficiently mastering weapons on trivial Lv1 monsters while still allowing some progress when revisiting nearby lower content.

Only the weapon family equipped when eligible contribution is made receives mastery XP. Weapon swapping cannot retroactively redirect XP.

Exact XP required per mastery level is BALANCE TBD and must be calibrated from real kills/hour. The target is that Lv.50 represents sustained use of a family, not a one-session unlock.

## 4. Sword — balanced control

Identity: reliable melee, frontal control, positioning, dependable defense/offense rhythm.

| Lv | Unlock | Design |
|---|---|---|
| 10 | Bowling Bash | Heavy frontal strike; pushes normal enemies and delivers strong positional control. Bosses resist displacement. |
| 20 | Guarded Rhythm | After completing a basic-attack sequence or landing Bowling Bash, gain a brief defensive window. No permanent flat stat. |
| 30 | Crescent Break | Wide forward arc that rewards catching several enemies in front; stronger coverage than Bowling Bash, less displacement. |
| 40 | Riposte Window | Correctly avoiding/blocking a telegraphed hit primes the next Sword Weapon Skill for faster execution and added stagger pressure. |
| 50 | Vanguard Tempest | Signature multi-stage frontal assault: advancing cuts followed by a broad finishing slash. Strong general-purpose technique without replacing dedicated AoE Skill Cores. |

Sword should feel forgiving and readable, not highest DPS in every situation.

## 5. Dagger — speed / repeated hits

Identity: fastest melee pressure, repeated hits, close positioning, proc synergy.

| Lv | Unlock | Design |
|---|---|---|
| 10 | Cross Slash | Fast two-part close burst. |
| 20 | Quick Hands | Sustained basic hits build a short-lived Tempo stack; weapon skills consume/benefit from Tempo rather than granting unconditional damage. |
| 30 | Shadow Flurry | Rapid focused multi-hit sequence against one target or a very tight group. |
| 40 | Twin Fang | Critical hits / repeated-hit thresholds briefly improve the next Dagger Weapon Skill's hit pattern; internal cooldown prevents runaway proc loops. |
| 50 | Phantom Blades | Signature high-speed assault with afterimage strikes; excels at sustained close pressure and proc interaction. |

Dagger owns hit frequency, not raw per-hit power.

## 6. Axe — cleave / commitment

Identity: high-impact physical cleave, wide arcs, deliberate commitment.

| Lv | Unlock | Design |
|---|---|---|
| 10 | Cleaving Strike | Wide heavy arc hitting enemies around the primary target. |
| 20 | Heavy Momentum | Landing a committed Axe hit builds Momentum; moving/whiffing for too long loses it. Momentum modifies the next Axe technique rather than providing permanent ATK. |
| 30 | Executioner's Sweep | Slower broad sweep with strong payoff against wounded groups; interacts naturally with Execution-style builds. |
| 40 | Overpower | Hitting Elite/Boss or multiple enemies with a heavy technique primes a limited armor-break/stagger interaction. |
| 50 | Ravager Arc | Signature enormous cleave with a readable wind-up and high payoff; player can reposition before committing but cannot spam it like a light weapon. |

Axe should feel destructive without becoming Hammer-with-a-different-sprite.

## 7. Hammer — stagger / impact

Identity: slowest impact weapon, crowd disruption, stagger and heavy telegraph punishment.

| Lv | Unlock | Design |
|---|---|---|
| 10 | Crushing Impact | Heavy localized smash with high stagger pressure. |
| 20 | Aftershock | Heavy Hammer techniques leave a small delayed secondary impact; secondary hit is utility-weighted, not a second full-damage nuke. |
| 30 | Earthbreaker | Frontal/ground shockwave extending Hammer threat beyond the immediate contact point. |
| 40 | Unshakable | During committed Hammer Weapon Skill wind-ups, gain limited interruption resistance; it does not grant immunity to lethal boss mechanics. |
| 50 | Cataclysm | Signature overhead impact followed by a large aftershock. Excellent against clustered durable enemies and stagger windows. |

Hammer owns stagger and commitment; Axe owns cleave and execution.

## 8. Bow — precision / spacing

Identity: ranged physical precision, line control, maintaining distance and deliberate shots.

| Lv | Unlock | Design |
|---|---|---|
| 10 | Power Shot | Aimed high-impact projectile with brief commitment. |
| 20 | Steady Aim | Maintaining useful distance and avoiding interruption builds Focus; careless close-range pressure breaks it. |
| 30 | Piercing Volley | Focused line attack that penetrates aligned enemies; distinct from the general Piercing Shot Core by being a weapon technique with Bow mastery interactions. |
| 40 | Hunter's Mark | Precision Weapon Skill hits can mark a priority target for a short window, improving Bow-specific follow-up behavior rather than globally amplifying all damage. |
| 50 | Skyfall Barrage | Signature targeted volley over a compact area; strong ranged payoff but narrower than dedicated large AoE spell cores. |

Bow should reward spacing and target selection, not passive off-screen safety.

## 9. Wand — rapid spell weapon

Identity: light magical weapon, quick casting cadence, mobility and elemental/proc synergy.

| Lv | Unlock | Design |
|---|---|---|
| 10 | Arc Bolt | Quick magical ranged weapon technique. |
| 20 | Spellweave | Using an Active Skill Core and Wand attacks in alternation builds a short rhythm bonus to Wand technique execution, not generic spell damage. |
| 30 | Arc Cascade | Several fast magical bolts seek the selected target/nearby valid targets. |
| 40 | Conduit | Elemental Skill Core use can temporarily attune the next Wand Weapon Skill to that element for interaction/proc purposes. Must not recursively trigger procs. |
| 50 | Astral Volley | Signature rapid magical barrage emphasizing mobility and repeated magical hits. |

Wand is the fast magical weapon; its mastery should interact with Skill Cores without replacing them.

## 10. Scepter — heavy magic / control-support

Identity: slower, heavier magical impact with short-area control and defensive/offensive utility.

| Lv | Unlock | Design |
|---|---|---|
| 10 | Radiant Burst | Short-range magical burst around/forward of the hero. |
| 20 | Resonance | Casting a Defensive or AoE Skill Core primes the next Scepter technique with a context-sensitive secondary effect; avoid unconditional MATK scaling. |
| 30 | Gravity Pulse | Dense magical pulse that pulls/slows eligible normal enemies toward a focal area; bosses resist hard displacement. |
| 40 | Dominion | Successfully affecting multiple enemies or protecting through a defensive skill grants a brief empowered Scepter-technique state. |
| 50 | Astral Dominion | Signature controlled magical detonation with an initial control pulse followed by a heavy burst. |

Scepter should not be Wand-but-stronger: it trades cadence/mobility for impact and control.

## 11. Weapon Skill compatibility

Weapon Skills:
- require the matching equipped weapon family;
- are unlocked permanently for that family at the mastery milestone;
- are not monster drops;
- do not consume Active Skill Core slots;
- should have their own Weapon Skill input/selection contract;
- may reference Skill tags/effects for shared combat math, but must not become universal Skill Cores.

General Skill Cores remain loot-driven and classless.

## 12. Auto / Semi-Auto

Auto may use unlocked Weapon Skills.

Each Weapon Skill definition should expose:
- canAutoUse
- minimumEnemyCount where relevant
- preferredRange
- reserveForElite / reserveForBoss where relevant
- danger constraints
- target preference

Auto receives no mastery XP bonus and no drop bonus. Manual and Semi-Auto are not penalized.

## 13. Balance guardrails

1. No mastery family receives unconditional per-level damage scaling.
2. Milestone passives change play pattern more than raw DPS.
3. Weapon Skill II and Signature skills must not obsolete general Skill Cores.
4. Weapon switching remains practical; mastery is expertise, not class commitment.
5. Boss hard-CC resistance is explicit; control skills still provide damage/stagger/secondary value.
6. Multi-hit skills obey proc internal-cooldown/budget rules.
7. Animation availability is an implementation constraint: each family already targets three authored attack actions, but mastery skills may reuse/combine those actions plus FX until dedicated assets exist.
8. Exact coefficients, cooldowns, cast times, resource costs and mastery XP curve are not locked until Combat Math V1 and real encounter pacing are measured.

## 14. Migration from Weave

The old Might / Range / Arcane / Mend / Hex Weave mastery must not coexist as a second weapon progression tree after this system is ported.

Migration plan:
- retain reusable combat effects where useful;
- remove weapon-attack XP routing into Weave;
- route eligible weapon contribution into Weapon Mastery;
- migrate any valuable non-weapon Weave concepts into Passive Core, Skill Modifier, Proc, or future systems;
- do not silently convert old Weave ranks into Weapon Mastery until save-migration policy is explicitly designed.

## 15. Implementation order

1. Define WeaponFamilyMastery state and registry.
2. Implement XP eligibility/contribution resolver.
3. Implement Lv.10 skills first for all seven families.
4. Add mastery UI and progress display.
5. Add Lv.20/30/40/50 milestone effects.
6. Add Auto decision metadata.
7. Retire old Weave weapon-XP path.
8. Balance XP curve and combat coefficients from telemetry.
