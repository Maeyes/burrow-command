// Burrow uses the *actual* Bunny World Skill Core catalog, item ownership, Mod slots,
// rarity/duplicate/shard upgrades and command validator. No Burrow-exclusive skills.
import {SKILLS_V2} from '../../src/simulation/skills.ts';
import {SKILL_MODIFIERS_V2} from '../../src/simulation/skillModifiersV2.ts';
import {applySkillCoreCommand,skillItemUpgradeQuote,equippedSkillItemCount} from '../../src/simulation/skillCoreService.ts';

const CLASS_FAMILIES={guard:'swordShield',archer:'bow',scout:'dagger',brute:'hammer',axe:'axe',vanguard:'greatsword',mage:'staff'};
export const CORE_CLASS_IDS=Object.keys(CLASS_FAMILIES);
// Every five-house-level milestone unlocks one COMPLETE Core build: one
// active Core and both Mod slots. Earlier unlocks never move equipped items.
export const CORE_SLOT_UNLOCKS=Object.freeze([10,20,30]);
export const CLASS_CORE_UNLOCK=CORE_SLOT_UNLOCKS[0];
export const CLASS_MOD_UNLOCKS=CORE_SLOT_UNLOCKS;
const RARITIES=['normal','good','rare','epic','legend','mythic','whiteAscended'];
const validCore=id=>SKILLS_V2[id]&&['active','passive'].includes(SKILLS_V2[id].kind);
const blank=()=>({active:[null,null,null],movement:null,passive:[],modifiersByActive:{},slotMods:[[],[],[]],coreRarity:{}});
export function defaultClassSkills(){return Object.fromEntries(CORE_CLASS_IDS.map(cls=>[cls,blank()]));}
export function normalizeClassSkills(raw){
 const result=defaultClassSkills();
 for(const cls of CORE_CLASS_IDS){
  const old=raw?.[cls];if(!old||typeof old!=='object')continue;
  const skills=result[cls],used=new Set();
  skills.active=Array.from({length:3},(_,slot)=>{
   const id=old.active?.[slot];
   if(typeof id!=='string'||!validCore(id)||used.has(id))return null;
   if(SKILLS_V2[id].compatibleWeaponFamilies?.length&&!SKILLS_V2[id].compatibleWeaponFamilies.includes(CLASS_FAMILIES[cls]))return null;
   used.add(id);return id;
  });
  skills.movement=SKILLS_V2[old.movement]?.kind==='movement'?old.movement:null;
  skills.slotMods=Array.from({length:3},(_,i)=>Array.from({length:2},(_,j)=>{
   const id=(skills.active[i]?old.modifiersByActive?.[skills.active[i]]?.[j]:null)??old.slotMods?.[i]?.[j];
   return SKILL_MODIFIERS_V2[id]?id:null;
  }));
  for(let i=0;i<3;i++)if(skills.active[i])skills.modifiersByActive[skills.active[i]]=skills.slotMods[i];
  skills.coreRarity=Object.fromEntries(Object.entries(old.coreRarity||{}).filter(([id,rarity])=>
   RARITIES.includes(rarity)&&((SKILLS_V2[id]?.kind&&SKILLS_V2[id].kind!=='weapon')||SKILL_MODIFIERS_V2[id])));
 }
 return result;
}
// Shared inventory: each class's equipped copies reserve real copies from the others.
export function classSkillProxy(s,cls){
 if(!CORE_CLASS_IDS.includes(cls))throw Error('invalid-class');
 const inventory={...s.inventory};
 for(const other of CORE_CLASS_IDS){
  if(other===cls)continue;
  const skills=s.classSkills?.[other];if(!skills)continue;
  const proxy={skills,inventory:s.inventory};
  for(const id of Object.keys(s.inventory)){
   const reserved=equippedSkillItemCount(proxy,id);
   if(reserved)inventory[id]=Math.max(0,(inventory[id]||0)-reserved);
  }
 }
 return {skills:s.classSkills?.[cls]||blank(),inventory,gold:s.gold};
}
export function availableForClass(s,cls,id){return classSkillProxy(s,cls).inventory[id]||0;}
export function classSkillQuote(s,cls,id){return skillItemUpgradeQuote(classSkillProxy(s,cls),id);}
export function applyBurrowSkillCommand(s,cls,command,rng=Math.random){
 if(!CORE_CLASS_IDS.includes(cls))throw Error('invalid-class');
 if(s.night)throw Error('daytime-only');
 if(s.warren<CLASS_CORE_UNLOCK)throw Error('warren-core-locked');
 if(command.type==='equipModifier'||command.type==='unequipModifier'||command.type==='upgradeModifier'){
  const id=command.coreId??s.classSkills?.[cls]?.active?.find(id=>id&&s.classSkills[cls].modifiersByActive?.[id]?.includes(command.modifierId));
  const slot=s.classSkills?.[cls]?.active?.indexOf(id)??-1;
  if(command.type!=='upgradeModifier'&&(![0,1].includes(command.modSlot)||slot<0))throw Error('invalid-mod-slot');
  if(slot<0||s.warren<CORE_SLOT_UNLOCKS[slot])throw Error('warren-mod-locked');
 }
 if(command.type==='equipCore'){
  const active=s.classSkills?.[cls]?.active??[];
  const targetSlot=command.slot??active.findIndex((id,slot)=>!id&&s.warren>=CORE_SLOT_UNLOCKS[slot]);
  if(targetSlot<0||targetSlot>2||s.warren<CORE_SLOT_UNLOCKS[targetSlot])throw Error('warren-core-slot-locked');
  // Burrow deliberately forbids duplicate Core IDs within one class, even if
  // inventory contains multiple physical copies. Main game's service normally
  // *moves* an existing Core between slots; Burrow requires unequip first.
  if(active.some((id,slot)=>id===command.coreId&&slot!==targetSlot))
   throw new Error('skill-core-already-equipped');
  command={...command,slot:targetSlot};
  const def=SKILLS_V2[command.coreId];
  if(def?.compatibleWeaponFamilies?.length&&!def.compatibleWeaponFamilies.includes(CLASS_FAMILIES[cls]))
   throw Error('incompatible-weapon-family');
 }
 s.classSkills??=defaultClassSkills();
 const input=classSkillProxy(s,cls),output=applySkillCoreCommand(input,command,rng);
 const inventory={...s.inventory};
 for(const id of new Set([...Object.keys(input.inventory),...Object.keys(output.inventory)])){
  const delta=(output.inventory[id]||0)-(input.inventory[id]||0);
  if(delta)inventory[id]=Math.max(0,(inventory[id]||0)+delta);
 }
 s.inventory=inventory;s.gold=output.gold;s.classSkills[cls]=output.skills;
 return output;
}
export function classActiveCores(s,cls){
 if(s.warren<CLASS_CORE_UNLOCK)return[];
 return (s.classSkills?.[cls]?.active||[])
  .filter((id,slot)=>s.warren>=CORE_SLOT_UNLOCKS[slot]&&validCore(id))
  .map(id=>SKILLS_V2[id]);
}
