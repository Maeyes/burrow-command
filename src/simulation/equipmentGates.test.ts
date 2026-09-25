import { describe,it,expect } from 'vitest';
import { createInitialCharacterV2 } from './character';
import { applyEquipmentCommand } from './equipmentService';

describe('canonical craft/equip gates',()=>{
 it('blocks planned recipes at the service boundary',()=>{
  const c=createInitialCharacterV2('planned');c.gold=999999;c.inventory={tier5Blueprint:1,starsilverOre:99,stormFeather:99,rimeCrystal:99};
  expect(()=>applyEquipmentCommand(c,{type:'craft',recipe:{templateId:'future',slot:'main',blueprintId:'tier5Blueprint',oreId:'starsilverOre',materials:[{itemId:'stormFeather',qty:1}],gold:1,baseGoldCost:1,available:false}})).toThrow('recipe-not-available');
 });
 it('blocks equipping gear above hero level',()=>{
  const c=createInitialCharacterV2('level');c.equipment.instances.high={id:'high',templateId:'high',slot:'main',rarity:'normal',affixes:[],baseGoldCost:1,requiredLevel:26};
  expect(()=>applyEquipmentCommand(c,{type:'equip',equipmentId:'high'})).toThrow('equipment-level-too-low');
 });
});
