# Handoff: New Monster Sprites (Bunny World)

## Goal
Generate sprites + animations for all new-map monsters with PixelLab, matching the style of existing Bunny World monsters (e.g. Cactling Bandit, Mossblob, Duneling).

## Workflow per monster
1. Generate the 24x24 sprite with PixelLab using the prompt template below (PixelLab returns 64 variants).
2. Pick **3 variants per monster** that best match the style rules (readable silhouette, compact, sparse crisp pixel clusters, fits beside existing monsters).
3. For each of the 3 picks, create animations:
   - **walk**: loop, side-facing right, moving toward the player
   - **attack**: one strike toward the right (bite, slam, claw, cast, etc. per monster), returns to idle pose
   - Swimmers / floaters (marked 🌊 / 👻): replace walk with a **swim/hover loop** that still reads as moving forward
4. Save the 3 picks per monster and report which variant numbers were chosen so the user can make the final pick.

## Hard requirements
- 24x24 pixel art, transparent background
- Low top-down, isometric-friendly view, side-facing right, walk-ready pose
- No ground, shadow, scenery, text, glow, antialiasing, painting, or 3D
- Tiny gameplay scale, compact proportions, cute but hostile

## Prompt template
Fill `{NAME}`, `{MAP}`, `{BODY}`, `{PALETTE}`, `{MOOD}`, `{EXTRA}` from the tables.

```
ORIGINAL tiny {MAP} enemy named {NAME} for Bunny World. {BODY} {EXTRA} {PALETTE}. {MOOD}. Match established Bunny World monsters for tiny gameplay scale, compact proportions, sparse crisp pixel clusters and readable silhouette. 24x24 pixel art, low top-down isometric-friendly view, side-facing right, walk-ready pose. Transparent background. No ground, shadow, scenery, text, glow, antialiasing, painting or 3D.
```

Default `{EXTRA}` = `No human clothing or weapons.` unless the table gives something else.
Rank hints: **Elite** = slightly bulkier and more ornate than its normal cousin. **Boss** = the most imposing silhouette that still fits 24x24 with a strong signature feature.

---

## 🔥 Magma 1 (volcano)
| Name | Rank | BODY | PALETTE | MOOD |
|---|---|---|---|---|
| Magma Imp | Normal | A small imp creature with a round body, stubby horns, bat-like mini wings and a pointed tail | Ember red with dark charcoal and tiny orange highlights | Mischievous and hostile |
| Cinder Imp | Normal | A small ash-covered imp with round body, stubby horns and a smoldering tail tip | Ash grey and charcoal with small ember orange eyes | Sneaky and spiteful |
| Fire Drake | Normal | A baby dragon with a chunky body, short wings, small snout and curled tail | Warm red scales with tan belly and orange accents | Fierce but small |
| Imp Warlord | Elite | A bulky imp with big curved horns and rocky plates growing from its shoulders | Deep red with basalt grey rock and orange accents | Brutal and bossy |
| Boss Dragon | Boss | A compact adult red dragon with broad wings folded forward, horned head and heavy tail | Crimson scales, dark wing membranes, gold belly | Majestic and furious |

## 🔥 Magma 2 (lava depths)
| Name | Rank | BODY | PALETTE | MOOD |
|---|---|---|---|---|
| Fire Lizard | Normal | A low long lizard with a round head, four short legs and a flame-tipped tail | Lava orange scales with dark stripes | Quick and snappy |
| Lava Lizard | Normal | A chunkier lizard with a row of rocky spikes along its back | Dark basalt with glowing-orange cracks drawn as flat pixels | Tough and territorial |
| Fire Golem | Normal | A stubby rock golem with blocky arms and a short body with lava cracks | Dark brown stone with orange crack lines | Slow and heavy |
| Obsidian Golem | Elite | A bulkier golem made of glossy black shards with a sharp crystal crest | Black obsidian with purple sheen and small orange cracks | Menacing and unstoppable |
| Dark Dragon Knight | Boss | A small armored knight with a dragon-skull helm, dragon wings on the back and a lance | Black armor, dark red cape and dragon wings, gold trim | Dark and noble |

`{EXTRA}` for Dark Dragon Knight: `Armor and lance allowed as part of its design.`

## 🌊 Sea 1 (shallow reef)
| Name | Rank | BODY | PALETTE | MOOD |
|---|---|---|---|---|
| Bubble Crab | Normal | A round crab with big claws raised and small bubble-shaped eyes | Coral pink shell with cream belly | Grumpy and pinchy |
| Jelly Drifter 🌊 | Normal | A small jellyfish with a dome head and short wavy tentacles | Pale translucent-look blue drawn with flat pixels and pink spots | Dreamy but stinging |
| Pufferling 🌊 | Normal | A round pufferfish with short spikes and tiny fins | Sandy yellow with brown spots and white belly | Puffed up and angry |
| Coral Crab Knight | Elite | A bigger crab with coral growths on its shell like a crest and one oversized claw | Red coral with teal shell and cream | Proud and aggressive |
| Giant Clam King | Boss | A large clam with open shell, glaring pearl eye inside and small tentacle arms | Purple and teal shell with a glowing-white pearl drawn with flat pixels | Greedy and imposing |

## 🌊 Sea 2 (deep abyss)
| Name | Rank | BODY | PALETTE | MOOD |
|---|---|---|---|---|
| Angler Fish 🌊 | Normal | A round fish with a huge jaw, tiny fins and a lure on a stalk above its head | Dark navy with a yellow lure | Creepy and hungry |
| Abyss Eel 🌊 | Normal | A short curled eel with a wide mouth and fin ridge | Deep teal with pale belly stripes | Slippery and vicious |
| Squidling 🌊 | Normal | A small squid with a pointed head and curling tentacles | Violet with pink suckers | Twitchy and sneaky |
| Abyss Shark 🌊 | Elite | A compact shark with a scarred snout and oversized teeth | Slate grey with pale belly and scars | Relentless |
| Kraken | Boss | A compact giant octopus with a big head, glaring eyes and several thick tentacles raised | Deep crimson-purple with pale suckers | Ancient and terrifying |

## ❄️ Snow 1 (tundra)
| Name | Rank | BODY | PALETTE | MOOD |
|---|---|---|---|---|
| Ice Fox | Normal | A small fox with a fluffy tail whose tip is an ice crystal | White fur with icy blue accents | Swift and sly |
| Snow Fox | Normal | A small fox with three fluffy tails | Pale blue fur with white tips | Playful but hostile |
| Mammoth | Normal | A compact woolly mammoth with curved tusks and short legs | Brown shaggy fur with cream tusks | Stubborn and heavy |
| Elder Mammoth | Elite | A bigger mammoth with long tusks and ice chunks on its back | Grey-brown fur, pale blue ice, cream tusks | Ancient and angry |
| Yeti | Boss | A huge-shouldered yeti with long arms and big fists | White fur, blue-grey face and hands | Roaring and wild |

## ❄️ Snow 2 (glacier)
| Name | Rank | BODY | PALETTE | MOOD |
|---|---|---|---|---|
| Frost Wolf | Normal | A small wolf with icy spikes along its back | Pale grey-blue fur with white spikes | Hungry and fierce |
| Ice Wraith 👻 | Normal | A small floating wisp with a hooded shape and trailing icy tail | Pale cyan and white drawn with flat pixels | Eerie and cold |
| Snow Troll | Normal | A stocky troll with big feet, long nose and an ice club | Blue-grey skin with white fur patches | Dumb and brutal |
| Frost Wraith Queen 👻 | Elite | A floating hooded wraith with an ice crystal tiara | Deep blue and white with crystal accents | Regal and chilling |
| Frost Giant | Boss | A compact giant with braided beard, icy skin and a crystal axe | Pale blue skin, white beard, cyan crystal axe | Colossal and wrathful |

`{EXTRA}` for Snow Troll and Frost Giant: `Primitive ice weapon allowed, no human clothing.`

## ⚡ Asgard 1 (golden halls)
| Name | Rank | BODY | PALETTE | MOOD |
|---|---|---|---|---|
| Einherjar | Normal | A small spirit warrior with a winged helm, round shield and short sword | Pale ghostly blue body with gold armor | Stern and loyal |
| Storm Raven | Normal | A round raven with spread wings and small lightning sparks drawn as flat pixels | Black feathers with yellow sparks | Sharp and ominous |
| Rune Sentinel | Normal | A stubby stone guardian with carved rune lines on its chest | Grey stone with blue rune lines | Silent and watchful |
| Valkyrie | Elite | A small winged warrior maiden with a spear and white wings | Silver armor, white wings, gold hair | Brave and fierce |
| Thor | Boss | A chibi thunder god with a red beard, winged helm and a big hammer | Red hair and beard, silver armor, red cape, blue sparks drawn as flat pixels | Mighty and thunderous |

## ⚡ Asgard 2 (world tree)
| Name | Rank | BODY | PALETTE | MOOD |
|---|---|---|---|---|
| Golden Einherjar | Normal | A spirit warrior in full gold armor with a horned helm and axe | Gold armor with pale blue spirit glow drawn as flat pixels | Elite and proud |
| Sleipnir Spawn | Normal | A small spirit horse with eight short legs | Grey-white coat with blue mane | Wild and fast |
| Rune Colossus | Normal | A chunky stone giant covered in rune carvings | Dark stone with gold rune lines | Unstoppable |
| Fenrir Pup | Normal | A big-pawed wolf pup with a broken chain collar | Dark grey fur with yellow eyes | Savage and hungry |
| Valkyrie Captain | Elite | A winged warrior with silver-plated wings and a long spear | Silver and blue armor with white wings | Commanding |
| Odin | Boss | A chibi old god with one eye patch, long white beard, wide hat and spear, two ravens beside him | Dark blue cloak, grey beard, gold spear | Wise and overwhelming |

`{EXTRA}` for all Asgard monsters: `Armor and weapons allowed as part of its design. Humanoid Norse god or warrior style.`

---

## Deliverable checklist
- [ ] 42 monsters × 3 picked variants
- [ ] Each variant: walk (or swim/hover) loop + attack animation, facing right
- [ ] Report file names + chosen variant numbers per monster
