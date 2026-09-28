import {homeWallTiles} from './warren-home-land.js';

// A defense is a world object, not a radius measured from the Hall. Use the
// active expanded perimeter as the placement authority, irrespective of wall HP.
// All coordinates and radii are world units (64 units = one editor tile).
export const DEFENSE_FOOTPRINT=Object.freeze({tower:22,magicCart:28});
export const DEFENSE_SPACING=8;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const distanceToBox=(x,y,b)=>Math.hypot(Math.max(b.x0-x,0,x-b.x1),Math.max(b.y0-y,0,y-b.y1));
const pointToSegment=(x,y,ax,ay,bx,by)=>{
 const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(x-(ax+t*dx),y-(ay+t*dy));
};
export const defenseWallDistance=(x,y,f,tile=64)=>pointToSegment(
 x,y,f.x*tile,f.y*tile,(f.x+(f.axis==='x'?(f.len||1):0))*tile,(f.y+(f.axis==='y'?(f.len||1):0))*tile
);
const insideWall=(x,y,r,cells)=>{
 // Radius-aware and uses the purchased/expanded *wall layout*, not deeds.
 for(let k=0;k<16;k++){
  const a=k*Math.PI/8,px=x+(r+4)*Math.cos(a),py=y+(r+4)*Math.sin(a);
  if(!cells.has(Math.round(px/64)+','+Math.round(py/64)))return false;
 }
 return cells.has(Math.round(x/64)+','+Math.round(y/64));
};
const overlapCollider=(x,y,r,c)=>{
 if(c?.type==='c')return Number.isFinite(c.x)&&Number.isFinite(c.y)&&Math.hypot(x-c.x,y-c.y)<r+c.r+2;
 if(c?.type==='b')return distanceToBox(x,y,c)<r+3;
 return false;
};
const overlapObject=(x,y,r,o)=>o?.box&&distanceToBox(x,y,o.box)<r+5;

/** Shared placement check used for creation, relocation and the red/green ghost.
 * All named objects, real engine colliders, manually placed decorations, walls
 * and other defenses are checked, with no hidden 520-unit build circle or
 * mandatory 170-unit Hall exclusion. Existing bought land OUTSIDE the wall
 * remains ineligible until the player pays for the wall relocation.
 */
export function validateDefensePlacement({
 x,y,kind='tower',home,walls=[],defenses=[],colliders=[],objects=[],decorations=[],occupants=[],canStand=null
}={}){
 const r=DEFENSE_FOOTPRINT[kind];
 if(!r||!Number.isFinite(x)||!Number.isFinite(y))return {ok:false,reason:'ตำแหน่งไม่ถูกต้อง'};
 if(!insideWall(x,y,r,homeWallTiles(home)))return {ok:false,reason:'สร้างได้เฉพาะพื้นที่ภายในแนวกำแพงปัจจุบัน'};
 if(walls.some(f=>defenseWallDistance(x,y,f)<r+(f.kind==='gate'?45:12)))
  return {ok:false,reason:'ต้องเว้นกำแพงและทางเข้าประตู'};
 if(defenses.some(d=>distance({x,y},d)<r+(d.radius??DEFENSE_FOOTPRINT[d.kind]??22)+DEFENSE_SPACING))
  return {ok:false,reason:'ตำแหน่งทับป้อมหรือรถยิงเวทย์'};
 if(decorations.some(o=>{
  const dr=Number.isFinite(o.radius)?o.radius:22;
  return o.prefab==='dirtPath'||o.prefab==='stonePath'
   ?distanceToBox(x,y,{x0:o.x-32,x1:o.x+32,y0:o.y-32,y1:o.y+32})<r+3
   :Math.hypot(x-o.x,y-o.y)<r+Math.max(dr,14)+3;
 }))return {ok:false,reason:'ตำแหน่งทับของตกแต่งหรือทางเดินที่วางไว้'};
 if(occupants.some(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&distance({x,y},u)<r+(u.r??12)+4))
  return {ok:false,reason:'มีกระต่ายหรือมอนสเตอร์ยืนอยู่บริเวณนี้'};
 if(colliders.some(c=>!c.bcFenceId&&overlapCollider(x,y,r,c)))
  return {ok:false,reason:'ตำแหน่งชนอาคาร ต้นไม้ หรือสิ่งกีดขวาง'};
 if(objects.some(o=>!o.bcFenceId&&!o.flat&&!String(o.homeId||'').startsWith('sand:')&&overlapObject(x,y,r,o)))
  return {ok:false,reason:'ตำแหน่งทับออบเจกต์ในฉาก'};
 if(canStand&&![[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,-r*.7],[r*.7,-r*.7],[-r*.7,r*.7]]
  .every(([dx,dy])=>canStand(x+dx,y+dy)))return {ok:false,reason:'พื้นไม่เรียบหรือเดินไม่ได้'};
 return {ok:true,x,y};
}
