// Safe Home Builder ownership layer. Phase 2 introduces purchased parcels and preset wall expansion.
import {HOME_PLOTS,HOME_EXPANSION_STAGES,HOME_NORTH_FINAL,HOME_PLOT_COST,HOME_WALL_COST,homeOwnedCell,plotForCell,fullyOwnedSide,homeWallLayoutId} from './warren-home-land.js';
export const HOME_TILE=64,HOME_VERSION=4,HOME_REFUND_RATE=.75;
const HOME_MATERIAL_IDS=new Set(['livingMoss','brutalSpore','copperOre','duneRunnerClaw','cactusSpine','moonstoneShard']);
export const HOME_CATEGORIES={paths:'ทางเดิน',nature:'ต้นไม้และพุ่ม',garden:'สวน',village:'ตกแต่ง',houses:'บ้านและอาคาร'};
export const HOME_ITEMS=Object.freeze({
 dirtPath:{name:'ทางเดินดิน',icon:'🟫',group:'paths',mats:1,gold:1},
 stonePath:{name:'ทางเดินหิน',icon:'🪨',group:'paths',mats:2,gold:2},
 oak:{name:'ต้นโอ๊กเล็ก',icon:'🌳',group:'nature',mats:5,gold:4,radius:16},
 pine:{name:'ต้นสนเล็ก',icon:'🌲',group:'nature',mats:5,gold:4,radius:16},
 blossom:{name:'ต้นไม้ดอก',icon:'🌸',group:'nature',mats:6,gold:5,radius:16},
 bush:{name:'พุ่มไม้',icon:'🌿',group:'nature',mats:2,gold:1},
 flowerBush:{name:'พุ่มดอกไม้',icon:'🌺',group:'nature',mats:3,gold:2},
 vegetable:{name:'แปลงผัก',icon:'🥬',group:'garden',mats:4,gold:3},
 flowerBed:{name:'แปลงดอกไม้',icon:'🌼',group:'garden',mats:4,gold:3},
 lantern:{name:'โคมไฟ',icon:'🏮',group:'village',mats:3,gold:3,radius:9},
 sign:{name:'ป้าย',icon:'🪧',group:'village',mats:2,gold:1,radius:9},
 bench:{name:'ม้านั่ง',icon:'🪑',group:'village',mats:4,gold:3,radius:13},
 hay:{name:'กองฟาง',icon:'🌾',group:'village',mats:3,gold:2},
 crate:{name:'ลังไม้',icon:'📦',group:'village',mats:2,gold:2,radius:12},
 barrel:{name:'ถังไม้',icon:'🛢️',group:'village',mats:2,gold:2,radius:11},
 pond:{name:'บ่อน้ำตกแต่ง',icon:'💧',group:'garden',mats:8,gold:7,radius:23},
 decoFence:{name:'รั้วตกแต่ง',icon:'🪵',group:'village',mats:3,gold:2,radius:16},
 farmerHouse:{name:'บ้านชาวสวน',icon:'🏡',group:'houses',mats:85,gold:65,radius:69},
 smithHouse:{name:'บ้านนักตีเหล็ก',icon:'⚒️',group:'houses',mats:110,gold:85,radius:70},
 mageHouse:{name:'บ้านนักเวท',icon:'🔮',group:'houses',mats:115,gold:95,radius:70},
 storeHouse:{name:'บ้านเก็บของ',icon:'📦',group:'houses',mats:95,gold:75,radius:70},
 barnHouse:{name:'โรงนา',icon:'🌾',group:'houses',mats:125,gold:95,radius:83},
 pavilion:{name:'ศาลาพัก',icon:'🏕️',group:'houses',mats:70,gold:55,radius:64}
});
export const defaultHomeBuilder=()=>({version:HOME_VERSION,ownedPlots:['base'],expandedSides:[],placedObjects:[],terrainEdits:[],rivers:[],waterfalls:[],wallLayoutId:'base-15x15',recovery:[],nextId:1});
export const snapHome=(x,y)=>({x:Math.round(x/HOME_TILE)*HOME_TILE,y:Math.round(y/HOME_TILE)*HOME_TILE});
const cell=x=>Math.round(x/HOME_TILE);
const distance=(x,y,p)=>Math.hypot(x-p.x,y-p.y);
// Keep a protected central spine to each of the only three night-invasion gates.
export const homeMainRoute=(x,y)=>{
 const i=cell(x),j=cell(y);
 return (i>=19&&i<=21&&j>=20&&j<=33)||(j>=19&&j<=21&&i>=7&&i<=33);
};
const fixtures=[
 {x:20*64,y:20*64,r:135}, // Hall
 {x:16.2*64,y:17.4*64,r:78},{x:23.8*64,y:17.2*64,r:78},
 {x:23.2*64,y:23.4*64,r:48},{x:24.8*64,y:20.8*64,r:45},
 {x:17.2*64,y:22.6*64,r:42} // existing well
];
const isOccupied=(items,x,y,prefab,ignoreId)=>items.some(o=>{
 if(o.id===ignoreId)return false;
 const other=HOME_ITEMS[o.prefab];
 if(!other)return false;
 if(o.x===x&&o.y===y)return true;
 const a=HOME_ITEMS[prefab];
 return (!!a.radius||!!other.radius)&&distance(x,y,o)<(a.radius||7)+(other.radius||7)+18;
});
export function validateHomePlacement(home,prefab,x,y,rotation=0,{canStand=null,defenses=[],ignoreId=null}={}){
 const item=HOME_ITEMS[prefab];if(!item)return {ok:false,reason:'ไม่พบแบบตกแต่ง'};
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isInteger(rotation)||rotation<0||rotation>3)return {ok:false,reason:'ตำแหน่งหรือทิศไม่ถูกต้อง'};
 const pos=snapHome(x,y),i=cell(pos.x),j=cell(pos.y);
 if(!homeOwnedCell(home,i,j))return {ok:false,reason:'อยู่นอก Plot ที่ซื้อแล้ว'};
 if(item.radius>32&&[[item.radius,0],[-item.radius,0],[0,item.radius],[0,-item.radius]].some(([dx,dy])=>!homeOwnedCell(home,Math.round((pos.x+dx)/64),Math.round((pos.y+dy)/64))))
  return {ok:false,reason:'อาคารต้องอยู่ภายใน Plot ที่ครอบครองทั้งหลัง'};
 if(fixtures.some(f=>distance(pos.x,pos.y,f)<f.r+(item.radius||8)))return {ok:false,reason:'ทับอาคารเดิม'};
 if(item.radius&&homeMainRoute(pos.x,pos.y))return {ok:false,reason:'ต้องเปิดทางเดินกว้างสามช่องให้ประตูทั้งสาม'};
 if(isOccupied(home.placedObjects||[],pos.x,pos.y,prefab,ignoreId))return {ok:false,reason:'ทับของตกแต่งเดิม'};
 if(defenses.some(p=>distance(pos.x,pos.y,p)<(p.radius||48)+(item.radius||12)))return {ok:false,reason:'ชนพื้นที่ป้อมหรือรถยิงเวทย์'};
 if(canStand&&!canStand(pos.x,pos.y,item.radius||8))return {ok:false,reason:'ติด Collider หรือพื้นที่เดินไม่ได้'};
 return {ok:true,...pos,rotation};
}
export function normalizeHomeBuilder(raw){
 const home=defaultHomeBuilder();if(!raw||typeof raw!=='object')return home;
 home.ownedPlots=['base',...new Set(Array.isArray(raw.ownedPlots)?raw.ownedPlots.filter(id=>Object.hasOwn(HOME_PLOTS,id)):[])];
 home.expandedSides=[...new Set(Array.isArray(raw.expandedSides)?raw.expandedSides:[])].filter(s=>HOME_EXPANSION_STAGES.includes(s)&&fullyOwnedSide(home,s)&&(s!==HOME_NORTH_FINAL||raw.expandedSides?.includes('north')&&fullyOwnedSide(home,'north')));
 home.wallLayoutId=homeWallLayoutId(home);
 home.nextId=Math.max(1,Math.min(10000000,Math.trunc(Number(raw.nextId)||1)));
 home.recovery=Array.isArray(raw.recovery)?raw.recovery.slice(0,150).filter(o=>o&&typeof o==='object'):[];
 const ids=new Set();
 for(const input of Array.isArray(raw.placedObjects)?raw.placedObjects.slice(0,500):[]){
  const id=String(input?.id||'').slice(0,60),prefab=String(input?.prefab||'');
  const x=input?.x,y=input?.y,rotation=input?.rotation;
  const check=validateHomePlacement(home,prefab,x,y,rotation);
  if(!id||ids.has(id)||!check.ok||x!==check.x||y!==check.y){
   home.recovery.push({id,prefab,x,y,rotation,variant:input?.variant,spent:input?.spent,reason:ids.has(id)?'duplicate-id':check.reason||'invalid-position'});continue;
  }
  ids.add(id);
  const numericId=Number(id.match(/^decor-(\d+)$/)?.[1]);
  if(Number.isSafeInteger(numericId))home.nextId=Math.max(home.nextId,numericId+1);
  home.placedObjects.push({id,prefab,x,y,rotation:check.rotation,variant:Number.isInteger(input.variant)?Math.max(0,Math.min(9,input.variant)):0,plot:plotForCell(cell(x),cell(y))||'base',solid:!!HOME_ITEMS[prefab].radius,createdVersion:String(input.createdVersion||'0.5.0').slice(0,20),spent:Object.fromEntries(Object.entries(input.spent||{}).filter(([k,v])=>HOME_MATERIAL_IDS.has(k)&&Number.isInteger(v)&&v>0&&v<=1000))});
 }
 home.recovery=home.recovery.slice(0,300);
 return home;
}
export function refundHome(spent){
 const parts=Object.entries(spent||{}).filter(([id,n])=>HOME_MATERIAL_IDS.has(id)&&Number.isInteger(n)&&n>0);
 const out=Object.fromEntries(parts.map(([id,n])=>[id,Math.floor(n*HOME_REFUND_RATE)]));
 let remainder=Math.floor(parts.reduce((n,[,qty])=>n+qty,0)*HOME_REFUND_RATE)-Object.values(out).reduce((n,qty)=>n+qty,0);
 for(const [id,qty] of parts.sort((a,b)=>(b[1]*HOME_REFUND_RATE)%1-(a[1]*HOME_REFUND_RATE)%1))if(remainder>0&&out[id]<qty){out[id]++;remainder--;}
 return Object.fromEntries(Object.entries(out).filter(([,n])=>n>0));
}
