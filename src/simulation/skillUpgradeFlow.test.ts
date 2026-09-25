import { describe,expect,it } from 'vitest';
import { createInitialCharacterV2 } from './character';
import { ArenaV2Adapter } from './arenaAdapter';
import { normalizeCharacterStateV2 } from './equipmentMigration';
import {
 applySkillCoreCommand,availableSkillUpgradeCopies,equippedSkillItemCount,
 movementSkillDistanceBonus,skillCoreDamageMultiplier,skillItemUpgradeQuote,skillUpgradeKind
} from './skillCoreService';

describe('Shared Skill Core / Mod / Movement upgrades',()=>{
 it('excludes the installed core from upgrade materials and consumes only spare copies',()=>{
  let c=createInitialCharacterV2('core');c.inventory.fireball=1;c.gold=10000;
  c=applySkillCoreCommand(c,{type:'equipCore',coreId:'fireball',slot:0});
  let quote=skillItemUpgradeQuote(c,'fireball')!;
  expect(quote).toMatchObject({kind:'core',totalOwned:1,reserved:1,availableDuplicates:0,duplicateQty:2,gold:10000,successRate:1});
  expect(()=>applySkillCoreCommand(c,{type:'upgradeCore',coreId:'fireball'},()=>0)).toThrow('not-enough-duplicate-cores');
  c.inventory.fireball=3;quote=skillItemUpgradeQuote(c,'fireball')!;
  expect(quote.availableDuplicates).toBe(2);
  c=applySkillCoreCommand(c,{type:'upgradeCore',coreId:'fireball'},()=>0);
  expect(c.inventory.fireball).toBe(1);
  expect(c.gold).toBe(0);
  expect(c.skills.active[0]).toBe('fireball');
  expect(c.skills.coreRarity?.fireball).toBe('good');
  expect(skillCoreDamageMultiplier(c,'fireball')).toBeCloseTo(1.1);
 });
 it('charges the same gold and success schedule when upgrading a Skill Mod but requires triple the duplicate quantity',()=>{
  let c=createInitialCharacterV2('mod');c.inventory.fireball=1;c.inventory.lingering=7;c.gold=10000;
  c=applySkillCoreCommand(c,{type:'equipCore',coreId:'fireball',slot:0});
  c=applySkillCoreCommand(c,{type:'equipModifier',coreId:'fireball',modifierId:'lingering',modSlot:0});
  const quote=skillItemUpgradeQuote(c,'lingering')!;
  expect(quote).toMatchObject({kind:'modifier',duplicateQty:6,reserved:1,availableDuplicates:6,gold:10000,successRate:1});
  c=applySkillCoreCommand(c,{type:'upgradeModifier',modifierId:'lingering'},()=>0);
  expect(c.inventory.lingering).toBe(1);
  expect(c.skills.modifiersByActive.fireball[0]).toBe('lingering');
  expect(c.skills.coreRarity?.lingering).toBe('good');
  const a=new ArenaV2Adapter({zoneId:'forest1',player:{x:0,y:0},monsters:[],character:c});
  expect(a.simulation.world.players.get(a.playerId)?.skillModifierMultipliers?.lingering).toBeCloseTo(1.1);
 });
 it('reserves every installed duplicate Mod and will not equip two copies from one owned item',()=>{
  let c=createInitialCharacterV2('duplicate');c.inventory.fireball=1;c.inventory.lingering=1;c.gold=100000;
  c=applySkillCoreCommand(c,{type:'equipCore',coreId:'fireball',slot:0});
  c=applySkillCoreCommand(c,{type:'equipModifier',coreId:'fireball',modifierId:'lingering',modSlot:0});
  expect(()=>applySkillCoreCommand(c,{type:'equipModifier',coreId:'fireball',modifierId:'lingering',modSlot:1})).toThrow('skill-mod-not-owned');
  c.inventory.lingering=2;
  c=applySkillCoreCommand(c,{type:'equipModifier',coreId:'fireball',modifierId:'lingering',modSlot:1});
  expect(equippedSkillItemCount(c,'lingering')).toBe(2);
  expect(availableSkillUpgradeCopies(c,'lingering')).toBe(0);
  c.inventory.lingering=7;
  expect(()=>applySkillCoreCommand(c,{type:'upgradeModifier',modifierId:'lingering'},()=>0)).toThrow('not-enough-duplicate-cores');
  c.inventory.lingering=8;
  c=applySkillCoreCommand(c,{type:'upgradeModifier',modifierId:'lingering'},()=>0);
  expect(c.inventory.lingering).toBe(2);
  expect(c.skills.modifiersByActive.fireball).toEqual(['lingering','lingering']);
 });
 it('moves one world unit farther for each successful Movement Core tier and persists across refresh',()=>{
  let c=createInitialCharacterV2('movement');c.inventory.dash=3;c.gold=10000;
  c=applySkillCoreCommand(c,{type:'equipMovementCore',coreId:'dash'});
  expect(skillItemUpgradeQuote(c,'dash')).toMatchObject({kind:'movement',duplicateQty:2,reserved:1,availableDuplicates:2,currentDistance:130,nextDistance:131});
  c=applySkillCoreCommand(c,{type:'upgradeMovementCore',coreId:'dash'},()=>0);
  expect(c.skills.coreRarity?.dash).toBe('good');
  expect(c.inventory.dash).toBe(1);
  expect(movementSkillDistanceBonus(c,'dash')).toBe(1);
  const saved=normalizeCharacterStateV2(JSON.parse(JSON.stringify(c)));
  const a=new ArenaV2Adapter({zoneId:'forest1',player:{x:0,y:0},monsters:[],character:saved});
  expect(a.simulation.world.players.get(a.playerId)?.movementSkillDistanceBonuses?.dash).toBe(1);
  const cast=a.castSkill('dash',undefined,undefined,{x:1,y:0});
  expect(cast.accepted).toBe(true);
  expect(a.simulation.world.players.get(a.playerId)?.position.x).toBe(131);
 });
 it('preserves upgraded Movement distance on large maps and stops at authored obstacles',()=>{
  let c=createInitialCharacterV2('world-distance');c.inventory.dash=3;c.gold=10000;
  c=applySkillCoreCommand(c,{type:'equipMovementCore',coreId:'dash'});
  c=applySkillCoreCommand(c,{type:'upgradeMovementCore',coreId:'dash'},()=>0);
  const open=new ArenaV2Adapter({zoneId:'forest1',player:{x:4000,y:4000},monsters:[],character:c,walkableContains:()=>true});
  expect(open.castSkill('dash',undefined,undefined,{x:1,y:0}).accepted).toBe(true);
  expect(open.simulation.world.players.get(open.playerId)?.position.x).toBe(4131);
  const wall=new ArenaV2Adapter({zoneId:'forest1',player:{x:4000,y:4000},monsters:[],character:c,walkableContains:pos=>pos.x<=4050});
  expect(wall.castSkill('dash',undefined,undefined,{x:1,y:0}).accepted).toBe(true);
  const landed=wall.simulation.world.players.get(wall.playerId)!.position.x;
  expect(landed).toBeGreaterThan(4000);
  expect(landed).toBeLessThanOrEqual(4050);
 });

 it('keeps the installed rarity after a failed roll while consuming gold and only spare duplicates',()=>{
  let c=createInitialCharacterV2('failure');c.inventory.blink=3;c.gold=10000;
  c=applySkillCoreCommand(c,{type:'equipMovementCore',coreId:'blink'});
  c=applySkillCoreCommand(c,{type:'upgradeMovementCore',coreId:'blink'},()=>0);
  c.inventory.blink=3;c.gold=30000;
  expect(skillItemUpgradeQuote(c,'blink')).toMatchObject({successRate:.70,duplicateQty:2,gold:30000});
  c=applySkillCoreCommand(c,{type:'upgradeMovementCore',coreId:'blink'},()=>.99);
  expect(c.skills.coreRarity?.blink).toBe('good');
  expect(c.inventory.blink).toBe(1);
  expect(c.gold).toBe(0);
  expect(movementSkillDistanceBonus(c,'blink')).toBe(1);
 });
 it('rejects wrong upgrade category and max-rarity upgrades',()=>{
  let c=createInitialCharacterV2('max');c.inventory.fireball=3;c.gold=1000000;
  c=applySkillCoreCommand(c,{type:'equipCore',coreId:'fireball',slot:0});
  expect(skillUpgradeKind('fireball')).toBe('core');
  expect(skillUpgradeKind('dash')).toBe('movement');
  expect(skillUpgradeKind('lingering')).toBe('modifier');
  expect(()=>applySkillCoreCommand(c,{type:'upgradeMovementCore',coreId:'fireball'})).toThrow('invalid-skill-upgrade-kind');
  c.skills.coreRarity={fireball:'whiteAscended'};
  expect(skillItemUpgradeQuote(c,'fireball')).toBeNull();
  expect(()=>applySkillCoreCommand(c,{type:'upgradeCore',coreId:'fireball'})).toThrow('skill-item-max-rarity');
 });
});
