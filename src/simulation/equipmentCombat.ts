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
  /** Refine milestone (+5/+10/+15) and set bonuses feeding engine hooks. */
  weaponSkillDamageMultiplier:number; coreSkillDamageMultiplier:number; coreCooldownMultiplier:number;
  damageTakenMultiplier:number; lastStandDamageTakenMultiplier:number; executeDamageMultiplier:number;
  moveSpeedMultiplier:number; dodgeCooldownMultiplier:number; weaponProcChanceBonus:number; shieldBlockChanceBonus:number;
}

/**
 * Per-piece refine milestones. Each tier is cumulative: a +15 piece also has its +5 and +10 bonus.
 * Keys are the slot "kind" (offhand splits into weapon/shield; hat/face/mouth share "utility").
 */
export const REFINE_MILESTONES_V2={
 main:[{atkPct:.03},{crit:3},{weaponSkillDamage:.15}],
 offhandWeapon:[{aspd:1},{atkPct:.03},{weaponProcChance:.05}],
 // Each shield refinement milestone adds +2 percentage points to Block, totaling +2/+4/+6.
 shield:[{defPct:.04,mdefPct:.04,blockChance:.02},{hpPct:.05,blockChance:.02},{damageTaken:.05,blockChance:.02}],
 armor:[{hpPct:.05},{defPct:.05,mdefPct:.05},{damageTaken:.05}],
 cape:[{mdefPct:.05},{flee:5},{coreCooldown:.05}],
 shoes:[{flee:3},{moveSpeed:.05},{dodgeCooldown:.15}],
 accessory:[{hit:5},{critDamage:.05},{coreSkillDamage:.08}],
 // Utility values are totals at each milestone (not added on top of the previous one).
 utility:[{utilityPct:.01},{utilityPct:.02},{utilityPct:.03}],
} as const;
export type RefineMilestoneKindV2=keyof typeof REFINE_MILESTONES_V2;
export const REFINE_MILESTONE_LEVELS_V2=[5,10,15] as const;
export function refineMilestoneKind(slot:string,offhandType?:'weapon'|'shield'):RefineMilestoneKindV2{
 if(slot==='main')return'main';if(slot==='offhand')return offhandType==='shield'?'shield':'offhandWeapon';
 if(slot==='armor'||slot==='cape'||slot==='shoes')return slot;if(slot==='accessoryLeft'||slot==='accessoryRight')return'accessory';return'utility';
}

/** Flat stats per enhancement level, per equipped piece (offensive = main/offhand weapon/accessories). */
// Balance sim (2026-09-25): +2 ATK/level made enhancement the dominant damage source from Lv20 on.
export const ENHANCE_GAIN_V2={offensive:1,defensive:1};

const KEYS:(keyof EquipmentCombatContributionV2)[]=['atk','matk','def','mdef','maxHp','crit','aspd','hit','flee'];
const PERCENT_AFFIXES:Record<string,keyof EquipmentCombatContributionV2>={atkPct:'atk',matkPct:'matk',defPct:'def',mdefPct:'mdef',hpPct:'maxHp'};
const DEFAULT_AFFIX_PERCENT=.03;
function add(out:EquipmentCombatContributionV2,source:EquipmentCombatContributionV2|undefined,multiplier=1){if(!source)return;for(const key of KEYS)out[key]=(out[key]??0)+(source[key]??0)*multiplier}

export function equipmentCombatTotals(state:CharacterStateV2):EquipmentCombatTotalsV2{
 const aggregate:EquipmentCombatContributionV2={};
 let offensiveRefinePercent=0,mainRefinePercent=0,offhandWeaponRefinePercent=0,defensiveRefinePercent=0,expBonus=0,dropBonus=0,utilityRefine=0;
 const qualifyingRefines:number[]=[];
 const R={atkPct:0,defPct:0,mdefPct:0,hpPct:0,crit:0,aspd:0,hit:0,flee:0,critDamage:0,weaponSkillDamage:0,coreSkillDamage:0,coreCooldown:0,damageTaken:0,moveSpeed:0,dodgeCooldown:0,weaponProcChance:0,blockChance:0,exp:0,drop:0};
 for(const [slot,id] of Object.entries(state.equipment.equippedBySlot)){
  if(!id)continue;
  const item=state.equipment.instances[id];if(!item)continue;
  const enhancement=state.equipment.enhancementBySlot[slot]??0;
  const refinement=state.equipment.refinementBySlot[slot]??0;
  qualifyingRefines.push(refinement);
  {const kind=refineMilestoneKind(slot,item.offhandType);const reached=REFINE_MILESTONE_LEVELS_V2.filter(lv=>refinement>=lv).length;
   if(kind==='utility'){if(reached){const pct=REFINE_MILESTONES_V2.utility[reached-1].utilityPct;if(slot==='hat'||slot==='mouth')R.exp+=pct;if(slot==='face'||slot==='mouth')R.drop+=pct;}}
   else for(const bonus of REFINE_MILESTONES_V2[kind].slice(0,reached))for(const [k,v] of Object.entries(bonus))(R as Record<string,number>)[k]+=v;}
  const category=progressionCategory(slot,item.offhandType);
  const itemStats:EquipmentCombatContributionV2={};add(itemStats,item.baseCombat,equipmentRarityStatMultiplier(item.rarity));
  for(const affix of item.affixes){
   const key=PERCENT_AFFIXES[affix];if(key)itemStats[key]=(itemStats[key]??0)*(1+DEFAULT_AFFIX_PERCENT);
   else if(affix==='crit')itemStats.crit=(itemStats.crit??0)+2;
   else if(affix==='aspd')itemStats.aspd=(itemStats.aspd??0)+1;
  }
  add(aggregate,itemStats);
  if(category==='offensive'){
   aggregate.atk=(aggregate.atk??0)+enhancement*ENHANCE_GAIN_V2.offensive;aggregate.matk=(aggregate.matk??0)+enhancement*ENHANCE_GAIN_V2.offensive;
   if(slot==='main')mainRefinePercent+=refinement*.005;
   else if(slot==='offhand'&&item.offhandType==='weapon')offhandWeaponRefinePercent+=refinement*.005;
   else offensiveRefinePercent+=refinement*.005;
  }else if(category==='defensive'){
   aggregate.def=(aggregate.def??0)+enhancement*ENHANCE_GAIN_V2.defensive;aggregate.mdef=(aggregate.mdef??0)+enhancement*ENHANCE_GAIN_V2.defensive;
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
 let setCritDamage=0,setExecute=0,setLastStand=0,setCoreCooldown=0,setCoreDamage=0,setWeaponSkillDamage=0;
 for(const set of SET_DEFINITIONS_V2){if((setCounts.get(set.id)??0)<set.requiredPieces)continue;
  if(set.role==='damage'){if(set.group==='body'){const p={2:.05,3:.07,4:.09,5:.10,6:.12}[set.tier];setAtkPercent+=p;setMatkPercent+=p;if(set.tier>=4)setExecute+=({4:.15,5:.20,6:.25} as Record<number,number>)[set.tier]??0}else{setCrit+={2:5,3:7,4:10,5:12,6:14}[set.tier];setCritDamage+={2:0,3:.10,4:.15,5:.20,6:.25}[set.tier]}}
  else if(set.role==='tank'){if(set.group==='body'){setHpPercent+={2:.08,3:.10,4:.12,5:.15,6:.18}[set.tier];const p={2:.05,3:.07,4:.08,5:.10,6:.12}[set.tier];setDefPercent+=p;setMdefPercent+=p;if(set.tier>=4)setLastStand+=({4:.20,5:.25,6:.30} as Record<number,number>)[set.tier]??0}else{setHpPercent+={2:.05,3:.07,4:.08,5:.10,6:.12}[set.tier];if(set.tier>=4){const p=({4:.05,5:.06,6:.07} as Record<number,number>)[set.tier]??0;setDefPercent+=p;setMdefPercent+=p}if(set.tier===3)setFlee+=5}}
  // Support = the skill set: body boosts pressed Skill Cores, accessories boost weapon-skill procs.
  else if(set.role==='support'){if(set.group==='body'){setCoreCooldown+={2:.06,3:.08,4:.10,5:.12,6:.14}[set.tier];setCoreDamage+={2:.05,3:.07,4:.09,5:.10,6:.12}[set.tier]}else{setWeaponSkillDamage+={2:.08,3:.10,4:.12,5:.15,6:.18}[set.tier];setHealingPercent+={2:0,3:0,4:.10,5:.15,6:.20}[set.tier]}}
  // Buff duration and T5 Overflow remain deferred until those mechanics have canonical runtime hooks.
 }
 aggregate.crit=(aggregate.crit??0)+setCrit+R.crit;aggregate.flee=(aggregate.flee??0)+setFlee+R.flee;aggregate.hit=(aggregate.hit??0)+R.hit;aggregate.aspd=(aggregate.aspd??0)+R.aspd;
 const master=masterRefinementBonus(qualifyingRefines);
 return{
  weaponAtk:Math.round(aggregate.atk??0),weaponMatk:Math.round(aggregate.matk??0),
  equipmentDef:Math.round(aggregate.def??0),equipmentMdef:Math.round(aggregate.mdef??0),equipmentMaxHp:Math.round(aggregate.maxHp??0),
  critBonusPercent:aggregate.crit??0,equipmentAspd:aggregate.aspd??0,hitBonus:aggregate.hit??0,fleeBonus:aggregate.flee??0,
  atkMultiplier:1+offensiveRefinePercent+mainRefinePercent+setAtkPercent+R.atkPct+master.atkPct,matkMultiplier:1+offensiveRefinePercent+mainRefinePercent+setMatkPercent+R.atkPct+master.matkPct,
  offhandAtkMultiplier:1+offensiveRefinePercent+offhandWeaponRefinePercent+setAtkPercent,offhandMatkMultiplier:1+offensiveRefinePercent+offhandWeaponRefinePercent+setMatkPercent,
  defMultiplier:1+defensiveRefinePercent+setDefPercent+R.defPct,mdefMultiplier:1+defensiveRefinePercent+setMdefPercent+R.mdefPct,maxHpMultiplier:1+defensiveRefinePercent+setHpPercent+R.hpPct+master.maxHpPct,
  masterRefinement:master.milestone,masterMaxSp:0,
  maxSpMultiplier:1+setSpPercent+master.maxSpPct,spRecoveryMultiplier:1+setSpRecoveryPercent,healingMultiplier:1+setHealingPercent,skillCostMultiplier:Math.max(0,1-setSkillCostReduction),
  expMultiplier:1+expBonus+R.exp,dropMultiplier:1+dropBonus+R.drop,
  castSpeed:utilityRefine/6,critDamageMultiplier:1+utilityRefine/100+setCritDamage+R.critDamage,elementDamageMultiplier:1+utilityRefine/100,
  weaponSkillDamageMultiplier:1+setWeaponSkillDamage+R.weaponSkillDamage,coreSkillDamageMultiplier:1+setCoreDamage+R.coreSkillDamage,
  coreCooldownMultiplier:Math.max(.5,1-setCoreCooldown-R.coreCooldown),damageTakenMultiplier:Math.max(.5,1-R.damageTaken),
  lastStandDamageTakenMultiplier:1-setLastStand,executeDamageMultiplier:1+setExecute,
  moveSpeedMultiplier:1+R.moveSpeed,dodgeCooldownMultiplier:Math.max(.5,1-R.dodgeCooldown),weaponProcChanceBonus:R.weaponProcChance,shieldBlockChanceBonus:R.blockChance,
 };
}
