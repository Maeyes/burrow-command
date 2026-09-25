import type { CharacterStateV2, EquipmentInstanceStateV2 } from './character';
import { EQUIPMENT_MASTER_V2, type WeaponFamilyV2 } from './itemMasterV2';

/**
 * Innate passives are granted by the ACTUAL equipped weapon, never by Mastery level or passive slots.
 * Equipment data is authoritative; do not infer bonuses from the player's previously selected family.
 */
export const WEAPON_INNATE_DESCRIPTIONS:Record<WeaponFamilyV2,string>={
 dagger:'ASPD +3, CRI +3, CRI DMG +6%. A second dagger grants 50% more of these bonuses.',
 hammer:'Max HP +6%, DEF +3%.',
 greatsword:'Physical ATK +5%.',
 swordShield:'Physical ATK +3.5% (70% of the Greatsword innate bonus).',
 staff:'MATK +5%.',
 axe:'Ignore 10% physical DEF; heal for 2% of physical damage dealt (half rate on secondary AoE targets).',
 bow:'Ranged ATK +5%, HIT +5.',
};

export interface WeaponInnateBonusesV2 {
 family:WeaponFamilyV2|null;
 dualDagger:boolean;
 hasShieldEquipped:boolean;
 aspdBonus:number;
 critBonus:number;
 critDamageBonus:number;
 hpMultiplier:number;
 defMultiplier:number;
 physicalAtkMultiplier:number;
 matkMultiplier:number;
 hitBonus:number;
 blockChanceBonus:number;
 physicalArmorPenetration:number;
 physicalLifeSteal:number;
}

export function weaponFamilyForTemplate(templateId:string):WeaponFamilyV2|undefined{
 // Legacy/new-character starter dagger is a real item, though it is not a craftable master template.
 return templateId==='starterDagger'?'dagger':EQUIPMENT_MASTER_V2[templateId]?.weaponFamily;
}
export function isOffhandDagger(item:EquipmentInstanceStateV2|undefined):boolean{
 return item?.offhandType==='weapon'&&weaponFamilyForTemplate(item.templateId)==='dagger';
}
export function innateDescriptionForItem(item:EquipmentInstanceStateV2):string|undefined{
 if(item.slot==='main'){
  const family=weaponFamilyForTemplate(item.templateId);
  return family?WEAPON_INNATE_DESCRIPTIONS[family]:undefined;
 }
 if(item.slot==='offhand'&&item.offhandType==='shield'){
  return 'Shield innate: Block Chance +5 percentage points while equipped with any compatible main-hand weapon.';
 }
 if(item.slot==='offhand'&&isOffhandDagger(item)){
  return 'Dual Dagger: when the main hand also holds a dagger, gain another 50% of its innate ASPD, CRI and CRI DMG bonuses.';
 }
 return undefined;
}

export function weaponInnateBonuses(state:Readonly<CharacterStateV2>):WeaponInnateBonusesV2{
 const mainId=state.equipment.equippedBySlot.main;
 const main=mainId?state.equipment.instances[mainId]:undefined;
 const family=main?weaponFamilyForTemplate(main.templateId)??null:null;
 const offhandId=state.equipment.equippedBySlot.offhand;
 const offhand=offhandId?state.equipment.instances[offhandId]:undefined;
 const dualDagger=family==='dagger'&&isOffhandDagger(offhand);
 // Shield innate belongs to the shield itself, including Dagger + Shield and Staff + Shield.
 // Legacy two-handed/offhand combinations cannot grant its bonus even if the save contains both items.
 const hasShieldEquipped=offhand?.offhandType==='shield'&&!(['bow','axe','greatsword'] as (WeaponFamilyV2|null)[]).includes(family);
 const base:WeaponInnateBonusesV2={
  family,dualDagger,hasShieldEquipped,
  aspdBonus:0,critBonus:0,critDamageBonus:0,
  hpMultiplier:1,defMultiplier:1,physicalAtkMultiplier:1,matkMultiplier:1,
  hitBonus:0,blockChanceBonus:hasShieldEquipped?.05:0,physicalArmorPenetration:0,physicalLifeSteal:0,
 };
 switch(family){
  case 'dagger':{
   const scale=dualDagger?1.5:1;
   return{...base,aspdBonus:3*scale,critBonus:3*scale,critDamageBonus:.06*scale};
  }
  case 'hammer':return{...base,hpMultiplier:1.06,defMultiplier:1.03};
  case 'greatsword':return{...base,physicalAtkMultiplier:1.05};
  case 'swordShield':return{...base,physicalAtkMultiplier:1.035};
  case 'staff':return{...base,matkMultiplier:1.05};
  case 'axe':return{...base,physicalArmorPenetration:.10,physicalLifeSteal:.02};
  case 'bow':return{...base,physicalAtkMultiplier:1.05,hitBonus:5};
  default:return base;
 }
}
