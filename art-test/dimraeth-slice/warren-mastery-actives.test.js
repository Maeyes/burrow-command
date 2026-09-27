import {describe,it,expect} from 'vitest';
import {WEAPON_SKILLS_BY_FAMILY_V2} from '../../src/simulation/skillEntitlements.ts';
import {SKILLS_V2} from '../../src/simulation/skills.ts';
import {WEAPON_PROC_RULES_V2} from '../../src/simulation/engine.ts';
import {defaultMastery,CLASS_IDS,CLASS_FAMILIES,classWeaponMasterySkills,toggleMasteryWeaponSkill,migrateSave} from './warren-progression.js';
import {defaultClassSkills} from './warren-class-cores.js';
import {renderMasteryHtml} from './warren-extra-ui.js';
import {renderClassCoreHtml} from './warren-class-core-ui.js';
import {resolveBurrowMasteryOnHit,persistBurrowMasteryRuntime,resolveBurrowCore} from './warren-core-combat.js';

const classes=Object.fromEntries(CLASS_IDS.map(cls=>[cls,{icon:'★',name:cls}]));
const state=(cls,unlocked=[10],active=true)=>{
 const s={warren:12,night:false,time:42,gold:200000,inventory:{},classSkills:defaultClassSkills(),mastery:defaultMastery(),coreClass:cls,masteryClass:cls};
 Object.assign(s.mastery[cls],{level:Math.max(...unlocked,10),unlocked});
 if(!active)s.mastery[cls].disabledWeaponSkills=[10];
 return s;
};
const rabbit=cls=>({id:1,cls,level:25,atk:135,def:12,maxHp:400,hp:400,sp:100,x:1250,y:1250,luk:10,critBonus:0,down:false});
const monster=(id=1,x=1295,y=1250)=>({id,type:'mossblob1',x,y,hp:200000,maxHp:200000,atk:10,range:38,speed:60,elite:false,boss:false,dead:false});
const castIds=result=>result.events.filter(e=>e.type==='skillCast').map(e=>e.skillId);

describe('Burrow Weapon Mastery Active: the main game Lv10/20/30 on-hit skills',()=>{
 it.each(CLASS_IDS)('%s maps precisely to the three authored weapon skills and paid unlocks',cls=>{
  const s=state(cls,[10,20,30]);
  const family=CLASS_FAMILIES[cls],expected=WEAPON_SKILLS_BY_FAMILY_V2[family];
  expect(classWeaponMasterySkills(s,cls)).toEqual(expected);
  expect(expected).toHaveLength(3);
  expect(expected.every(id=>SKILLS_V2[id].kind==='weapon')).toBe(true);
  expect(classWeaponMasterySkills(state(cls,[]),cls)).toEqual([null,null,null]);
 });
 it.each(CLASS_IDS)('%s Lv10 has exactly the main game 25% chance, without a duplicate basic attack',cls=>{
  const s=state(cls),u=rabbit(cls),m=monster();
  const result=resolveBurrowMasteryOnHit(s,u,m,[m],()=>0.1);
  const skillId=WEAPON_SKILLS_BY_FAMILY_V2[CLASS_FAMILIES[cls]][0];
  expect(result.accepted).toBe(true);
  expect(castIds(result)).toContain(skillId);
  expect(result.events.some(e=>e.type==='damageDealt'&&e.effect?.origin==='MASTERY_PROC')).toBe(true);
  // The host's basic swing is independent. This result contains only mastery proc damage.
  expect(result.events.some(e=>e.type==='attackStarted'&&e.abilityId==='basic')).toBe(false);
  expect(result.player.weaponProc.hits).toBe(1);
  expect(result.player.weaponProc.readyAtMs[skillId]).toBeGreaterThanOrEqual(WEAPON_PROC_RULES_V2.chanceIcdMs);
  persistBurrowMasteryRuntime(s,u,result.player);
  expect(u.weaponProc.hits).toBe(1);
  expect(u.weaponProc.readyAt[skillId]).toBeGreaterThan(s.time);
 });
 it('uses every fifth basic hit for Lv20, 14-hit gauge for Lv30 and the main cooldown floor',()=>{
  const s=state('archer',[10,20,30]),u=rabbit('archer'),m=monster();
  const [s10,s20,s30]=WEAPON_SKILLS_BY_FAMILY_V2.bow;
  const castAt=[];
  for(let n=1;n<=14;n++){
   const result=resolveBurrowMasteryOnHit(s,u,m,[m],()=>.5);
   expect(result.accepted).toBe(true);
   const casts=castIds(result);
   if(casts.length)castAt.push({n,casts});
   persistBurrowMasteryRuntime(s,u,result.player);
   s.time+=.1;
  }
  expect(castAt.filter(x=>x.casts.includes(s10))).toHaveLength(0); // RNG .5 > .25
  expect(castAt.filter(x=>x.casts.includes(s20)).map(x=>x.n)).toEqual([5]); // 5th; 10th hits same cooldown
  expect(castAt.filter(x=>x.casts.includes(s30)).map(x=>x.n)).toEqual([14]);
  expect(u.weaponProc.hits).toBe(14);
  expect(u.weaponProc.gauge).toBe(0);
  expect(u.weaponProc.readyAt[s20]).toBeGreaterThan(s.time);
  expect(u.weaponProc.readyAt[s30]).toBeGreaterThan(s.time);
 });
 it('keeps tier toggles independent, rejects toggles by night/unearned skills, and migrates old saves',()=>{
  const s=state('mage',[10,20,30]);
  expect(toggleMasteryWeaponSkill(s,'mage',20)).toBe(true);
  expect(classWeaponMasterySkills(s,'mage')).toEqual([WEAPON_SKILLS_BY_FAMILY_V2.staff[0],null,WEAPON_SKILLS_BY_FAMILY_V2.staff[2]]);
  s.night=true;expect(toggleMasteryWeaponSkill(s,'mage',10)).toBe(false);s.night=false;
  expect(toggleMasteryWeaponSkill(s,'mage',40)).toBe(false);
  const raw={v:3,gold:123,warren:20,mastery:s.mastery,units:[],towers:[],gear:[]};
  const migrated=migrateSave(raw);
  expect(migrated.mastery.mage.disabledWeaponSkills).toEqual([20]);
  expect(classWeaponMasterySkills(migrated,'mage')[1]).toBeNull();
  delete raw.mastery.mage.disabledWeaponSkills; // previously deployed save: auto-enable earned active skills
  expect(classWeaponMasterySkills(migrateSave(raw),'mage')).toEqual(WEAPON_SKILLS_BY_FAMILY_V2.staff);
 });
 it('shows distinct three Mastery Active slots in both Mastery and Core views',()=>{
  const s=state('scout',[10,20]);
  const html=renderMasteryHtml(s,classes),core=renderClassCoreHtml(s,classes);
  expect(html).toContain('Weapon Mastery Active · 3 ช่องแยกจาก Skill Core');
  for(const lvl of [10,20,30])expect(html).toContain('data-mastery-active-level="'+lvl+'"');
  expect(html).toContain(SKILLS_V2.crossSlash.name);
  expect(html).toContain(SKILLS_V2.shadowFlurry.name);
  expect(core).toContain(SKILLS_V2.phantomBlades.name);
  expect(core).toContain('data-open-mastery="scout"');
 });
 it('a Staff Spell Chain and the next basic hit share the same authored weapon-skill cooldown',()=>{
  const s=state('mage',[10]),u=rabbit('mage'),m=monster();
  s.inventory.fireball=1;s.classSkills.mage.active[0]='fireball';
  const first=resolveBurrowCore(s,u,m,[m],'fireball',()=>.1);
  expect(castIds(first)).toContain('arcBolt');
  persistBurrowMasteryRuntime(s,u,first.player);
  expect(u.weaponProc.readyAt.arcBolt).toBeGreaterThan(s.time);
  s.time+=.1;
  const next=resolveBurrowMasteryOnHit(s,u,m,[m],()=>.1);
  expect(next.accepted).toBe(true);
  expect(castIds(next)).not.toContain('arcBolt');
  expect(next.player.weaponProc.hits).toBe(1);
 });
 it('Staff Spell Chain uses unlocked authoritative mastery passives and its learned weapon skill',()=>{
  const s=state('mage',[10]),u=rabbit('mage'),m=monster();
  s.inventory.fireball=1;s.classSkills.mage.active[0]='fireball';
  const result=resolveBurrowCore(s,u,m,[m],'fireball',()=>.1);
  expect(result.accepted,result.reason).toBe(true);
  expect(castIds(result)).toContain('fireball');
  expect(castIds(result)).toContain(WEAPON_SKILLS_BY_FAMILY_V2.staff[0]);
  expect(result.events.some(e=>e.type==='damageDealt'&&e.effect?.origin==='MASTERY_PROC')).toBe(true);
 });
});
