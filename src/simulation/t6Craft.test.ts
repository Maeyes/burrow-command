import { describe,expect,it } from 'vitest';
import { EQUIPMENT_MASTER_V2 } from './itemMasterV2';
import { createInitialCharacterV2, grantCharacterExpV2, expToNextLevelV2 } from './character';
import { applyEquipmentCommand } from './equipmentService';
import { inventoryItemMeta } from './itemTagsV2';

describe('T6 crafting',()=>{
 it('every T6 template crafts at its required level with its recipe items',()=>{
  const t6=Object.values(EQUIPMENT_MASTER_V2).filter(t=>t.tier===6);
  expect(t6.length).toBeGreaterThan(0);
  for(const t of t6){
   let c=createInitialCharacterV2('t6');for(let l=1;l<t.requiredLevel;l++)c=grantCharacterExpV2(c,expToNextLevelV2(l));
   const r=t.recipe;c={...c,gold:1e12,inventory:{...c.inventory,...Object.fromEntries([r.blueprintId,r.oreId,...r.materials.map(m=>m.itemId)].map(id=>[id,1e6]))}};
   const res=applyEquipmentCommand(c,{type:'craft',recipe:{templateId:t.id,slot:t.slot,blueprintId:r.blueprintId,oreId:r.oreId,oreQty:r.oreQty,materials:r.materials,gold:r.gold,baseGoldCost:t.baseGoldCost,baseCombat:t.baseCombat,setId:t.setId,requiredLevel:t.requiredLevel}},()=>0);
   expect(res.createdEquipmentId,t.id).toBeTruthy();
  }
  expect(inventoryItemMeta('tier6Blueprint').category).toBe('Blueprint');
 });
});

describe('Enhance All (max)',()=>{
 it('spreads levels evenly, stops at hero level and when stones run out',()=>{
  const t=Object.values(EQUIPMENT_MASTER_V2).filter(x=>x.tier===1&&(x.slot==='main'||x.slot==='armor'));
  let c=createInitialCharacterV2('ea');for(let l=1;l<10;l++)c=grantCharacterExpV2(c,expToNextLevelV2(l));
  for(const tpl of t){const r=tpl.recipe;c={...c,gold:1e9,inventory:{...c.inventory,...Object.fromEntries([r.blueprintId,r.oreId,...r.materials.map(m=>m.itemId)].map(id=>[id,99]))}};
   const res=applyEquipmentCommand(c,{type:'craft',recipe:{templateId:tpl.id,slot:tpl.slot,blueprintId:r.blueprintId,oreId:r.oreId,oreQty:r.oreQty,materials:r.materials,gold:r.gold,baseGoldCost:tpl.baseGoldCost,baseCombat:tpl.baseCombat,setId:tpl.setId,requiredLevel:tpl.requiredLevel}},()=>0);
   c=applyEquipmentCommand(res.state,{type:'equip',equipmentId:res.createdEquipmentId!}).state;}
  c.inventory.verdantAetherstone=5;
  const res=applyEquipmentCommand(c,{type:'enhanceAll'});
  const lv=Object.values(res.state.equipment.enhancementBySlot);
  expect(lv.reduce((a,b)=>a+b,0)).toBe(5);
  expect(Math.max(...lv)-Math.min(...lv)).toBeLessThanOrEqual(1);
  res.state.inventory.verdantAetherstone=999;
  const full=applyEquipmentCommand(res.state,{type:'enhanceAll'}).state;
  expect(Object.values(full.equipment.enhancementBySlot).every(v=>v===full.level)).toBe(true);
  expect(()=>applyEquipmentCommand(full,{type:'enhanceAll'})).toThrow('nothing-to-enhance');
 });
});
