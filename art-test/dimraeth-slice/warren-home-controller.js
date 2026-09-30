// Home Builder controller: placement, land, walls, terrain and recovery.
// Pure rules live in warren-home-*.js; this module applies them to the live game state.
import {sceneFromMap} from './scenes/custom.js';
import {WS} from './engine/state.js';
import {runtimeWalkHeight,repaintRuntimeRoadFields,rebuildRuntimeTerrain} from './engine/runtime.js';
import {perimeterMid} from './warren-perimeter.js';
import {CONSTRUCTION_MATERIAL_IDS} from './warren-progression.js';
import {HOME_ITEMS,snapHome,validateHomePlacement,refundHome} from './warren-home-builder.js';
import {homeArt} from './warren-home-art.js';
import {isHomeNativePath} from './warren-home-paths.js';
import {HOME_PLOTS,HOME_SIDE_NAMES,HOME_PLOT_COST,HOME_WALL_COST,fullyOwnedSide,homePerimeterBlueprint,homeWallLayoutId,plotForCell,reconcileHomeWall,HOME_EXPANSION_STAGES,HOME_NORTH_FINAL,homeAtNorthernCliff} from './warren-home-land.js';
import {applyHomeTerrainBrush,validateHomeTerrainBatch,quoteHomeTerrain,deriveHomeRivers,makeHomeWaterfall,isNorthCliffCrest,deriveHomeNorthCurtains,quoteNewHomeNorthCurtains} from './warren-home-terrain.js';

export function createHomeController(ctx){
 const {S,T,save,renderUi,toast,buildMap,currentStage,standable,dist,matCount,spendMats,spendMatsWithReceipt,closeMobileDrawer,defenseStructures,rebuildPerimeter}=ctx;
// Home Builder changes are isolated from the combat save and terrain grids.
let homeRuntimeReady=false;
let homeGroundRefresh=Promise.resolve();
function refreshNativeHomeGround(){
 S.homeGroundBusy=true;renderUi();
 homeGroundRefresh=homeGroundRefresh.catch(()=>{}).then(async()=>{
  const native=sceneFromMap(buildMap(WS.scene?.biome||currentStage.biome,S.homeBuilder));
  if(!await repaintRuntimeRoadFields(native))throw Error('Terrain renderer not initialized');
 }).catch(error=>{
  console.error('[home-builder] native road refresh failed',error);
  toast('ไม่สามารถรีเฟรชพื้นได้ กรุณาโหลดเกมใหม่เพื่อแสดงทางเดินจาก Map Editor');
 }).finally(()=>{S.homeGroundBusy=false;renderUi();});
 return homeGroundRefresh;
}
const homeDefenses=()=>[...S.towers,...S.magicCarts].map(t=>({x:t.x,y:t.y,radius:48}));
function checkHome(prefab,x,y,rotation,ignoreId=null,checkActors=true){
 // Ignore the object's own collider when moving it onto another snapped tile.
 const colliders=WS.colliders;
 if(ignoreId&&homeRuntimeReady)WS.colliders=colliders.filter(c=>c.homeId!==ignoreId);
 try{
  const result=validateHomePlacement(S.homeBuilder,prefab,x,y,rotation,{
   defenses:homeDefenses(),ignoreId,
   canStand:homeRuntimeReady?(px,py,r)=>[[0,0],[r,0],[-r,0],[0,r],[0,-r]].every(([dx,dy])=>standable(px+dx,py+dy)):null
  });
  if(result.ok&&checkActors&&HOME_ITEMS[prefab]?.radius){
   const blocked=[...S.units.filter(u=>!u.down),...S.monsters.filter(m=>!m.dead)].some(u=>dist(u,result)<HOME_ITEMS[prefab].radius+23);
   if(blocked)return {ok:false,reason:'มีกระต่ายหรือมอนสเตอร์ยืนอยู่บริเวณนี้'};
  }
  return result;
 }finally{WS.colliders=colliders;}
}
// A bad cosmetic sprite must never stop the animation loop or corrupt a save.
const failedHomeSprites=new Set();
function safeHomeArt(prefab,rotation=0,variant=0){
 try{return homeArt(prefab,rotation,variant);}
 catch(error){
  const key=prefab+':'+rotation+':'+variant;
  if(!failedHomeSprites.has(key)){
   failedHomeSprites.add(key);
   console.error('[home-builder] failed to render cosmetic sprite',key,error);
  }
  return null;
 }
}
// Catalog cards show the real in-world sprite, rendered once per prefab.
const homeThumbs=new Map();
function homeThumb(prefab){
 if(!homeThumbs.has(prefab)){
  let url=null;
  try{const art=isHomeNativePath(prefab)?null:safeHomeArt(prefab,0,0);url=art?.img?.toDataURL?.()||null;}catch{}
  homeThumbs.set(prefab,url);
 }
 return homeThumbs.get(prefab);
}
// The placed object under a world point, so tapping existing decor selects it.
function homeObjectAt(x,y){
 const p=snapHome(x,y);let best=null,bestD=Infinity;
 for(const o of S.homeBuilder.placedObjects){
  const def=HOME_ITEMS[o.prefab];if(!def)continue;
  const d=Math.hypot(o.x-x,o.y-y),reach=isHomeNativePath(o.prefab)?0:Math.max(def.radius||0,26);
  const hit=isHomeNativePath(o.prefab)?o.x===p.x&&o.y===p.y:d<=reach;
  // Paths only win when nothing solid stands on the same spot.
  const score=isHomeNativePath(o.prefab)?1e6:d;
  if(hit&&score<bestD){best=o;bestD=score;}
 }
 return best;
}
function editSelectedHome(change){
 if(!S.homeOpen||S.night||S.homeGroundBusy)return false;
 const obj=S.homeBuilder.placedObjects.find(o=>o.id===S.homeSelectedId);if(!obj)return false;
 const next={...obj,...change};
 const check=checkHome(obj.prefab,obj.x,obj.y,next.rotation,obj.id,false);
 if(!check.ok){toast(check.reason);return false;}
 if(!isHomeNativePath(obj.prefab)&&!safeHomeArt(obj.prefab,next.rotation,next.variant||0)){toast('ไม่สามารถสร้างภาพแบบนี้ได้');return false;}
 S.homeUndo={kind:'move',before:{...obj}};Object.assign(obj,change);
 rebuildHomeWorld();save();renderUi();return true;
}
function rebuildHomeWorld(){
 ctx.onHomeChanged?.();
 if(!homeRuntimeReady)return;
 WS.objects=WS.objects.filter(o=>!o.homeId);
 WS.colliders=WS.colliders.filter(c=>!c.homeId);
 for(const tile of S.homeBuilder.terrainEdits.filter(e=>e.ground==='sand'&&!e.water)){
  const x=tile.i*T,y=tile.j*T,sprite=homeArt('sandPatch'),z=runtimeWalkHeight(x,y)??0;
  WS.objects.push({kind:'sprite',img:sprite.img,ox:sprite.ox,oy:sprite.oy,x,y,z:z+1,homeId:'sand:'+tile.i+':'+tile.j,
   box:{x0:x-30,x1:x+30,y0:y-30,y1:y+30}});
 }
 for(const o of S.homeBuilder.placedObjects){
  const def=HOME_ITEMS[o.prefab];if(!def||isHomeNativePath(o.prefab))continue;
  const sprite=safeHomeArt(o.prefab,o.rotation,o.variant);
  if(!sprite)continue; // Keep the player's object in their save until its art can be rendered.
  const z=runtimeWalkHeight(o.x,o.y)??0;
  WS.objects.push({kind:'sprite',img:sprite.img,ox:sprite.ox,oy:sprite.oy,x:o.x,y:o.y,z,
   box:{x0:o.x-8,x1:o.x+8,y0:o.y-8,y1:o.y+8},homeId:o.id,homePrefab:o.prefab});
  if(def.radius)WS.colliders.push({type:'c',x:o.x,y:o.y,r:def.radius,homeId:o.id});
 }
 for(const actor of [...S.units,...S.monsters]){actor.replan=0;actor.path=null;}
}
function restoreHomeWorld(){
 homeRuntimeReady=true;
 const loaded=S.homeBuilder.placedObjects.slice();
 S.homeBuilder.placedObjects=[];
 for(const obj of loaded){
  const result=checkHome(obj.prefab,obj.x,obj.y,obj.rotation,null,false);
  if(result.ok)S.homeBuilder.placedObjects.push(obj);
  else S.homeBuilder.recovery.push({...obj,reason:result.reason});
 }
 rebuildHomeWorld();
 if(loaded.length!==S.homeBuilder.placedObjects.length){
  save();toast('พบของตกแต่งที่วางไม่ปลอดภัย ย้ายไป Recovery Storage แล้ว');
  if(loaded.some(o=>isHomeNativePath(o.prefab)&&!S.homeBuilder.placedObjects.some(v=>v.id===o.id)))refreshNativeHomeGround();
 }
}
function placeHome(x,y){
 if(!S.homeOpen||S.night||S.homeGroundBusy||S.homeAction!=='place')return false;
 const def=HOME_ITEMS[S.homeSelected],check=checkHome(S.homeSelected,x,y,S.homeRotation);
 if(!check.ok){toast(check.reason);return false;}
 if(!def||S.gold<def.gold||matCount()<def.mats){toast('Gold หรือวัตถุดิบก่อสร้างไม่พอ');return false;}
 // Build the sprite before charging or mutating the save. A failed asset may
 // never freeze the game or leave the player with an unpaid/invisible house.
 if(!isHomeNativePath(S.homeSelected)&&!safeHomeArt(S.homeSelected,S.homeRotation,S.homeVariant)){
  toast('ไม่สามารถสร้างภาพบ้านนี้ได้ ยังไม่หักวัตถุดิบหรือ Gold');return false;
 }
 const receipt=spendMatsWithReceipt(def.mats);if(!receipt)return false;
 S.gold-=def.gold;
 const obj={id:'decor-'+S.homeBuilder.nextId++,prefab:S.homeSelected,x:check.x,y:check.y,rotation:S.homeRotation,
  variant:S.homeVariant,plot:plotForCell(Math.round(check.x/T),Math.round(check.y/T))||'base',spent:receipt,solid:!!def.radius,createdVersion:'0.5.0'};
 S.homeBuilder.placedObjects.push(obj);S.homeUndo={kind:'place',obj:{...obj}};
 rebuildHomeWorld();save();
 if(isHomeNativePath(obj.prefab))refreshNativeHomeGround();
 renderUi();toast('วาง '+def.name+' แล้ว');return true;
}
function moveHome(id,x,y){
 if(!S.homeOpen||S.night||S.homeGroundBusy)return false;
 const obj=S.homeBuilder.placedObjects.find(o=>o.id===id);if(!obj)return false;
 const check=checkHome(obj.prefab,x,y,S.homeRotation,id);
 if(!check.ok){toast(check.reason);return false;}
 const before={...obj};Object.assign(obj,{x:check.x,y:check.y,rotation:check.rotation,variant:S.homeVariant,plot:plotForCell(Math.round(check.x/T),Math.round(check.y/T))||'base'});
 S.homeUndo={kind:'move',before};S.homeAction='place';S.homeMovingId=null;
 rebuildHomeWorld();save();
 if(isHomeNativePath(obj.prefab))refreshNativeHomeGround();
 renderUi();toast('ย้าย '+HOME_ITEMS[obj.prefab].name+' ฟรี');return true;
}
function demolishHome(id){
 if(!S.homeOpen||S.night||S.homeGroundBusy)return false;
 const index=S.homeBuilder.placedObjects.findIndex(o=>o.id===id);if(index<0)return false;
 const obj=S.homeBuilder.placedObjects.splice(index,1)[0];
 const refund=refundHome(obj.spent);
 for(const [key,qty] of Object.entries(refund))S.inventory[key]=(S.inventory[key]||0)+qty;
 S.homeUndo={kind:'demolish',obj:{...obj},refund};
 if(S.homeMovingId===id){S.homeMovingId=null;S.homeAction='place';}
 if(S.homeSelectedId===id)S.homeSelectedId=null;
 rebuildHomeWorld();save();
 if(isHomeNativePath(obj.prefab))refreshNativeHomeGround();
 renderUi();toast('รื้อแล้ว · คืนวัตถุดิบประมาณ 75%');return true;
}
function undoHome(){
 const action=S.homeUndo;if(!action||S.night||S.homeGroundBusy)return false;
 const nativePathChanged=isHomeNativePath(action.kind==='move'?action.before.prefab:action.obj?.prefab);
 if(action.kind==='recover'){
  const index=S.homeBuilder.placedObjects.findIndex(o=>o.id===action.obj.id);if(index<0)return false;
  S.homeBuilder.placedObjects.splice(index,1);S.homeBuilder.recovery.push(action.original);
 }else if(action.kind==='place'){
  const id=action.obj.id,index=S.homeBuilder.placedObjects.findIndex(o=>o.id===id);
  if(index<0)return false;
  const [obj]=S.homeBuilder.placedObjects.splice(index,1);
  for(const [key,n] of Object.entries(obj.spent))S.inventory[key]=(S.inventory[key]||0)+n;
  S.gold+=HOME_ITEMS[obj.prefab].gold;
 }else if(action.kind==='move'){
  const current=S.homeBuilder.placedObjects.find(o=>o.id===action.before.id);
  if(!current)return false;
  const check=checkHome(action.before.prefab,action.before.x,action.before.y,action.before.rotation,current.id);
  if(!check.ok){toast('คืนตำแหน่งเดิมไม่ได้: '+check.reason);return false;}
  Object.assign(current,action.before);
 }else{
  const obj=action.obj,check=checkHome(obj.prefab,obj.x,obj.y,obj.rotation);
  if(!check.ok||Object.entries(action.refund).some(([key,n])=>(S.inventory[key]||0)<n)){
   toast('Undo ไม่ได้: พื้นที่หรือวัตถุดิบที่คืนไปไม่พร้อมแล้ว');return false;
  }
  for(const [key,n] of Object.entries(action.refund))S.inventory[key]-=n;
  S.homeBuilder.placedObjects.push(obj);
 }
 S.homeUndo=null;rebuildHomeWorld();save();
 if(nativePathChanged)refreshNativeHomeGround();
 renderUi();toast('ย้อนการกระทำล่าสุดแล้ว');return true;
}
function setHomeOpen(open){
 if(!open&&S.homeGroundBusy){toast('กำลังสร้างพื้นจาก Map Editor กรุณารอสักครู่');return;}
 if(!open&&S.homeTerrainDraft&&quoteHomeTerrain(S.homeBuilder.terrainEdits,S.homeTerrainDraft).changes&&
  !confirm('มีร่าง Terrain ที่ยังไม่ได้ยืนยัน ต้องการทิ้งร่างหรือไม่?'))return;
 if(open&&S.night){toast('Home Builder เปิดได้เฉพาะกลางวัน');return;}
 S.homeOpen=!!open;S.homeHover=null;S.homeSelectedId=null;S.homeAction='place';S.homeMovingId=null;S.homeStoredId=null;S.homeTerrainDraft=null;S.homeWallPreview=null;S.homeWallPreviewData=null;
 if(open){S.modal=null;S.itemDetailId=null;S.building=false;S.movingTower=-1;S.movingMagicCart=-1;if(ctx.mobileDrawer())closeMobileDrawer();}
 renderUi();
}

// Phase 2: land ownership and fixed wall layouts are separate purchases.
function buyHomePlot(id){
 const plot=HOME_PLOTS[id];
 if(!plot||S.night||S.homeBuilder.ownedPlots.includes(id))return false;
 if(plot.side===HOME_NORTH_FINAL&&!S.homeBuilder.expandedSides.includes('north')){
  toast('ต้องซื้อและขยายกำแพงเหนือช่วงแรกก่อน');return false;
 }
 if(S.gold<HOME_PLOT_COST.gold||matCount()<HOME_PLOT_COST.mats){
  toast('ซื้อ Plot ต้องใช้ '+HOME_PLOT_COST.gold+' Gold + '+HOME_PLOT_COST.mats+' วัตถุดิบ');return false;
 }
 if(!spendMats(HOME_PLOT_COST.mats))return false;
 S.gold-=HOME_PLOT_COST.gold;
 S.homeBuilder.ownedPlots.push(id);
 S.homeUndo=null;save();renderUi();toast('ซื้อ Plot '+HOME_SIDE_NAMES[plot.side]+' #'+plot.index+' แล้ว · ยังอยู่นอกกำแพง');return true;
}
function previewHomeWall(side){
 if(!HOME_EXPANSION_STAGES.includes(side)||!fullyOwnedSide(S.homeBuilder,side)||S.homeBuilder.expandedSides.includes(side)||!S.wallLevel)return null;
 if(side===HOME_NORTH_FINAL&&!S.homeBuilder.expandedSides.includes('north'))return null;
 const future={...S.homeBuilder,expandedSides:[...S.homeBuilder.expandedSides,side]};
 const blueprint=homePerimeterBlueprint(S.wallLevel,future);
 const current=new Set(S.fences.map(f=>f.axis+':'+f.x+':'+f.y));
 const added=blueprint.filter(f=>!current.has(f.axis+':'+f.x+':'+f.y));
 // Candidate geometry must be actually walkable and free of towers and player decorations.
 const oldColliders=WS.colliders;
 if(homeRuntimeReady)WS.colliders=oldColliders.filter(c=>!c.bcFenceId);
 try{
  for(const f of added){
   const p=perimeterMid(f,T);
   if(homeRuntimeReady&&!standable(p.x,p.y))return {ok:false,reason:'แนวกำแพงใหม่ตัดผ่าน Terrain ที่เดินไม่ได้',blueprint};
   if(defenseStructures().some(o=>dist(p,o)<45))return {ok:false,reason:'มีป้อมหรือรถเวทย์ทับแนวกำแพงใหม่',blueprint};
   if([...S.units.filter(o=>!o.down),...S.monsters.filter(o=>!o.dead)].some(o=>dist(p,o)<32))return {ok:false,reason:'มีตัวละครยืนบนแนวกำแพงใหม่',blueprint};
   if(S.homeBuilder.placedObjects.some(o=>HOME_ITEMS[o.prefab]?.radius&&dist(p,o)<HOME_ITEMS[o.prefab].radius+8))
    return {ok:false,reason:'มีของตกแต่งขวางแนวกำแพงใหม่',blueprint};
  }
 }finally{WS.colliders=oldColliders;}
 const routes=validateHomeTerrainBatch(future,S.homeBuilder.terrainEdits,{...homeTerrainContext(),walls:blueprint});
 if(!routes.ok)return {ok:false,reason:'แนวกำแพงใหม่ไม่มีเส้นทาง: '+routes.reason,blueprint};
 return {ok:true,blueprint,layoutId:homeWallLayoutId(future),cost:HOME_WALL_COST};
}
function expandHomeWall(side){
 if(S.night)return false;
 const proposal=previewHomeWall(side);
 if(!proposal?.ok){toast(proposal?.reason||'ต้องซื้อ Plot ทั้งสามแปลงของทิศนี้และสร้างกำแพงก่อน');return false;}
 if(S.gold<HOME_WALL_COST.gold||matCount()<HOME_WALL_COST.mats){toast('วัสดุสำหรับย้ายกำแพงไม่พอ');return false;}
 if(!spendMats(HOME_WALL_COST.mats))return false;
 S.gold-=HOME_WALL_COST.gold;
 S.homeBuilder.expandedSides.push(side);
 S.fences=reconcileHomeWall(S.wallLevel,S.homeBuilder,S.fences);
 S.homeBuilder.wallLayoutId=proposal.layoutId;
 S.homeWallPreview=null;S.homeWallPreviewData=null;S.homeUndo=null;
 rebuildPerimeter();save();renderUi();
 toast(side===HOME_NORTH_FINAL?'ถึงหน้าผาเหนือแล้ว · ถอดกำแพงเหนือและใช้หน้าผาระดับ 3 ปิดทางแทน':'ขยายกำแพงทาง'+HOME_SIDE_NAMES[side]+'เรียบร้อย · ประตูสามด้านยังใช้งานได้');return true;
}

// Phase 3: paint a reversible draft, validate the whole result, then re-bake
// the real Dimraeth terrain once. No rebuilding meshes or nav during a drag.
function homeTerrainContext(){
 return {decorations:S.homeBuilder.placedObjects.map(o=>({...o,radius:HOME_ITEMS[o.prefab]?.radius||0})),
  defenses:defenseStructures(),walls:S.fences};
}
function paintHomeTerrain(x,y){
 if(!S.homeOpen||S.night||S.homeAction!=='terrain')return false;
 const i=Math.round(x/T),j=Math.round(y/T);
 const draft=S.homeTerrainDraft??S.homeBuilder.terrainEdits.map(e=>({...e}));
 const next=applyHomeTerrainBrush(draft,i,j,S.homeTerrainBrush);
 if(!next){S.homeTerrainNotice='เลือกพู่กันไม่ถูกต้อง';renderUi();return false;}
 const check=validateHomeTerrainBatch(S.homeBuilder,next,homeTerrainContext());
 if(!check.ok){S.homeTerrainNotice=check.reason;renderUi();return false;}
 S.homeTerrainDraft=next;S.homeTerrainNotice='';
 renderUi();return true;
}
function commitHomeTerrain(){
 if(S.night||!S.homeOpen||!S.homeTerrainDraft)return false;
 const check=validateHomeTerrainBatch(S.homeBuilder,S.homeTerrainDraft,homeTerrainContext());
 if(!check.ok){S.homeTerrainNotice=check.reason;renderUi();return false;}
 const terrainCost=quoteHomeTerrain(S.homeBuilder.terrainEdits,S.homeTerrainDraft);
 const newCurtains=deriveHomeNorthCurtains(S.homeBuilder,S.homeTerrainDraft);
 const oldCurtains=deriveHomeNorthCurtains(S.homeBuilder,S.homeBuilder.terrainEdits);
 const landmarkCost=quoteNewHomeNorthCurtains(oldCurtains,newCurtains);
 const cost={mats:terrainCost.mats+landmarkCost.mats,gold:terrainCost.gold+landmarkCost.gold};
 if(!terrainCost.changes)return false;
 if(S.gold<cost.gold||matCount()<cost.mats){S.homeTerrainNotice='Gold หรือวัตถุดิบไม่พอ (รวมค่าม่านน้ำตกใหม่)';renderUi();return false;}
 if(!spendMats(cost.mats))return false;
 S.gold-=cost.gold;
 S.homeBuilder.terrainEdits=S.homeTerrainDraft.map(e=>({...e}));
 S.homeBuilder.rivers=deriveHomeRivers(S.homeBuilder.terrainEdits);
 const valid=[];
 for(const fall of S.homeBuilder.waterfalls){
  if(fall.type==='north-curtain'||fall.sourceTile?.j===2)continue;
  const test=makeHomeWaterfall(S.homeBuilder,fall.sourceTile,S.homeBuilder.terrainEdits);
  if(test.ok)valid.push(test.waterfall);
  else S.homeBuilder.recovery.push({type:'waterfall',data:fall,reason:test.reason});
 }
 S.homeBuilder.waterfalls=[...valid,...newCurtains];
 S.homeTerrainDraft=null;S.homeAction='place';S.homeUndo=null;S.homeTerrainNotice='';
 save();
 refreshHomeTerrainLive();
 return true;
}
// Re-bake cliffs, water, trees, colliders and ground in place; game walls/houses/towers stay.
// If the live rebuild ever fails, fall back to the old full reload (the save is already written).
function refreshHomeTerrainLive(){
 S.homeGroundBusy=true;renderUi();
 homeGroundRefresh=homeGroundRefresh.catch(()=>{}).then(async()=>{
  const scene=sceneFromMap(buildMap(WS.scene?.biome||currentStage.biome,S.homeBuilder));
  if(!await rebuildRuntimeTerrain(scene))throw Error('Terrain runtime not initialized');
  rebuildPerimeter();   // re-seat wall z/colliders on the new ground, push actors out of new cliffs
  rebuildHomeWorld();
  toast('สร้าง Terrain เรียบร้อย');
 }).catch(error=>{
  console.error('[home-builder] live terrain rebuild failed',error);
  location.reload();
 }).finally(()=>{S.homeGroundBusy=false;renderUi();});
 return homeGroundRefresh;
}
function createHomeWaterfall(x,y){
 if(S.night||!S.homeOpen||S.homeAction!=='waterfall')return false;
 const source={i:Math.round(x/T),j:Math.round(y/T)};
 if(homeAtNorthernCliff(S.homeBuilder)&&source.j===3)source.j=2;
 if(isNorthCliffCrest(S.homeBuilder,source.i,source.j)){
  toast('ม่านน้ำตกธรรมชาติสร้างอัตโนมัติ: วาดน้ำบนสันหน้าผา บ่อ และแม่น้ำ แล้วกดยืนยัน Terrain');
  return false;
 }
 const check=makeHomeWaterfall(S.homeBuilder,source,S.homeBuilder.terrainEdits);
 if(!check.ok){toast(check.reason);return false;}
 if(S.homeBuilder.waterfalls.some(w=>w.sourceTile.i===source.i&&w.sourceTile.j===source.j)){toast('จุดนี้มีน้ำตกอยู่แล้ว');return false;}
 const fee={gold:35,mats:60};
 if(S.gold<fee.gold||matCount()<fee.mats){toast('น้ำตกต้องใช้ 35 Gold + 60 วัตถุดิบ');return false;}
 if(!spendMats(fee.mats))return false;
 S.gold-=fee.gold;S.homeBuilder.waterfalls.push(check.waterfall);
 S.homeAction='place';S.homeUndo=null;save();renderUi();
 toast('ปลดน้ำตกเรียบร้อย · บันทึกต้นน้ำ ขอบเนิน บ่อรับน้ำ และแม่น้ำแล้ว');return true;
}

function restoreRecoveryHome(x,y){
 if(!S.homeOpen||S.night||S.homeGroundBusy||!S.homeStoredId)return false;
 const idx=S.homeBuilder.recovery.findIndex(o=>o.id===S.homeStoredId&&HOME_ITEMS[o.prefab]);
 if(idx<0)return false;
 const original=S.homeBuilder.recovery[idx],check=checkHome(original.prefab,x,y,S.homeRotation);
 if(!check.ok){toast(check.reason);return false;}
 const id=S.homeBuilder.placedObjects.some(o=>o.id===original.id)?'decor-'+S.homeBuilder.nextId++:original.id;
 const serial=Number(id.match(/^decor-(\d+)$/)?.[1]);
 if(Number.isSafeInteger(serial))S.homeBuilder.nextId=Math.max(S.homeBuilder.nextId,serial+1);
 const spent=Object.fromEntries(Object.entries(original.spent||{}).filter(([key,n])=>CONSTRUCTION_MATERIAL_IDS.includes(key)&&Number.isInteger(n)&&n>0&&n<=1000));
 const obj={id,prefab:original.prefab,x:check.x,y:check.y,rotation:check.rotation,variant:S.homeVariant,plot:plotForCell(Math.round(check.x/T),Math.round(check.y/T))||'base',spent,
  solid:!!HOME_ITEMS[original.prefab].radius,createdVersion:'0.6.0'};
 S.homeBuilder.recovery.splice(idx,1);S.homeBuilder.placedObjects.push(obj);
 S.homeUndo={kind:'recover',obj:{...obj},original};S.homeStoredId=null;S.homeAction='place';
 rebuildHomeWorld();save();
 if(isHomeNativePath(obj.prefab))refreshNativeHomeGround();
 renderUi();toast('กู้คืนของตกแต่งแล้ว โดยไม่เสียทรัพยากรเพิ่ม');return true;
}


 return {refreshNativeHomeGround,checkHome,safeHomeArt,homeThumb,homeObjectAt,editSelectedHome,rebuildHomeWorld,restoreHomeWorld,placeHome,moveHome,demolishHome,undoHome,setHomeOpen,buyHomePlot,previewHomeWall,expandHomeWall,homeTerrainContext,paintHomeTerrain,commitHomeTerrain,createHomeWaterfall,restoreRecoveryHome,
  waitHomeGround:()=>homeGroundRefresh};
}
