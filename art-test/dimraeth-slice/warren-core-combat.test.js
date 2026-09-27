import {describe,it,expect} from 'vitest';
import {SKILLS_V2} from '../../src/simulation/skills.ts';
import {defaultClassSkills,applyBurrowSkillCommand} from './warren-class-cores.js';
import {burrowMaxSp,regenBurrowSp,chooseBurrowCore,resolveBurrowCore,resolveBurrowMovement} from './warren-core-combat.js';
const BASE={warren:10,time:120,night:false,gold:50000};
const state=(cls,id,mod)=>{
 const s={...BASE,inventory:{[id]:3,[mod||'lifeDrain']:2},classSkills:defaultClassSkills()};
 applyBurrowSkillCommand(s,cls,{type:'equipCore',coreId:id,slot:0});
 if(mod)applyBurrowSkillCommand(s,cls,{type:'equipModifier',coreId:id,modifierId:mod,modSlot:0});
 return s;
};
const unit=(cls='mage')=>({cls,level:15,atk:100,maxHp:250,hp:250,sp:100,maxSp:100,x:1200,y:1200,down:false,luk:0,critBonus:0});
const monster=(id=1,x=1240,y=1200)=>({id,type:'stoneMossblob',x,y,hp:5000,maxHp:5000,atk:10,range:38,speed:78,elite:false,boss:false,dead:false});
describe('Burrow uses the main BunnySimulation skill executor rather than homebrew Core damage',()=>{
 it.each([
  ['guard','barrier'],['archer','piercingShot'],['scout','bladeRush'],
  ['brute','groundSlam'],['axe','cyclone'],['vanguard','bladeRush'],['mage','fireball'],
 ])('%s can cast genuine %s through authoritative simulation', (cls,id)=>{
  const s=state(cls,id),u=unit(cls),m=monster(),result=resolveBurrowCore(s,u,m,[m],id,()=>.5);
  expect(SKILLS_V2[id]?.kind).toBe('active');
  expect(result.accepted,result.reason).toBe(true);
  expect(result.events.some(e=>e.type==='skillCast'&&e.skillId===id)).toBe(true);
  expect(result.events.some(e=>e.type==='cooldownStarted'&&e.abilityId===id)).toBe(true);
  if(id==='barrier')expect(result.player.barrierHp).toBeGreaterThan(0);
  else expect(result.world.monsters.get('burrow-monster-1').hp).toBeLessThan(5000);
 });
 it('auto-casts every ready active Core, including previously elite-reserved or AoE-only ones',()=>{
  const s=state('mage','fireball'),u=unit('mage'),m=monster();
  s.inventory.iceLance=1;s.inventory.cyclone=1;s.inventory.bladeRush=1;
  s.warren=30;
  applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'iceLance',slot:1});
  applyBurrowSkillCommand(s,'mage',{type:'equipCore',coreId:'cyclone',slot:2});
  expect(chooseBurrowCore(s,u,m,[m])?.id).toBe('fireball');
  u.nextCoreSlot=1;expect(chooseBurrowCore(s,u,m,[m])?.id).toBe('iceLance');
  u.nextCoreSlot=2;expect(chooseBurrowCore(s,u,m,[m])?.id).toBe('cyclone');
  // Existing equipped Cores stay in saved slots; locked slots cannot cast.
  s.warren=10;u.nextCoreSlot=1;
  expect(chooseBurrowCore(s,u,m,[m])?.id).toBe('fireball');
  expect(resolveBurrowCore(s,u,m,[m],'iceLance',()=>.5).accepted).toBe(false);
  s.warren=20;expect(chooseBurrowCore(s,u,m,[m])?.id).toBe('iceLance');
  s.warren=30;
  // Cyclone's original minimum three-target hint no longer prevents casting.
  u.coreCooldowns={fireball:s.time+3,iceLance:s.time+3};
  u.nextCoreSlot=0;expect(chooseBurrowCore(s,u,m,[m])?.id).toBe('cyclone');
  const scout=state('scout','bladeRush'),rabbit=unit('scout');
  expect(chooseBurrowCore(scout,rabbit,m,[m])?.id).toBe('bladeRush');
  rabbit.coreCooldowns={bladeRush:scout.time+5};
  expect(chooseBurrowCore(scout,rabbit,m,[m])).toBeNull();
 });
 it('never charges SP or mutates combat on rejected casts; enforces level and inventory',()=>{
  const s=state('mage','fireball'),u=unit(),m=monster();
  s.warren=9;expect(resolveBurrowCore(s,u,m,[m],'fireball',()=>.5)).toMatchObject({accepted:false});
  s.warren=10;u.sp=0;
  const r=resolveBurrowCore(s,u,m,[m],'fireball',()=>.5);
  expect(r).toMatchObject({accepted:false,reason:'insufficient-sp'});
  expect(u.sp).toBe(0);expect(m.hp).toBe(m.maxHp);
  expect(resolveBurrowCore(s,u,m,[m],'notASkill',()=>.5).accepted).toBe(false);
 });
 it('real Life Drain Mod heals exactly via the simulation and rarity increases the canonical damage',()=>{
  const s=state('mage','fireball','lifeDrain'),u=unit(),m=monster();
  u.hp=75;
  const base=resolveBurrowCore(s,u,m,[m],'fireball',()=>.5);
  expect(base.accepted,base.reason).toBe(true);
  expect(base.player.hp).toBeGreaterThan(u.hp);
  expect(base.events.some(e=>e.type==='healed')).toBe(true);
  s.classSkills.mage.coreRarity.fireball='legend';
  const rarer=resolveBurrowCore(s,u,m,[m],'fireball',()=>.5);
  expect(rarer.world.monsters.get('burrow-monster-1').hp).toBeLessThan(base.world.monsters.get('burrow-monster-1').hp);
 });
 it('canonical AoE and echo are resolved by the real core and Mod logic',()=>{
  const s=state('mage','thunderStorm','echo'),u=unit(),m=monster(),second=monster(2,1250,1210);
  const hit=resolveBurrowCore(s,u,m,[m,second],'thunderStorm',()=>.1);
  expect(hit.accepted,hit.reason).toBe(true);
  expect(hit.events.filter(e=>e.type==='damageDealt').length).toBeGreaterThan(6);
  expect(hit.events.some(e=>e.type==='damageDealt'&&e.effect?.origin==='ECHO')).toBe(true);
 });
 it('uses the main simulation for Dash and Blink movement, rarity travel and blocked terrain',()=>{
  for(const name of ['dash','blink']){
   const s=state('scout','bladeRush'),u=unit('scout'),target={x:u.x+550,y:u.y};
   s.inventory[name]=1;
   applyBurrowSkillCommand(s,'scout',{type:'equipMovementCore',coreId:name});
   const free=resolveBurrowMovement(s,u,target,()=>true,()=>.5);
   expect(free.accepted,free.reason).toBe(true);
   expect(free.player.position.x).toBe(SKILLS_V2[name].movementDistance);
   expect(free.events.some(e=>e.type==='cooldownStarted'&&e.abilityId===name)).toBe(true);
   s.classSkills.scout.coreRarity[name]='rare';
   expect(resolveBurrowMovement(s,u,target,()=>true,()=>.5).player.position.x)
    .toBe(SKILLS_V2[name].movementDistance+30);
   const blocked=resolveBurrowMovement(s,u,target,x=>x<=u.x+52,()=>.5);
   expect(blocked.accepted).toBe(true);
   expect(blocked.player.position.x).toBeGreaterThan(30);
   expect(blocked.player.position.x).toBeLessThanOrEqual(52);
   u.coreCooldowns={[name]:s.time+2};
   expect(resolveBurrowMovement(s,u,target,()=>true,()=>.5)).toMatchObject({accepted:false,reason:'skill-cooldown'});
  }
 });
 it('chooses only authored auto skills with cooldown, SP, area and elite gates',()=>{
  const s=state('mage','fireball'),u=unit(),m=monster();
  regenBurrowSp(u,.5);expect(u.maxSp).toBe(burrowMaxSp(u));
  expect(chooseBurrowCore(s,u,m,[m])?.id).toBe('fireball');
  u.coreCooldowns={fireball:s.time+3};
  expect(chooseBurrowCore(s,u,m,[m])).toBeNull();
  u.coreCooldowns={};u.sp=0;expect(chooseBurrowCore(s,u,m,[m])).toBeNull();
 });
});
