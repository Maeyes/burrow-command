import {describe,it,expect} from 'vitest';
import {CLASS_CORE_UNLOCK,CLASS_MOD_UNLOCKS,defaultClassSkills,normalizeClassSkills,classSkillProxy,classSkillQuote,applyBurrowSkillCommand,classActiveCores} from './warren-class-cores.js';
import {renderClassCoreHtml} from './warren-class-core-ui.js';
import {SKILLS_V2} from '../../src/simulation/skills.ts';
import {SKILL_MODIFIERS_V2} from '../../src/simulation/skillModifiersV2.ts';
import {skillItemUpgradeQuote} from '../../src/simulation/skillCoreService.ts';
import {HIT_COLORS,BASE_CRIT_DAMAGE,rollWarrenCrit,rollMasteryProc,hitFeedback} from './warren-hit-feedback.js';
const state=()=>({warren:10,night:false,gold:40000,inventory:{fireball:3,lifeDrain:2,dash:1,piercingShot:1,rapidCasting:1},classSkills:defaultClassSkills()});
const classes=Object.fromEntries(['guard','archer','scout','brute','axe','vanguard','mage'].map(cls=>[cls,{name:cls,icon:'🐰'}]));
describe('Burrow reuses main-game Skill Core and Modifier authority',()=>{
 it('uses real main-game Core/Mods, three slots, independent movement, and Warren 10/20/30 gates',()=>{
  expect(CLASS_CORE_UNLOCK).toBe(10);
  expect(CLASS_MOD_UNLOCKS).toEqual([20,30]);
  expect(defaultClassSkills().mage.active).toEqual([null,null,null]);
  expect(SKILLS_V2.fireball.kind).toBe('active');
  expect(SKILL_MODIFIERS_V2.lifeDrain.name).toBe('Life Drain');
  expect(SKILLS_V2.arcBolt.kind).toBe('weapon'); // not an invented core
  const s=state();s.warren=9;
  expect(()=>applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'fireball',slot:0})).toThrow('warren-core-locked');
  s.warren=10;
  applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'fireball',slot:0});
  expect(classActiveCores(s,'mage')[0]).toBe(SKILLS_V2.fireball);
  expect(()=>applyBurrowSkillCommand(s,'mage',{type:'equipModifier',coreId:'fireball',modifierId:'lifeDrain',modSlot:0})).toThrow('warren-mod-locked');
  s.warren=20;
  applyBurrowSkillCommand(s,'mage',{type:'equipModifier',coreId:'fireball',modifierId:'lifeDrain',modSlot:0});
  expect(()=>applyBurrowSkillCommand(s,'mage',{type:'equipModifier',coreId:'fireball',modifierId:'rapidCasting',modSlot:1})).toThrow('warren-mod-locked');
  s.warren=30;
  applyBurrowSkillCommand(s,'mage',{type:'equipModifier',coreId:'fireball',modifierId:'rapidCasting',modSlot:1});
  applyBurrowSkillCommand(s,'mage',{type:'equipMovementCore',coreId:'dash'});
  expect(s.classSkills.mage.movement).toBe('dash');
  const recovered=normalizeClassSkills(JSON.parse(JSON.stringify(s.classSkills)));
  expect(recovered.mage.modifiersByActive.fireball).toEqual(['lifeDrain','rapidCasting']);
  expect(recovered.mage.movement).toBe('dash');
 });
 it('uses actual monster-owned items, family compatibility and global copy reservations',()=>{
  const s=state();
  s.inventory.fireball=1;
  expect(()=>applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'piercingShot',slot:0})).toThrow('incompatible-weapon-family');
  applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'fireball',slot:0});
  expect(classSkillProxy(s,'archer').inventory.fireball).toBe(0);
  expect(()=>applyBurrowSkillCommand(s,'archer',{type:'equipCore',coreId:'fireball',slot:0})).toThrow('skill-core-not-owned');
  applyBurrowSkillCommand(s,'mage',{type:'unequipCore',slot:0});
  expect(classSkillProxy(s,'archer').inventory.fireball).toBe(1);
  s.night=true;
  expect(()=>applyBurrowSkillCommand(s,'archer',{type:'equipCore',coreId:'fireball',slot:0})).toThrow('daytime-only');
 });
 it('forbids a duplicate Core inside one class even with multiple owned copies and heals corrupt saves',()=>{
  const s=state();s.inventory.fireball=4;
  applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'fireball',slot:0});
  expect(()=>applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'fireball',slot:1}))
    .toThrow('skill-core-already-equipped');
  expect(()=>applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'fireball'}))
    .toThrow('skill-core-already-equipped');
  expect(s.classSkills.mage.active).toEqual(['fireball',null,null]);
  // Repeat-selecting the SAME slot is safe, but moving requires unequip first.
  expect(()=>applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'fireball',slot:0})).not.toThrow();
  s.coreClass='mage';
  const html=renderClassCoreHtml(s,classes);
  expect((html.match(/option value="fireball"/g)||[])).toHaveLength(1);
  const corrupt=JSON.parse(JSON.stringify(s.classSkills));
  corrupt.mage.active=['fireball','fireball','fireball'];
  expect(normalizeClassSkills(corrupt).mage.active).toEqual(['fireball',null,null]);
  applyBurrowSkillCommand(s,'mage',{type:'unequipCore',slot:0});
  applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'fireball',slot:1});
  expect(s.classSkills.mage.active).toEqual([undefined,'fireball',null]);
 });
 it('main service authorizes exact Core rarity cost, duplicate consumption and Gold',()=>{
  const s=state();
  applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'fireball',slot:0});
  const official=skillItemUpgradeQuote(classSkillProxy(s,'mage'),'fireball'),quote=classSkillQuote(s,'mage','fireball');
  expect(quote).toEqual(official);
  expect(quote).toMatchObject({gold:10000,duplicateQty:2,availableDuplicates:2,successRate:1});
  const before=s.gold;
  applyBurrowSkillCommand(s,'mage',{type:'upgradeCore',coreId:'fireball'},()=>0);
  expect(s.classSkills.mage.coreRarity.fireball).toBe('good');
  expect(s.inventory.fireball).toBe(1);
  expect(s.gold).toBe(before-quote.gold);
 });
 it('salvages only spare Core/Mod copies and exchanges only discovered items through the main service',()=>{
  const s=state();s.inventory.fireball=2;
  applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'fireball',slot:0});
  s.inventory.coreShard=0;
  applyBurrowSkillCommand(s,'mage',{type:'salvageSkillItem',itemId:'fireball',qty:1});
  expect(s.inventory.fireball).toBe(1);
  expect(s.inventory.coreShard).toBe(1);
  expect(()=>applyBurrowSkillCommand(s,'archer',{type:'salvageSkillItem',itemId:'fireball'})).toThrow('skill-item-not-spare');
  expect(()=>applyBurrowSkillCommand(s,'mage',{type:'exchangeShards',itemId:'fireball'})).toThrow('not-enough-shards');
  s.inventory.coreShard=3;
  applyBurrowSkillCommand(s,'mage',{type:'exchangeShards',itemId:'fireball'});
  expect(s.inventory.fireball).toBe(2);expect(s.inventory.coreShard).toBe(0);
  s.warren=20;
  applyBurrowSkillCommand(s,'mage',{type:'equipModifier',coreId:'fireball',modifierId:'lifeDrain',modSlot:0});
  s.inventory.modShard=0;
  applyBurrowSkillCommand(s,'mage',{type:'salvageSkillItem',itemId:'lifeDrain'});
  expect(s.inventory.lifeDrain).toBe(1);expect(s.inventory.modShard).toBe(1);
 });
 it('shows only genuine owned skills and mods with three slots and a movement slot',()=>{
  const s=state(),html=renderClassCoreHtml(s,classes);
  expect(html).toContain('data-core-choose="0"');
  expect(html).toContain('data-core-choose="1"');
  expect(html).toContain('data-core-choose="2"');
  expect(html).toContain('data-movement-choose');
  expect(html).toContain('Fireball');
  expect(html).toContain('Life Drain');
  expect(html).not.toContain('Shadow Dash');
  expect(html).not.toContain('Bulwark');
 });
});
describe('Burrow proc text and crit share the main game presentation',()=>{
 it('dagger Double Attack rolls separate follow-up damage and crit at Lv40',()=>{
  expect(rollMasteryProc('dagger',[],()=>0)).toBeNull();
  expect(rollMasteryProc('dagger',[10],()=>.19)).toEqual({kind:'double',ratio:1,criticalAllowed:false});
  expect(rollMasteryProc('dagger',[10,20],()=>.24)?.kind).toBe('double');
  expect(rollMasteryProc('dagger',[10,20],()=>.25)).toBeNull();
  expect(rollMasteryProc('dagger',[10,20,40,50],()=>.29)).toEqual({kind:'double',ratio:1,criticalAllowed:true});
 });
 it('bow Additional Hit applies correct tier and Greatsword Cleave hits secondary only',()=>{
  expect(rollMasteryProc('bow',[10],()=>.14)).toMatchObject({kind:'additional',ratio:.5});
  expect(rollMasteryProc('bow',[10,20,50],()=>.24)).toMatchObject({kind:'additional',ratio:.75});
  expect(rollMasteryProc('bow',[10],()=>.2)).toBeNull();
  expect(rollMasteryProc('greatsword',[10,20,40,50],()=>.99)).toMatchObject({kind:'cleave',ratio:1,range:82});
  expect(rollMasteryProc('greatsword',[10,30],()=>.99)).toMatchObject({ratio:.5,range:104});
 });
 it('critical chance and damage use main combat math rather than a fixed 12%',()=>{
  expect(BASE_CRIT_DAMAGE).toBe(1.5);
  expect(rollWarrenCrit(0,0,()=>.009)).toBe(true);
  expect(rollWarrenCrit(0,0,()=>.1)).toBe(false);
  expect(rollWarrenCrit(0,19,()=>.19)).toBe(true);
 });
 it('uses exact gold crit, cyan Double Attack and violet Additional Hit',()=>{
  expect(hitFeedback(83,{critical:true})).toMatchObject({text:'CRITICAL! ★  83',color:HIT_COLORS.critical});
  expect(hitFeedback(42,{kind:'double'})).toMatchObject({text:'DOUBLE ATTACK!  42',color:HIT_COLORS.double});
  expect(hitFeedback(31,{kind:'additional'})).toMatchObject({text:'ADDITIONAL HIT!  31',color:HIT_COLORS.additional});
  expect(hitFeedback(37,{kind:'double',critical:true})).toMatchObject({text:'DOUBLE ATTACK! ★  37',color:HIT_COLORS.critical});
 });
});
