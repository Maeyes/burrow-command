import {describe,expect,it} from 'vitest';
import {MONSTERS_V2} from './monsterDataV2';
import {UTILITY_EQUIPMENT_V2} from './utilityEquipmentV2';
describe('drop-only utility equipment',()=>{
 it('keeps hat face mouth outside craft master and gives every utility item a source',async()=>{
  const {EQUIPMENT_MASTER_V2}=await import('./itemMasterV2');
  const craftIds=new Set(Object.keys(EQUIPMENT_MASTER_V2));
  for(const item of Object.values(UTILITY_EQUIPMENT_V2)){
   expect(['hat','face','mouth']).toContain(item.slot);
   expect(craftIds.has(item.id)).toBe(false);
   expect(Object.values(MONSTERS_V2).some(m=>(m.loot.equipmentDrops??[]).some(d=>d.itemId===item.id))).toBe(true);
  }
 });
});
