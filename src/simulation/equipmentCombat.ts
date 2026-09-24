import type { CharacterStateV2, EquipmentCombatContributionV2 } from './character';
import { equipmentRarityStatMultiplier, masterRefinementBonus, progressionCategory } from './equipmentV2';
import { SET_DEFINITIONS_V2 } from './itemMasterV2';

export interface EquipmentCombatTotalsV2 {
  weaponAtk:number; weaponMatk:number; equipmentDef:number; equipmentMdef:number; equipmentMaxHp:number;
  critBonusPercent:number; equipmentAspd:number; hitBonus:number; fleeBonus:number;
  atkMultiplier:number; matkMultiplier:number; offhandAtkMultiplier:number; offhandMatkMultiplier:number; defMultiplier:number; mdefMultiplier:number; maxHpMultiplier:number;
  masterRefinement:0|5|10|15; masterMaxSp:number;
  maxSpMultiplier:number; spRecoveryMultiplier:number; healingMultiplier:number; skillCostMultiplier:number;
  expMultiplier:number; dropMultiplier:number;
  castSpeed:number; critDamageMultiplier:number; elementDamageMultiplier:number;
}

const KEYS:(keyof EquipmentCombatContributionV2)[]=['atk','matk','def','mdef','maxHp','crit','aspd','hit','flee'];
const PERCENT_AFFIXES:Record<string,keyof EquipmentCombatContributionV2>={atkPct:'atk',matkPct:'matk',defPct:'def',mdefPct:'mdef',hpPct:'maxHp'};
const DEFAULT_AFFIX_PERCENT=.03;
function add(out:EquipmentCombatContributionV2,source:EquipmentCombatContributionV2|undefined,multiplier=1){if(!source)return;for(const key of KEYS)out[key]=(out[key]??0)+(source[key]??0)*multiplier}

export function equipmentCombatTotals(state:CharacterStateV2):EquipmentCombatTotalsV2{
 const aggregate:EquipmentCombatContributionV2={};
 let offensiveRefinePercent=0,mainRefinePercent=0,offhandWeaponRefinePercent=0,defensiveRefinePercent=0,expBonus=0,dropBonus=0,utilityRefine=0;
 const qualifyingRefines:number[]=[];
 for(const [slot,id] of Object.entries(state.equipment.equippedBySlot)){
  if(!id)continue;
  const item=state.equipment.instances[id];if(!item)continue;
  const enhancement=state.equipment.enhancementBySlot[slot]??0;
  const refinement=state.equipment.refinementBySlot[slot]??0;
  qualifyingRefines.push(refinement);
  const category=progressionCategory(slot,item.offhandType);
  const itemStats:EquipmentCombatContributionV2={};add(itemStats,item.baseCombat,equipmentRarityStatMultiplier(item.rarity));
  for(const affix of item.affixes){
   const key=PERCENT_AFFIXES[affix];if(key)itemStats[key]=(itemStats[key]??0)*(1+DEFAULT_AFFIX_PERCENT);
   else if(affix==='crit')itemStats.crit=(itemStats.crit??0)+2;
   else if(affix==='aspd')itemStats.aspd=(itemStats.aspd??0)+1;
  }
  add(aggregate,itemStats);
  if(category==='offensive'){
   aggregate.atk=(aggregate.atk??0)+enhancement*2;aggregate.matk=(aggregate.matk??0)+enhancement*2;
   if(slot==='main')mainRefinePercent+=refinement*.005;
   else if(slot==='offhand'&&item.offhandType==='weapon')offhandWeaponRefinePercent+=refinement*.005;
   else offensiveRefinePercent+=refinement*.005;
  }else if(category==='defensive'){
   aggregate.def=(aggregate.def??0)+enhancement;aggregate.mdef=(aggregate.mdef??0)+enhancement;
   defensiveRefinePercent+=refinement*.005;
  }
  if(category==='utility'){
   if(slot==='hat')expBonus+=enhancement*.001;
   else if(slot==='face')dropBonus+=enhancement*.001;
   else if(slot==='mouth'){expBonus+=enhancement*.0005;dropBonus+=enhancement*.0005;}
   // Every utility refine level grants all four utility-combat stats.
   utilityRefine+=refinement*.3;
   aggregate.aspd=(aggregate.aspd??0)+refinement*.05;
  }
 }
 const setCounts=new Map<string,number>();for(const id of Object.values(state.equipment.equippedBySlot)){if(!id)continue;const setId=state.equipment.instances[id]?.setId;if(setId)setCounts.set(setId,(setCounts.get(setId)??0)+1)}
 let setAtkPercent=0,setMatkPercent=0,setDefPercent=0,setMdefPercent=0,setHpPercent=0,setCrit=0,setFlee=0;
 let setSpPercent=0,setSpRecoveryPercent=0,setHealingPercent=0,setSkillCostReduction=0;
 for(const set of SET_DEFINITIONS_V2){if((setCounts.get(set.id)??0)<set.requiredPieces)continue;
  if(set.role==='damage'){if(set.group==='body'){const p={2:.05,3:.07,4:.09,5:.10}[set.tier];setAtkPercent+=p;setMatkPercent+=p}else setCrit+={2:5,3:7,4:10,5:12}[set.tier]}
  else if(set.role==='tank'){if(set.group==='body'){setHpPercent+={2:.08,3:.10,4:.12,5:.15}[set.tier];const p={2:.05,3:.07,4:.08,5:.10}[set.tier];setDefPercent+=p;setMdefPercent+=p}else{setHpPercent+={2:.05,3:.07,4:.08,5:.10}[set.tier];if(set.tier>=4){const p=set.tier===4?.05:.06;setDefPercent+=p;setMdefPercent+=p}if(set.tier===3)setFlee+=5}}
  else if(set.role==='support'){if(set.group==='body'){setSpPercent+={2:.10,3:.12,4:.15,5:.20}[set.tier];setSpRecoveryPercent+={2:.10,3:.15,4:.20,5:.25}[set.tier];if(set.tier>=4)setSkillCostReduction+=.10}else{setSpPercent+={2:.08,3:.10,4:.10,5:0}[set.tier];setSpRecoveryPercent+={2:0,3:.10,4:.15,5:.15}[set.tier];setHealingPercent+={2:0,3:0,4:.10,5:.15}[set.tier]}}
  // Buff duration and T5 Overflow remain deferred until those mechanics have canonical runtime hooks.
 }
 aggregate.crit=(aggregate.crit??0)+setCrit;aggregate.flee=(aggregate.flee??0)+setFlee;
 const master=masterRefinementBonus(qualifyingRefines);
 aggregate.atk=(aggregate.atk??0)+master.atk;aggregate.matk=(aggregate.matk??0)+master.matk;aggregate.maxHp=(aggregate.maxHp??0)+master.maxHp;
 return{
  weaponAtk:Math.round(aggregate.atk??0),weaponMatk:Math.round(aggregate.matk??0),
  equipmentDef:Math.round(aggregate.def??0),equipmentMdef:Math.round(aggregate.mdef??0),equipmentMaxHp:Math.round(aggregate.maxHp??0),
  critBonusPercent:aggregate.crit??0,equipmentAspd:aggregate.aspd??0,hitBonus:aggregate.hit??0,fleeBonus:aggregate.flee??0,
  atkMultiplier:1+offensiveRefinePercent+mainRefinePercent+setAtkPercent,matkMultiplier:1+offensiveRefinePercent+mainRefinePercent+setMatkPercent,
  offhandAtkMultiplier:1+offensiveRefinePercent+offhandWeaponRefinePercent+setAtkPercent,offhandMatkMultiplier:1+offensiveRefinePercent+offhandWeaponRefinePercent+setMatkPercent,
  defMultiplier:1+defensiveRefinePercent+setDefPercent,mdefMultiplier:1+defensiveRefinePercent+setMdefPercent,maxHpMultiplier:1+defensiveRefinePercent+setHpPercent,
  masterRefinement:master.milestone,masterMaxSp:master.maxSp,
  maxSpMultiplier:1+setSpPercent,spRecoveryMultiplier:1+setSpRecoveryPercent,healingMultiplier:1+setHealingPercent,skillCostMultiplier:Math.max(0,1-setSkillCostReduction),
  expMultiplier:1+expBonus,dropMultiplier:1+dropBonus,
  castSpeed:utilityRefine/6,critDamageMultiplier:1+utilityRefine/100,elementDamageMultiplier:1+utilityRefine/100,
 };
}
