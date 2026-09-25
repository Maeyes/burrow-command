import type { CharacterStateV2 } from './character';
import { SKILLS_V2 } from './skills';
import { isSkillCoreItem } from './itemTagsV2';
import { SKILL_MODIFIERS_V2 } from './skillModifiersV2';
import type { RandomFn } from './engine';

export const SKILL_CORE_RARITIES=['normal','good','rare','epic','legend','mythic','whiteAscended'] as const;
export type SkillCoreRarity=typeof SKILL_CORE_RARITIES[number];
export const SKILL_CORE_UPGRADE_BASE_GOLD=10000;
export const SKILL_CORE_UPGRADE_SUCCESS=[1,.70,.40,.20,.10,.05] as const;
export const SKILL_CORE_UPGRADE_GOLD_MULTIPLIER=[1,3,9,27,81,243] as const;
export function skillCoreDamageMultiplier(state:CharacterStateV2,coreId:string){const rarity=state.skills.coreRarity?.[coreId]??'normal';const i=SKILL_CORE_RARITIES.indexOf(rarity);return 1+Math.max(0,i)*.10;}
export type SkillUpgradeKindV2='core'|'modifier'|'movement';
/** Equipped copies are inventory entries, not upgrade material. Count attached mods on all saved core configurations. */
export function equippedSkillItemCount(state:CharacterStateV2,id:string):number{
 const installedCoreCount=state.skills.active.filter(x=>x===id).length+(state.skills.movement===id?1:0);
 const attachedModCount=Object.values(state.skills.modifiersByActive??{}).reduce(
  (count,slots)=>count+(slots??[]).filter(x=>x===id).length,0);
 return installedCoreCount+attachedModCount;
}
export function availableSkillUpgradeCopies(state:CharacterStateV2,id:string):number{
 return Math.max(0,(state.inventory[id]??0)-equippedSkillItemCount(state,id));
}
export function skillUpgradeKind(id:string):SkillUpgradeKindV2|undefined{
 if(SKILL_MODIFIERS_V2[id])return'modifier';
 const kind=SKILLS_V2[id]?.kind;
 return kind==='movement'?'movement':kind==='active'||kind==='passive'?'core':undefined;
}
export function movementSkillDistanceBonus(state:CharacterStateV2,id:string):number{
 if(skillUpgradeKind(id)!=='movement')return 0;
 return Math.max(0,SKILL_CORE_RARITIES.indexOf(state.skills.coreRarity?.[id]??'normal'));
}
export function skillItemUpgradeQuote(state:CharacterStateV2,id:string){
 const kind=skillUpgradeKind(id);
 if(!kind)return null;
 const current=state.skills.coreRarity?.[id]??'normal',i=SKILL_CORE_RARITIES.indexOf(current);
 if(i<0||i>=SKILL_CORE_RARITIES.length-1)return null;
 const totalOwned=state.inventory[id]??0,reserved=equippedSkillItemCount(state,id);
 const baseDistance=kind==='movement'?(SKILLS_V2[id]?.movementDistance??0):0;
 return{
  kind,id,current,next:SKILL_CORE_RARITIES[i+1],successRate:SKILL_CORE_UPGRADE_SUCCESS[i],
  duplicateQty:kind==='modifier'?6:2,
  gold:SKILL_CORE_UPGRADE_BASE_GOLD*SKILL_CORE_UPGRADE_GOLD_MULTIPLIER[i],
  totalOwned,reserved,availableDuplicates:availableSkillUpgradeCopies(state,id),
  currentEffectMultiplier:1+i*.10,nextEffectMultiplier:1+(i+1)*.10,
  currentDamageBonus:i*.10,nextDamageBonus:(i+1)*.10,
  currentDistance:baseDistance+(kind==='movement'?i:0),
  nextDistance:baseDistance+(kind==='movement'?i+1:0),
 };
}
/** Backward-compatible quote used by the existing Skill Core upgrade screen. */
export const skillCoreUpgradeQuote=skillItemUpgradeQuote;

export type SkillCoreCommandV2=
 |{type:'equipCore';coreId:string;slot?:0|1|2}
 |{type:'unequipCore';slot:0|1|2}
 |{type:'equipMovementCore';coreId:string}
 |{type:'unequipMovementCore'}
 |{type:'equipModifier';coreId:string;modifierId:string;modSlot:0|1}
 |{type:'unequipModifier';coreId:string;modSlot:0|1}
 |{type:'upgradeCore';coreId:string}
 |{type:'upgradeModifier';modifierId:string}
 |{type:'upgradeMovementCore';coreId:string};

export function applySkillCoreCommand(state:CharacterStateV2,command:SkillCoreCommandV2,rng:RandomFn=Math.random):CharacterStateV2{
 if(command.type==='upgradeCore'||command.type==='upgradeModifier'||command.type==='upgradeMovementCore'){
  const id=command.type==='upgradeModifier'?command.modifierId:command.coreId;
  const expected:SkillUpgradeKindV2=command.type==='upgradeModifier'?'modifier':command.type==='upgradeMovementCore'?'movement':'core';
  if(skillUpgradeKind(id)!==expected)throw new Error('invalid-skill-upgrade-kind');
  const installed=expected==='modifier'
   ?equippedSkillItemCount(state,id)>0
   :expected==='movement'?state.skills.movement===id:state.skills.active.includes(id);
  if(!installed)throw new Error('skill-item-not-installed');
  const quote=skillItemUpgradeQuote(state,id);
  if(!quote)throw new Error('skill-item-max-rarity');
  if(quote.availableDuplicates<quote.duplicateQty)throw new Error('not-enough-duplicate-cores');
  if(state.gold<quote.gold)throw new Error('not-enough-gold');
  const inventory={...state.inventory,[id]:quote.totalOwned-quote.duplicateQty};
  const next={...state,gold:state.gold-quote.gold,inventory,skills:{...state.skills,coreRarity:{...(state.skills.coreRarity??{})}}};
  if(rng()<quote.successRate)next.skills.coreRarity![id]=quote.next;
  return next;
 }
 const skills={...state.skills,active:[...state.skills.active] as [string?,string?,string?],modifiersByActive:{...state.skills.modifiersByActive}};
 if(command.type==='unequipCore'){skills.active[command.slot]=undefined;return{...state,skills};}
 if(command.type==='unequipMovementCore'){skills.movement=undefined;return{...state,skills};}
 if(command.type==='equipModifier'||command.type==='unequipModifier'){
  if(!skills.active.includes(command.coreId))throw new Error('skill-core-not-equipped');
  const mods=[...(skills.modifiersByActive[command.coreId]??[])];
  if(command.type==='equipModifier'){
   if(!SKILL_MODIFIERS_V2[command.modifierId])throw new Error('unknown-skill-mod');
   const sameSlot=mods[command.modSlot]===command.modifierId;
   const free=availableSkillUpgradeCopies(state,command.modifierId);
   if(!sameSlot&&free<1)throw new Error('skill-mod-not-owned');
   mods[command.modSlot]=command.modifierId;
  }else mods.splice(command.modSlot,1);
  skills.modifiersByActive[command.coreId]=mods.slice(0,2);
  return{...state,skills};
 }
 const id=command.coreId;
 if((state.inventory[id]??0)<1||!isSkillCoreItem(id))throw new Error('skill-core-not-owned');
 const def=SKILLS_V2[id];if(!def)throw new Error('unknown-skill-core');
 if(command.type==='equipMovementCore'){
  if(def.kind!=='movement')throw new Error('not-movement-core');
  skills.movement=id;return{...state,skills};
 }
 if(def.kind==='movement')throw new Error('movement-core-requires-movement-slot');
 if(def.kind!=='active'&&def.kind!=='passive')throw new Error('invalid-active-core');
 const existing=skills.active.findIndex(x=>x===id);if(existing>=0)skills.active[existing]=undefined;
 const slot=command.slot??(skills.active.findIndex(x=>!x) as 0|1|2);
 if(slot<0||slot>2)throw new Error('skill-core-slots-full');
 skills.active[slot]=id;
 return{...state,skills};
}
