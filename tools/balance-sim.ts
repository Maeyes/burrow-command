// Balance sim: three player profiles fight every non-boss monster 1v1 at the monster's own level.
// Run: npm run balance   (env PROFILES=typical,invested; ENH_OFF / ENH_DEF try other enhance gains)
import { ArenaV2Adapter } from '../src/simulation/arenaAdapter';
import { createInitialCharacterV2, grantCharacterExpV2, allocateCharacterStatsV2, expToNextLevelV2, type CharacterStateV2 } from '../src/simulation/character';
import { MONSTERS_V2 } from '../src/simulation/monsterDataV2';
import { EQUIPMENT_MASTER_V2, equipmentTierForLevel } from '../src/simulation/itemMasterV2';
import { applyEquipmentCommand } from '../src/simulation/equipmentService';
import { monsterBaseExpV2 } from '../src/simulation/rewards';
import { MAP_ORDER_V2, mapTitleV2 } from '../src/simulation/mapNames';
import { ENHANCE_GAIN_V2 } from '../src/simulation/equipmentCombat';
if(process.env.ENH_OFF)ENHANCE_GAIN_V2.offensive=Number(process.env.ENH_OFF);if(process.env.ENH_DEF)ENHANCE_GAIN_V2.defensive=Number(process.env.ENH_DEF);
const ONLY=(process.env.PROFILES||'fresh,typical,invested').split(',') as Profile[];

type Profile='fresh'|'typical'|'invested';


function build(level:number,profile:Profile):CharacterStateV2{
  let c=createInitialCharacterV2('p');
  for(let l=1;l<level;l++)c=grantCharacterExpV2(c,expToNextLevelV2(l));
  const pts=c.unspentStatPoints;
  c=allocateCharacterStatsV2(c,{str:Math.floor(pts*.45),agi:Math.floor(pts*.2),vit:Math.floor(pts*.15),dex:pts-Math.floor(pts*.45)-Math.floor(pts*.2)-Math.floor(pts*.15)});
  if(profile==='fresh')return c;
  const tier=equipmentTierForLevel(level);
  const rarity=profile==='invested'?'rare':'normal';
  const pick=Object.values(EQUIPMENT_MASTER_V2).filter(t=>t.tier===tier&&(t.weaponFamily==='dagger'&&t.slot==='main'||(!t.weaponFamily&&t.slot!=='offhand'&&(t.role==='neutral'||t.role==='damage'))));
  for(const t of pick){
    const r=t.recipe;c={...c,gold:1e12,inventory:{...c.inventory,...Object.fromEntries([r.blueprintId,r.oreId,...r.materials.map(m=>m.itemId)].map(id=>[id,1e6]))}};
    const res=applyEquipmentCommand(c,{type:'craft',recipe:{templateId:t.id,slot:t.slot,blueprintId:r.blueprintId,oreId:r.oreId,oreQty:r.oreQty,materials:r.materials,gold:r.gold,baseGoldCost:t.baseGoldCost,baseCombat:t.baseCombat,setId:t.setId,requiredLevel:t.requiredLevel}},()=>0);
    c=res.state;const id=res.createdEquipmentId!;c.equipment.instances[id]={...c.equipment.instances[id],rarity};
    const target=t.slot==='accessoryLeft'&&c.equipment.equippedBySlot.accessoryLeft?'accessoryRight':undefined;
    try{c=applyEquipmentCommand(c,{type:'equip',equipmentId:id,targetSlot:target}).state}catch{}
  }
  const enh=profile==='invested'?level:Math.round(level*.6);
  const ref=profile==='invested'?(level>=60?15:level>=40?10:level>=20?5:0):(level>=50?7:level>=30?5:0);
  for(const slot of Object.keys(c.equipment.equippedBySlot)){if(!c.equipment.equippedBySlot[slot])continue;c.equipment.enhancementBySlot[slot]=enh;c.equipment.refinementBySlot[slot]=ref;}
  c.weaponMastery={...c.weaponMastery,dagger:{level:Math.min(50,Math.round(level*(profile==='invested'?.8:.5))),xp:0}};
  return c;
}

function fight(monId:string,profile:Profile,seed:number){
  const m=MONSTERS_V2[monId];let s=seed;const rng=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};
  const view:any={id:'m',monsterType:monId,x:30,y:0,hp:1,maxHp:1,dead:false};
  const sim=new ArenaV2Adapter({zoneId:m.mapId,player:{x:0,y:0} as any,monsters:[view],character:build(m.level,profile),random:rng});
  const p=sim.simulation.world.players.get(sim.playerId)!,mon=sim.simulation.world.monsters.get('m')!;mon.targetPlayerId=p.id;
  let t=0;while(t<120000&&mon.alive&&p.alive){try{sim.basicAttack('m')}catch{}sim.step(50);p.position={x:0,y:0};t+=50;}
  return{t:t/1000,hp:p.hp/p.maxHp,win:!mon.alive};
}

const rows:string[]=[];
for(const map of MAP_ORDER_V2){
  const mons=Object.values(MONSTERS_V2).filter(m=>m.mapId===map&&m.rank!=='boss');if(!mons.length)continue;
  for(const rank of ['normal','elite'] as const){
    const set=mons.filter(m=>m.rank===rank);if(!set.length)continue;
    const cells=ONLY.map(pr=>{const runs=set.flatMap(m=>[1,2,3].map(sd=>fight(m.id,pr,sd*97+m.level)));const wins=runs.filter(r=>r.win);
      const ttk=wins.length?wins.reduce((a,r)=>a+r.t,0)/wins.length:NaN,hp=wins.length?wins.reduce((a,r)=>a+r.hp,0)/wins.length:0;
      return `${(100*wins.length/runs.length).toFixed(0).padStart(3)}% win ${isNaN(ttk)?'  —  ':ttk.toFixed(1).padStart(5)+'s'} hp${(hp*100).toFixed(0).padStart(3)}%`;});
    const lv=`${Math.min(...set.map(m=>m.level))}-${Math.max(...set.map(m=>m.level))}`;
    const kpl=Math.round(set.reduce((a,m)=>a+expToNextLevelV2(m.level)/monsterBaseExpV2(m),0)/set.length);
    rows.push(`${mapTitleV2(map).padEnd(19)} ${rank.padEnd(6)} Lv${lv.padEnd(6)} kills/lv ${String(kpl).padStart(4)} | ${cells.join(' | ')}`);
  }
}
console.log(`${'map'.padEnd(19)} rank   level    kills/lv | ${ONLY.map(p=>p.padEnd(24)).join(' | ')}`);
console.log(rows.join('\n'));
