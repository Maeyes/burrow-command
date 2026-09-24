import type { CharacterStateV2,EquipmentInstanceStateV2 } from './character';
import { applyEconomyCommand } from './economy';
import { OPTION_AFFIX_POOL,RARITY_AFFIX_COUNT,dismantleFragments,dismantleProtectionLv1,enhancementRequirement,optionStoneCost,reoptionStoneCost,resolveRefinement,rollRarity,type EquipmentRarity } from './equipmentV2';
import type { RandomFn } from './engine';
import { EQUIPMENT_MASTER_V2 } from './itemMasterV2';

export interface CraftRecipeV2 {templateId:string;slot:string;blueprintId:string;oreId:string;oreQty?:number;materials?:Array<{itemId:string;qty:number}>;materialId?:string;materialQty?:number;bossMaterialId?:string;bossMaterialQty?:number;gold:number;baseGoldCost:number;baseCombat?:import('./character').EquipmentCombatContributionV2;offhandType?:'weapon'|'shield';setId?:string;requiredLevel?:number;available?:boolean}
export type EquipmentCommandV2=
 |{type:'craft';recipe:CraftRecipeV2}
 |{type:'equip';equipmentId:string;targetSlot?:string}
 |{type:'unequip';slot:string}
 |{type:'enhance';slot:string}
 |{type:'refine';slot:string;protectedAttempt?:boolean}
 |{type:'addOption';equipmentId:string}
 |{type:'reoption';equipmentId:string;lockedIndexes:number[]}
 |{type:'dismantle';equipmentId:string};

export interface EquipmentCommandResultV2{state:CharacterStateV2;createdEquipmentId?:string;refineSuccess?:boolean;granted?:Record<string,number>}
let nextEquipmentSequence=1;
function uid(state:CharacterStateV2,templateId:string){let id='';do{id=`eq-${templateId}-${nextEquipmentSequence++}`}while(state.equipment.instances[id]);return id}
function equipment(state:CharacterStateV2,id:string){const x=state.equipment.instances[id];if(!x)throw new Error('equipment-not-found');return x}
function spend(state:CharacterStateV2,gold:number,items:Record<string,number>){return applyEconomyCommand(state,{type:'spend',gold,items})}
function grant(state:CharacterStateV2,items:Record<string,number>){return applyEconomyCommand(state,{type:'grantLoot',loot:{gold:0,items}})}
function withInstance(state:CharacterStateV2,x:EquipmentInstanceStateV2):CharacterStateV2{return{...state,equipment:{...state.equipment,instances:{...state.equipment.instances,[x.id]:x}}}}
function randomAffix(rng:RandomFn,excluded=new Set<string>()){const pool=OPTION_AFFIX_POOL.filter(x=>!excluded.has(x));if(!pool.length)throw new Error('no-affix-available');return pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))]}

export function applyEquipmentCommand(state:CharacterStateV2,command:EquipmentCommandV2,rng:RandomFn=Math.random):EquipmentCommandResultV2{
 if(command.type==='craft'){
  const r=command.recipe;if(r.available===false)throw new Error('recipe-not-available');const items:Record<string,number>={[r.blueprintId]:1,[r.oreId]:r.oreQty??2};
  for(const material of r.materials??[])items[material.itemId]=(items[material.itemId]??0)+material.qty;
  if(r.materialId)items[r.materialId]=(items[r.materialId]??0)+(r.materialQty??1);
  if(r.bossMaterialId)items[r.bossMaterialId]=r.bossMaterialQty??1;
  let next=spend(state,r.gold,items);const rarity=rollRarity(rng());const id=uid(next,r.templateId);
  const instance:EquipmentInstanceStateV2={id,templateId:r.templateId,slot:r.slot,rarity,affixes:[],baseGoldCost:r.baseGoldCost,baseCombat:r.baseCombat,offhandType:r.offhandType,setId:r.setId,requiredLevel:r.requiredLevel};
  next=withInstance(next,instance);return{state:next,createdEquipmentId:id};
 }
 if(command.type==='equip'){
  const x=equipment(state,command.equipmentId);if((x.requiredLevel??1)>state.level)throw new Error('equipment-level-too-low');const target=command.targetSlot??x.slot;
  const accessoryPair=(x.slot==='accessoryLeft'||x.slot==='accessoryRight')&&(target==='accessoryLeft'||target==='accessoryRight');
  if(target!==x.slot&&!accessoryPair)throw new Error('invalid-equipment-slot');
  const equippedBySlot={...state.equipment.equippedBySlot};for(const [slot,id] of Object.entries(equippedBySlot))if(id===x.id)equippedBySlot[slot]=null;
  // Two-handed families occupy both hands. Offhand progression is retained but inactive while empty.
  const TWO_HANDED_FAMILIES=new Set(['bow','axe','greatsword']);
  const xFamily=EQUIPMENT_MASTER_V2[x.templateId]?.weaponFamily;
  if(target==='main'&&xFamily&&TWO_HANDED_FAMILIES.has(xFamily))equippedBySlot.offhand=null;
  // An offhand cannot be equipped while a two-handed main weapon is equipped.
  if(target==='offhand'){
    const mainId=equippedBySlot.main,main=mainId?state.equipment.instances[mainId]:undefined;
    const mainFamily=main?EQUIPMENT_MASTER_V2[main.templateId]?.weaponFamily:undefined;
    if(mainFamily&&TWO_HANDED_FAMILIES.has(mainFamily))throw new Error('two-handed-weapon-equipped');
  }
  equippedBySlot[target]=x.id;
  return{state:{...state,equipment:{...state.equipment,equippedBySlot}}};
 }
 if(command.type==='unequip'){
  if(!state.equipment.equippedBySlot[command.slot])throw new Error('empty-slot');
  return{state:{...state,equipment:{...state.equipment,equippedBySlot:{...state.equipment.equippedBySlot,[command.slot]:null}}}};
 }
 if(command.type==='enhance'){
  const id=state.equipment.equippedBySlot[command.slot];if(!id)throw new Error('empty-slot');
  const x=equipment(state,id);const current=state.equipment.enhancementBySlot[command.slot]??0;const nextLevel=current+1;
  if(nextLevel>state.level)throw new Error('enhancement-above-hero-level');
  const req=enhancementRequirement(x.baseGoldCost,nextLevel);const next=spend(state,req.gold,{[req.stoneId]:req.stoneQty});
  return{state:{...next,equipment:{...next.equipment,enhancementBySlot:{...next.equipment.enhancementBySlot,[command.slot]:nextLevel}}}};
 }
 if(command.type==='refine'){
  const id=state.equipment.equippedBySlot[command.slot];if(!id)throw new Error('empty-slot');
  const current=state.equipment.refinementBySlot[command.slot]??0;const result=resolveRefinement(current,rng(),!!command.protectedAttempt);
  const cost:Record<string,number>={astraliteStone:result.astralite};if(result.protection)cost[result.protection.id]=result.protection.qty;
  const next=spend(state,0,cost);
  return{state:{...next,equipment:{...next.equipment,refinementBySlot:{...next.equipment.refinementBySlot,[command.slot]:result.level}}},refineSuccess:result.success};
 }
 if(command.type==='addOption'){
  const x=equipment(state,command.equipmentId);const cap=RARITY_AFFIX_COUNT[x.rarity as EquipmentRarity];if(x.affixes.length>=cap)throw new Error('affix-cap');
  let next=spend(state,0,{optionStone:optionStoneCost(x.affixes.length)});const affix=randomAffix(rng,new Set(x.affixes));next=withInstance(next,{...x,affixes:[...x.affixes,affix]});return{state:next};
 }
 if(command.type==='reoption'){
  const x=equipment(state,command.equipmentId);const locked=new Set(command.lockedIndexes);if(locked.size>=x.affixes.length)throw new Error('cannot-lock-all-affixes');
  let next=spend(state,0,{reoptionStone:reoptionStoneCost(locked.size)});const used=new Set(x.affixes.filter((_,i)=>locked.has(i)));const affixes=x.affixes.map((a,i)=>{if(locked.has(i))return a;const rolled=randomAffix(rng,used);used.add(rolled);return rolled});
  next=withInstance(next,{...x,affixes});return{state:next};
 }
 const x=equipment(state,command.equipmentId);if(Object.values(state.equipment.equippedBySlot).includes(x.id))throw new Error('cannot-dismantle-equipped');
 const granted:Record<string,number>={stoneFragment:dismantleFragments(x.rarity as EquipmentRarity)};const protection=dismantleProtectionLv1(x.rarity as EquipmentRarity,rng());if(protection)granted.refineProtectionLv1=protection;
 const instances={...state.equipment.instances};delete instances[x.id];let next={...state,equipment:{...state.equipment,instances}};next=grant(next,granted);return{state:next,granted};
}
