// Authoritative Home Builder terrain data. Paint batches are validated before
// committing; engine re-bakes ground from these edits on the next scene reload.
import {homeOwnedCell,homeWallTiles,wallSides,homeAtNorthernCliff,HOME_NORTH_CLIFF,HOME_NORTH_FINAL} from './warren-home-land.js';
export const HOME_TERRAIN_BRUSHES=Object.freeze({
 grass:{name:'พื้นหญ้า',icon:'🌿',mats:2,gold:2},
 dirt:{name:'พื้นดิน',icon:'🟫',mats:2,gold:2},
 stone:{name:'ทางหิน',icon:'🪨',mats:3,gold:2},
 sand:{name:'พื้นทราย',icon:'🏜️',mats:3,gold:2},
 raise:{name:'ยกพื้นเป็นเนิน',icon:'⛰️',mats:25,gold:18},
 lower:{name:'ลดระดับพื้น',icon:'⬇️',mats:8,gold:5},
 water:{name:'วาดแม่น้ำ',icon:'💦',mats:20,gold:15},
 erase:{name:'คืนสภาพพื้นที่',icon:'↶',mats:2,gold:1}
});
const normalCell=(o)=>Number.isInteger(o?.i)&&Number.isInteger(o?.j)&&o.i>=3&&o.i<=35&&o.j>=3&&o.j<=35;
// North's 15 owned world-tile columns terminate at the permanent level-3 lip.
// The cliff itself is not walkable or a normal terrain-edit plot, but painting
// WATER on its lip is explicitly permitted once the final north wall is gone.
export const isNorthCliffCrest=(home,i,j)=>homeAtNorthernCliff(home)&&Number.isInteger(i)&&j===HOME_NORTH_CLIFF.lastHighRow&&i>=13&&i<=27&&homeOwnedCell(home,i,3);
const isCrestWater=(e)=>e?.j===HOME_NORTH_CLIFF.lastHighRow&&e.elevation===HOME_NORTH_CLIFF.level&&e.water===true&&e.ground==='grass';
export const terrainKey=(i,j)=>i+','+j;
export const terrainAt=(edits,i,j)=>edits?.find(o=>o.i===i&&o.j===j)??null;
const blank=(i,j)=>({i,j,ground:'grass',elevation:0,water:false});
export function applyHomeTerrainBrush(edits,i,j,brush){
 if(!HOME_TERRAIN_BRUSHES[brush])return null;
 if(j===HOME_NORTH_CLIFF.lastHighRow&&Number.isInteger(i)&&i>=13&&i<=27){
  if(brush!=='water'&&brush!=='erase')return null;
  const out=edits.filter(e=>e.i!==i||e.j!==j);
  if(brush==='water')out.push({i,j,ground:'grass',elevation:HOME_NORTH_CLIFF.level,water:true});
  return out;
 }
 if(!normalCell({i,j}))return null;
 const old=terrainAt(edits,i,j),next={...(old??blank(i,j))};
 if(brush==='raise')next.elevation=Math.min(2,next.elevation+1);
 else if(brush==='lower')next.elevation=Math.max(0,next.elevation-1);
 else if(brush==='water'){
  next.water=true;
  // The first basin row below the natural cliff cannot retain an accidental
  // raised-water height from an earlier hill edit (the water-top pedestals).
  if(j===3&&i>=13&&i<=27)next.elevation=0;
 }
 else if(brush==='erase')Object.assign(next,blank(i,j));
 else {next.ground=brush;next.water=false;}
 const out=edits.filter(e=>e.i!==i||e.j!==j);
 if(next.ground!=='grass'||next.elevation||next.water)out.push(next);
 return out;
}
export function normalizeHomeTerrain(raw,home){
 const edits=[];
 const seen=new Set();
 for(const e of Array.isArray(raw)?raw.slice(0,450):[]){
  const crest=isNorthCliffCrest(home,e?.i,e?.j)&&isCrestWater(e);
  if((!crest&&(!normalCell(e)||!homeOwnedCell(home,e.i,e.j)))||!['grass','dirt','stone','sand'].includes(e?.ground)||(!crest&&![0,1,2].includes(e.elevation))||typeof e.water!=='boolean'||seen.has(terrainKey(e.i,e.j))){
   if(e&&typeof e==='object')home.recovery.push({type:'terrain',data:e,reason:'terrain-outside-plot-or-corrupt'});
   continue;
  }
  seen.add(terrainKey(e.i,e.j));
  if(e.ground!=='grass'||e.elevation||e.water)edits.push({i:e.i,j:e.j,ground:e.ground,
   elevation:homeAtNorthernCliff(home)&&e.j===3&&e.i>=13&&e.i<=27&&e.water?0:e.elevation,water:e.water});
 }
 return edits;
}
const fixtures=[
 {x:20,y:20,r:2.2}, {x:16.2,y:17.4,r:1.5},{x:23.8,y:17.2,r:1.5},
 {x:23.2,y:23.4,r:1.2},{x:24.8,y:20.8,r:1},{x:17.2,y:22.6,r:1}
];
const protectedRoute=(i,j)=>(i>=19&&i<=21&&j>=19&&j<=33)||(j>=19&&j<=21&&i>=7&&i<=33);
export function validateHomeTerrainBatch(home,edits,{decorations=[],defenses=[],walls=[]}={}){
 if(!Array.isArray(edits)||edits.length>350)return {ok:false,reason:'แก้พื้นที่ได้สูงสุด 350 ช่อง'};
 const seen=new Set();
 const expanded=wallSides(home);
 for(const e of edits){
  const crest=isNorthCliffCrest(home,e?.i,e?.j);
  if((!crest&&(!normalCell(e)||!homeOwnedCell(home,e.i,e.j)))||seen.has(terrainKey(e.i,e.j)))return {ok:false,reason:'มีช่องที่ไม่ใช่ Plot ของผู้เล่น'};
  seen.add(terrainKey(e.i,e.j));
  if(crest){
   if(!isCrestWater(e))return {ok:false,reason:'สันหน้าผาเหนืออนุญาตเฉพาะน้ำระดับ 3'};
   continue; // no buildings/paths on the permanent impassable cliff
  }
  if(!['grass','dirt','stone','sand'].includes(e.ground)||![0,1,2].includes(e.elevation)||typeof e.water!=='boolean')return {ok:false,reason:'Terrain ไม่ถูกต้อง'};
  if(homeAtNorthernCliff(home)&&e.j===3&&e.i>=13&&e.i<=27&&e.water&&e.elevation!==0)
   return {ok:false,reason:'บ่อรับน้ำใต้หน้าผาต้องอยู่ระดับพื้นปกติ'};
  if(e.water&&e.elevation>0&&!expanded.includes('north'))return {ok:false,reason:'แหล่งน้ำบนเนินปลดเมื่อขยายกำแพงเหนือแล้ว'};
  if(e.elevation&&!expanded.includes('north'))return {ok:false,reason:'ต้องขยายกำแพงเหนือเพื่อสร้างเนิน'};
  if(e.elevation&&(e.j<3||e.j>12||e.j<8&&!expanded.includes(HOME_NORTH_FINAL)))return {ok:false,reason:'เนินสร้างได้เฉพาะพื้นที่เหนือที่ขยายถึงแล้ว'};
  if((e.water||e.elevation)&&protectedRoute(e.i,e.j))return {ok:false,reason:'ห้ามตัดเส้นทางหลักของกระต่าย'};
  if(fixtures.some(p=>Math.hypot(e.i-p.x,e.j-p.y)<p.r))return {ok:false,reason:'ไม่อนุญาตให้แก้ใต้สิ่งก่อสร้างหลัก'};
  if(decorations.some(p=>Math.hypot(e.i-p.x/64,e.j-p.y/64)<(p.radius||20)/64+.5))return {ok:false,reason:'มีของตกแต่งในบริเวณนี้'};
  if(defenses.some(p=>Math.hypot(e.i-p.x/64,e.j-p.y/64)<1.15))return {ok:false,reason:'ห้ามแก้ใต้ป้อมหรือรถเวทย์'};
  if(walls.some(f=>{
   // At the cliff's left/right cap, basin water touches the INNER edge of the
   // existing side wall but never crosses it. Do not block the two end tiles.
   if(homeAtNorthernCliff(home)&&e.water&&e.j>=3&&e.j<=7&&(e.i===13||e.i===27)&&
      f.axis==='y'&&Math.abs(f.x-(e.i===13?12.5:27.5))<.01)return false;
   return Math.hypot(e.i-(f.x+(f.axis==='x'?(f.len||1)/2:0)),e.j-(f.y+(f.axis==='y'?(f.len||1)/2:0)))<.85;
  }))return {ok:false,reason:'ห้ามแก้ใต้กำแพงและประตู ('+e.i+','+e.j+')'};
 }
 // World-tile connectivity: all THREE active gates must reach their protected
 // internal approach. The protected 3-wide corridors retain independent lanes.
 const bounds={south:expanded.includes('south')?32:27,east:expanded.includes('east')?32:27,west:expanded.includes('west')?8:13};
 const cells=homeWallTiles(home),water=new Set(edits.filter(e=>e.water||e.elevation).map(e=>terrainKey(e.i,e.j)));
 const occupied=new Set(decorations.filter(o=>o.radius).map(o=>terrainKey(Math.round(o.x/64),Math.round(o.y/64))));
 const walkable=(i,j)=>cells.has(terrainKey(i,j))&&!water.has(terrainKey(i,j))&&!occupied.has(terrainKey(i,j));
 const accessible=(start,goal)=>{
  const queue=[start],seen=new Set([terrainKey(...start)]);
  for(let n=0;n<queue.length;n++){
   const [i,j]=queue[n];
   if(i===goal[0]&&j===goal[1])return true;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const x=i+dx,y=j+dy,key=terrainKey(x,y);
    if(seen.has(key)||!walkable(x,y))continue;
    seen.add(key);queue.push([x,y]);
   }
  }
  return false;
 };
 for(const [start,goal] of [
  [[20,bounds.south],[20,23]],[[bounds.east,20],[23,20]],[[bounds.west,20],[17,20]]
 ])if(!walkable(...start)||!walkable(...goal)||!accessible(start,goal))return {ok:false,reason:'การแก้พื้นที่ตัดทางเข้าจากประตูสู่โพรง'};
 return {ok:true};
}
export function makeHomeWaterfall(home,source,edits){
 if(!wallSides(home).includes('north'))return {ok:false,reason:'ต้องซื้อ Plot เหนือครบและย้ายกำแพงก่อน'};
 const {i,j}=source||{};
 const natural=homeAtNorthernCliff(home)&&j===HOME_NORTH_CLIFF.lastHighRow;
 if(!Number.isInteger(i)||!Number.isInteger(j)||!(natural?isNorthCliffCrest(home,i,j):i>=15&&i<=25&&j>=8&&j<=9))return {ok:false,reason:'เลือกขอบเนินด้านเหนือ'};
 const at=(x,y)=>terrainAt(edits,x,y)||blank(x,y);
 const hill=[i-1,i,i+1].map(x=>natural?{elevation:HOME_NORTH_CLIFF.level,water:isCrestWater(at(x,j))}:at(x,j));
 if(hill.some(t=>t.elevation<1))return {ok:false,reason:'ต้องสร้างเนินต่อกัน 3 ส่วน'};
 if(!at(i,j).water||at(i,j+1).elevation!==0||![1,2].every(d=>at(i,j+d).water))
  return {ok:false,reason:'ต้นน้ำต้องอยู่บนเนิน และมีบ่อรับน้ำกับแม่น้ำต่อเนื่อง'};
 const path=[];for(let y=j+2;y<=12&&at(i,y).water;y++)path.push({i,j:y});
 if(!path.length)return {ok:false,reason:'แม่น้ำต้องไหลออกจากบ่อรับน้ำ'};
 const waterfall={sourceTile:{i,j},cliffTiles:hill.map((_,k)=>({i:i+k-1,j})),
  fallDirection:'south',basinTiles:[{i,j:j+1}],riverPath:path};
 return {ok:true,waterfall};
}
/** Permanent level-3 ridge across the entire northern map boundary.
 * Each original world tile contains four 16-unit terrain cells. World row 2
 * ends at subcell 9, while purchasable northern land begins at world row 3.
 * Authored level-3 crest-water tiles create the source directly, including
 * contiguous curtains. Water painted in row 3 is the lower catch basin; the
 * ridge and its collision geometry are never raised or rebuilt by the brush. */
// The permanent northern cliff is a pre-existing level-3 landform. Authoring
// source water must not create or raise another landform on top of the river.
// Old one-tile cliff waterfalls are migrated in place (no second charge).
export function migrateLegacyNorthCliffSources(home,rawWaterfalls=[]){
 if(!homeAtNorthernCliff(home))return home.terrainEdits;
 const known=new Set(home.terrainEdits.map(e=>terrainKey(e.i,e.j)));
 for(const fall of Array.isArray(rawWaterfalls)?rawWaterfalls:[]){
  const tiles=Array.isArray(fall?.sourceTiles)?fall.sourceTiles:[fall?.sourceTile];
  for(const tile of tiles){
   if(!isNorthCliffCrest(home,tile?.i,tile?.j))continue;
   const key=terrainKey(tile.i,tile.j);
   if(known.has(key))continue;
   known.add(key);
   home.terrainEdits.push({i:tile.i,j:tile.j,ground:'grass',elevation:HOME_NORTH_CLIFF.level,water:true});
  }
 }
 return home.terrainEdits;
}
// The native terrain renderer joins adjacent high-water cells into one face.
// Metadata describes the joined run for save/UI, not extra geometry or raised
// pedestals. All 15 owned crest tiles, including both end columns, are valid.
export function deriveHomeNorthCurtains(home,edits=[]){
 if(!homeAtNorthernCliff(home))return [];
 const at=(i,j)=>terrainAt(edits,i,j)||blank(i,j);
 const ready=[];
 for(let i=13;i<=27;i++){
  if(!isCrestWater(at(i,2))||at(i,3).elevation!==0||!at(i,3).water||!at(i,4).water)continue;
  ready.push(i);
 }
 const curtains=[];
 for(let p=0;p<ready.length;){
  let q=p+1;while(q<ready.length&&ready[q]===ready[q-1]+1)q++;
  const run=ready.slice(p,q),sources=run.map(i=>({i,j:2}));
  const riverPath=[];
  for(const i of run)for(let j=4;j<=12&&at(i,j).water;j++)riverPath.push({i,j});
  curtains.push({type:'north-curtain',sourceTile:{...sources[0]},sourceTiles:sources,
   cliffTiles:sources.map(s=>({...s})),fallDirection:'south',
   faceTiles:sources.map((s,k)=>({...s,cap:run.length===1?'single':k===0?'left':k===run.length-1?'right':'middle'})),
   basinTiles:run.map(i=>({i,j:3})),riverPath});
  p=q;
 }
 return curtains;
}
export function quoteNewHomeNorthCurtains(previous=[],next=[]){
 const old=new Set(previous.flatMap(w=>Array.isArray(w.sourceTiles)?w.sourceTiles.filter(s=>s.j===2).map(s=>s.i):
  w.sourceTile?.j===2?[w.sourceTile.i]:[]));
 const count=next.filter(w=>!w.sourceTiles.some(s=>old.has(s.i))).length;
 return {groups:count,mats:count*60,gold:count*35};
}

export function applyHomeNorthernCliff({level,road,forest,water},home,n=160){
 const last=(HOME_NORTH_CLIFF.lastHighRow*4+2); // j=2 occupies subcells 6..9
 for(let y=0;y<last;y++)for(let x=0;x<n;x++){
  const k=y*n+x;level[k]=HOME_NORTH_CLIFF.level;road[k]=0;forest[k]=1;water[k]=0;
 }
 if(!homeAtNorthernCliff(home))return;
 for(const e of home.terrainEdits||[]){
  if(!isNorthCliffCrest(home,e.i,e.j)||!isCrestWater(e))continue;
  for(let y=6;y<last;y++)for(let x=e.i*4-2;x<=e.i*4+1;x++)if(x>=0&&x<n)water[y*n+x]=1;
 }
}

export function applyHomeTerrainToArrays(arrays,edits,n=160){
 const {level,road,forest,water}=arrays;
 for(const e of edits||[]){
  if(!normalCell(e))continue;
  for(let y=e.j*4-2;y<=e.j*4+1;y++)for(let x=e.i*4-2;x<=e.i*4+1;x++){
   if(x<0||y<0||x>=n||y>=n)continue;
   const k=y*n+x;
   level[k]=e.elevation;water[k]=e.water?1:0;
   road[k]=e.water?0:e.ground==='stone'?1:e.ground==='dirt'?2:0;
   forest[k]=e.ground==='sand'?2:1; // sand-colored decal is drawn separately in forest maps
  }
 }
}

// Charge only changed fields relative to the committed map, never the
// contents of an abandoned preview. Restoration costs a small flat amount.
export function quoteHomeTerrain(current,next){
 const old=new Map((current||[]).map(e=>[terrainKey(e.i,e.j),e]));
 const future=new Map((next||[]).map(e=>[terrainKey(e.i,e.j),e]));
 let mats=0,gold=0,changes=0;
 for(const key of new Set([...old.keys(),...future.keys()])){
  const before=old.get(key)||{ground:'grass',elevation:0,water:false};
  const after=future.get(key)||{ground:'grass',elevation:0,water:false};
  if(before.ground===after.ground&&before.elevation===after.elevation&&before.water===after.water)continue;
  changes++;
  if(after.ground!==before.ground){const cost=HOME_TERRAIN_BRUSHES[after.ground];mats+=cost.mats;gold+=cost.gold;}
  if(after.elevation>before.elevation&&after.j!==HOME_NORTH_CLIFF.lastHighRow){const steps=after.elevation-before.elevation;mats+=25*steps;gold+=18*steps;}
  if(after.elevation<before.elevation){const steps=before.elevation-after.elevation;mats+=8*steps;gold+=5*steps;}
  if(after.water&&!before.water){mats+=20;gold+=15;}
  if(before.water&&!after.water){mats+=2;gold++;}
 }
 return {mats,gold,changes};
}
export function deriveHomeRivers(edits){
 const water=new Set((edits||[]).filter(e=>e.water).map(e=>terrainKey(e.i,e.j)));
 const rivers=[];
 while(water.size){
  const first=water.values().next().value,stack=[first],tiles=[];
  water.delete(first);
  while(stack.length){
   const key=stack.pop(),[i,j]=key.split(',').map(Number);
   tiles.push({i,j});
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const candidate=terrainKey(i+dx,j+dy);
    if(water.delete(candidate))stack.push(candidate);
   }
  }
  rivers.push({tiles:tiles.sort((a,b)=>a.j-b.j||a.i-b.i)});
 }
 return rivers;
}
