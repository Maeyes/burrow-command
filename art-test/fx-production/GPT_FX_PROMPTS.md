# GPT image prompts — remaining skill FX (2026-09-25)

Save each result as `art-test/fx-production/gpt-src/<id>.png` (key frame) or
`art-test/fx-production/gpt-src/<id>-sheet.png` (8-frame sheet). Claude cleans them up
(background removal, 96px nearest-neighbour, palette reduction, outline) and then either
animates the key frame with PixelLab (2 gens each) or slices the sheet directly.

## Paste this first (style block, once per chat)

> You are drawing VFX sprites for a cute isometric pixel-art RPG (white bunny hero, 64px characters).
> Rules for every image:
> - Pixel art look: chunky hard-edged pixel clusters, 1px dark outline, limited palette (max ~16 colours), NO soft gradients, NO blur, NO glow haze, NO anti-aliasing.
> - VFX only: no character, no weapon, no text, no UI, no ground tiles.
> - Background: solid flat pure green #00FF00 (so it can be keyed out). Nothing else green-screen coloured in the effect.
> - Square canvas, effect centred, filling about 80% of the canvas.
> - Projectiles and slashes point/travel to the RIGHT. Ground effects are a flat ellipse seen from a 45° isometric camera.

## Option A — key frame (one image per effect, 1024×1024)
Prompt: **"`<description>` — single frame, square, follow the style rules."**

## Option B — 8-frame sheet (one image per effect, 2048×256 or 8 equal squares in a row)
Prompt: **"`<description>` — animation sheet: 8 equal square frames in ONE horizontal row, left to right, same size and same centre point in every frame, clear green gap between frames. Motion: `<motion>`."**

## Effects

| id | description | motion (Option B) |
|---|---|---|
| bowlingBash | heavy spinning greatsword slash impact, thick cream-white circular arc with a dust ring on the ground | arc spins once around, dust ring expands, fades |
| crescentBreak | one huge crescent-moon sword slash of white-gold light with star sparkles along the edge | crescent sweeps in, flashes, thins out, fades |
| vanguardTempest | storm of mint-white wind blades swirling around a centre like a small hurricane | blades orbit faster, expand, dissipate |
| crossSlash | sharp X-shaped double slash, white with hot-pink edges, tiny sparks at the cross | first stroke, second stroke, flash, fade |
| shadowFlurry | cluster of many small dark-violet and black slash marks with magenta glints and shadow wisps | slashes pop in one by one, then scatter and fade |
| phantomBlades | ring of 6 ghostly translucent lilac blades spinning around a centre | blades spin around the ring, then fly outward and fade |
| cleavingStrike | heavy downward axe cleave, orange-white arc ending in a ground crack | arc comes down, crack splits the ground, dust, fade |
| executionersSweep | wide horizontal blood-red sweep slash with dark red trail | sweep across left to right, trail lingers, fade |
| ravagerArc | 360° crimson spin slash ring on the ground | ring draws around, flashes, expands, fades |
| crushingImpact | hammer impact crater: white-yellow flash, cracked ground ellipse, rock chips | flash, crater cracks, rocks fly and fall, dust fades |
| earthbreaker | ground fissure ripping open in a line with rocks bursting upward, brown and orange | fissure opens, rocks burst up, fall back, dust |
| cataclysm | massive earthquake blast: large cracked ground ellipse, rocks, orange magma glow in the cracks | shock ring, rocks explode up, glow pulses, settles |
| powerShot | charged arrow of golden light with a ring shockwave at the tip, flying right | tip ring pulses, streak flickers (looping) |
| piercingVolley | three glowing white-gold arrow streaks flying right, slightly staggered | streaks shimmer (looping) |
| skyfallBarrage | rain of glowing arrows falling diagonally from the sky onto a ground ellipse, small impact flashes | arrows fall in waves, impacts pop, fade |
| arcBolt | small violet-blue arcane magic bolt with a crackling spark trail, flying right | bolt pulses, sparks crackle (looping) |
| arcCascade | branching violet-blue arcane lightning bursting outward from a centre point | branches crackle out, flash, fade |
| astralVolley | gold and violet star shards raining down onto a ground ellipse with twinkles | shards fall in waves, twinkle on impact, fade |
| radiantBurst | golden holy light burst with sharp rays and a bright white core | core flashes, rays extend, fade |
| gravityPulse | violet gravity wave ring on the ground pulling inward, dark centre, small debris | rings contract toward the centre, debris sucked in |
| astralDominion | large golden-violet astral sigil circle on the ground with runes, exploding with light | sigil draws, runes glow, pillar of light bursts, fade |
| slashSwordShield | clean medium sword arc swinging right, white blade trail with pale blue edge, small sparkles | arc sweeps, flashes at the edge, fades |
| shotArrow | small wooden arrow with white feather fletching and a thin white speed streak, flying right | streak flickers (looping) |
| boltStaff | small glowing violet-blue magic orb with a sparkling star trail, flying right | orb pulses, sparkles stream (looping) |
