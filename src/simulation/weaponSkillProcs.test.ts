import { describe, expect, it } from 'vitest';
import { BunnySimulation, WEAPON_PROC_RULES_V2 } from './engine';
import type { MonsterEntity, PlayerEntity } from './entities';
import type { CombatWeaponFamily } from '../systems/combatMath';
import { addMonster, addPlayer, createWorldState } from './world';

const player = (weaponSkills:string[],weaponFamily:CombatWeaponFamily='greatsword'): PlayerEntity => ({
  id:'p1', kind:'player', position:{x:0,y:0}, hp:5000, maxHp:5000, alive:true,
  stats:{level:30,str:10,agi:1,vit:30,int:5,dex:30,luk:1},
  weaponFamily, weaponAtk:20, weaponMatk:20, equipmentDef:40, equipmentMdef:20,
  hitBonus:0,fleeBonus:0,critBonusPercent:0,equipmentAspd:0,attackRange:60,moveSpeed:6,
  dodgeDistance:3,dodgeCooldownMs:1200,nextDodgeAtMs:0,
  lastClientSequence:0,nextBasicAttackAtMs:0,cooldowns:{},
  skillEntitlements:{active:[],passive:[],weaponSkills,modifiersByActive:{}},
});
const tank = (): MonsterEntity => ({
  id:'m1',kind:'monster',position:{x:10,y:0},hp:1e9,maxHp:1e9,alive:true,level:30,
  atk:0,matk:0,def:0,mdef:0,hit:0,flee:0,critChance:0,attackRange:2,
  moveSpeed:0,attackIntervalMs:1e9,nextBasicAttackAtMs:1e12,isElite:false,isBoss:false,
});
// rng .5: every attack hits (hit chance 95%) but the Lv10 25% roll never passes; rng .1 passes it.
function swing(skills:string[],rng:()=>number,attacks:number,weaponFamily:CombatWeaponFamily='greatsword'){
  const world=createWorldState('forest1');addPlayer(world,player(skills,weaponFamily));addMonster(world,tank());
  const sim=new BunnySimulation(world,rng);const casts:{n:number;skillId:string}[]=[];
  for(let n=1;n<=attacks;n++){
    const r=sim.dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:n});
    for(const e of r.events)if(e.type==='skillCast')casts.push({n,skillId:e.skillId});
    sim.step(10000); // clear the basic-attack timer and every internal cooldown
  }
  return casts;
}

describe('weapon mastery skills trigger from basic attacks',()=>{
  it('Lv20 skill fires on every Nth basic attack',()=>{
    const casts=swing(['bowlingBash','crescentBreak'],()=>.5,WEAPON_PROC_RULES_V2.everyNthHit*3).filter(c=>c.skillId==='crescentBreak');
    const n=WEAPON_PROC_RULES_V2.everyNthHit;
    expect(casts.map(c=>c.n)).toEqual([n,n*2,n*3]);
  });
  it('Lv30 skill releases when the gauge fills, then recharges',()=>{
    const g=WEAPON_PROC_RULES_V2.gaugeHits;
    const casts=swing(['bowlingBash','crescentBreak','vanguardTempest'],()=>.5,g*2).filter(c=>c.skillId==='vanguardTempest');
    expect(casts.map(c=>c.n)).toEqual([g,g*2]);
  });
  it('Lv10 skill fires on a successful chance roll only',()=>{
    expect(swing(['bowlingBash'],()=>.5,6)).toEqual([]);           // .5 >= 25% chance: never fires
    expect(swing(['bowlingBash'],()=>.1,3).map(c=>c.n)).toEqual([1,2,3]); // .1 < 25%: fires each (ICD cleared by step)
  });
  it('fires the Lv10 mastery skill for every weapon family through the same proc path',()=>{
    const first:Record<CombatWeaponFamily,string>={greatsword:'bowlingBash',dagger:'crossSlash',axe:'cleavingStrike',hammer:'crushingImpact',bow:'powerShot',staff:'arcBolt',swordShield:'radiantBurst'};
    for(const [family,skillId] of Object.entries(first) as [CombatWeaponFamily,string][]){
      expect(swing([skillId],()=>.1,1,family).map(x=>x.skillId),family).toContain(skillId);
    }
  });
  it('supports cross-family on-hit loadouts independently of the equipped weapon family',()=>{
    const casts=swing(['crossSlash'],()=>.1,1,'greatsword');
    expect(casts.map(c=>c.skillId)).toEqual(['crossSlash']);
  });
  it('cannot be cast by pressing',()=>{
    const world=createWorldState('forest1');addPlayer(world,player(['bowlingBash']));addMonster(world,tank());
    const r=new BunnySimulation(world,()=>.5).dispatch({type:'castSkill',playerId:'p1',skillId:'bowlingBash',targetId:'m1',clientSequence:1});
    expect(r.accepted).toBe(false);expect(r.reason).toBe('weapon-skill-triggers-on-attack');
  });
});
