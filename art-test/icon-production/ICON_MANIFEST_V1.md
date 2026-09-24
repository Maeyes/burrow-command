# Bunny World — Icon Production Manifest v1

Source of truth audited 2026-09-23:
- src/simulation/itemMasterV2.ts
- src/simulation/itemTagsV2.ts
- src/simulation/skills.ts

## Art contract
- Native icon canvas: 64x64 px, transparent RGBA.
- One icon per cell; no text, labels, borders, UI frame, floor, or cast shadow.
- Crisp intentional pixel clusters; no antialiasing / smooth painting / 3D render.
- Comparable objects share scale and camera angle.
- Equipment: object silhouette first. Skills: action/effect silhouette first.
- Generate sheets as exact 4x4 grids (256x256), then slice into 16 independent 64x64 PNGs.
- Never use a generated sheet directly in runtime.

## Authoritative equipment
35 main-hand weapons = 7 families x T1-T5.
10 offhands = dagger + shield x T1-T5.
T1 body/accessory: Armor, Cape, Shoes, Sporeloop Charm.
T2-T5 each contain Damage/Tank/Support sets across Armor/Cape/Shoes/Ring/Pendant = 60.
Total equipment templates: 109.

## Skills
41 skills are currently authoritative in `SKILLS_V2`, but the weapon-mastery design is NOT YET UPDATED/LOCKED.
Current snapshot: 18 general/movement/support skills + 23 weapon skills.
Current weapon families represented: Greatsword, Dagger, Axe, Hammer, Bow, Staff, Sword+Shield.

### MASTERY ACTIVE-SKILL RULE — LOCKED
Weapon Mastery grants the family's three active weapon skills at Lv10 / Lv20 / Lv30.
The existing passive/mechanical mastery milestones remain additional bonuses and are not replaced by active skills.
Authoritative family mapping:
- Greatsword: Bowling Bash / Crescent Break / Vanguard Tempest
- Dagger: Cross Slash / Shadow Flurry / Phantom Blades
- Axe: Cleaving Strike / Executioner's Sweep / Ravager Arc
- Hammer: Crushing Impact / Earthbreaker / Cataclysm
- Bow: Power Shot / Piercing Volley / Skyfall Barrage
- Staff: Arc Bolt / Arc Cascade / Astral Volley
- Sword+Shield: Radiant Burst / Gravity Pulse / Astral Dominion
B11-B13 weapon-skill icons are now valid production targets.

## Production batches
### B01 — T1 Weapons & Offhands (9)
mosswoodSword, sporefangDagger, mosswoodAxe, copperrootHammer, mosswoodBow, sporewoodWand, sporewoodScepter, t1OffhandDagger, t1Shield

### B02 — T2 Weapons & Offhands (9)
wildwoodSword, thornfangDagger, ironrootAxe, ironbarkHammer, thornwoodBow, bloomWand, bloomScepter, t2OffhandDagger, t2Shield

### B03 — T3 Weapons & Offhands (9)
sunscarBlade, duneFangDagger, sunbreakerAxe, duneforgeHammer, scorchwindBow, mirageWand, sunspireScepter, t3OffhandDagger, t3Shield

### B04 — T4 Weapons & Offhands (9)
blacksteelSword, goblinShiv, blacksteelCleaver, stonebreakerHammer, goblinWarbow, runeboundWand, runeboundScepter, t4OffhandDagger, t4Shield

### B05 — T5 Weapons & Offhands (9)
apexSword, apexDagger, apexAxe, apexHammer, apexBow, celestialWand, celestialScepter, t5OffhandDagger, t5Shield

### B06 — T1 body + core upgrade materials (12)
t1Armor, t1Cape, t1Shoes, t1AccessoryLeft,
verdantAetherstone, azureAetherstone, violetAetherstone, astraliteStone,
refineProtectionLv1, refineProtectionLv2, optionStone, reoptionStone

### B07 — Current crafting materials (16)
livingMoss, brutalSpore, duneRunnerClaw, cactusSpine,
djinnEssence, sunscarabCarapace, goblinIronScrap, cursedBone,
copperOre, ironOre, moonstoneShard, silverOre,
mithrilOre, bruteSpore, ancientRootHeart, duneMawFang

### B08 — Crafting + blueprint reserve (7)
sunforgeCore, leaderEmblem,
tier1Blueprint, tier2Blueprint, tier3Blueprint, tier4Blueprint, tier5Blueprint
Reserve 9 empty cells for future authoritative materials.

### B09 — Skill modifiers (12)
lifeDrain, lingering, expandedArea, execution,
rapidCasting, mobileCast, combustion, echo,
overcharge, chain, extraStrike, concentratedForce

### B10 — General Skills A (16)
cyclone, thunderStorm, meteorStorm, dash,
blink, barrier, warCry, frostNova,
chainLightning, fireball, piercingShot, groundSlam,
bladeRush, iceLance, healingPulse, blackHole

### B11 — General Skills B + Greatsword + Dagger (8) — READY
lightningField, flameTrail,
bowlingBash, crescentBreak, vanguardTempest,
crossSlash, shadowFlurry, phantomBlades

### B12 — Axe + Hammer + Bow (9) — READY
cleavingStrike, executionersSweep, ravagerArc,
crushingImpact, earthbreaker, cataclysm,
powerShot, piercingVolley, skyfallBarrage

### B13 — Staff + Sword/Shield (6) — READY
arcBolt, arcCascade, astralVolley,
radiantBurst, gravityPulse, astralDominion

### B14 — Weapon mastery milestones (35) — added after audit of src/simulation/masteryMilestones.ts
7 families x 5 milestones (Lv10/20/30/40/50). Output folder: output/MASTERY, files named `<family>_<milestoneId>.png`.
greatsword: cleave, cleaveII, wideCleave, cleaveIII, perfectCleave
dagger: doubleAttack, doubleAttackII, precisionFollowup, criticalFollowup, doubleAttackIII
axe: heavyBlow, heavyBlowII, armorBreak, heavyBlowIII, crushingArmorBreak
hammer: crushingImpact, crushingImpactII, concussion, crushingImpactIII, shockwave
bow: multiShot, multiShotII, eagleEye, piercingArrow, multiShotIII
staff: concentration, mobileCasting, flowCasting, coreEcho, perfectCasting
swordShield: guard, firmGuard, counterGuard, perfectGuard, aegisMastery

Audit notes:
- Verified 2026-09-24 against current code: skillEntitlements.ts grants 1/2/3 family weapon skills at mastery Lv10/20/30 (0 below Lv10); passive milestones are separate and unchanged. All 21 weapon-skill IDs exist in SKILLS_V2 with matching `compatibleWeaponFamilies`.
- skills.ts has 39 entries (18 general + 21 weapon), not the 41 (18 + 23) stated in the Skills header above; B10-B13 cover all 39. The 21 weapon-skill icons were redone under the action-icon brief (v1 backups in qa/weapon-skill-v1/).
- No UI consumes weapon skills yet: the hotbar has 3 Skill Core slots + movement (castHotbarSkill reads skills.active only), weapon skills are reachable only via Auto Hunt, and the mastery panel lists passive milestones only. iconFor(id,'skill') already resolves all 21.
- Hammer milestone `crushingImpact` shares its id with the hammer skill `crushingImpact`; mastery files carry the family prefix to avoid collision.

## Later batches (produced 2026-09-24, per-icon generation, all validated 64x64 RGBA)
### B15 — T2-T5 set equipment (60) — output/B15
Damage / Tank / Support x Armor / Cape / Shoes / AccessoryLeft (ring) / AccessoryRight (pendant), ids `t{2..5}{Role}{Slot}`.
Sets: T2 Wildfang / Ironbark / Spiritbloom, T3 Sunscar / Dune Bastion / Mirage, T4 Blacksteel / Stoneguard / Runebound, T5 Apex / Immortal / Celestial.
### B16 — utility gear, starter, T5 placeholders, boss uniques (24) — output/B16
mushroomCap, mossCrown, sporeGoggles, forestLeaf, luckyTwig, cactusCrown, desertGoggles, desertScarf, sunscarabHelm, goblinMinerHelm, goblinEyepatch, boneVisor, boneCharm, foremanHelm, starterDagger,
futureT5Ore, futureT5MaterialA, futureT5MaterialB (placeholder art), mushroomBruteUnique, thornrootUnique, duneMawUnique, sunforgeUnique, goblinLeaderUnique, bloodPrice (unique-drop art is provisional: no item design exists in code).
### UI (8) — output/UI: gear, craft, skill, monster, settings (quick menu), potion, home, auto (combat HUD).
### FAMILY (7) — output/FAMILY: greatsword, dagger, axe, hammer, bow, staff, swordShield (weapon mastery family emblems).
Redone in place: sporewoodScepter, sunspireScepter, t3OffhandDagger, tier2Blueprint, apexDagger, t5OffhandDagger, MASTERY greatsword_* (5) and hammer_concussion (previous versions in qa/replaced-v2/).
Coverage: `npm run icons:sync` regenerates public/assets/icons and ICON_COVERAGE.md (all authoritative equipment, items, skills, mastery, UI and family ids currently have a PNG).

## Do not produce yet
Legacy-only crafting resources beastPelt, pelt, hide, fang, core.
They remain semantically tagged for old saves but are not current production art targets.
