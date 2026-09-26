# Skill FX production (2026-09-25)

Pipeline: `create_image_pro` 96x96 key frame (4 candidates) → pick → `animate_image` 8 frames →
`art-test/fx-production/skills/<id>/frame_000..008.png` (frame 0 = key frame).
Projectiles and slashes face RIGHT (code rotates them); ground effects are drawn as an isometric
ellipse seen from above. Dash afterimages and target telegraphs are code FX (not generated).
Kept from the old game: groundSlam, meteorStorm, blackHole (`fx/runtime/`).

Style suffix on every prompt: *True handcrafted pixel art, crisp hard pixel clusters, no anti-aliasing,
no blur, no text, no character, transparent background.*

## Core skills
| id | key frame | animation |
|---|---|---|
| fireball | blazing fireball flying right, white-yellow core, orange-red flames, short tail | flames flicker and roil as it flies, embers shed behind |
| iceLance | long crystal ice spear flying right, cyan-white facets, frost mist trail | frost trail streams, facets glint, shards fall behind |
| thunderStorm | jagged blue-white lightning bolt striking down into the ground, sparks and flash | bolt flashes down, impact burst, bolt flickers and fades |
| frostNova | ring of jagged ice crystals bursting outward on the ground, cyan-white, mist | ring expands outward, crystals shoot up then shatter and fade |
| cyclone | swirling mint-white whirlwind tornado with dust and leaves | tornado spins fast, streaks rotate, dust whirls |
| chainLightning | horizontal crackling electric arc from left to right, blue-white branches | arc crackles, branches jump and flicker, fades |
| lightningField | crackling electric field on the ground, blue sparks in an ellipse | sparks jump across the field, small bolts pop up and fade |
| flameTrail | patch of fire burning on the ground, orange-red flames in an ellipse | flames dance and flicker, embers rise, dies down |
| barrier | translucent pink-white magic bubble shield with hexagon shimmer | shimmer ripples across the bubble, pulse glow |
| warCry | red-orange roar shockwave ring on the ground with speed lines | shockwave ring expands outward and fades |
| healingPulse | soft green healing ring on the ground with rising sparkles and small crosses | ring expands, sparkles and crosses float up, fades |
| blink | white-pink teleport flash burst with sparkles | flash bursts, sparkles scatter and vanish |
| piercingShot | glowing charged arrow flying right with white-gold streak | streak shimmers, arrow shaft glows, air ripples |
| bladeRush | three fast white slash streaks toward the right | streaks cut through one after another then fade |

## Weapon mastery skills
| id | family | key frame |
|---|---|---|
| bowlingBash | greatsword | heavy spinning sword slash impact, cream-white arc, dust ring |
| crescentBreak | greatsword | huge crescent-moon sword slash, bright white-gold |
| vanguardTempest | greatsword | storm of wind blades swirling around a center, mint-white |
| crossSlash | dagger | sharp X-shaped cross slash, white with pink edge |
| shadowFlurry | dagger | flurry of many small dark-violet slashes |
| phantomBlades | dagger | ring of ghostly translucent blades spinning around a center |
| cleavingStrike | axe | heavy downward cleave with a ground crack, orange-white |
| executionersSweep | axe | wide horizontal blood-red sweep slash |
| ravagerArc | axe | 360-degree crimson spin slash ring |
| crushingImpact | hammer | hammer impact crater with dust and rock chips |
| earthbreaker | hammer | ground fissure cracking open with rocks bursting up |
| cataclysm | hammer | massive earthquake explosion, rocks and dust, orange glow |
| powerShot | bow | charged arrow with a ring shockwave at the tip, flying right |
| piercingVolley | bow | three glowing arrow streaks flying right |
| skyfallBarrage | bow | rain of glowing arrows falling from the sky onto the ground |
| arcBolt | staff | small purple-blue arcane magic bolt flying right |
| arcCascade | staff | branching arcane lightning burst, purple-blue |
| astralVolley | staff | falling star shards raining down, gold-violet |
| radiantBurst | swordShield | golden holy light burst with rays |
| gravityPulse | swordShield | violet gravity wave ring pulling inward |
| astralDominion | swordShield | large golden-violet astral sigil circle exploding with light |

## Basic attack slash arcs (overlay on top of the baked swing)
| id | key frame |
|---|---|
| slashGreatsword | wide heavy crescent slash arc, cream-white |
| slashDagger | two quick thin crossing slashes, white with pink edge |
| slashAxe | heavy chopping arc, orange-white |
| slashHammer | blunt smash impact burst, white-yellow star |
| slashSwordShield | clean medium sword arc, white-blue |
| shotArrow | small arrow with white streak flying right |
| boltStaff | small magic orb bolt with sparkle trail flying right |
