import { describe,expect,it } from 'vitest';
import { ArenaV2Adapter } from './arenaAdapter';
import { createInitialCharacterV2 } from './character';

function staffSetup(passives:string[]){
 const c=createInitialCharacterV2('staff');c.inventory.fireball=1;c.skills.active=['fireball',undefined,undefined];
 const sim=new ArenaV2Adapter({zoneId:'forest1',player:{x:0,y:0} as any,monsters:[{id:'m',monsterType:'mossblob1',x:40,y:0,hp:1,maxHp:1,dead:false} as any],character:c,random:()=>0});
 const p:any=sim.simulation.world.players.get(sim.playerId)!;
 p.weaponFamily='staff';p.masteryPassives=passives;p.skillEntitlements={...p.skillEntitlements,active:['fireball'],weaponSkills:['arcBolt','arcCascade','astralVolley']};p.sp=999;
 const m:any=sim.simulation.world.monsters.get('m')!;m.hp=m.maxHp=1e6;
 return sim;
}
describe('Staff Spell Chain',()=>{
 it('fires a Staff weapon skill after a core cast only with Spell Chain',()=>{
  const off=staffSetup([]).castSkill('fireball','m') as any;
  const on=staffSetup(['staff:concentration']).castSkill('fireball','m') as any;
  const weaponHit=(r:any)=>r.events.some((e:any)=>e.type==='damageDealt'&&['arcBolt','arcCascade','astralVolley'].includes(e.effect?.ability));
  expect(off.accepted&&on.accepted).toBe(true);
  expect(weaponHit(off)).toBe(false);
  expect(weaponHit(on)).toBe(true);
 });
});
