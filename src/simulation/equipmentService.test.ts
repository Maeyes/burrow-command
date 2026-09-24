import{describe,expect,it}from'vitest';
import{createInitialCharacterV2,type CharacterStateV2}from'./character';
import{applyEquipmentCommand,type CraftRecipeV2}from'./equipmentService';

const recipe:CraftRecipeV2={templateId:'ironwoodSword',slot:'main',blueprintId:'weaponBlueprintT1',oreId:'copperOre',materialId:'fang',materialQty:1,gold:20,baseGoldCost:20};
function funded(level=120):CharacterStateV2{const s=createInitialCharacterV2('c');return{...s,level,stats:{...s.stats,level},gold:1000000,inventory:{weaponBlueprintT1:10,copperOre:100,fang:50,verdantAetherstone:100,azureAetherstone:100,violetAetherstone:100,astraliteStone:1000,optionStone:20,reoptionStone:20,refineProtectionLv1:100,refineProtectionLv2:100}}}
describe('equipment lifecycle service',()=>{
 it('crafts intrinsic-only instances',()=>{const r=applyEquipmentCommand(funded(),{type:'craft',recipe},()=>0);const x=r.state.equipment.instances[r.createdEquipmentId!];expect(x).not.toHaveProperty('refine');expect(x).not.toHaveProperty('enhancementGrowth')});
 it('never reuses an existing equipment UID after a runtime sequence reset/collision',()=>{let s=funded();s.equipment.instances['eq-ironwoodSword-1']={id:'eq-ironwoodSword-1',templateId:'ironwoodSword',slot:'main',rarity:'normal',affixes:[],baseGoldCost:20};s.equipment.equippedBySlot.main='eq-ironwoodSword-1';const r=applyEquipmentCommand(s,{type:'craft',recipe},()=>0);expect(r.createdEquipmentId).not.toBe('eq-ironwoodSword-1');expect(r.state.equipment.equippedBySlot.main).toBe('eq-ironwoodSword-1');expect(Object.keys(r.state.equipment.instances)).toContain(r.createdEquipmentId!);});
 it('enhancement survives replacement and cannot exceed hero level',()=>{
  let s=funded(1);const first=applyEquipmentCommand(s,{type:'craft',recipe},()=>0);s=applyEquipmentCommand(first.state,{type:'equip',equipmentId:first.createdEquipmentId!}).state;
  s=applyEquipmentCommand(s,{type:'enhance',slot:'main'}).state;expect(s.equipment.enhancementBySlot.main).toBe(1);expect(()=>applyEquipmentCommand(s,{type:'enhance',slot:'main'})).toThrow('enhancement-above-hero-level');
  const second=applyEquipmentCommand(s,{type:'craft',recipe},()=>0);s=applyEquipmentCommand(second.state,{type:'equip',equipmentId:second.createdEquipmentId!}).state;expect(s.equipment.enhancementBySlot.main).toBe(1);
 });
 it('refinement survives replacement and is never stored on items',()=>{
  let s=funded();const first=applyEquipmentCommand(s,{type:'craft',recipe},()=>0);s=applyEquipmentCommand(first.state,{type:'equip',equipmentId:first.createdEquipmentId!}).state;
  s=applyEquipmentCommand(s,{type:'refine',slot:'main'},()=>0).state;expect(s.equipment.refinementBySlot.main).toBe(1);expect(s.equipment.instances[first.createdEquipmentId!]).not.toHaveProperty('refine');
  const second=applyEquipmentCommand(s,{type:'craft',recipe},()=>0);s=applyEquipmentCommand(second.state,{type:'equip',equipmentId:second.createdEquipmentId!}).state;expect(s.equipment.refinementBySlot.main).toBe(1);expect(s.equipment.instances[second.createdEquipmentId!]).not.toHaveProperty('refine');
 });
 it('consumes the correct Aetherstone target bracket',()=>{
  let s=funded();const c=applyEquipmentCommand(s,{type:'craft',recipe},()=>0);s=applyEquipmentCommand(c.state,{type:'equip',equipmentId:c.createdEquipmentId!}).state;
  s={...s,equipment:{...s.equipment,enhancementBySlot:{...s.equipment.enhancementBySlot,main:39}}};const v=s.inventory.verdantAetherstone;s=applyEquipmentCommand(s,{type:'enhance',slot:'main'}).state;expect(s.inventory.verdantAetherstone).toBe(v-1);
  s={...s,equipment:{...s.equipment,enhancementBySlot:{...s.equipment.enhancementBySlot,main:40}}};const a=s.inventory.azureAetherstone;s=applyEquipmentCommand(s,{type:'enhance',slot:'main'}).state;expect(s.inventory.azureAetherstone).toBe(a-1);
  s={...s,equipment:{...s.equipment,enhancementBySlot:{...s.equipment.enhancementBySlot,main:80}}};const violet=s.inventory.violetAetherstone;s=applyEquipmentCommand(s,{type:'enhance',slot:'main'}).state;expect(s.inventory.violetAetherstone).toBe(violet-1);
 });
 it('refinement failure respects safe floors and protection',()=>{
  let s=funded();const c=applyEquipmentCommand(s,{type:'craft',recipe},()=>0);s=applyEquipmentCommand(c.state,{type:'equip',equipmentId:c.createdEquipmentId!}).state;
  s={...s,equipment:{...s.equipment,refinementBySlot:{main:9}}};expect(applyEquipmentCommand(s,{type:'refine',slot:'main'},()=>.99).state.equipment.refinementBySlot.main).toBe(9);
  s={...s,equipment:{...s.equipment,refinementBySlot:{main:8}}};expect(applyEquipmentCommand(s,{type:'refine',slot:'main'},()=>.99).state.equipment.refinementBySlot.main).toBe(7);
  expect(applyEquipmentCommand(s,{type:'refine',slot:'main',protectedAttempt:true},()=>.99).state.equipment.refinementBySlot.main).toBe(8);
 });
 it('gear swapping cannot transfer or reset progression between slots',()=>{
  let s=funded();s.equipment.enhancementBySlot={main:12,armor:7};s.equipment.refinementBySlot={main:6,armor:3};
  const c=applyEquipmentCommand(s,{type:'craft',recipe},()=>0);s=applyEquipmentCommand(c.state,{type:'equip',equipmentId:c.createdEquipmentId!}).state;
  expect(s.equipment.enhancementBySlot).toEqual({main:12,armor:7});expect(s.equipment.refinementBySlot).toEqual({main:6,armor:3});
  s=applyEquipmentCommand(s,{type:'unequip',slot:'main'}).state;expect(s.equipment.enhancementBySlot.main).toBe(12);expect(s.equipment.refinementBySlot.main).toBe(6);
 });
});
