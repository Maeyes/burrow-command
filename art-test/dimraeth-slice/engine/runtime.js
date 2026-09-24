// Game loop: movement over the height grid, depth sorting, terrain occlusion, lighting, particles.
import { W, H, T, S, K, setRenderScale, hash2, clamp, isoX, isoY, makeCanvas, yieldFrame } from './util.js';
import { WS } from './state.js';
import { buildLibraries } from './sprites.js';
import { buildTerrain, bakeGround, GROUND, MAT } from './terrain.js';
import { placeStructures, placeScatter } from './world.js';
import { biomeOf } from './biomes.js';
let KIT = biomeOf(null);

const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const STEP_UP = 12; // max height change the player can walk over (stairs are ~7-9 px per step)

// Runtime actors are supplied by the game layer. The map engine owns terrain/depth/occlusion;
// combat/AI/HP remain outside this module.
const actors=[];
let actorUpdater=null;
export function setRuntimeActors(next=[]){actors.length=0;actors.push(...next);}
export function setRuntimeActorUpdater(fn=null){actorUpdater=typeof fn==='function'?fn:null;}
export function getTerrainRuntime(){return WS.terrain;}
export function projectRuntimePoint(x,y,z=0){const p=toScreen(x,y,z);return viewZoom===1?{x:p[0],y:p[1]}:{x:W/2+(p[0]-W/2)*viewZoom,y:H/2+(p[1]-H/2)*viewZoom};}
export function unprojectRuntimePoint(sx,sy,z=0){
  const ix=(sx-W/2+cam.x)/K,iy=(sy-H/2+cam.y)/K+z;
  return{x:ix+2*iy,y:2*iy-ix};
}
export function setRuntimeCameraWorld(x,y,z=0){cam={x:isoX(x,y),y:isoY(x,y,z)};return{x:cam.x,y:cam.y};}
export function canRuntimeActorStand(x,y,zNow=0){return canStand(x,y,zNow);}
export function resolveRuntimeActor(ent){
  const before={x:ent.x,y:ent.y};
  const zNow=WS.terrain?.walkHeight(ent.x,ent.y)??ent.z??0;
  if(!canStand(ent.x,ent.y,zNow)){ent.x=before.x;ent.y=before.y;return false;}
  resolveColliders(ent);
  return true;
}
export function runtimeWalkHeight(x,y){return WS.terrain?.walkHeight(x,y)??null;}
export function moveRuntimePlayerToward(x,y,maxStep){
  if(!player)return false;
  const dx=x-player.x,dy=y-player.y,d=Math.hypot(dx,dy);if(d<.001)return false;
  const step=Math.min(d,Math.max(0,maxStep)),mx=dx/d*step,my=dy/d*step,zNow=WS.terrain.walkHeight(player.x,player.y)??player.zGround;
  player.moving=false;
  for(const [ax,ay] of [[mx,my],[mx,0],[0,my]]){
    if(!canStand(player.x+ax,player.y+ay,zNow))continue;
    const ox=player.x,oy=player.y;player.x+=ax;player.y+=ay;resolveColliders(player);
    if(Math.hypot(player.x-ox,player.y-oy)>.01){player.moving=true;break;}
  }
  const vx=(dx-dy)/2,vy=(dx+dy)/4,heading=(Math.atan2(vx,-vy)*180/Math.PI+360)%360;player.dir=Math.round(heading/45)%8;
  const g=WS.terrain.walkHeight(player.x,player.y);if(g!==null)player.zGround=g;return player.moving;
}
export function setRuntimePlayerVisual(getter=null){playerVisualGetter=typeof getter==='function'?getter:null;}
export function setRuntimePlayerControl(active=false){externalPlayerControl=Boolean(active);if(externalPlayerControl&&player)player.target=null;}

let canvas, ctx, player, cam, dusk = false, time = 0, t0 = 0, rafId = 0;
let bootListeners=[];
let viewZoom=1,worldVisualScale=1,playerVisualScale=1,playerVisualGetter=null,externalPlayerControl=false,minimapZoom=1,debugTraversal=false;
const keys = new Set(), sprites = {}, particles = [];

const toScreen = (x, y, z = 0) => [Math.round((isoX(x, y) - cam.x)*worldVisualScale + W / 2), Math.round((isoY(x, y, z) - cam.y)*worldVisualScale + H / 2)];

// ---------- terrain occlusion ----------
// A sprite pixel at height hp above the object's feet is a point (x, y, z + hp) on the pixel's ray;
// terrain hit at the same pixel with a higher z is nearer the viewer and hides it.
const imgDataCache = new Map();
const runtimeScaledSpriteCache = new WeakMap();
const playerOrientedSpriteCache = new WeakMap();
function scaledRuntimeSprite(img, scale = 1) {
  if (scale === 1) return img;
  let byScale = runtimeScaledSpriteCache.get(img);
  if (!byScale) { byScale = new Map(); runtimeScaledSpriteCache.set(img, byScale); }
  const key = Number(scale.toFixed(3));
  let out = byScale.get(key);
  if (out) return out;
  out = makeCanvas(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
  const g = out.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, out.width, out.height);
  byScale.set(key, out); return out;
}
function spriteData(img) {
  let d = imgDataCache.get(img);
  if (!d) { d = img.getContext ? img.getContext('2d').getImageData(0, 0, img.width, img.height) : (() => { const c = makeCanvas(img.width, img.height), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height); })(); imgDataCache.set(img, d); }
  return d;
}
function occluded(img, ox, oy, x, y, z, target) {
  const { zbuf, gw, gh } = WS.ground;
  const gx = Math.round(isoX(x, y) - GROUND.x0) - ox, footY = Math.round(isoY(x, y, z) - GROUND.y0), gy = footY - oy;
  const w = img.width, h = img.height;
  let any = false;
  for (let j = 0; j < h && !any; j++) {
    const py = gy + j; if (py < 0 || py >= gh) continue;
    const lim = z + Math.max(0, footY - py) / K + 3;
    for (let i = 0; i < w; i++) { const px = gx + i; if (px >= 0 && px < gw && zbuf[py * gw + px] > lim) { any = true; break; } }
  }
  if (!any) return null;
  const src = spriteData(img), out = target || makeCanvas(w, h);
  if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
  const g = out.getContext('2d'), dst = g.createImageData(w, h);
  dst.data.set(src.data);
  for (let j = 0; j < h; j++) {
    const py = gy + j; if (py < 0 || py >= gh) continue;
    const lim = z + Math.max(0, footY - py) / K + 3;
    for (let i = 0; i < w; i++) { const px = gx + i; if (px >= 0 && px < gw && zbuf[py * gw + px] > lim) dst.data[(j * w + i) * 4 + 3] = 0; }
  }
  g.putImageData(dst, 0, 0);
  return out;
}
function maskStaticObjects() {
  for (const o of WS.objects) {
    if (o.kind !== 'sprite' || o.flat) continue;
    const m = occluded(o.img, o.ox, o.oy, o.x, o.y, o.z);
    if (m) o.img = m;
  }
}

// ---------- movement ----------
function canStand(x, y, zNow) {
  const T0 = WS.terrain;
  for (const [dx, dy] of [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]]) {
    const h = T0.walkHeight(x + dx, y + dy);
    if (h === null || Math.abs(h - zNow) > STEP_UP * (dx || dy ? 1.6 : 1)) return false;
  }
  return true;
}
function resolveColliders(ent) {
  // The old 0..S clamp belonged to the original authored slice. The terrain grid itself
  // extends well beyond it, so the clamp created an invisible wall across otherwise visible,
  // valid Forest terrain. Let walkHeight/canStand define the traversable world instead.
  const edgePad=16;
  ent.x=clamp(ent.x,-2560+edgePad,-2560+512*16-edgePad);
  ent.y=clamp(ent.y,-2560+edgePad,-2560+512*16-edgePad);
  for (let pass = 0; pass < 2; pass++) for (const c of WS.colliders) {
    if (c.type === 'c') {
      const dx = ent.x - c.x, dy = ent.y - c.y, dist = Math.hypot(dx, dy), m = c.r + ent.r;
      if (dist < m && dist > .001) { ent.x = c.x + dx / dist * m; ent.y = c.y + dy / dist * m; }
    } else {
      const qx = clamp(ent.x, c.x0, c.x1), qy = clamp(ent.y, c.y0, c.y1);
      const dx = ent.x - qx, dy = ent.y - qy, dist = Math.hypot(dx, dy);
      if (dist < ent.r) {
        if (dist > .001) { ent.x = qx + dx / dist * ent.r; ent.y = qy + dy / dist * ent.r; }
        else {
          const opts = [[c.x0 - ent.r - ent.x, 0], [c.x1 + ent.r - ent.x, 0], [0, c.y0 - ent.r - ent.y], [0, c.y1 + ent.r - ent.y]];
          opts.sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]));
          ent.x += opts[0][0]; ent.y += opts[0][1];
        }
      }
    }
  }
}

function update(dt) {
  const SC = WS.scene;
  let sx = 0, sy = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) sy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) sy += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) sx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) sx += 1;
  if (sx || sy) player.target = null;
  else if (player.target) {
    const dx = isoX(player.target.x, player.target.y) - isoX(player.x, player.y);
    const dy = isoY(player.target.x, player.target.y) - isoY(player.x, player.y);
    if (Math.hypot(dx, dy) < 4) player.target = null; else { sx = dx; sy = dy; }
  }
  if(externalPlayerControl){sx=0;sy=0;player.target=null;}
  const len = Math.hypot(sx, sy), speed = 125;
  player.moving = false;
  if (len > 0) {
    const vx = sx / len * speed, vy = sy / len * speed;
    const mx = (vx + 2 * vy) * dt, my = (2 * vy - vx) * dt;
    const zNow = WS.terrain.walkHeight(player.x, player.y) ?? player.zGround;
    // try full move, then slide along each axis
    for (const [ax, ay] of [[mx, my], [mx, 0], [0, my]]) {
      if (canStand(player.x + ax, player.y + ay, zNow)) { player.x += ax; player.y += ay; player.moving = true; break; }
    }
    if (!player.moving) player.target = null;
    const heading = (Math.atan2(vx, -vy) * 180 / Math.PI + 360) % 360;
    player.dir = Math.round(heading / 45) % 8;
  }
  resolveColliders(player);
  const g = WS.terrain.walkHeight(player.x, player.y);
  if (g !== null) player.zGround = g;
  player.z += (player.zGround - player.z) * Math.min(1, dt * 18);
  const tx = clamp(isoX(player.x, player.y), GROUND.x0 + W / 2, GROUND.x1 - W / 2);
  const ty = clamp(isoY(player.x, player.y, player.z) - 20, GROUND.y0 + H / 2, GROUND.y1 - H / 2);
  cam.x += (tx - cam.x) * Math.min(1, dt * 6); cam.y += (ty - cam.y) * Math.min(1, dt * 6);
  // particles
  for (const c of SC.camps || []) if (Math.random() < dt * 14) particles.push({ type: 'spark', x: c.x + (Math.random() - .5) * 14, y: c.y + (Math.random() - .5) * 14, z: WS.terrain.heightAt(c.x, c.y) + 12, vz: 30 + Math.random() * 30, life: 1 + Math.random() });
  for (const c of WS.chimneys) if (Math.random() < dt * 2.2) particles.push({ type: 'smoke', x: c.x, y: c.y, z: c.z, vz: 14, life: 3.5, drift: Math.random() * 6 });
  if (SC.fountain && Math.random() < dt * 40) {
    const a = Math.random() * Math.PI * 2, sp = 18 + Math.random() * 10, fz = WS.terrain.heightAt(SC.fountain.x, SC.fountain.y);
    particles.push({ type: 'drop', x: SC.fountain.x, y: SC.fountain.y, z: fz + 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 30 + Math.random() * 20, life: 2, floor: fz + 47, base: fz });
  }
  for (const f of WS.terrain.falls) if (Math.random() < dt * 5) {
    if (f.lava) { particles.push({ type: 'spark', x: f.x + (Math.random() - .5) * 16, y: f.y + (Math.random() - .5) * 16, z: f.zBot + 2, vz: 30 + Math.random() * 30, life: 1.2 }); continue; }
    particles.push({ type: 'mist', x: f.x + (Math.random() - .5) * 16, y: f.y + (Math.random() - .5) * 16, z: f.zBot + 2, vz: 8 + Math.random() * 10, life: 1.4 + Math.random(), s: 2 + Math.random() * 3 });
  }
  for (const p of SC.portals || []) if (Math.random() < dt * 10) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * 36;
    particles.push({ type: 'mote', x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr, z: WS.terrain.heightAt(p.x, p.y), vz: 22 + Math.random() * 20, life: 1.6, col: p.col });
  }
  spawnAtmosphere(dt);
  if (false) particles.push({ type: 'leaf', sx: cam.x + (Math.random() - .5) * W, sy: cam.y - H / 2 - 10, vx: 18 + Math.random() * 16, vy: 26 + Math.random() * 14, life: 14, ph: Math.random() * 6 });
  if (dusk && Math.random() < dt * 3) particles.push({ type: 'fly', sx: cam.x + (Math.random() - .5) * W, sy: cam.y + (Math.random() - .5) * H, life: 4 + Math.random() * 3, ph: Math.random() * 6 });
  for (const p of particles) {
    p.life -= dt;
    if (p.type === 'spark' || p.type === 'mote' || p.type === 'mist') { p.z += p.vz * dt; p.x += (Math.random() - .5) * 20 * dt; }
    else if (p.type === 'smoke') { p.z += p.vz * dt; p.x += p.drift * dt; p.y -= p.drift * dt; }
    else if (p.type === 'drop') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vz -= 120 * dt; p.z += p.vz * dt;
      if (Math.hypot(p.x - SC.fountain.x, p.y - SC.fountain.y) > 26) p.floor = p.base + 11;
      if (p.z < p.floor) p.life = 0;
    }
    else if (p.sx !== undefined && p.type !== 'fly') { p.sx += (p.vx + Math.sin(time * 2 + p.ph) * (p.sway ?? 20)) * dt; p.sy += p.vy * dt; }
    else if (p.type === 'fly') { p.sx += Math.sin(time * 1.3 + p.ph) * 12 * dt; p.sy += Math.cos(time * 1.7 + p.ph) * 8 * dt; }
  }
  for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
}

// ---------- draw ----------
const boxOf = o => o.box || { x0: o.x - o.r, x1: o.x + o.r, y0: o.y - o.r, y1: o.y + o.r };
function compare(a, b) {
  if (!!a.flat !== !!b.flat) return a.flat ? -1 : 1; // ground decals & bridge decks first
  const A = boxOf(a), B = boxOf(b);
  const oy = A.y0 < B.y1 && B.y0 < A.y1, ox = A.x0 < B.x1 && B.x0 < A.x1;
  if (oy) { if (A.x1 <= B.x0) return -1; if (B.x1 <= A.x0) return 1; }
  if (ox) { if (A.y1 <= B.y0) return -1; if (B.y1 <= A.y0) return 1; }
  return ((A.x0 + A.x1) + (A.y0 + A.y1)) - ((B.x0 + B.x1) + (B.y0 + B.y1)) + (a.z - b.z) * 4;
}
function drawIsoLine(x0, y0, x1, y1, z, col) {
  const [ax, ay] = toScreen(x0, y0, z), [bx, by] = toScreen(x1, y1, z);
  const steps = Math.max(1, Math.abs(by - ay)), sxs = (bx - ax) / steps, sys = Math.sign(by - ay);
  ctx.fillStyle = col;
  const th = Math.max(2, Math.round(2 * K));
  for (let k = 0; k < steps; k++) ctx.fillRect(Math.round(ax + sxs * k), ay + sys * k, Math.ceil(Math.abs(sxs)) || 1, th);
}
const playerMask = makeCanvas(64, 64);
function drawObject(o, psx, psy, afterPlayer) {
  if (o.kind === 'sprite') {
    const [sx, sy] = toScreen(o.x, o.y, o.z), vs=o.visualScale??1, dw=Math.round(o.img.width*vs), dh=Math.round(o.img.height*vs), ox=Math.round(o.ox*vs), oy=Math.round(o.oy*vs), x=sx-ox, y=sy-oy;
    if (x > W || y > H || x + dw < 0 || y + dh < 0) return;
    // Fade only the foreground object itself when it overlaps the hero.
    // Never erase the main canvas: destination-out created the old white/transparent halo.
    const overlapsHero=o.fade&&afterPlayer&&psx>x+6&&psx<x+dw-6&&psy-30>y&&psy-30<y+dh-10;
    if(overlapsHero){
      ctx.save();
      ctx.globalAlpha=.38;
      ctx.drawImage(o.img,x,y,dw,dh);
      ctx.restore();
    }else ctx.drawImage(o.img,x,y,dw,dh);
  } else if (o.kind === 'player') {
    const [sx, sy] = toScreen(o.x, o.y, o.z);
    const custom=playerVisualGetter?.(o)??null;
    const img=custom?.image??sprites[DIRS[o.dir]]; if (!img) return;
    const bob = custom ? 0 : (o.moving ? Math.round(Math.abs(Math.sin(time * 11)) * 2) : 0);
    const dw=Math.round(img.width*playerVisualScale),dh=Math.round(img.height*playerVisualScale),ox=Math.round(dw/2),oy=Math.round((custom?.footY??60)*playerVisualScale)+bob;
    if(custom){
      let variants=playerOrientedSpriteCache.get(img);
      if(!variants){variants=new Map();playerOrientedSpriteCache.set(img,variants);}
      const key=`${playerVisualScale}:${custom.flipX?'flip':'plain'}`;
      let renderImg=variants.get(key);
      if(!renderImg){
        renderImg=makeCanvas(dw,dh);const rg=renderImg.getContext('2d');rg.imageSmoothingEnabled=false;
        if(custom.flipX){rg.translate(dw,0);rg.scale(-1,1);}
        rg.drawImage(img,0,0,dw,dh);variants.set(key,renderImg);
      }
      const masked=occluded(renderImg,ox,oy,o.x,o.y,o.z,playerMask);
      ctx.drawImage(masked??renderImg,Math.round(sx-ox),Math.round(sy-oy));
    }else{
      ctx.save();
      ctx.drawImage(img,Math.round(sx-ox),Math.round(sy-oy),dw,dh);
      ctx.restore();
    }
    if(custom?.slashArc){
      const dirs=['north','north-east','east','south-east','south','south-west','west','north-west'];
      const di=Math.max(0,dirs.indexOf(custom.slashDirection));
      const progress=Math.max(0,Math.min(1,custom.slashProgress??0));
      const base=-Math.PI/2+di*Math.PI/4;
      const sweep=1.2,offset=(progress-.5)*.55;
      ctx.save();
      ctx.translate(Math.round(sx),Math.round(sy-30));
      ctx.rotate(base);
      ctx.scale(1,.58);
      ctx.globalAlpha=Math.max(.15,1-progress*.72);
      ctx.lineCap='round';
      ctx.strokeStyle='rgba(255,245,206,.96)';
      ctx.lineWidth=4;
      ctx.beginPath();
      ctx.arc(0,0,46,-sweep/2+offset,sweep/2+offset);
      ctx.stroke();
      ctx.strokeStyle='rgba(255,198,92,.58)';
      ctx.lineWidth=8;
      ctx.globalAlpha*=.48;
      ctx.beginPath();
      ctx.arc(0,0,46,-sweep/2+offset-.08,sweep/2+offset-.08);
      ctx.stroke();
      ctx.restore();
    }
  } else if(o.kind==='actor'){
    const img=typeof o.getImage==='function'?o.getImage():o.img;if(!img)return;
    const groundZ=WS.terrain.walkHeight(o.x,o.y)??o.z??0,z=groundZ+(o.zOffset??0);o.z=z;
    const [sx,sy]=toScreen(o.x,o.y,z);
    if(o.shadow!==false){ctx.fillStyle='rgba(16,20,28,.34)';for(let r=-3;r<=3;r++){const hw=Math.round(12*Math.sqrt(1-(r/4)**2));ctx.fillRect(sx-hw,sy+r-1,hw*2,1);}}
    const actorScale=o.visualScale??1;
    if(o.terrainOcclusion){
      const renderImg=scaledRuntimeSprite(img,actorScale),ox=o.ox??Math.round(img.width/2),oy=o.oy??img.height,dox=Math.round(ox*actorScale),doy=Math.round(oy*actorScale);
      const masked=occluded(renderImg,dox,doy,o.x,o.y,z,o._occlusionCanvas);if(masked)o._occlusionCanvas=masked;
      ctx.imageSmoothingEnabled=false;ctx.drawImage(masked??renderImg,Math.round(sx-dox),Math.round(sy-doy));
    }else{
      const ox=o.ox??Math.round(img.width/2),oy=o.oy??img.height,dw=Math.round(img.width*actorScale),dh=Math.round(img.height*actorScale),dox=Math.round(ox*actorScale),doy=Math.round(oy*actorScale);
      ctx.imageSmoothingEnabled=false;ctx.drawImage(img,sx-dox,sy-doy,dw,dh);
    }
    if(typeof o.drawOverlay==='function')o.drawOverlay(ctx,{x:sx,y:sy,z,time});
  } else if (o.kind === 'fence') {
    const [ax, ay] = toScreen(o.x, o.y, o.z);
    if (ax < -40 || ax > W + 40 || ay < -40 || ay > H + 40) return;
    if (o.x1 !== o.x || o.y1 !== o.y) {
      drawIsoLine(o.x, o.y, o.x1, o.y1, o.z + 17, '#9a6a3c'); drawIsoLine(o.x, o.y, o.x1, o.y1, o.z + 16, '#5a3a22');
      drawIsoLine(o.x, o.y, o.x1, o.y1, o.z + 9, '#8c5c34'); drawIsoLine(o.x, o.y, o.x1, o.y1, o.z + 8, '#4a2e1a');
    }
    const R = n => Math.round(n * K);
    ctx.fillStyle = '#4a2e1a'; ctx.fillRect(ax - R(2), ay - R(22), R(4), R(23));
    ctx.fillStyle = '#8c5c34'; ctx.fillRect(ax - R(2), ay - R(22), R(2), R(22));
    ctx.fillStyle = '#b07e4a'; ctx.fillRect(ax - R(2), ay - R(23), R(3), Math.max(1, R(1)));
  } else if (o.kind === 'lantern') {
    const [ax, ay] = toScreen(o.x, o.y, o.z), sx = 0, sy = 0;
    ctx.save(); ctx.translate(ax, ay); ctx.scale(K, K);
    ctx.fillStyle = '#2e1c10'; ctx.fillRect(sx - 1, sy - 34, 3, 35);
    ctx.fillStyle = '#6b4427'; ctx.fillRect(sx - 1, sy - 34, 1, 34);
    ctx.fillStyle = '#2e1c10'; ctx.fillRect(sx - 1, sy - 34, 8, 2); ctx.fillRect(sx + 3, sy - 34, 1, 5);
    const f = .75 + Math.sin(time * 9 + o.x) * .1 + Math.sin(time * 23 + o.y) * .06;
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(sx + 1, sy - 30, 6, 8);
    ctx.fillStyle = `rgba(255,${190 + f * 40 | 0},110,1)`; ctx.fillRect(sx + 2, sy - 29, 4, 6);
    ctx.fillStyle = '#fff4c0'; ctx.fillRect(sx + 3, sy - 27, 2, 2);
    ctx.restore();
  } else if (o.kind === 'fire') {
    const [ax, ay] = toScreen(o.x, o.y, o.z), sx = 0, sy = 0;
    ctx.save(); ctx.translate(ax, ay); ctx.scale(K, K);
    ctx.fillStyle = '#3a2414'; ctx.fillRect(sx - 12, sy - 3, 24, 4); ctx.fillRect(sx - 8, sy - 5, 16, 3);
    ctx.fillStyle = '#6b4427'; ctx.fillRect(sx - 12, sy - 3, 24, 1);
    const cols = ['#b8321c', '#e8641e', '#ffa22e', '#ffd65a', '#fff3b8'];
    for (let i = 0; i < 11; i++) {
      const cx = sx - 10 + i * 2, center = 1 - Math.abs(i - 5) / 6;
      const hgt = Math.round((6 + 18 * center) * (.72 + .28 * Math.sin(time * 11 + i * 1.9) + .12 * Math.sin(time * 27 + i)));
      for (let k = 0; k < hgt; k++) {
        const t = k / hgt, ci = clamp(Math.floor((1 - t) * 3.2 * center + (t < .15 ? 0 : 1)), 0, 4);
        ctx.fillStyle = cols[clamp(t > .8 ? 0 : ci + (center > .6 && t < .5 ? 1 : 0), 0, 4)];
        ctx.fillRect(cx, sy - 4 - k, 2, 1);
      }
    }
    ctx.restore();
  } else if (o.kind === 'portal') {
    const [cx, cy] = toScreen(o.x, o.y, o.z);
    if (cx < -80 || cx > W + 80 || cy < -80 || cy > H + 80) return;
    const [r, g, b] = o.col;
    const ring = (rad, n, speed, size, alpha) => {
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + time * speed, wx = Math.cos(a) * rad, wy = Math.sin(a) * rad;
        const k = .55 + .45 * Math.sin(i * 1.7 + time * 4);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha * k})`; ctx.fillRect(Math.round(cx + (wx - wy) / 2 * K), Math.round(cy + (wx + wy) / 4 * K), size, size);
      }
    };
    ring(40, 64, .4, 2, .95); ring(30, 40, -.7, 1, .8); ring(18, 20, 1.2, 1, .7);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 - time * .4, wx = Math.cos(a) * 34, wy = Math.sin(a) * 34;
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(Math.round(cx + (wx - wy) / 2 * K), Math.round(cy + (wx + wy) / 4 * K) - 1, 2, 3);
    }
  }
  if (o.flagAt) drawFlag(o.flagAt);
}
function drawFlag(f) {
  const [ax, ay] = toScreen(f.x, f.y, f.z), sx = 0, sy = 0;
  ctx.save(); ctx.translate(ax, ay); ctx.scale(K, K);
  ctx.fillStyle = '#2a1c14'; ctx.fillRect(sx, sy - 22, 1, 23);
  for (let xx = 0; xx < 14; xx++) {
    const wave = Math.round(Math.sin(time * 5 - xx * .6) * 1.5);
    for (let yy = 0; yy < 8; yy++) {
      ctx.fillStyle = yy < 1 ? '#e05a4a' : yy > 6 ? '#7a1c1c' : xx > 3 && xx < 7 && yy > 2 && yy < 5 ? '#e8c25a' : '#b8322a';
      ctx.fillRect(sx + 1 + xx, sy - 22 + yy + wave, 1, 1);
    }
  }
  ctx.restore();
}
// animated water on top of the baked ground: glints on rivers, streaks running down waterfalls
function drawWater(ox, oy) {
  const wp = WS.ground.waterPix;
  for (let i = 0; i < wp.length; i += 3) {
    const x = wp[i] + ox, y = wp[i + 1] + oy, lava = wp[i + 2];
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const ph = Math.sin(time * 2.2 + wp[i] * .31 + wp[i + 1] * .77);
    if (ph < .55) continue;
    ctx.fillStyle = lava ? (ph > .9 ? 'rgba(255,240,150,.95)' : 'rgba(255,150,50,.75)') : ph > .9 ? 'rgba(235,255,250,.95)' : 'rgba(170,225,220,.7)'; ctx.fillRect(x, y, 2, 1);
  }
  const fp = WS.ground.fallPix;
  ctx.fillStyle = 'rgba(240,255,252,.85)';
  for (let i = 0; i < fp.length; i += 6) {
    const x = fp[i] + ox, y = fp[i + 1] + oy;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const hgt = fp[i + 2], col = Math.floor(fp[i + 4] * .559 / 2), ph = (hgt + time * 60 + hash2(col, 3) * 40) % (14 + (col % 3) * 4);
    if (ph < 3) { ctx.fillStyle = fp[i + 5] ? 'rgba(255,230,140,.9)' : 'rgba(240,255,252,.85)'; ctx.fillRect(x, y, 1, 1); }
  }
}

let vignette, lightCanvas, lctx;
function buildOverlays() {
  vignette = makeCanvas(W, H);
  const g = vignette.getContext('2d'), grad = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .72);
  grad.addColorStop(0, 'rgba(12,8,20,0)'); grad.addColorStop(1, `rgba(12,8,20,${KIT.light.vignette})`);
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  lightCanvas = makeCanvas(W, H); lctx = lightCanvas.getContext('2d');
}
function drawLighting() {
  lctx.globalCompositeOperation = 'source-over'; lctx.fillStyle = dusk ? KIT.light.dusk : KIT.light.day; lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'lighter';
  const strong = dusk || KIT.light.alwaysLights;
  for (const l of WS.lights) {
    if (l.dusk && !strong) continue;
    const [sx, sy] = toScreen(l.x, l.y, l.z);
    const fl = l.flick ? .9 + Math.sin(time * 8 + l.x) * .05 + Math.sin(time * 19 + l.y) * .05 : 1;
    const rad = l.r * K * fl * (strong ? 1.15 : .8);
    if (sx < -rad || sx > W + rad || sy < -rad || sy > H + rad) continue;
    const gr = lctx.createRadialGradient(sx, sy, 0, sx, sy, rad), a = l.a * (strong ? 1 : .45);
    gr.addColorStop(0, `rgba(${l.col[0]},${l.col[1]},${l.col[2]},${a})`);
    gr.addColorStop(.45, `rgba(${l.col[0]},${l.col[1] * .8 | 0},${l.col[2] * .6 | 0},${a * .45})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = gr; lctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
  }
  ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(lightCanvas, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const l of WS.lights) {
    if ((!l.fire && !l.glow && !strong) || (l.dusk && !strong)) continue;
    const [sx, sy] = toScreen(l.x, l.y, l.z), rad = (l.fire ? 70 : 26) * (.92 + Math.sin(time * 10 + l.x) * .08);
    if (sx < -rad || sx > W + rad || sy < -rad || sy > H + rad) continue;
    const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    gr.addColorStop(0, `rgba(255,170,80,${dusk ? .35 : .18})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = gr; ctx.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  if (!dusk) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = KIT.light.grade; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  if (KIT.light.caustics) drawCaustics();
  ctx.drawImage(vignette, 0, 0);
}
// Underwater: a seamless web of light (ridged noise) drifting over everything.
let causticTile = null;
function drawCaustics() {
  if (!causticTile) {
    const n = 192; causticTile = makeCanvas(n, n);
    const g = causticTile.getContext('2d'), img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const a = x / n * Math.PI * 2, b = y / n * Math.PI * 2; // periodic sampling -> seamless tile
      const v = Math.abs(Math.sin(a * 2 + Math.sin(b * 3 + Math.sin(a * 5) * .6) * 1.9) + Math.sin(b * 2 + Math.sin(a * 4 + 1) * 1.7 + Math.sin(b * 5) * .5)) / 2;
      const ridge = Math.max(0, 1 - v * 4), o = (y * n + x) * 4;
      img.data[o] = 190; img.data[o + 1] = 245; img.data[o + 2] = 255; img.data[o + 3] = ridge > .45 ? Math.round(ridge * 34) : 0;
    }
    g.putImageData(img, 0, 0);
  }
  const n = causticTile.width * 3, ox = -((cam.x * .6 + time * 14) % n + n) % n, oy = -((cam.y * .6 + time * 9) % n + n) % n;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = false;
  for (let y = oy - n; y < H; y += n) for (let x = ox - n; x < W; x += n) ctx.drawImage(causticTile, x, y, n, n);
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    if (p.sx !== undefined) {
      const x = Math.round(p.sx - cam.x + W / 2), y = Math.round(p.sy - cam.y + H / 2);
      if (p.type === 'leaf') { ctx.fillStyle = Math.sin(time * 6 + p.ph) > 0 ? '#e2a84a' : '#c47d2e'; ctx.fillRect(x, y, 2, 1); }
      else if (p.col) { ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, p.life * .8) * (p.alpha ?? 1); if (p.type === 'bubble') { ctx.strokeStyle = p.col; ctx.lineWidth = 1; ctx.strokeRect(x - .5, y - .5, p.s, p.s); } else ctx.fillRect(x, y, p.w ?? 2, p.s ?? 1); ctx.globalAlpha = 1; }
      else { ctx.fillStyle = `rgba(220,255,140,${.5 + .5 * Math.sin(time * 5 + p.ph)})`; ctx.fillRect(x, y, 2, 2); }
      continue;
    }
    const [sx, sy] = toScreen(p.x, p.y, p.z);
    if (p.type === 'spark') { ctx.fillStyle = p.life > .6 ? '#ffd65a' : '#e8641e'; ctx.fillRect(sx, sy, 1, 1); }
    else if (p.type === 'mote') { ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${Math.min(1, p.life)})`; ctx.fillRect(sx, sy, 1, 2); }
    else if (p.type === 'drop') { ctx.fillStyle = p.vz > 0 ? '#e8f7ff' : '#9fd4f0'; ctx.fillRect(sx, sy, 1, 2); }
    else if (p.type === 'mist') { const s = Math.round(p.s + (2 - p.life) * 3); ctx.fillStyle = `rgba(230,248,250,${Math.min(.4, p.life * .3)})`; ctx.fillRect(sx - (s >> 1), sy - (s >> 1), s, s); }
    else if (p.type === 'smoke') { const a = Math.min(.35, p.life / 3.5 * .35), s = Math.round(3 + (3.5 - p.life) * 2); ctx.fillStyle = `rgba(200,196,190,${a})`; ctx.fillRect(sx - s / 2 | 0, sy - s / 2 | 0, s, s); }
  }
}

// Screen-space atmosphere particles, one style per biome kit.
function spawnAtmosphere(dt) {
  const t = KIT.particles, rx = () => cam.x + (Math.random() - .5) * W, top = cam.y - H / 2 - 10, bottom = cam.y + H / 2 + 10;
  const push = (rate, p) => { if (Math.random() < dt * rate) particles.push({ ph: Math.random() * 6, ...p }); };
  if (t === 'leaf' && !dusk) push(1.2, { type: 'leaf', sx: rx(), sy: top, vx: 18 + Math.random() * 16, vy: 26 + Math.random() * 14, life: 14 });
  else if (t === 'sand') push(10, { type: 'sand', sx: cam.x - W / 2 - 10, sy: cam.y + (Math.random() - .5) * H, vx: 160 + Math.random() * 90, vy: 8 + Math.random() * 10, sway: 6, life: 9, col: '#e8c48a', w: 3, s: 1, alpha: .55 });
  else if (t === 'snow') push(26, { type: 'snow', sx: rx() - 60, sy: top, vx: 14 + Math.random() * 10, vy: 30 + Math.random() * 24, sway: 16, life: 18, col: '#ffffff', w: Math.random() < .3 ? 2 : 1, s: Math.random() < .3 ? 2 : 1, alpha: .9 });
  else if (t === 'dust') push(4, { type: 'dust', sx: rx(), sy: cam.y + (Math.random() - .5) * H, vx: 4, vy: -4, sway: 6, life: 6, col: '#b8b0c8', w: 1, s: 1, alpha: .5 });
  else if (t === 'ember') push(14, { type: 'ember', sx: rx(), sy: bottom, vx: 10 + Math.random() * 14, vy: -(34 + Math.random() * 40), sway: 18, life: 10, col: Math.random() < .5 ? '#ffb040' : '#ff6a20', w: 1, s: 1, alpha: 1 });
  else if (t === 'bubble') push(8, { type: 'bubble', sx: rx(), sy: bottom, vx: 0, vy: -(26 + Math.random() * 30), sway: 12, life: 12, col: 'rgba(210,245,255,.8)', s: Math.random() < .4 ? 3 : 2 });
  else if (t === 'mote') push(6, { type: 'mote2', sx: rx(), sy: cam.y + (Math.random() - .5) * H, vx: 3, vy: -10, sway: 10, life: 5, col: '#fff2b0', w: 1, s: 1, alpha: .9 });
}

function drawTraversalDebug(){
  if(!debugTraversal||!player)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  const span=520,step=32,zNow=WS.terrain.walkHeight(player.x,player.y)??player.zGround;
  for(let y=player.y-span;y<=player.y+span;y+=step)for(let x=player.x-span;x<=player.x+span;x+=step){
    const [sx,sy]=toScreen(x,y,WS.terrain.walkHeight(x,y)??zNow);if(sx<0||sx>W||sy<0||sy>H)continue;
    const ok=canStand(x,y,zNow);ctx.fillStyle=ok?'rgba(70,235,110,.22)':'rgba(245,70,70,.28)';ctx.fillRect(sx-3,sy-3,6,6);
  }
  ctx.strokeStyle='rgba(255,210,55,.85)';ctx.lineWidth=1;
  for(const c of WS.colliders){if(c.type==='c'){const [sx,sy]=toScreen(c.x,c.y,WS.terrain.walkHeight(c.x,c.y)??0);ctx.beginPath();ctx.arc(sx,sy,Math.max(3,c.r*.35),0,Math.PI*2);ctx.stroke();}}
  ctx.restore();
}

// Minimap = the baked ground image itself, scaled down, so it has the same iso orientation,
// colours, river and cliffs as the main view. Tree crowns are stamped in once.
let MINI_SCALE=1/8;let miniBase=null;
// Crown colour of a sprite: average of its opaque pixels in the upper half (cached per image),
// so snowy pines, cacti, corals, crystals... each read with their own colour on the minimap.
const crownCache=new Map();
function crownColors(img){
  let c=crownCache.get(img);if(c)return c;
  const d=spriteData(img).data,w=img.width,h=img.height;let r=0,g=0,b=0,n=0;
  for(let y=0;y<h*.6;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4;if(d[o+3]<128)continue;r+=d[o];g+=d[o+1];b+=d[o+2];n++;}
  if(!n)n=1;r/=n;g/=n;b/=n;
  c=[`rgba(${r*.6|0},${g*.6|0},${b*.6|0},.9)`,`rgba(${Math.min(255,r*1.15)|0},${Math.min(255,g*1.15)|0},${Math.min(255,b*1.15)|0},.8)`];
  crownCache.set(img,c);return c;
}
function buildMinimapBase(){
  MINI_SCALE=1/(8*K);
  const {canvas:gc,gw,gh}=WS.ground,w=Math.ceil(gw*MINI_SCALE),h=Math.ceil(gh*MINI_SCALE);
  const c=makeCanvas(w,h),g=c.getContext('2d');g.imageSmoothingEnabled=true;g.drawImage(gc,0,0,w,h);
  for(const o of WS.objects){
    if(o.kind!=='sprite'||!o.fade)continue;
    const x=(isoX(o.x,o.y)-GROUND.x0)*MINI_SCALE,y=(isoY(o.x,o.y,o.z)-GROUND.y0-28*K)*MINI_SCALE;
    const [dk,lt]=crownColors(o.img);
    g.fillStyle=dk;g.beginPath();g.arc(x,y,3.2,0,Math.PI*2);g.fill();
    g.fillStyle=lt;g.fillRect(Math.round(x-2),Math.round(y-2),2,2);
  }
  miniBase=c;
}
function drawMinimap(){
  if(!player||!WS.ground)return;
  if(!miniBase)buildMinimapBase();
  const mw=220,mh=140,pad=16,x0=W-mw-pad,y0=pad,z=minimapZoom;
  const toMini=(x,y,zz=0)=>[x0+mw/2+((isoX(x,y)-isoX(player.x,player.y))*MINI_SCALE)*z,y0+mh/2+((isoY(x,y,zz)-isoY(player.x,player.y,player.z))*MINI_SCALE)*z];
  const cx=(isoX(player.x,player.y)-GROUND.x0)*MINI_SCALE,cy=(isoY(player.x,player.y,player.z)-GROUND.y0)*MINI_SCALE;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='rgba(14,12,9,.9)';ctx.fillRect(x0-4,y0-4,mw+8,mh+8);
  ctx.beginPath();ctx.rect(x0,y0,mw,mh);ctx.clip();
  ctx.fillStyle='#16241a';ctx.fillRect(x0,y0,mw,mh);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(miniBase,cx-mw/2/z,cy-mh/2/z,mw/z,mh/z,x0,y0,mw,mh);
  ctx.imageSmoothingEnabled=false;
  for(const a of actors){
    if(a.hidden||a.dead)continue;const [x,y]=toMini(a.x,a.y,a.z||0);
    if(x<x0||x>x0+mw||y<y0||y>y0+mh)continue;
    ctx.fillStyle='#2a0f0c';ctx.fillRect(Math.round(x)-2,Math.round(y)-2,4,4);ctx.fillStyle='#ff6a55';ctx.fillRect(Math.round(x)-1,Math.round(y)-1,2,2);
  }
  for(const pt of WS.scene.portals||[]){const [x,y]=toMini(pt.x,pt.y);ctx.strokeStyle='#9fe0ff';ctx.lineWidth=1;ctx.strokeRect(Math.round(x)-3,Math.round(y)-2,6,4);}
  // player arrow points where the hero faces (screen directions, same as the sprite)
  const px=x0+mw/2,py=y0+mh/2,ang=(player.dir||0)*Math.PI/4;
  ctx.translate(px,py);ctx.rotate(ang);
  ctx.fillStyle='#fff2a8';ctx.strokeStyle='#2a1c10';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4.5,5);ctx.lineTo(0,2.5);ctx.lineTo(-4.5,5);ctx.closePath();ctx.stroke();ctx.fill();
  ctx.restore();
  // frame
  ctx.strokeStyle='#c9a86a';ctx.lineWidth=2;ctx.strokeRect(x0-1,y0-1,mw+2,mh+2);
  ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=1;ctx.strokeRect(x0-4.5,y0-4.5,mw+9,mh+9);
  ctx.fillStyle='rgba(14,12,9,.9)';ctx.fillRect(x0,y0+mh-15,mw,15);
  ctx.fillStyle='#f0dfae';ctx.font='bold 10px system-ui';ctx.textAlign='left';ctx.fillText(WS.scene.title||'',x0+6,y0+mh-4);
  ctx.textAlign='right';ctx.fillStyle='#bca97c';ctx.fillText(`${Math.round(player.x/64)}, ${Math.round(player.y/64)}`,x0+mw-6,y0+mh-4);ctx.textAlign='left';
}

function frame(now) {
  const dt = Math.min(.05, (now - t0) / 1000); t0 = now; time += dt;
  update(dt);
  if(actorUpdater)actorUpdater({dt,time,player,actors,terrain:WS.terrain});
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle = '#101510'; ctx.fillRect(0, 0, W, H);
  if(viewZoom!==1)ctx.setTransform(viewZoom,0,0,viewZoom,W*(1-viewZoom)/2,H*(1-viewZoom)/2);
  const ox = Math.round((GROUND.x0 - cam.x)*worldVisualScale + W / 2), oy = Math.round((GROUND.y0 - cam.y)*worldVisualScale + H / 2);
  ctx.save();
  if(worldVisualScale!==1){ctx.translate(ox,oy);ctx.scale(worldVisualScale,worldVisualScale);ctx.drawImage(WS.ground.canvas,0,0);ctx.restore();}
  else {ctx.drawImage(WS.ground.canvas,ox,oy);}
  drawWater(ox, oy);
  if (WS.scene.fountain) {
    const f = WS.scene.fountain, [fx, fy] = toScreen(f.x, f.y, WS.terrain.heightAt(f.x, f.y) + 11);
    ctx.fillStyle = 'rgba(230,248,255,.9)';
    for (let i = 0; i < 26; i++) {
      const a = hash2(i, 3) * Math.PI * 2, rr = 12 + hash2(i, 5) * 58, wx = Math.cos(a) * rr, wy = Math.sin(a) * rr;
      if (Math.sin(time * 3 + i * 1.7) >= .55) ctx.fillRect(Math.round(fx + (wx - wy) / 2 * K), Math.round(fy + (wx + wy) / 4 * K), 2, 1);
    }
  }
  const [psx, psy] = toScreen(player.x, player.y, player.zGround);
  ctx.fillStyle = 'rgba(16,20,34,.38)';
  const shadowRx=Math.max(7,Math.round(15*playerVisualScale)),shadowRy=Math.max(2,Math.round(5*playerVisualScale));
  for (let r = -shadowRy+1; r < shadowRy; r++) { const hw = Math.round(shadowRx * Math.sqrt(Math.max(0,1-(r/shadowRy)**2))); ctx.fillRect(psx-hw,psy+r-1,hw*2,1); }
  const vis = [];
  for (const o of WS.objects) {
    const [sx, sy] = toScreen(o.x, o.y, o.z);
    if (sx < -360 || sx > W + 360 || sy < -80 || sy > H + 420) continue;
    vis.push(o);
  }
  for(const actor of actors){
    if(actor.hidden||actor.dead)continue;
    const z=WS.terrain.walkHeight(actor.x,actor.y);if(z===null)continue;
    actor.z=z+(actor.zOffset??0);vis.push(actor);
  }
  vis.push(player);
  vis.sort(compare);
  let after = false;
  for (const o of vis) { if (o === player) after = true; drawObject(o, psx, psy, after && o !== player); }
  drawParticles();
  // Lighting/vignette are screen-space overlays. Reset camera zoom first so they always
  // cover the full viewport instead of becoming a visible zoomed rectangle.
  ctx.setTransform(1,0,0,1,0,0);
  drawLighting();
  drawTraversalDebug();
  drawMinimap();
  rafId=requestAnimationFrame(frame);
}

export function teardown(){
  if(rafId){cancelAnimationFrame(rafId);rafId=0;}
  for(const [target,type,fn,opts] of bootListeners)target.removeEventListener(type,fn,opts);
  bootListeners=[];keys.clear();actors.length=0;actorUpdater=null;externalPlayerControl=false;playerVisualGetter=null;particles.length=0;player=null;cam=null;
  if(typeof window!=='undefined')delete window.__slice;
}

const TERRAIN_CACHE_VERSION='ground-v1';
function cacheDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open('bunny-world-terrain',1);req.onupgradeneeded=()=>req.result.createObjectStore('ground');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function readGroundCache(key){
  if(!key||typeof indexedDB==='undefined')return null;
  try{const db=await cacheDb(),row=await new Promise((resolve,reject)=>{const tx=db.transaction('ground','readonly'),r=tx.objectStore('ground').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();if(!row)return null;
    const bmp=await createImageBitmap(row.blob),c=makeCanvas(row.gw,row.gh),g=c.getContext('2d');g.drawImage(bmp,0,0);bmp.close?.();
    return{canvas:c,gw:row.gw,gh:row.gh,zbuf:new Int16Array(row.zbuf),waterPix:new Int32Array(row.waterPix),fallPix:new Int32Array(row.fallPix)};
  }catch(e){console.warn('[terrain-cache] read failed',e);return null;}
}
async function writeGroundCache(key,ground){
  if(!key||typeof indexedDB==='undefined'||!ground?.canvas)return;
  try{const blob=await new Promise(r=>ground.canvas.toBlob(r,'image/png'));if(!blob)return;const row={blob,gw:ground.gw,gh:ground.gh,zbuf:ground.zbuf.buffer.slice(0),waterPix:ground.waterPix.buffer.slice(0),fallPix:ground.fallPix.buffer.slice(0)};const db=await cacheDb();await new Promise((resolve,reject)=>{const tx=db.transaction('ground','readwrite');tx.objectStore('ground').put(row,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch(e){console.warn('[terrain-cache] write failed',e);}
}

export async function prepare(scene,{canvasEl,loadingEl,renderScale}={}){
  setRenderScale(renderScale??scene.renderScale??K);
  canvas=canvasEl;ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;WS.scene=scene;
  const say=t=>{if(loadingEl)loadingEl.textContent=t;};
  await yieldFrame();const tStart=performance.now();say('กำลังสร้างต้นไม้…');await yieldFrame();
  KIT=biomeOf(scene);buildLibraries(KIT);WS.terrain=buildTerrain(scene);placeStructures();say('กำลังวางของ…');await yieldFrame();placeScatter();
  const noCache=new URLSearchParams(location.search).has('nocache');
  const cacheKey=!noCache&&scene.cacheKey?`${TERRAIN_CACHE_VERSION}:${scene.cacheKey}:scale:${K}`:null;
  WS.ground=null;
  if(cacheKey){say('กำลังโหลดพื้นจาก cache…');WS.ground=await readGroundCache(cacheKey);}
  if(!WS.ground){await bakeGround(p=>say(`กำลังวาดพื้น… ${Math.round(p*100)}%`));if(cacheKey)writeGroundCache(cacheKey,WS.ground);}
  else say('โหลดพื้นจาก cache แล้ว');
  maskStaticObjects();buildOverlays();
  return {WS,bakeMs:Math.round(performance.now()-tStart)};
}

export function renderHosted({cameraX,cameraY,screenCenterY=H/2,playerEntity=null,runtimeActors=null,timeSeconds=0}={}){
  if(!ctx||!WS.ground)return;time=timeSeconds;
  if(runtimeActors)setRuntimeActors(runtimeActors);
  // Hosted Arena keeps its established world coordinates/projection. Convert its world camera
  // to Dimraeth projected camera space, with Arena's ground baseline as the screen centre.
  if(cameraX!==undefined&&cameraY!==undefined)cam={x:isoX(cameraX,cameraY),y:isoY(cameraX,cameraY)+(H/2-screenCenterY)};
  ctx.fillStyle='#101510';ctx.fillRect(0,0,W,H);
  const ox=Math.round(GROUND.x0-cam.x+W/2),oy=Math.round(GROUND.y0-cam.y+H/2);ctx.drawImage(WS.ground.canvas,ox,oy);drawWater(ox,oy);
  const vis=[];for(const o of WS.objects)vis.push(o);for(const actor of actors){if(actor.hidden||actor.dead)continue;const z=WS.terrain.walkHeight(actor.x,actor.y);if(z===null)continue;actor.z=z+(actor.zOffset??0);vis.push(actor);}if(playerEntity)vis.push(playerEntity);
  vis.sort(compare);const ps=playerEntity?toScreen(playerEntity.x,playerEntity.y,playerEntity.z??0):[-9999,-9999];let after=false;
  for(const o of vis){if(o===playerEntity)after=true;drawObject(o,ps[0],ps[1],after&&o!==playerEntity);}drawParticles();drawLighting();
}

export async function boot(scene, { canvasEl, loadingEl, playerSprites = null, zoom = 1, worldScale = 1, renderScale, playerScale = 1 }) {
  // worldScale used to upscale the finished ground image (blurry/uneven pixels). It is now a
  // native render scale: terrain and sprites are generated at that size. Hero/actors keep their own scale.
  viewZoom=Math.max(.5,Math.min(2,zoom));worldVisualScale=1;playerVisualScale=Math.max(.5,Math.min(1.5,playerScale));
  const {bakeMs}=await prepare(scene,{canvasEl,loadingEl,renderScale:renderScale??scene.renderScale??worldScale});
  if(playerSprites)await Promise.all(DIRS.map(d => new Promise((res, rej) => { const i = new Image(); i.onload = () => { sprites[d] = i; res(); }; i.onerror = rej; i.src = `${playerSprites}${d}.png`; })));
  const z0 = WS.terrain.walkHeight(scene.spawn.x, scene.spawn.y) ?? 0;
  player = { kind: 'player', x: scene.spawn.x, y: scene.spawn.y, z: z0, zGround: z0, dir: 4, r: 13, target: null };
  cam = { x: isoX(player.x, player.y), y: isoY(player.x, player.y, z0) };
  loadingEl?.remove();
  const onKeyDown=e=>{keys.add(e.code);if(e.code==='KeyL')dusk=!dusk;if(e.code==='F3'){debugTraversal=!debugTraversal;e.preventDefault();}if(e.code==='KeyH'){const h=document.getElementById('hud');if(h)h.hidden=!h.hidden;}if(e.code.startsWith('Arrow'))e.preventDefault();};
  const onKeyUp=e=>keys.delete(e.code);
  const onWheel=e=>{const factor=e.deltaY<0?1.1:1/1.1;viewZoom=Math.max(.7,Math.min(1.8,viewZoom*factor));e.preventDefault();};
  const onPointer=e=>{const r=canvas.getBoundingClientRect(),mx=(e.clientX-r.left)*W/r.width,my=(e.clientY-r.top)*H/r.height,hit=WS.terrain.pick(mx-W/2+cam.x,my-H/2+cam.y);player.target={x:hit.x,y:hit.y};};
  window.addEventListener('keydown',onKeyDown);window.addEventListener('keyup',onKeyUp);canvas.addEventListener('wheel',onWheel,{passive:false});canvas.addEventListener('pointerdown',onPointer);
  bootListeners=[[window,'keydown',onKeyDown],[window,'keyup',onKeyUp],[canvas,'wheel',onWheel,{passive:false}],[canvas,'pointerdown',onPointer]];
  window.__slice = { WS, player, cam, actors, setRuntimeActors, setRuntimeActorUpdater, terrain:WS.terrain, projectRuntimePoint, canRuntimeActorStand, bakeMs, setDusk: v => { dusk = v; } };
  t0 = performance.now();
  rafId=requestAnimationFrame(frame);
}
