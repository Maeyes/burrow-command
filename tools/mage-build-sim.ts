// Mage stat-split comparison: same level, gear and cores; only the stat allocation changes.
// Run: npx tsx tools/mage-build-sim.ts [level]
import { ArenaV2Adapter } from '../src/simulation/arenaAdapter';
import { createInitialCharacterV2, grantCharacterExpV2, allocateCharacterStatsV2, expToNextLevelV2, type CharacterStateV2 } from '../src/simulation/character';
import { EQUIPMENT_MASTER_V2, equipmentTierForLevel } from '../src/simulation/itemMasterV2';
import { applyEquipmentCommand } from '../src/simulation/equipmentService';
import { applySkillCoreCommand } from '../src/simulation/skillCoreService';
import { MONSTERS_V2 } from '../src/simulation/monsterDataV2';

const LEVEL=Number(process.argv[2]||60);
type Split=Record<'str'|'agi'|'vit'|'int'|'dex'|'luk',number>;
const SPLITS:Record<string,Split>={
 'pure INT (90 INT / 10 DEX)':{str:0,agi:0,vit:0,int:.9,dex:.1,luk:0},
 'INT + ASPD (55 / 35 AGI / 10 DEX)':{str:0,agi:.35,vit:0,int:.55,dex:.1,luk:0},
 'INT + CRIT (55 / 35 LUK / 10 DEX)':{str:0,agi:0,vit:0,int:.55,dex:.1,luk:.35},
 'ASPD + CRIT (35 / 30 AGI / 30 LUK / 5 DEX)':{str:0,agi:.3,vit:0,int:.35,dex:.05,luk:.3},
};

function build(split:Split){
 let c:CharacterStateV2=createInitialCharacterV2('mage');
 for(let l=1;l<LEVEL;l++)c=grantCharacterExpV2(c,expToNextLevelV2(l));
 const pts=c.unspentStatPoints,alloc:any={};let used=0;
 for(const k of Object.keys(split) as (keyof Split)[]){alloc[k]=Math.floor(pts*split[k]);used+=alloc[k];}
 alloc.int+=pts-used;c=allocateCharacterStatsV2(c,alloc);
 const tier=equipmentTierForLevel(LEVEL);
 const pick=Object.values(EQUIPMENT_MASTER_V2).filter(t=>t.tier===tier&&(t.weaponFamily==='staff'&&t.slot==='main'||(!t.weaponFamily&&t.slot!=='offhand'&&(t.role==='neutral'||t.role==='damage'))));
 for(const t of pick){
  const r=t.recipe;c={...c,gold:1e12,inventory:{...c.inventory,...Object.fromEntries([r.blueprintId,r.oreId,...r.materials.map(m=>m.itemId)].map(id=>[id,1e6]))}};
  const res=applyEquipmentCommand(c,{type:'craft',recipe:{templateId:t.id,slot:t.slot,blueprintId:r.blueprintId,oreId:r.oreId,oreQty:r.oreQty,materials:r.materials,gold:r.gold,baseGoldCost:t.baseGoldCost,baseCombat:t.baseCombat,setId:t.setId,requiredLevel:t.requiredLevel}},()=>0);
  c=res.state;const target=t.slot==='accessoryLeft'&&c.equipment.equippedBySlot.accessoryLeft?'accessoryRight':undefined;
  try{c=applyEquipmentCommand(c,{type:'equip',equipmentId:res.createdEquipmentId!,targetSlot:target}).state}catch{}
 }
 c.inventory={...c.inventory,fireball:1,iceLance:1,chainLightning:1};
 c=applySkillCoreCommand(c,{type:'equipCore',coreId:'fireball',slot:0});
 c=applySkillCoreCommand(c,{type:'equipCore',coreId:'iceLance',slot:1});
 c=applySkillCoreCommand(c,{type:'equipCore',coreId:'chainLightning',slot:2});
 return c;
}

function dps(split:Split,seed:number){
 const mon=Object.values(MONSTERS_V2).filter(m=>m.rank==='normal').sort((a,b)=>Math.abs(a.level-LEVEL)-Math.abs(b.level-LEVEL))[0];
 let s=seed;const rng=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};
 const sim=new ArenaV2Adapter({zoneId:mon.mapId,player:{x:0,y:0} as any,monsters:[{id:'m',monsterType:mon.id,x:40,y:0,hp:1,maxHp:1,dead:false} as any],character:build(split),random:rng});
 const p:any=sim.simulation.world.players.get(sim.playerId)!,m:any=sim.simulation.world.monsters.get('m')!;
 m.hp=m.maxHp=1e9;m.atk=0;p.sp=1e9;p.maxSp=1e9;
 let dealt=0;const T=60000;
 for(let t=0;t<T;t+=50){
  for(const id of ['fireball','iceLance','chainLightning']){try{const r:any=sim.castSkill(id,'m');if(r?.accepted)for(const e of r.events)if(e.type==='damageDealt'&&e.targetId==='m')dealt+=e.amount;}catch{}}
  try{const r:any=sim.basicAttack('m');if(r?.accepted)for(const e of r.events)if(e.type==='damageDealt'&&e.targetId==='m')dealt+=e.amount;}catch{}
  const ev:any=sim.step(50);for(const e of (ev?.events??ev??[]))if(e?.type==='damageDealt'&&e.targetId==='m')dealt+=e.amount;
  p.position={x:0,y:0};m.position={x:40,y:0};
 }
 return{dps:dealt/(T/1000),mon:mon.name,stats:p.stats};
}
console.log(`Staff Lv${LEVEL}, cores Fireball / Ice Lance / Chain Lightning, no mods, 60s vs a dummy`);
const base=dps(SPLITS[Object.keys(SPLITS)[0]],7).dps;
for(const [name,split] of Object.entries(SPLITS)){
 const runs=[1,2,3].map(sd=>dps(split,sd*31));const avg=runs.reduce((a,r)=>a+r.dps,0)/runs.length;const st=runs[0].stats;
 console.log(`${name.padEnd(44)} DPS ${avg.toFixed(0).padStart(6)}  (${(avg/base*100).toFixed(0)}%)  INT ${st.int} AGI ${st.agi} LUK ${st.luk} DEX ${st.dex}`);
}
