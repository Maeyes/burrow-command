// Mutable world state shared by the engine modules. One scene is loaded per page.
export const WS = {
  scene: null,        // scene config (see scenes/*.js and ENGINE.md)
  terrain: null,      // height grid + queries (engine/terrain.js)
  ground: null,       // { canvas, zbuf, waterPix, fallPix } baked by bakeGround()
  objects: [],        // depth-sorted runtime objects { kind, x, y, z, box, ... }
  colliders: [],      // { type:'c', x, y, r } | { type:'b', x0, x1, y0, y1 }
  lights: [],         // { x, y, z, r, col:[r,g,b], a, flick?, fire?, dusk? }
  baked: [],          // small sprites painted into the ground canvas { img, x, y, z, ox, oy, scale? }
  shadows: [],        // soft ellipse shadows painted into the ground { x, y, z, dx, dy, rx, ry }
  rectShadows: [],    // world-rect shadows (buildings, walls) { x0, x1, y0, y1, k }
  chimneys: [],       // smoke emitters { x, y, z }
  flags: [],          // waving flags { x, y, z }
  bridges: [],        // walkable decks { x0, x1, y0, y1, z }
};
