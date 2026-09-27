# Burrow Command economy audit

Generated from current source with `node tools/burrow-economy-audit.mjs`. No save data accessed.

## Assumptions
- dropMultiplier: 1.35
- gold: Fixed Burrow region/rank table, Forest I (Normal 5, Elite 15, Boss 50) plus 20% of that baseline per successive map, no Warren-level multiplier or main-game Gold roll.
- workshop: Base rewards before 1/2/3% bonus; add bonus only to gold and common mats.
- day: 85% uniformly selected normal, 15% FIRST elite. Spawn mixture, not observed kill mixture.
- night: All queued enemies successfully spawn and die. No losses, repair spending or failed nights modeled.
- scenarios: Illustrative 10/25/50 day kills, 75% delivery, wave 3 fully cleared. Not measured days to unlock.
- lure: All spawned monsters killed and delivered; no displaced normal farming accounted for.

## All playable monsters
Gold shown at entry Warren level of each map, before Workshop bonus. Item probabilities include all source tuning and runtime ×1.35.

| Map | Monster | Rank | Gold/kill | Drops: probability per kill |
|---|---|---|---:|---|
| forest1 | mossblob1 | normal | 5.00 | copperOre 27.00%; astraliteStone 4.05%; livingMoss 78.98%; verdantAetherstone 20.25%; lifeDrain 1.42%; tier1Blueprint 5.40% |
| forest1 | mossblob3 | normal | 5.00 | copperOre 27.00%; astraliteStone 4.05%; livingMoss 78.98%; verdantAetherstone 20.25%; tier1Blueprint 5.40%; forestLeaf 1.01% |
| forest1 | sporekin1 | normal | 5.00 | copperOre 27.00%; astraliteStone 4.05%; brutalSpore 70.20%; verdantAetherstone 20.25%; lingering 1.62%; blackHole 0.41%; tier1Blueprint 5.40% |
| forest1 | sporekin3 | normal | 5.00 | copperOre 27.00%; astraliteStone 4.05%; brutalSpore 70.20%; verdantAetherstone 20.25%; lingering 1.01%; tier1Blueprint 5.40%; sporeGoggles 1.01%; mushroomCap 0.61% |
| forest1 | barkBeetle2 | normal | 5.00 | copperOre 27.00%; astraliteStone 4.05%; livingMoss 78.98%; verdantAetherstone 20.25%; lingering 1.62%; barrier 0.41%; tier1Blueprint 5.40% |
| forest1 | barkBeetle3 | normal | 5.00 | copperOre 27.00%; astraliteStone 4.05%; livingMoss 78.98%; verdantAetherstone 20.25%; lifeDrain 1.42%; tier1Blueprint 5.40% |
| forest1 | mossblob2 | elite | 15.00 | copperOre 27.00%; astraliteStone 4.05%; livingMoss 100.00%; verdantAetherstone 60.75%; lifeDrain 14.18%; barrier 8.10%; tier1Blueprint 5.40% |
| forest1 | sporekin2 | elite | 15.00 | copperOre 27.00%; astraliteStone 4.05%; brutalSpore 100.00%; verdantAetherstone 60.75%; lingering 14.18%; blackHole 8.10%; tier1Blueprint 5.40% |
| forest1 | barkBeetle1 | elite | 15.00 | copperOre 27.00%; astraliteStone 4.05%; livingMoss 100.00%; verdantAetherstone 60.75%; lifeDrain 14.18%; barrier 8.10%; tier1Blueprint 5.40% |
| forest1 | mushroom | boss | 50.00 | copperOre 27.00%; astraliteStone 4.05%; verdantAetherstone 81.00%; expandedArea 40.50%; cyclone 13.50%; tier1Blueprint 5.40%; mossCrown 16.20% |
| forest2 | acorn2 | normal | 6.00 | copperOre 27.00%; astraliteStone 4.05%; livingMoss 70.20%; verdantAetherstone 36.45%; execution 1.42%; tier1Blueprint 8.10% |
| forest2 | acorn3 | normal | 6.00 | copperOre 27.00%; astraliteStone 4.05%; livingMoss 70.20%; verdantAetherstone 36.45%; execution 1.62%; cyclone 0.41%; tier1Blueprint 8.10% |
| forest2 | twig2 | normal | 6.00 | copperOre 27.00%; astraliteStone 4.05%; brutalSpore 70.20%; verdantAetherstone 36.45%; rapidCasting 1.62%; tier1Blueprint 8.10%; luckyTwig 1.22% |
| forest2 | twig3 | normal | 6.00 | copperOre 27.00%; astraliteStone 4.05%; brutalSpore 70.20%; verdantAetherstone 36.45%; rapidCasting 1.62%; chainLightning 0.41%; tier1Blueprint 8.10% |
| forest2 | thornBoar2 | normal | 6.00 | copperOre 27.00%; astraliteStone 4.05%; brutalSpore 70.20%; verdantAetherstone 36.45%; execution 1.62%; groundSlam 0.41%; tier1Blueprint 8.10% |
| forest2 | thornBoar3 | normal | 6.00 | copperOre 27.00%; astraliteStone 4.05%; brutalSpore 70.20%; verdantAetherstone 36.45%; execution 1.62%; tier1Blueprint 8.10% |
| forest2 | acorn1 | elite | 18.00 | copperOre 27.00%; astraliteStone 4.05%; livingMoss 100.00%; verdantAetherstone 100.00%; execution 14.18%; cyclone 8.10%; tier1Blueprint 10.80% |
| forest2 | twig1 | elite | 18.00 | copperOre 27.00%; astraliteStone 4.05%; brutalSpore 100.00%; verdantAetherstone 100.00%; rapidCasting 14.18%; chainLightning 8.10%; tier1Blueprint 10.80% |
| forest2 | thornBoar1 | elite | 18.00 | copperOre 27.00%; astraliteStone 4.05%; brutalSpore 100.00%; verdantAetherstone 100.00%; execution 14.18%; groundSlam 8.10%; tier1Blueprint 10.80% |
| forest2 | thornroot | boss | 60.00 | copperOre 27.00%; astraliteStone 4.05%; verdantAetherstone 91.13%; lingering 40.50%; frostNova 13.50%; tier1Blueprint 13.50% |
| desert1 | duneling2 | normal | 7.00 | moonstoneShard 27.00%; astraliteStone 4.05%; duneRunnerClaw 87.75%; azureAetherstone 20.25%; mobileCast 1.82%; dash 0.54%; tier2Blueprint 5.40%; desertGoggles 1.22% |
| desert1 | duneling3 | normal | 7.00 | moonstoneShard 27.00%; astraliteStone 4.05%; duneRunnerClaw 87.75%; azureAetherstone 20.25%; mobileCast 1.42%; tier2Blueprint 5.40% |
| desert1 | cactling1 | normal | 7.00 | moonstoneShard 27.00%; astraliteStone 4.05%; cactusSpine 87.75%; azureAetherstone 20.25%; combustion 1.62%; tier2Blueprint 5.40%; cactusCrown 1.22% |
| desert1 | cactling3 | normal | 7.00 | moonstoneShard 27.00%; astraliteStone 4.05%; cactusSpine 78.98%; azureAetherstone 20.25%; combustion 1.82%; fireball 0.54%; tier2Blueprint 5.40%; desertScarf 1.22% |
| desert1 | mirageJackal2 | normal | 7.00 | moonstoneShard 27.00%; astraliteStone 4.05%; duneRunnerClaw 87.75%; azureAetherstone 20.25%; mobileCast 1.82%; dash 0.54%; tier2Blueprint 5.40% |
| desert1 | mirageJackal3 | normal | 7.00 | moonstoneShard 27.00%; astraliteStone 4.05%; duneRunnerClaw 87.75%; azureAetherstone 20.25%; mobileCast 1.62%; tier2Blueprint 5.40% |
| desert1 | duneling1 | elite | 21.00 | moonstoneShard 27.00%; astraliteStone 4.05%; duneRunnerClaw 100.00%; azureAetherstone 60.75%; mobileCast 14.18%; dash 10.80%; tier2Blueprint 5.40% |
| desert1 | cactling2 | elite | 21.00 | moonstoneShard 27.00%; astraliteStone 4.05%; cactusSpine 100.00%; azureAetherstone 60.75%; combustion 16.20%; fireball 10.80%; tier2Blueprint 5.40% |
| desert1 | mirageJackal1 | elite | 21.00 | moonstoneShard 27.00%; astraliteStone 4.05%; duneRunnerClaw 100.00%; azureAetherstone 60.75%; mobileCast 14.18%; dash 10.80%; tier2Blueprint 5.40% |
| desert1 | dunemaw | boss | 70.00 | moonstoneShard 27.00%; astraliteStone 4.05%; azureAetherstone 81.00%; echo 40.50%; meteorStorm 13.50%; tier2Blueprint 5.40% |
| desert2 | dust2 | normal | 8.00 | moonstoneShard 27.00%; astraliteStone 4.05%; duneRunnerClaw 87.75%; azureAetherstone 24.30%; mobileCast 2.02%; piercingShot 0.54%; tier2Blueprint 5.40% |
| desert2 | dust3 | normal | 8.00 | moonstoneShard 27.00%; astraliteStone 4.05%; duneRunnerClaw 87.75%; azureAetherstone 24.30%; rapidCasting 2.02%; tier2Blueprint 5.40% |
| desert2 | scarab1 | normal | 8.00 | moonstoneShard 27.00%; astraliteStone 4.05%; cactusSpine 87.75%; azureAetherstone 24.30%; chain 1.62%; tier2Blueprint 5.40% |
| desert2 | scarab2 | normal | 8.00 | moonstoneShard 27.00%; astraliteStone 4.05%; cactusSpine 87.75%; azureAetherstone 24.30%; overcharge 2.02%; lightningField 0.54%; tier2Blueprint 5.40% |
| desert2 | sandScorpion1 | normal | 8.00 | moonstoneShard 27.00%; astraliteStone 4.05%; cactusSpine 87.75%; azureAetherstone 24.30%; chain 1.82%; lightningField 0.54%; tier2Blueprint 5.40% |
| desert2 | dust1 | elite | 24.00 | moonstoneShard 27.00%; astraliteStone 4.05%; duneRunnerClaw 100.00%; azureAetherstone 70.87%; rapidCasting 16.20%; piercingShot 10.80%; tier2Blueprint 5.40% |
| desert2 | scarab3 | elite | 24.00 | moonstoneShard 27.00%; astraliteStone 4.05%; cactusSpine 100.00%; azureAetherstone 70.87%; chain 16.20%; lightningField 10.80%; tier2Blueprint 5.40% |
| desert2 | sandScorpion2 | elite | 24.00 | moonstoneShard 27.00%; astraliteStone 4.05%; cactusSpine 100.00%; azureAetherstone 70.87%; chain 16.20%; lightningField 10.80%; tier2Blueprint 5.40% |
| desert2 | colossus | boss | 80.00 | moonstoneShard 27.00%; astraliteStone 4.05%; azureAetherstone 91.13%; extraStrike 40.50%; thunderStorm 13.50%; tier2Blueprint 5.40%; sunscarabHelm 16.20% |

## Weighted progression
Gold and common materials exclude Workshop bonus. Night = wave 3, all kills. Per-day examples apply 75% delivery to daytime loot only.

| Lv | Map | Day G/kill | Day common/kill | Night G | Night common | G/day: 10 / 25 / 50 day kills |
|---:|---|---:|---:|---:|---:|---|
| 1 | forest1 | 6.50 | 1.07 | 73.80 | 9.96 | 122.55 / 195.67 / 317.55 |
| 2 | forest1 | 6.50 | 1.07 | 103.20 | 13.40 | 151.95 / 225.08 / 346.95 |
| 3 | forest1 | 6.50 | 1.07 | 135.00 | 16.89 | 183.75 / 256.88 / 378.75 |
| 4 | forest1 | 6.50 | 1.07 | 169.20 | 20.45 | 217.95 / 291.07 / 412.95 |
| 5 | forest1 | 6.50 | 1.07 | 205.80 | 24.05 | 254.55 / 327.67 / 449.55 |
| 6 | forest2 | 7.80 | 1.02 | 293.76 | 27.05 | 352.26 / 440.01 / 586.26 |
| 7 | forest2 | 7.80 | 1.02 | 343.44 | 30.75 | 401.94 / 489.69 / 635.94 |
| 8 | forest2 | 7.80 | 1.02 | 396.00 | 34.52 | 454.50 / 542.25 / 688.50 |
| 9 | forest2 | 7.80 | 1.02 | 451.44 | 38.37 | 509.94 / 597.69 / 743.94 |
| 10 | forest2 | 7.80 | 1.02 | 509.76 | 42.29 | 568.26 / 656.01 / 802.26 |
| 11 | desert1 | 9.10 | 1.15 | 666.12 | 48.04 | 734.37 / 836.75 / 1007.37 |
| 12 | desert1 | 9.10 | 1.15 | 740.88 | 51.96 | 809.13 / 911.50 / 1082.13 |
| 13 | desert1 | 9.10 | 1.15 | 819.00 | 55.92 | 887.25 / 989.62 / 1160.25 |
| 14 | desert1 | 9.10 | 1.15 | 873.60 | 59.64 | 941.85 / 1044.22 / 1214.85 |
| 15 | desert1 | 9.10 | 1.15 | 928.20 | 63.38 | 996.45 / 1098.82 / 1269.45 |
| 16 | desert2 | 10.40 | 1.17 | 1123.20 | 67.26 | 1201.20 / 1318.20 / 1513.20 |
| 17 | desert2 | 10.40 | 1.17 | 1185.60 | 70.99 | 1263.60 / 1380.60 / 1575.60 |
| 18 | desert2 | 10.40 | 1.17 | 1248.00 | 74.73 | 1326.00 / 1443.00 / 1638.00 |
| 19 | desert2 | 10.40 | 1.17 | 1310.40 | 78.47 | 1388.40 / 1505.40 / 1700.40 |
| 20 | desert2 | 10.40 | 1.17 | 1372.80 | 82.20 | 1450.80 / 1567.80 / 1762.80 |

## Lure at map entry
Gross rewards before delivery loss/Workshop. Common reward is much smaller than the material payment; rare drops remain probabilistic.

| Lv | Mode | Cost common | Gold | Common returned | Blueprint expected | Astralite expected |
|---:|---|---:|---:|---:|---:|---:|
| 1 | small | 100 | 40.00 | 8.24 | 0.43 | 0.32 |
| 1 | elite | 200 | 75.00 | 7.26 | 0.32 | 0.24 |
| 1 | frontier | 300 | 51.00 | 5.38 | 0.45 | 0.20 |
| 6 | small | 100 | 48.00 | 7.78 | 0.65 | 0.32 |
| 6 | elite | 200 | 90.00 | 7.17 | 0.61 | 0.24 |
| 6 | frontier | 300 | 59.50 | 5.90 | 0.27 | 0.20 |
| 11 | small | 100 | 56.00 | 9.06 | 0.43 | 0.32 |
| 11 | elite | 200 | 105.00 | 7.41 | 0.32 | 0.24 |
| 11 | frontier | 300 | 68.00 | 5.95 | 0.27 | 0.20 |
| 16 | small | 100 | 64.00 | 9.18 | 0.43 | 0.32 |
| 16 | elite | 200 | 120.00 | 7.44 | 0.32 | 0.24 |

## Craft costs (all supported T1/T2 recipes)

| Recipe | Gold | Requirements |
|---|---:|---|
| mosswoodSword | 120 | tier1Blueprint ×1; copperOre ×2; livingMoss ×4 |
| sporefangDagger | 120 | tier1Blueprint ×1; copperOre ×2; livingMoss ×4 |
| mosswoodAxe | 120 | tier1Blueprint ×1; copperOre ×2; livingMoss ×4 |
| copperrootHammer | 120 | tier1Blueprint ×1; copperOre ×2; livingMoss ×4 |
| mosswoodBow | 120 | tier1Blueprint ×1; copperOre ×2; livingMoss ×4 |
| sporewoodWand | 120 | tier1Blueprint ×1; copperOre ×2; brutalSpore ×4 |
| sporewoodScepter | 120 | tier1Blueprint ×1; copperOre ×2; brutalSpore ×4 |
| wildwoodSword | 320 | tier2Blueprint ×1; moonstoneShard ×3; duneRunnerClaw ×6; cactusSpine ×2 |
| thornfangDagger | 320 | tier2Blueprint ×1; moonstoneShard ×3; duneRunnerClaw ×6; cactusSpine ×2 |
| ironrootAxe | 320 | tier2Blueprint ×1; moonstoneShard ×3; duneRunnerClaw ×6; cactusSpine ×2 |
| ironbarkHammer | 320 | tier2Blueprint ×1; moonstoneShard ×3; duneRunnerClaw ×6; cactusSpine ×2 |
| thornwoodBow | 320 | tier2Blueprint ×1; moonstoneShard ×3; duneRunnerClaw ×6; cactusSpine ×2 |
| bloomWand | 320 | tier2Blueprint ×1; moonstoneShard ×3; cactusSpine ×6; duneRunnerClaw ×2 |
| bloomScepter | 320 | tier2Blueprint ×1; moonstoneShard ×3; cactusSpine ×6; duneRunnerClaw ×2 |
| t1Armor | 140 | tier1Blueprint ×1; copperOre ×2; livingMoss ×5 |
| t1AccessoryLeft | 70 | tier1Blueprint ×1; copperOre ×2; brutalSpore ×2 |
| t2DamageArmor | 380 | tier2Blueprint ×1; moonstoneShard ×4; duneRunnerClaw ×7; cactusSpine ×2 |
| t2DamageAccessoryLeft | 190 | tier2Blueprint ×1; moonstoneShard ×2; duneRunnerClaw ×4; cactusSpine ×1 |
| t2DamageAccessoryRight | 190 | tier2Blueprint ×1; moonstoneShard ×2; duneRunnerClaw ×4; cactusSpine ×1 |
| t2TankArmor | 380 | tier2Blueprint ×1; moonstoneShard ×4; duneRunnerClaw ×7; cactusSpine ×2 |
| t2TankAccessoryLeft | 190 | tier2Blueprint ×1; moonstoneShard ×2; duneRunnerClaw ×4; cactusSpine ×1 |
| t2TankAccessoryRight | 190 | tier2Blueprint ×1; moonstoneShard ×2; duneRunnerClaw ×4; cactusSpine ×1 |
| t2SupportArmor | 380 | tier2Blueprint ×1; moonstoneShard ×4; cactusSpine ×7; duneRunnerClaw ×2 |
| t2SupportAccessoryLeft | 190 | tier2Blueprint ×1; moonstoneShard ×2; cactusSpine ×4; duneRunnerClaw ×1 |
| t2SupportAccessoryRight | 190 | tier2Blueprint ×1; moonstoneShard ×2; cactusSpine ×4; duneRunnerClaw ×1 |

## Refine cumulative expected cost per slot
Unprotected, starting at +0, baseGoldCost=120. Includes failures, 20% downgrade conditional on failure, and safe floors. Expected value, not a guaranteed budget.

| Target | Attempts | Gold | Astralite |
|---:|---:|---:|---:|
| +1 | 1.00 | 78.00 | 1.00 |
| +2 | 2.06 | 276.72 | 2.06 |
| +3 | 3.20 | 647.80 | 3.20 |
| +4 | 4.41 | 1246.78 | 5.59 |
| +5 | 5.83 | 2205.38 | 8.42 |
| +6 | 7.52 | 3693.23 | 11.80 |
| +7 | 9.34 | 5747.77 | 19.07 |
| +8 | 12.00 | 9307.77 | 29.74 |
| +9 | 15.85 | 15310.06 | 45.13 |
| +10 | 19.85 | 22974.06 | 77.13 |
| +11 | 28.05 | 40140.26 | 142.73 |
| +12 | 44.01 | 76348.62 | 270.41 |
| +13 | 54.01 | 104658.62 | 430.41 |
| +14 | 94.87 | 225039.47 | 1084.12 |
| +15 | 270.13 | 752566.73 | 3888.24 |

## Enhance cumulative guaranteed cost per slot

| Target | Gold |
|---:|---:|
| +1 | 100 |
| +5 | 570 |
| +10 | 1320 |
| +20 | 3680 |
| +40 | 15460 |
| +80 | 174680 |
| +120 | 1812010 |
