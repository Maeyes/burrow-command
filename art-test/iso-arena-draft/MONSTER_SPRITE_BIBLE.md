# Bunny World — Monster Sprite Bible v1

## Canonical visual references
These files define the target monster art language. Match their production feel; do not copy their character designs.
- `Sunnyside_World_Assets/Characters/Goblin/PNG/spr_walk_strip8.png`
- `Sunnyside_World_Assets/Characters/Skeleton/PNG/skeleton_walk_strip8.png`
- Supporting animation references: the sibling Goblin/Skeleton PNG strips for idle, attack, hurt, and death.

## Locked visual language
- Cute compact fantasy RPG pixel art; charming, readable, not childish.
- Slightly oversized head, short limbs, compact body mass.
- Strong silhouette readable at gameplay zoom.
- Low-to-moderate internal detail; avoid noisy micro-detail.
- Crisp intentional pixel clusters. No anti-aliasing, vector edges, smooth painting, or 3D-rendered look.
- Transparent RGBA background.
- No baked ground, ground shadow, labels, borders, UI, glow, bloom, or fog.
- New monsters must feel native beside the canonical Sunnyside Goblin/Skeleton.
- Designs must be original Bunny World creatures, not recolors or copies of the references.

## Gameplay presentation
- Bunny World uses a standard 2:1 isometric world projection, but monster sprites are character sprites placed at a feet/world anchor.
- Do not distort the sprite into an isometric diamond.
- Renderer handles world projection, depth sorting, shadows, targeting, HP bars, and runtime effects.
- Ground/feet anchor must remain stable across animation frames.
- Current approved on-screen scale is the live Goblin/Skeleton scale in `art-test/iso-arena-draft/poc.js`.

## Walk-cycle production contract
First-pass production animation for every normal monster:
- 8-frame seamless walk cycle.
- One horizontal strip, exactly 8 equal-width cells.
- Same character identity, anatomy, palette, equipment, proportions, and silhouette in every frame.
- Walking in place: translation through the world is handled by gameplay code.
- Feet contact should be coherent; avoid apparent hovering.
- Body may bob subtly, but the ground anchor must not drift.
- Motion should have the cute, slightly bouncy cadence of the canonical Goblin/Skeleton.
- Transparent background in every cell.
- No separators, labels, frame numbers, or padding changes between cells.
- Horizontal facing may be mirrored by the renderer for the prototype. Future production may add directional sets.

## Initial Greenfield roster
1. Mossblob — small round moss creature, tiny feet, bright eyes, a few leaves on head.
2. Sporekin — tiny mushroom creature, short legs, oversized mushroom cap.
3. Twig Imp — small woodland imp with twig/branch crown and glowing eyes.
4. Acorn Guard — stout acorn creature with tiny leaf shield / guardian silhouette.
5. Goblin — canonical Sunnyside generic fantasy enemy for prototype.
6. Skeleton — canonical Sunnyside generic undead enemy for prototype.
7. Mushroom Brute — larger elite mushroom creature; same pixel language but heavier silhouette.

## Generation rule
Use the canonical reference sprites as visual/style/scale/animation references whenever the generator supports image/reference input. Text prompting alone is secondary. Generate one monster at a time. Validate the walk strip before requesting attack/hurt/death animations.

## Master prompt template
Create a new ORIGINAL Bunny World fantasy RPG monster named **{MONSTER_NAME}**.

Use the supplied Bunny World canonical Goblin and Skeleton walk sprites strictly as VISUAL PRODUCTION REFERENCES. Match their pixel density, compact proportions, readable silhouette, restrained detail level, crisp pixel clustering, gameplay scale, and cute slightly bouncy walk cadence. Do NOT copy their character design.

MONSTER DESIGN:
{MONSTER_DESCRIPTION}

OUTPUT CONTRACT:
- production-ready pixel art
- one horizontal sprite strip
- exactly 8 equal-width animation cells
- seamless 8-frame walk cycle, walking in place
- stable feet/ground anchor across all frames
- same anatomy, palette, proportions, accessories, and identity in every frame
- transparent RGBA background
- no ground or baked shadow
- no text, labels, borders, dividers, UI, glow, bloom, fog, scenery, or background
- no anti-aliasing
- no vector-art look
- no smooth digital painting
- no 3D-rendered look
- do not change canvas/cell geometry between frames

The monster must look as though it belongs in the same game and same scene as the supplied Goblin and Skeleton while remaining an original Bunny World design.
