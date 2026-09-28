import {perimeterTier,perimeterBlueprint} from './warren-perimeter.js';
// The existing 40x40 world has two five-tile bands north of the old 15x15 base.
// The final northern row ends at a permanent level-3 cliff at world y=2.5.
export const HOME_SIDES=Object.freeze(['south','east','west','north']);
export const HOME_NORTH_FINAL='northUpper';
export const HOME_EXPANSION_STAGES=Object.freeze([...HOME_SIDES,HOME_NORTH_FINAL]);
export const HOME_SIDE_NAMES=Object.freeze({south:'ใต้',east:'ตะวันออก',west:'ตะวันตก',north:'เหนือ · ช่วงแรก',northUpper:'เหนือ · ช่วงสุดท้าย'});
export const HOME_NORTH_CLIFF=Object.freeze({level:3,lastHighRow:2,edgeY:2.5,minX:0,maxX:39});
const segments=[[13,17],[18,22],[23,27]];
export const HOME_PLOTS=Object.freeze(Object.fromEntries(HOME_EXPANSION_STAGES.flatMap(side=>segments.map(([a,b],i)=>{
 const bounds=side==='south'?{x0:a,x1:b,y0:28,y1:32}:
  side==='north'?{x0:a,x1:b,y0:8,y1:12}:
  side===HOME_NORTH_FINAL?{x0:a,x1:b,y0:3,y1:7}:
  side==='east'?{x0:28,x1:32,y0:a,y1:b}:{x0:8,x1:12,y0:a,y1:b};
 return [side+(i+1),{id:side+(i+1),side,index:i+1,bounds}];
}))));
export const HOME_PLOT_COST=Object.freeze({gold:85,mats:90});
export const HOME_WALL_COST=Object.freeze({gold:240,mats:500});
export const sidePlots=side=>HOME_EXPANSION_STAGES.includes(side)?[1,2,3].map(i=>side+i):[];
export const fullyOwnedSide=(home,side)=>sidePlots(side).length===3&&sidePlots(side).every(id=>home?.ownedPlots?.includes(id));
export const wallSides=home=>HOME_EXPANSION_STAGES.filter(s=>home?.expandedSides?.includes(s)&&fullyOwnedSide(home,s)&&(s!==HOME_NORTH_FINAL||home?.expandedSides?.includes('north')));
export const homeAtNorthernCliff=home=>wallSides(home).includes(HOME_NORTH_FINAL);
export const homeWallLayoutId=home=>'base-15x15'+(wallSides(home).length?'-'+wallSides(home).join('-'):'');
export const homePerimeterBlueprint=(level,home)=>homeWallBlueprint(level,home,perimeterTier)??perimeterBlueprint(level);
export function homeOwnedCell(home,i,j){
 if(i>=14&&i<=26&&j>=14&&j<=26)return true;
 return Object.values(HOME_PLOTS).some(p=>home?.ownedPlots?.includes(p.id)&&i>=p.bounds.x0&&i<=p.bounds.x1&&j>=p.bounds.y0&&j<=p.bounds.y1);
}
export const plotForCell=(i,j)=>Object.values(HOME_PLOTS).find(p=>i>=p.bounds.x0&&i<=p.bounds.x1&&j>=p.bounds.y0&&j<=p.bounds.y1)?.id??null;
export function homeWallTiles(home){
 const cells=new Set();
 for(let x=13;x<=27;x++)for(let y=13;y<=27;y++)cells.add(x+','+y);
 for(const side of wallSides(home))for(let x=0;x<15;x++)for(let y=0;y<5;y++){
  const i=side==='east'?28+y:side==='west'?8+y:13+x;
  const j=side==='south'?28+y:side==='north'?8+y:side===HOME_NORTH_FINAL?3+y:13+x;
  cells.add(i+','+j);
 }
 return cells;
}
export const homeWallSegmentKey=f=>[f.axis,f.x,f.y,f.kind].join(':');
export function homeWallIntegrity(level,home,actual=[]){
 const expected=homePerimeterBlueprint(level,home),need=new Set(expected.map(homeWallSegmentKey)),have=new Set(actual.map(homeWallSegmentKey));
 return {expected:expected.length,actual:actual.length,
  missing:expected.filter(f=>!have.has(homeWallSegmentKey(f))).length,
  obsolete:actual.filter(f=>!need.has(homeWallSegmentKey(f))).length,
  broken:actual.filter(f=>f.hp<=0).length,
  gates:actual.filter(f=>f.kind==='gate').length};
}
export function reconcileHomeWall(level,home,actual=[]){
 const saved=new Map(actual.filter(f=>f&&['fence','gate'].includes(f.kind)).map(f=>[homeWallSegmentKey(f),f]));
 return homePerimeterBlueprint(level,home).map(f=>{
  const prior=saved.get(homeWallSegmentKey(f));
  return prior&&Number.isFinite(prior.hp)?{...f,hp:Math.max(0,Math.min(f.maxHp,Math.ceil(prior.hp)))}:f;
 });
}
export function homeWallBlueprint(level,home,tier){
 if(!level)return [];
 const sides=wallSides(home);
 if(!sides.length)return null; // preserve the exact original 54-part perimeter
 const cfg=tier(level),cells=homeWallTiles(home),has=(x,y)=>cells.has(x+','+y);
 const edges=[];
 const add=(axis,x,y,side)=>edges.push({axis,x,y,side});
 for(const key of cells){
  const [x,y]=key.split(',').map(Number);
  // Once the final north band meets the level-3 cliff, the solid rock replaces
  // the *entire* northern horizontal wall. Side walls end exactly at the cliff.
  if(!has(x,y-1)&&!(homeAtNorthernCliff(home)&&y===3))add('x',x-.5,y-.5,'north');
  if(!has(x,y+1))add('x',x-.5,y+.5,'south');
  if(!has(x-1,y))add('y',x-.5,y-.5,'west');
  if(!has(x+1,y))add('y',x+.5,y-.5,'east');
 }
 const gatePoint=(side,edge)=>{
  const end=side==='south'?(sides.includes('south')?32.5:27.5):
   side==='east'?(sides.includes('east')?32.5:27.5):(sides.includes('west')?7.5:12.5);
  return side==='south'?edge.axis==='x'&&edge.y===end&&edge.x>=18.5&&edge.x<21.5:
   side==='east'?edge.axis==='y'&&edge.x===end&&edge.y>=18.5&&edge.y<21.5:
   edge.axis==='y'&&edge.x===end&&edge.y>=18.5&&edge.y<21.5;
 };
 const make=(edge,kind='fence',len=1)=>({
  axis:edge.axis,x:edge.x,y:edge.y,kind,len,material:cfg.material,
  ...(cfg.reinforced?{reinforced:true}:{}),tier:cfg.level,
  ...(kind==='gate'?{side:edge.side}:{}),
  hp:kind==='gate'?cfg.gateHp:cfg.sectionHp,
  maxHp:kind==='gate'?cfg.gateHp:cfg.sectionHp
 });
 const fences=edges.filter(e=>!['south','east','west'].some(s=>gatePoint(s,e))).map(e=>make(e));
 for(const side of ['south','east','west']){
  const group=edges.filter(e=>gatePoint(side,e)).sort((a,b)=>a.axis==='x'?a.x-b.x:a.y-b.y);
  if(group.length!==3)throw Error('unsafe-wall-layout:'+side);
  fences.push(make(group[0],'gate',3));
 }
 return fences.sort((a,b)=>a.axis.localeCompare(b.axis)||a.x-b.x||a.y-b.y);
}
