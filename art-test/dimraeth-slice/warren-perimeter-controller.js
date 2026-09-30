// Village perimeter runtime: install/rebuild wall + gate colliders and visuals,
// gate selection, upgrades and damage. Pure layout rules live in warren-perimeter.js
// and warren-home-land.js.
import {WS} from './engine/state.js';
import {runtimeWalkHeight} from './engine/runtime.js';
import {combatSFX} from './combat/sfx.js';
import {stoneWallSprite,stoneGateSprite} from './engine/sprites.js';
import {biomeOf} from './engine/biomes.js';
import {fenceRun} from './engine/world.js';
import * as PAL from './engine/palettes.js';
import {nextPerimeterTier,perimeterMid,toggleGateSelection,gateShouldClose} from './warren-perimeter.js';
import {homePerimeterBlueprint,homeWallIntegrity,reconcileHomeWall} from './warren-home-land.js';

export function createPerimeterController(ctx){
 const {S,T,toast,save,renderUi,matCount,spendMats,keepActorsOutOfWalls}=ctx;
// One-click village perimeter. No manual painting, starter fences or invisible placement restrictions.
const fenceKey=f=>f.axis+':'+f.x+':'+f.y;
// Exact same asset generators that scene editor stoneWall / stoneGate props use.
// Cache per axis/length/biome: a 15×15 wall should not rasterize a sprite for every tile.
const editorStoneSprites=new Map();
function editorStoneSprite(f,len){
 const alongX=f.axis==='x',biome=WS.scene?.biome||'forest',seed=Math.round(f.x*7+f.y*13),tier=Math.max(2,f.tier||S.wallLevel||2),extra=(tier-2)*4;
 const key=f.kind+':'+len+':'+f.axis+':'+(f.kind==='gate'?biome:seed&1)+':'+tier;
 let sprite=editorStoneSprites.get(key);
 if(!sprite){
  sprite=f.kind==='gate'
   ?stoneGateSprite(len,alongX,biomeOf(WS.scene).village?.wallPalette||PAL.WSTONE,extra)
   :stoneWallSprite(len,alongX,seed,30+extra);
  editorStoneSprites.set(key,sprite);
 }
 return sprite;
}
function removePerimeterRuntime(){
 WS.objects=WS.objects.filter(o=>!o.bcFenceId);
 // Replace collider array: A* caches it by identity and length.
 WS.colliders=WS.colliders.filter(c=>!c.bcFenceId);
}
function installFence(f){
 if(f.hp<=0)return; // destroyed fence or gate leaves a walkable breach
 const x=f.x*T,y=f.y*T,ex=x+(f.axis==='x'?(f.len||1)*T:0),ey=y+(f.axis==='y'?(f.len||1)*T:0),p=perimeterMid(f,T);
 const objectsAt=WS.objects.length,collidersAt=WS.colliders.length,key=fenceKey(f);
 if(f.kind==='gate'){
  const closed=gateShouldClose(f,S.night,S.gateClosed);
  f.closed=closed;
  const box={x0:Math.min(x,ex)-5,x1:Math.max(x,ex)+5,y0:Math.min(y,ey)-5,y1:Math.max(y,ey)+5};
  const z=runtimeWalkHeight(p.x,p.y)??0;
  if(f.material==='stone'){
   const sprite=editorStoneSprite(f,f.len*T),alongX=f.axis==='x',th=14;
   const x0=alongX?x:x-th/2,y0=alongX?y-th/2:y;
   WS.objects.push({kind:'gate',closed,x,y,x1:ex,y1:ey,z,box,
    editorStoneSprite:{img:sprite.img,ox:sprite.ox,oy:sprite.oy,x:x0,y:y0},editorPrefab:'stoneGate'});
  }else WS.objects.push({kind:'gate',closed,x,y,x1:ex,y1:ey,z,box});
  if(closed)WS.colliders.push({type:'b',...box});
 }else if(f.material==='stone'){
  const sprite=editorStoneSprite(f,(f.len||1)*T),alongX=f.axis==='x',th=12;
  const x0=alongX?x:x-th/2,y0=alongX?y-th/2:y,len=(f.len||1)*T,z=runtimeWalkHeight(p.x,p.y)??0;
  const box=alongX?{x0,x1:x0+len,y0,y1:y0+th}:{x0,x1:x0+th,y0,y1:y0+len};
  WS.objects.push({kind:'sprite',img:sprite.img,ox:sprite.ox,oy:sprite.oy,x:x0,y:y0,z,box,
   editorPrefab:'stoneWall',x1:ex,y1:ey});
  // Keep the same gameplay collider widths as the wooden perimeter, regardless of asset thickness.
  WS.colliders.push({type:'b',x0:Math.min(x,ex)-3,x1:Math.max(x,ex)+3,y0:Math.min(y,ey)-3,y1:Math.max(y,ey)+3});
 }else fenceRun(x,y,ex,ey,null,runtimeWalkHeight(p.x,p.y)??0,true);
 for(const o of WS.objects.slice(objectsAt)){
  o.bcFenceId=key;o.wallMaterial=f.material;o.reinforced=!!f.reinforced;
 }
 for(const c of WS.colliders.slice(collidersAt))c.bcFenceId=key;
}
function rebuildPerimeter(){
 const health=homeWallIntegrity(S.wallLevel,S.homeBuilder,S.fences);
 if(health.missing||health.obsolete||health.actual!==health.expected){
  S.fences=reconcileHomeWall(S.wallLevel,S.homeBuilder,S.fences);
 }
 removePerimeterRuntime();
 for(const section of S.fences)installFence(section);
 // Units and monsters will replan with the new collider array automatically.
 for(const actor of [...S.units,...S.monsters]){actor.replan=0;actor.path=null;}
 keepActorsOutOfWalls([...S.units,...S.monsters]);
}
function syncGateRuntime(){
 // Rebuild only gate colliders/visual state when day becomes night or the selection changes.
 const gateKeys=new Set(S.fences.filter(f=>f.kind==='gate').map(fenceKey));
 WS.colliders=WS.colliders.filter(c=>!gateKeys.has(c.bcFenceId));
 for(const f of S.fences.filter(f=>f.kind==='gate')){
  const closed=gateShouldClose(f,S.night,S.gateClosed);f.closed=closed;
  const obj=WS.objects.find(o=>o.bcFenceId===fenceKey(f)&&o.kind==='gate');
  if(!obj)continue;
  obj.closed=closed;
  if(closed)WS.colliders.push({type:'b',...obj.box,bcFenceId:fenceKey(f)});
 }
 for(const actor of [...S.units,...S.monsters]){actor.replan=0;actor.path=null;}
}
function selectGate(side){
 if(S.night||!S.wallLevel)return false;
 const next=toggleGateSelection(S.gateClosed,side);
 if(!next)return toast('เลือกปิดได้สูงสุด 2 ฝั่ง · ต้องเหลือทางเข้าอย่างน้อย 1 ทาง'),false;
 S.gateClosed=next;save();renderUi();return true;
}
function upgradePerimeter(){
 if(S.night)return toast('สร้างและอัปเกรดกำแพงได้เฉพาะกลางวัน'),false;
 const next=nextPerimeterTier(S.wallLevel);
 if(next.level<=S.wallLevel)return toast('กำแพงอัปเกรดเต็มระดับแล้ว'),false;
 if(matCount()<next.cost)return toast(`วัตถุดิบไม่พอ · ต้องใช้ ${next.cost} ชิ้น (มี ${matCount()})`),false;
 if(!spendMats(next.cost))return false;
 S.wallLevel=next.level;S.fences=homePerimeterBlueprint(next.level,S.homeBuilder);
 rebuildPerimeter();save();renderUi();
 combatSFX.playLevelUp?.({volume:.45});
 toast(`${next.material==='wood'?'สร้างรั้วไม้':next.reinforced?'เสริมกำแพงหิน':'อัปเกรดเป็นกำแพงหิน'} Lv ${next.level} · รักษาแนวกำแพงที่ซื้อแล้ว · ใช้วัตถุดิบ ${next.cost}`);
 return true;
}
function hurtPerimeter(section,damage){
 if(!section||!['fence','gate'].includes(section.kind)||section.hp<=0)return false;
 const p=perimeterMid(section,T);
 section.hp=Math.max(0,Math.ceil(section.hp-Math.max(1,damage)));
 ctx.floaters()?.text(p.x,p.y,'-'+Math.ceil(damage),{color:'#e8aa75',size:12,lift:35});
 if(section.hp===0){
  const key=fenceKey(section);
  WS.objects=WS.objects.filter(o=>o.bcFenceId!==key);
  WS.colliders=WS.colliders.filter(c=>c.bcFenceId!==key);
  ctx.skillFx()?.burst(p.x,p.y,{color:'#d5a078',count:13,up:42});
  for(const actor of [...S.units,...S.monsters]){actor.replan=0;actor.path=null;}
  if(section.kind==='gate')toast('ประตู'+({south:'ใต้',east:'ตะวันออก',west:'ตะวันตก'}[section.side]||'')+'พัง! มอนสเตอร์บุกผ่านช่องนี้ได้แล้ว');
 }
 renderUi();return true;
}

 return {fenceKey,editorStoneSprites,editorStoneSprite,removePerimeterRuntime,installFence,rebuildPerimeter,syncGateRuntime,selectGate,upgradePerimeter,hurtPerimeter};
}
