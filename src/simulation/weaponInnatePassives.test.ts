import {describe,expect,it} from 'vitest';
import {createInitialCharacterV2, type CharacterStateV2} from './character';
import {EQUIPMENT_MASTER_V2, type WeaponFamilyV2} from './itemMasterV2';
import {innateDescriptionForItem,weaponInnateBonuses} from './weaponInnatePassives';

const MAIN:Record<WeaponFamilyV2,string>={
 dagger:'sporefangDagger',hammer:'copperrootHammer',greatsword:'mosswoodSword',
 swordShield:'sporewoodScepter',staff:'sporewoodWand',axe:'mosswoodAxe',bow:'mosswoodBow',
};

function equip(state:CharacterStateV2,slot:'main'|'offhand',templateId:string):void{
 const template=EQUIPMENT_MASTER_V2[templateId];
 expect(template,templateId).toBeDefined();
 state.equipment.instances[templateId]={
  id:templateId,templateId,slot,offhandType:template.offhandType,
  rarity:'normal',affixes:[],baseGoldCost:100,baseCombat:template.baseCombat,
 };
 state.equipment.equippedBySlot[slot]=templateId;
}

describe('weapon innate passives',()=>{
 it('grants starter dagger passives without requiring Mastery passive slots',()=>{
  const s=createInitialCharacterV2('starter');
  expect(s.masteryLoadout.passive).toEqual([]);
  const b=weaponInnateBonuses(s);
  expect(b).toMatchObject({family:'dagger',aspdBonus:3,critBonus:3,critDamageBonus:.06,dualDagger:false});
 });
 it('resolves the approved passive for all seven main-hand families',()=>{
  const expected={
   dagger:{aspdBonus:3,critBonus:3,critDamageBonus:.06},
   hammer:{hpMultiplier:1.06,defMultiplier:1.03},
   greatsword:{physicalAtkMultiplier:1.05},
   swordShield:{physicalAtkMultiplier:1.035,blockChanceBonus:0},
   staff:{matkMultiplier:1.05},
   axe:{physicalArmorPenetration:.10,physicalLifeSteal:.02},
   bow:{physicalAtkMultiplier:1.05,hitBonus:5},
  };
  for(const [family,templateId] of Object.entries(MAIN)){
   const s=createInitialCharacterV2(family);equip(s,'main',templateId);
   expect(weaponInnateBonuses(s),family).toMatchObject({family,...expected[family as keyof typeof expected]});
   expect(innateDescriptionForItem(s.equipment.instances[templateId]),family).toBeTruthy();
   expect(s.masteryLoadout.passive).toEqual([]);
  }
 });
 it('a second real dagger provides exactly 50% of main dagger bonuses; swapping or removing it revokes them',()=>{
  const s=createInitialCharacterV2('dual');
  equip(s,'offhand','t1OffhandDagger');
  expect(weaponInnateBonuses(s)).toMatchObject({dualDagger:true,aspdBonus:4.5,critBonus:4.5,critDamageBonus:.09});
  equip(s,'offhand','t1Shield');
  expect(weaponInnateBonuses(s)).toMatchObject({dualDagger:false,aspdBonus:3,critBonus:3,critDamageBonus:.06,hasShieldEquipped:true,blockChanceBonus:.05});
  equip(s,'offhand','t1OffhandDagger');equip(s,'main','mosswoodSword');
  expect(weaponInnateBonuses(s)).toMatchObject({family:'greatsword',dualDagger:false,aspdBonus:0,physicalAtkMultiplier:1.05});
  s.equipment.equippedBySlot.main=null;
  expect(weaponInnateBonuses(s)).toMatchObject({family:null,physicalAtkMultiplier:1,aspdBonus:0,blockChanceBonus:0});
 });
 it('grants shield +5% Block with any compatible one-handed main weapon; one-handed sword always gives +3.5% ATK',()=>{
  const s=createInitialCharacterV2('pair');
  equip(s,'offhand','t1Shield');
  expect(weaponInnateBonuses(s)).toMatchObject({family:'dagger',hasShieldEquipped:true,blockChanceBonus:.05,aspdBonus:3}); // Dagger + shield gains both innates.
  expect(innateDescriptionForItem(s.equipment.instances.t1Shield)).toContain('Block Chance +5');
  equip(s,'main','sporewoodScepter');
  expect(weaponInnateBonuses(s)).toMatchObject({hasShieldEquipped:true,physicalAtkMultiplier:1.035,blockChanceBonus:.05});
  equip(s,'offhand','t1OffhandDagger');
  expect(weaponInnateBonuses(s)).toMatchObject({hasShieldEquipped:false,physicalAtkMultiplier:1.035,blockChanceBonus:0});
  equip(s,'main','sporewoodWand');
  equip(s,'offhand','t1Shield');
  expect(weaponInnateBonuses(s)).toMatchObject({family:'staff',matkMultiplier:1.05,hasShieldEquipped:true,blockChanceBonus:.05});
 });
 it('recognizes all six tiers of shield and offhand dagger, without granting the pair to two-handed weapons',()=>{
  for(let tier=1;tier<=6;tier++){
   const s=createInitialCharacterV2('tier'+tier);
   equip(s,'main','sporewoodScepter');equip(s,'offhand',`t${tier}Shield`);
   expect(weaponInnateBonuses(s)).toMatchObject({physicalAtkMultiplier:1.035,blockChanceBonus:.05});
   equip(s,'main','mosswoodSword');
   expect(weaponInnateBonuses(s)).toMatchObject({hasShieldEquipped:false,blockChanceBonus:0}); // Ignore illegal stale two-handed+shield saves.
   equip(s,'main','sporefangDagger');
   equip(s,'offhand',`t${tier}Shield`);
   expect(weaponInnateBonuses(s).blockChanceBonus).toBe(.05);
   equip(s,'offhand',`t${tier}OffhandDagger`);
   expect(weaponInnateBonuses(s)).toMatchObject({aspdBonus:4.5,blockChanceBonus:0});
  }
 });
});
