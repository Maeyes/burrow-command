import { describe, expect, it } from 'vitest';
import { createInitialCharacterV2, type EquipmentInstanceStateV2 } from './character';
import { equipmentCombatTotals } from './equipmentCombat';
import { EQUIPMENT_MASTER_V2 } from './itemMasterV2';

function equip(c:ReturnType<typeof createInitialCharacterV2>,slot:string,id:string,item:Partial<EquipmentInstanceStateV2>={}){
 if(c.equipment.instances['starter-dagger'])c.equipment.instances['starter-dagger'].baseCombat=undefined;
 c.equipment.equippedBySlot[slot]=id;
 c.equipment.instances[id]={id,templateId:id,slot,rarity:'normal',affixes:[],baseGoldCost:10,...item};
}
describe('slot-bound equipment -> combat stats',()=>{
 it('grants exact offensive and defensive enhancement values',()=>{
  const c=createInitialCharacterV2('c');equip(c,'main','weapon');equip(c,'armor','armor');
  c.equipment.enhancementBySlot.main=10;c.equipment.enhancementBySlot.armor=10;
  const x=equipmentCombatTotals(c);
  expect(x.weaponAtk).toBe(10);expect(x.weaponMatk).toBe(10);
  expect(x.equipmentDef).toBe(10);expect(x.equipmentMdef).toBe(10);
 });
 it('scales intrinsic equipment stats by rarity without scaling slot enhancement',()=>{const cases=[['normal',1],['good',1.2],['rare',1.4],['epic',1.6],['legend',1.8],['mythic',2],['whiteAscended',2]] as const;for(const [rarity,mult] of cases){const c=createInitialCharacterV2(rarity);equip(c,'main','weapon',{rarity,baseCombat:{atk:10,matk:5}});c.equipment.enhancementBySlot.main=2;const x=equipmentCombatTotals(c);expect(x.weaponAtk).toBe(Math.round(10*mult)+2);expect(x.weaponMatk).toBe(Math.round(5*mult)+2);}});
 it('aggregates refinement as character-level 0.5% modifiers per level',()=>{
  const c=createInitialCharacterV2('c');equip(c,'main','weapon');equip(c,'armor','armor');
  c.equipment.refinementBySlot.main=10;c.equipment.refinementBySlot.armor=10;
  const x=equipmentCombatTotals(c);
  // 10 levels x 0.5% = 5%, plus the +5/+10 refine milestones: main +3% ATK, armor +5% HP and +5% DEF/MDEF.
  expect(x.atkMultiplier).toBeCloseTo(1.08);expect(x.matkMultiplier).toBeCloseTo(1.08);
  expect(x.defMultiplier).toBeCloseTo(1.10);expect(x.mdefMultiplier).toBeCloseTo(1.10);expect(x.maxHpMultiplier).toBeCloseTo(1.10);expect(x.critBonusPercent).toBe(3);
 });
 it('classifies weapon offhand offensive and shield offhand defensive',()=>{
  const offensive=createInitialCharacterV2('o');equip(offensive,'offhand','dagger',{offhandType:'weapon'});offensive.equipment.enhancementBySlot.offhand=3;offensive.equipment.refinementBySlot.offhand=4;
  const ox=equipmentCombatTotals(offensive);expect(ox.weaponAtk).toBe(3);expect(ox.equipmentDef).toBe(0);expect(ox.atkMultiplier).toBeCloseTo(1);expect(ox.offhandAtkMultiplier).toBeCloseTo(1.02);
  const defensive=createInitialCharacterV2('d');equip(defensive,'offhand','shield',{offhandType:'shield'});defensive.equipment.enhancementBySlot.offhand=3;defensive.equipment.refinementBySlot.offhand=4;
  const dx=equipmentCombatTotals(defensive);expect(dx.weaponAtk).toBe(0);expect(dx.equipmentDef).toBe(3);expect(dx.defMultiplier).toBeCloseTo(1.02);
 });
 it('keeps main and offhand weapon refinement isolated by hand',()=>{
  const c=createInitialCharacterV2('dual');equip(c,'main','main',{baseCombat:{atk:20}});equip(c,'offhand','off',{offhandType:'weapon',baseCombat:{atk:10}});
  c.equipment.refinementBySlot.main=10;c.equipment.refinementBySlot.offhand=4;
  const x=equipmentCombatTotals(c);expect(x.atkMultiplier).toBeCloseTo(1.08);expect(x.offhandAtkMultiplier).toBeCloseTo(1.02);
 });
 it('does not invent utility-slot progression bonuses',()=>{
  const c=createInitialCharacterV2('c');equip(c,'hat','hat');c.equipment.enhancementBySlot.hat=120;c.equipment.refinementBySlot.hat=15;
  const x=equipmentCombatTotals(c);expect(x.weaponAtk+x.weaponMatk+x.equipmentDef+x.equipmentMdef+x.equipmentMaxHp).toBe(0);expect(x.atkMultiplier).toBe(1);expect(x.maxHpMultiplier).toBe(1);
 });
 it('applies only the highest Master Refinement milestone, as percent multipliers',()=>{
  const expected={5:[1.05,1.05,1.05,1.05],10:[1.10,1.10,1.08,1.08],15:[1.15,1.15,1.12,1.12]} as const;
  for(const level of [5,10,15] as const){
   const c=createInitialCharacterV2(String(level));for(let i=0;i<6;i++){const slot='master'+i;equip(c,slot,'eq'+i);c.equipment.refinementBySlot[slot]=level;}
   const x=equipmentCombatTotals(c);expect(x.masterRefinement).toBe(level);const got=[x.atkMultiplier,x.matkMultiplier,x.maxHpMultiplier,x.maxSpMultiplier];got.forEach((v,i)=>expect(v).toBeCloseTo(expected[level][i]));
  }
 });
 it('requires six slots for Master Refinement',()=>{
  const c=createInitialCharacterV2('c');for(let i=0;i<5;i++){const slot='master'+i;equip(c,slot,'eq'+i);c.equipment.refinementBySlot[slot]=15;}
  expect(equipmentCombatTotals(c).masterRefinement).toBe(0);
 });
});

describe('refine milestones',()=>{
 it('grants +2/+4/+6 percentage points of Block at shield +5/+10/+15 for every T1–T6 shield',()=>{
  const cases=[[0,0],[4,0],[5,.02],[9,.02],[10,.04],[14,.04],[15,.06]] as const;
  for(const tier of [1,2,3,4,5,6]){
   const template=EQUIPMENT_MASTER_V2[`t${tier}Shield`];
   expect(template.offhandType).toBe('shield');
   for(const [refinement,expected] of cases){
    const c=createInitialCharacterV2(`shield-t${tier}-r${refinement}`);
    equip(c,'offhand',`t${tier}Shield`,{offhandType:template.offhandType});
    c.equipment.refinementBySlot.offhand=refinement;
    expect(equipmentCombatTotals(c).shieldBlockChanceBonus,`T${tier} +${refinement}`).toBeCloseTo(expected);
   }
  }
 });
 it('keeps Block chance bound to the shield slot, and never awards it to offhand weapons',()=>{
  const c=createInitialCharacterV2('shield-slot');
  equip(c,'offhand','test-shield',{offhandType:'shield'});
  c.equipment.refinementBySlot.offhand=15;
  expect(equipmentCombatTotals(c).shieldBlockChanceBonus).toBeCloseTo(.06);
  equip(c,'offhand','test-dagger',{offhandType:'weapon'});
  expect(equipmentCombatTotals(c).shieldBlockChanceBonus).toBe(0);
  equip(c,'offhand','new-shield',{offhandType:'shield'});
  expect(equipmentCombatTotals(c).shieldBlockChanceBonus).toBeCloseTo(.06);
 });
 it('stack per piece at +5/+10/+15',()=>{
  const c=createInitialCharacterV2('r');equip(c,'main','weapon');equip(c,'cape','cape');equip(c,'hat','hat');
  c.equipment.refinementBySlot.main=15;c.equipment.refinementBySlot.cape=15;c.equipment.refinementBySlot.hat=10;
  const x=equipmentCombatTotals(c);
  expect(x.critBonusPercent).toBe(3);expect(x.weaponSkillDamageMultiplier).toBeCloseTo(1.15);
  expect(x.fleeBonus).toBe(5);expect(x.coreCooldownMultiplier).toBeCloseTo(.95);
  expect(x.expMultiplier).toBeCloseTo(1.02);
 });
 it('give nothing below +5',()=>{
  const c=createInitialCharacterV2('r');equip(c,'shoes','shoes');c.equipment.refinementBySlot.shoes=4;
  const x=equipmentCombatTotals(c);expect(x.fleeBonus).toBe(0);expect(x.moveSpeedMultiplier).toBe(1);
 });
});
