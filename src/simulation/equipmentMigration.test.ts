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

describe('map id migration',()=>{
 it('moves v1 starter-forest saves to forest1 and forestii to forest2',()=>{
  const base=createInitialCharacterV2('c');const {mapIdVersion:_v,...legacy}=base;
  expect(normalizeCharacterStateV2({...legacy,currentMapId:'forest2',unlockedMaps:['forest2','forestii']}).currentMapId).toBe('forest1');
  expect(normalizeCharacterStateV2({...legacy,currentMapId:'forestii'}).currentMapId).toBe('forest2');
  expect(normalizeCharacterStateV2({...legacy,currentMapId:'forest2',unlockedMaps:['forest2','forestii']}).unlockedMaps).toEqual(['forest1','forest2']);
 });
 it('leaves v2 saves alone and is idempotent',()=>{
  const once=normalizeCharacterStateV2({...createInitialCharacterV2('c'),currentMapId:'forest2'});
  expect(once.currentMapId).toBe('forest2');expect(normalizeCharacterStateV2(once).currentMapId).toBe('forest2');
 });
});
