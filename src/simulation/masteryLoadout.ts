import type { CombatWeaponFamily } from '../systems/combatMath';
import type { CharacterStateV2, MasteryActiveLevelV2, MasteryPassiveSelectionV2, WeaponMasteryLoadoutV2 } from './character';
import { WEAPON_MASTERY_MILESTONES } from './masteryMilestones';
import { WEAPON_SKILLS_BY_FAMILY_V2 } from './skillEntitlements';

export const MASTERY_PASSIVE_SLOTS=5;
export const MASTERY_ACTIVE_LEVELS=[10,20,30] as const satisfies readonly MasteryActiveLevelV2[];

/** Passive slot capacity is account-wide for the character build and grows with the highest mastery reached: Lv10/20/30/40/50 => 1/2/3/4/5 slots. */
export function masteryPassiveSlotCapacity(state:CharacterStateV2){
 const highest=Math.max(0,...Object.values(state.weaponMastery??{}).map(x=>Math.max(0,Math.floor(x?.level??0))));
 return Math.max(0,Math.min(MASTERY_PASSIVE_SLOTS,Math.floor(highest/10)));
}

export type MasteryLoadoutCommandV2=
 |{type:'togglePassive';family:CombatWeaponFamily;milestoneId:string}
 |{type:'equipActive';level:MasteryActiveLevelV2;family:CombatWeaponFamily}
 |{type:'unequipActive';level:MasteryActiveLevelV2};

export function masteryPassiveKey(family:CombatWeaponFamily,milestoneId:string){return `${family}:${milestoneId}`;}

export function masteryPassiveKeys(state:CharacterStateV2):string[]{
 return (state.masteryLoadout?.passive??[]).map(x=>masteryPassiveKey(x.family,x.milestoneId));
}

export function activeMasterySkillFor(family:CombatWeaponFamily,level:MasteryActiveLevelV2):string|undefined{
 const index=MASTERY_ACTIVE_LEVELS.indexOf(level);
 return index<0?undefined:WEAPON_SKILLS_BY_FAMILY_V2[family]?.[index];
}

export function activeMasteryFamilyForSkill(skillId:string,level:MasteryActiveLevelV2):CombatWeaponFamily|undefined{
 const index=MASTERY_ACTIVE_LEVELS.indexOf(level);
 return (Object.keys(WEAPON_SKILLS_BY_FAMILY_V2) as CombatWeaponFamily[]).find(f=>WEAPON_SKILLS_BY_FAMILY_V2[f]?.[index]===skillId);
}

function unlockedPassive(state:CharacterStateV2,selection:MasteryPassiveSelectionV2){
 const milestone=WEAPON_MASTERY_MILESTONES[selection.family]?.find(x=>x.id===selection.milestoneId);
 return Boolean(milestone&&(state.weaponMastery[selection.family]?.level??1)>=milestone.level);
}

export function normalizeMasteryLoadout(state:CharacterStateV2):WeaponMasteryLoadoutV2{
 const raw=state.masteryLoadout;
 const passiveCapacity=masteryPassiveSlotCapacity(state);
 const passive:MasteryPassiveSelectionV2[]=[];
 const seen=new Set<string>();
 for(const selection of raw?.passive??[]){
  if(!selection||!WEAPON_MASTERY_MILESTONES[selection.family])continue;
  const normalized={family:selection.family,milestoneId:String(selection.milestoneId)} as MasteryPassiveSelectionV2;
  const key=masteryPassiveKey(normalized.family,normalized.milestoneId);
  if(seen.has(key)||!unlockedPassive(state,normalized))continue;
  if(passive.length>=passiveCapacity)break;
  seen.add(key);passive.push(normalized);
 }
 const active:WeaponMasteryLoadoutV2['active']={};
 for(const level of MASTERY_ACTIVE_LEVELS){
  const skillId=raw?.active?.[level];
  if(!skillId)continue;
  const family=activeMasteryFamilyForSkill(skillId,level);
  if(!family||(state.weaponMastery[family]?.level??1)<level)continue;
  active[level]=skillId;
 }
 return{passive,active};
}

export function applyMasteryLoadoutCommand(state:CharacterStateV2,command:MasteryLoadoutCommandV2):CharacterStateV2{
 const loadout=normalizeMasteryLoadout(state);
 const passiveCapacity=masteryPassiveSlotCapacity(state);
 if(command.type==='togglePassive'){
  const milestone=WEAPON_MASTERY_MILESTONES[command.family]?.find(x=>x.id===command.milestoneId);
  if(!milestone)throw new Error('unknown-mastery-passive');
  if((state.weaponMastery[command.family]?.level??1)<milestone.level)throw new Error('mastery-passive-locked');
  const key=masteryPassiveKey(command.family,command.milestoneId);
  const at=loadout.passive.findIndex(x=>masteryPassiveKey(x.family,x.milestoneId)===key);
  const passive=[...loadout.passive];
  if(at>=0)passive.splice(at,1);
  else{
   if(passive.length>=passiveCapacity)throw new Error('mastery-passive-slots-full');
   passive.push({family:command.family,milestoneId:command.milestoneId});
  }
  return{...state,masteryLoadout:{...loadout,passive}};
 }
 if(command.type==='unequipActive'){
  const active={...loadout.active};delete active[command.level];
  return{...state,masteryLoadout:{...loadout,active}};
 }
 const skillId=activeMasterySkillFor(command.family,command.level);
 if(!skillId)throw new Error('unknown-mastery-active');
 if((state.weaponMastery[command.family]?.level??1)<command.level)throw new Error('mastery-active-locked');
 return{...state,masteryLoadout:{...loadout,active:{...loadout.active,[command.level]:skillId}}};
}
