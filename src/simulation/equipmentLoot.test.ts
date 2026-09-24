import {describe,expect,it} from 'vitest';
import {createInitialCharacterV2} from './character';
import {grantLootWithEquipment} from './equipmentLoot';
describe('equipment loot pipeline',()=>{
 it('turns drop-only utility loot into rolled equipment instances instead of stack items',()=>{
  const c=createInitialCharacterV2('drop');
  const next=grantLootWithEquipment(c,{gold:7,items:{mushroomCap:1,livingMoss:2}},()=>.9);
  expect(next.gold).toBe(7);expect(next.inventory.livingMoss).toBe(2);expect(next.inventory.mushroomCap).toBeUndefined();
  const item=Object.values(next.equipment.instances).find(x=>x.templateId==='mushroomCap');
  expect(item).toBeTruthy();expect(item?.slot).toBe('hat');expect(item?.requiredLevel).toBe(5);
  expect(item?.rarity).not.toBe('normal');expect(item?.affixes.length).toBeGreaterThanOrEqual(0);
 });
});
