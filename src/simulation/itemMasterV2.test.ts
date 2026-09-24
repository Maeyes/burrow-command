import { describe,it,expect } from 'vitest';
import { CRAFTABLE_EQUIPMENT_COUNT, EQUIPMENT_MASTER_V2, GLOBAL_BLUEPRINT_DROP_CHANCE, blueprintForLevel } from './itemMasterV2';
import { MONSTERS_V2 } from './monsterDataV2';

describe('canonical item/craft master v2',()=>{
 it('contains the locked 109 templates',()=>expect(CRAFTABLE_EQUIPMENT_COUNT).toBe(109));
 it('uses one global tier blueprint per craft',()=>{
  for(const item of Object.values(EQUIPMENT_MASTER_V2)){
   expect(item.recipe.blueprintId).toBe(`tier${item.tier}Blueprint`);
   expect(item.recipe.materials.length).toBeGreaterThan(0);
  }
 });
 it('keeps T1 free of boss signature materials',()=>{
  const forbidden=new Set(['bruteSpore','ancientRootHeart','duneMawFang','sunforgeCore','leaderEmblem']);
  for(const item of Object.values(EQUIPMENT_MASTER_V2).filter(x=>x.tier===1))
   expect(item.recipe.materials.some(m=>forbidden.has(m.itemId))).toBe(false);
 });
 it('marks T5 planned until its content/material sources exist',()=>expect(Object.values(EQUIPMENT_MASTER_V2).filter(x=>x.tier===5).every(x=>!x.recipe.available)).toBe(true));
});

describe('global blueprint progression',()=>{
 it('maps the locked level brackets',()=>{
  expect(blueprintForLevel(1)).toBe('tier1Blueprint');expect(blueprintForLevel(25)).toBe('tier1Blueprint');
  expect(blueprintForLevel(26)).toBe('tier2Blueprint');expect(blueprintForLevel(45)).toBe('tier2Blueprint');
  expect(blueprintForLevel(46)).toBe('tier3Blueprint');expect(blueprintForLevel(65)).toBe('tier3Blueprint');
  expect(blueprintForLevel(66)).toBe('tier4Blueprint');expect(blueprintForLevel(85)).toBe('tier4Blueprint');
  expect(blueprintForLevel(86)).toBe('tier5Blueprint');
 });
 it('gives every monster its level-tier blueprint and keeps Forest 2 compensation explicit',()=>{
  expect(GLOBAL_BLUEPRINT_DROP_CHANCE).toBe(.02);
  for(const monster of Object.values(MONSTERS_V2)){
   const expectedChance=monster.mapId==='forest2'?(monster.rank==='boss'?.05:monster.rank==='elite'?.04:.03):.02;
   expect(monster.loot.blueprint).toEqual({itemId:blueprintForLevel(monster.level),chance:expectedChance});
  }
 });
 it('removes generic crafting material ids from current monster material drops',()=>{
  const legacy=new Set(['beastPelt','fang','core']);
  for(const monster of Object.values(MONSTERS_V2)) expect(legacy.has(monster.loot.material?.itemId??'')).toBe(false);
 });
});
