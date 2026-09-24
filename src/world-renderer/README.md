# Bunny World procedural isometric renderer

This module boundary extracts the reusable rules proven by art-test/dimraeth-slice without copying the demo wholesale into poc.js.

Principles:
- one 2:1 world projection for terrain, structures, entities and navigation;
- deterministic noise + locked palettes + Bayer dithering for code-generated pixel art;
- static terrain may be baked once; dynamic entities remain runtime layers;
- map geometry is authoritative for both rendering placement and collision/spawn validation;
- biome/map data stays separate from renderer algorithms.

Migration order:
1. projection/noise/geometry primitives (this directory);
2. extract palette/ground/cliff rasterizers from the slice;
3. extract vegetation/structure sprite factories;
4. define Forest 1 as data using shared geometry;
5. replace Forest 1 presentation incrementally while keeping current combat simulation authoritative;
6. only then retire old Forest 1 ground/prop drawing.

Do not duplicate combat, monster, mastery, loot, or progression state here.
