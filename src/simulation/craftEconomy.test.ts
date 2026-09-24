import { describe,it,expect } from 'vitest';
import { EQUIPMENT_MASTER_V2, equipmentTierForLevel } from './itemMasterV2';
import { MONSTERS_V2 } from './monsterDataV2';

const sources=(itemId:string)=>Object.values(MONSTERS_V2).filter(m=>m.loot.oreItemId===itemId||m.loot.material?.itemId===itemId);
describe('craft economy reachability',()=>{
 it('every available recipe ingredient has at least one current monster source',()=>{
  for(const item of Object.values(EQUIPMENT_MASTER_V2).filter(x=>x.recipe.available)){
   expect(sources(item.recipe.oreId).length,`${item.id} ore ${item.recipe.oreId}`).toBeGreaterThan(0);
   for(const mat of item.recipe.materials)expect(sources(mat.itemId).length,`${item.id} material ${mat.itemId}`).toBeGreaterThan(0);
  }
 });
 it('available T2-T4 recipes use ingredients farmable inside their own level tier',()=>{
  for(const item of Object.values(EQUIPMENT_MASTER_V2).filter(x=>x.recipe.available&&x.tier>=2)){
   for(const id of [item.recipe.oreId,...item.recipe.materials.map(m=>m.itemId)]){
    expect(sources(id).some(m=>equipmentTierForLevel(m.level)===item.tier),`${item.id} ${id}`).toBe(true);
   }
  }
 });
 it('T1 remains boss independent',()=>{
  for(const item of Object.values(EQUIPMENT_MASTER_V2).filter(x=>x.tier===1))
   for(const id of [item.recipe.oreId,...item.recipe.materials.map(m=>m.itemId)])
    expect(sources(id).some(m=>m.rank!=='boss')).toBe(true);
 });
});
