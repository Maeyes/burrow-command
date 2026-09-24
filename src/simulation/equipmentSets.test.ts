import { describe,it,expect } from 'vitest';
import { createInitialCharacterV2 } from './character';
import { equipmentCombatTotals } from './equipmentCombat';

function setPiece(c:ReturnType<typeof createInitialCharacterV2>,slot:string,id:string,setId:string){
 c.equipment.instances[id]={id,templateId:id,slot,rarity:'normal',affixes:[],baseGoldCost:10,setId};
 c.equipment.equippedBySlot[slot]=id;
}
describe('equipment set effects',()=>{
 it('requires complete 3pc damage body set and grants the T2 multiplier',()=>{
  const c=createInitialCharacterV2('d');setPiece(c,'armor','a','t2-damage-body');setPiece(c,'cape','b','t2-damage-body');
  expect(equipmentCombatTotals(c).atkMultiplier).toBe(1);
  setPiece(c,'shoes','s','t2-damage-body');
  expect(equipmentCombatTotals(c).atkMultiplier).toBeCloseTo(1.05);expect(equipmentCombatTotals(c).matkMultiplier).toBeCloseTo(1.05);
 });
 it('requires two accessories and supports left/right copies',()=>{
  const c=createInitialCharacterV2('a');setPiece(c,'accessoryLeft','l','t2-damage-accessory');
  expect(equipmentCombatTotals(c).critBonusPercent).toBe(0);
  setPiece(c,'accessoryRight','r','t2-damage-accessory');
  expect(equipmentCombatTotals(c).critBonusPercent).toBe(5);
 });
 it('applies tank body and accessory bonuses independently',()=>{
  const c=createInitialCharacterV2('t');setPiece(c,'armor','a','t2-tank-body');setPiece(c,'cape','b','t2-tank-body');setPiece(c,'shoes','s','t2-tank-body');
  let x=equipmentCombatTotals(c);expect(x.maxHpMultiplier).toBeCloseTo(1.08);expect(x.defMultiplier).toBeCloseTo(1.05);
  setPiece(c,'accessoryLeft','l','t2-tank-accessory');setPiece(c,'accessoryRight','r','t2-tank-accessory');
  x=equipmentCombatTotals(c);expect(x.maxHpMultiplier).toBeCloseTo(1.13);
 });
 it('applies support SP economy from complete sets',()=>{
  const c=createInitialCharacterV2('s');setPiece(c,'armor','a','t4-support-body');setPiece(c,'cape','b','t4-support-body');setPiece(c,'shoes','s','t4-support-body');
  setPiece(c,'accessoryLeft','l','t4-support-accessory');setPiece(c,'accessoryRight','r','t4-support-accessory');
  const x=equipmentCombatTotals(c);expect(x.maxSpMultiplier).toBeCloseTo(1.25);expect(x.spRecoveryMultiplier).toBeCloseTo(1.35);expect(x.healingMultiplier).toBeCloseTo(1.10);expect(x.skillCostMultiplier).toBeCloseTo(.90);
 });
});
