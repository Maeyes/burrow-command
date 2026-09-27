// One-button, automatically placed perimeter. No hand-painted wall pieces or starter walls.
// Three selectable gates (S/E/W) and a solid north wall. At most two may close at night,
// so players can funnel night raiders through ONE or TWO open approaches.
export const GATE_SIDES=Object.freeze(['south','east','west']);
export const MAX_CLOSED_GATES=2;
export function normalizeGateSelections(sides){
 return [...new Set(Array.isArray(sides)?sides:[])].filter(side=>GATE_SIDES.includes(side)).slice(0,MAX_CLOSED_GATES);
}
export const gateShouldClose=(f,night,selected)=>f?.kind==='gate'&&f.hp>0&&!!night&&selected.includes(f.side);
export function toggleGateSelection(sides,side){
 const current=normalizeGateSelections(sides);
 if(!GATE_SIDES.includes(side))return null;
 if(current.includes(side))return current.filter(x=>x!==side);
 return current.length<MAX_CLOSED_GATES?[...current,side]:null;
}
export const PERIMETER_TIERS=Object.freeze([
 {level:0,radius:0,cost:0,sectionHp:0,material:'none'},
 {level:1,radius:7.5,cost:160,sectionHp:55,gateHp:240,material:'wood'},
 {level:2,radius:7.5,cost:300,sectionHp:85,gateHp:360,material:'stone'},
 {level:3,radius:7.5,cost:480,sectionHp:125,gateHp:500,material:'stone',reinforced:true},
 {level:4,radius:7.5,cost:700,sectionHp:170,gateHp:680,material:'stone',reinforced:true},
 {level:5,radius:7.5,cost:950,sectionHp:220,gateHp:880,material:'stone',reinforced:true},
 {level:6,radius:7.5,cost:1250,sectionHp:280,gateHp:1120,material:'stone',reinforced:true},
 {level:7,radius:7.5,cost:1600,sectionHp:350,gateHp:1400,material:'stone',reinforced:true},
 {level:8,radius:7.5,cost:2000,sectionHp:430,gateHp:1720,material:'stone',reinforced:true},
 {level:9,radius:7.5,cost:2450,sectionHp:520,gateHp:2080,material:'stone',reinforced:true},
 {level:10,radius:7.5,cost:3000,sectionHp:620,gateHp:2480,material:'stone',reinforced:true},
]);
export const perimeterTier=level=>PERIMETER_TIERS[Math.max(0,Math.min(PERIMETER_TIERS.length-1,Math.floor(level||0)))];
export const nextPerimeterTier=level=>PERIMETER_TIERS[Math.min(PERIMETER_TIERS.length-1,Math.max(0,Math.floor(level||0))+1)]||PERIMETER_TIERS.at(-1);
export const perimeterFootprint=level=>{
 const r=perimeterTier(level).radius;
 return {side:r*2,halfSide:r,worldSide:r*2*64};
};
/** Half-tile origin keeps an odd-size square centered exactly on the Warren. Three-tile OPEN arch on each side. */
export function perimeterBlueprint(level,cx=20,cy=20){
 const cfg=perimeterTier(level);if(!cfg.radius)return [];
 const r=cfg.radius,solid=[];
 const add=(axis,x,y,kind='fence',len=1)=>{
  solid.push({axis,x,y,kind,len,material:cfg.material,...(cfg.reinforced?{reinforced:true}:{}),
   tier:cfg.level,
   ...(kind==='gate'?{side:axis==='x'?'south':x<cx?'west':'east'}:{}),
   hp:kind==='gate'?cfg.gateHp:cfg.sectionHp,maxHp:kind==='gate'?cfg.gateHp:cfg.sectionHp});
 };
 const left=cx-r,right=cx+r,top=cy-r,bottom=cy+r;
 // NORTH stays solid; SOUTH/EAST/WEST each have a centered three-tile gate.
 const gateIndex=Math.floor(r*2/2)-1;
 for(let i=0;i<r*2;i++)add('x',left+i,top);
 for(let i=0;i<r*2;i++)if(i<gateIndex||i>=gateIndex+3)add('x',left+i,bottom);
 add('x',left+gateIndex,bottom,'gate',3);
 for(const x of [left,right]){
  for(let i=0;i<r*2;i++)if(i<gateIndex||i>=gateIndex+3)add('y',x,top+i);
  add('y',x,top+gateIndex,'gate',3);
 }
 return solid;
}
export const perimeterHealth=sections=>(sections||[]).filter(f=>f.kind==='fence'||f.kind==='gate').reduce((a,f)=>({hp:a.hp+Math.max(0,Math.min(f.maxHp||0,f.hp||0)),maxHp:a.maxHp+(f.maxHp||0),damaged:a.damaged+(f.hp<f.maxHp?1:0),broken:a.broken+(f.hp<=0?1:0)}),{hp:0,maxHp:0,damaged:0,broken:0});
/** Use midpoints consistently for the same 64-unit sections drawn by the engine. */
export const perimeterMid=(f,tile=64)=>({x:(f.x+(f.axis==='x'?(f.len||1)/2:0))*tile,y:(f.y+(f.axis==='y'?(f.len||1)/2:0))*tile});
export function nearestPerimeterSection(position,sections,maxDistance=Infinity){
 let chosen=null,best=maxDistance;
 for(const f of sections||[]){if(f.kind!=='fence'||f.hp<=0)continue;
  const p=perimeterMid(f),d=Math.hypot(p.x-position.x,p.y-position.y);
  if(d<best){chosen=f;best=d;}
 }
 return chosen;
}
