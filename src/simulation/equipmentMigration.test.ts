import{describe,expect,it}from'vitest';
import{createInitialCharacterV2}from'./character';
import{normalizeCharacterStateV2}from'./equipmentMigration';

describe('slot-bound equipment migration',()=>{
 it('migrates equipped legacy refine to slot and strips item progression fields',()=>{
  const s=createInitialCharacterV2('c');const legacy=s as any;legacy.equipment.instances['starter-dagger'].refine=9;legacy.equipment.instances['starter-dagger'].enhancementGrowth={atk:99};
  const n=normalizeCharacterStateV2(legacy);expect(n.equipment.refinementBySlot.main).toBe(9);expect(n.equipment.instances['starter-dagger']).not.toHaveProperty('refine');expect(n.equipment.instances['starter-dagger']).not.toHaveProperty('enhancementGrowth');
 });
 it('preserves existing slot refinement instead of overwriting it from a legacy item',()=>{
  const s=createInitialCharacterV2('c');const legacy=s as any;legacy.equipment.refinementBySlot={main:12};legacy.equipment.instances['starter-dagger'].refine=3;
  expect(normalizeCharacterStateV2(legacy).equipment.refinementBySlot.main).toBe(12);
 });
});
