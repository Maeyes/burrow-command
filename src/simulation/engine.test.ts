import { describe, expect, it } from 'vitest';
import { BunnySimulation } from './engine';
import type { MonsterEntity, PlayerEntity } from './entities';
import { addMonster, addPlayer, createWorldState } from './world';

const player = (): PlayerEntity => ({
  id:'p1', kind:'player', position:{x:0,y:0}, hp:500, maxHp:500, alive:true,
  stats:{level:30,str:50,agi:30,vit:30,int:5,dex:30,luk:10},
  weaponFamily:'greatsword', weaponAtk:60, weaponMatk:0, equipmentDef:40, equipmentMdef:20,
  hitBonus:0,fleeBonus:0,critBonusPercent:0,equipmentAspd:0,attackRange:2,moveSpeed:6,
  dodgeDistance:3,dodgeCooldownMs:1200,nextDodgeAtMs:0,
  lastClientSequence:0,nextBasicAttackAtMs:0,cooldowns:{},
  skillEntitlements:{active:['fireball','thunderStorm','meteorStorm'],movement:'dash',passive:[],weaponSkills:[],modifiersByActive:{}},
});
const monster = (): MonsterEntity => ({
  id:'m1',kind:'monster',position:{x:1,y:0},hp:500,maxHp:500,alive:true,level:30,
  atk:80,matk:0,def:50,mdef:20,hit:220,flee:150,critChance:0,attackRange:2,
  moveSpeed:3,attackIntervalMs:1000,nextBasicAttackAtMs:0,isElite:false,isBoss:false,
});

describe('BunnySimulation authoritative core',()=>{
  it('server simulation computes damage rather than accepting it from command',()=>{
    const world=createWorldState('forest1'); addPlayer(world,player()); addMonster(world,monster());
    const sim=new BunnySimulation(world,()=>0);
    const result=sim.dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:1});
    expect(result.accepted).toBe(true);
    expect(result.events.find(e=>e.type==='damageDealt')).toMatchObject({type:'damageDealt',sourceId:'p1',targetId:'m1',amount:165,critical:true});
    expect(world.monsters.get('m1')?.hp).toBe(335);
  });

  it('computes dual-wield main and offhand hits from each hand weapon ATK',()=>{
    const world=createWorldState('forest1');const p=player();p.weaponFamily='dagger';p.weaponAtk=80;p.offhandWeaponAtk=10;p.offhandWeaponMatk=0;p.hasOffhandWeaponEquipped=true;p.masteryLevels={dagger:1};const m=monster();m.hp=m.maxHp=1000;
    addPlayer(world,p);addMonster(world,m);const rolls=[0,0.99,0,0.99];let roll=0;const sim=new BunnySimulation(world,()=>rolls[roll++]??0.99);
    const result=sim.dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:1});
    const hits=result.events.filter(e=>e.type==='damageDealt');expect(hits).toHaveLength(2);expect(hits[0].amount).toBeGreaterThan(hits[1].amount);
  });

  it('rejects replayed client sequence numbers',()=>{
    const world=createWorldState('forest1'); addPlayer(world,player()); addMonster(world,monster());
    const sim=new BunnySimulation(world,()=>0.99);
    sim.dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:4});
    expect(sim.dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:4})).toMatchObject({accepted:false,reason:'stale-command'});
  });

  it('enforces authoritative attack range and cooldown',()=>{
    const world=createWorldState('forest1'); const p=player(); const m=monster(); m.position={x:99,y:0};
    addPlayer(world,p); addMonster(world,m); const sim=new BunnySimulation(world,()=>0.99);
    expect(sim.dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:1}).reason).toBe('out-of-range');
    m.position={x:1,y:0};
    expect(sim.dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:2}).accepted).toBe(true);
    expect(sim.dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:3}).reason).toBe('attack-cooldown');
  });

  it('lets idle monsters roam locally without acquiring a distant player',()=>{
    const world=createWorldState('forest1');const p=player();p.position={x:500,y:500};const m=monster();m.position={x:0,y:0};m.homePosition={x:0,y:0};m.roamRadius=30;m.aggroRange=0;m.nextRoamAtMs=0;
    addPlayer(world,p);addMonster(world,m);const sim=new BunnySimulation(world,()=>0);
    sim.step(100);expect(m.targetPlayerId).toBeUndefined();expect(m.position.x).toBeGreaterThan(0);expect(Math.hypot(m.position.x-m.homePosition!.x,m.position.y-m.homePosition!.y)).toBeLessThanOrEqual(30);
  });

  it('supports passive onboarding monsters with zero aggro range',()=>{
    const world=createWorldState('forest1');const p=player();const m=monster();m.position={x:1,y:0};m.aggroRange=0;
    addPlayer(world,p);addMonster(world,m);const sim=new BunnySimulation(world,()=>0.99);
    sim.step(100);expect(m.targetPlayerId).toBeUndefined();expect(m.position).toEqual({x:1,y:0});
    sim.dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:1});expect(m.targetPlayerId).toBe('p1');
  });

  it('keeps distant monsters idle until the player enters aggro range',()=>{
    const world=createWorldState('forest1'); const p=player(); const m=monster(); m.position={x:100,y:0};m.aggroRange=20;
    addPlayer(world,p);addMonster(world,m);const sim=new BunnySimulation(world,()=>0.99);
    sim.step(100);expect(m.position).toEqual({x:100,y:0});expect(m.targetPlayerId).toBeUndefined();
    p.position={x:85,y:0};sim.step(100);expect(m.targetPlayerId).toBe('p1');expect(m.position.x).toBeLessThan(100);
  });

  it('lets monsters attack from simulation ticks',()=>{
    const world=createWorldState('forest1'); addPlayer(world,player()); addMonster(world,monster());
    const sim=new BunnySimulation(world,()=>0);
    const events=sim.step(16);
    expect(events.some(e=>e.type==='damageDealt' && e.sourceId==='m1')).toBe(true);
    expect(world.players.get('p1')!.hp).toBeLessThan(500);
  });

  it('emits authoritative monster attack-start and critical damage events',()=>{
    const world=createWorldState('forest1'); addPlayer(world,player()); const m=monster(); m.critChance=1; addMonster(world,m);
    const sim=new BunnySimulation(world,()=>0);
    const events=sim.step(16);
    expect(events[0]).toMatchObject({type:'attackStarted',sourceId:'m1',targetId:'p1'});
    expect(events.some(e=>e.type==='damageDealt' && e.sourceId==='m1' && e.critical===true)).toBe(true);
  });

  it('resolves skill damage and enforces skill cooldown',()=>{
    const world=createWorldState('forest1'); const p=player(); p.weaponFamily='staff'; p.weaponMatk=80; addPlayer(world,p); addMonster(world,monster());
    const sim=new BunnySimulation(world,()=>0);
    const cast=sim.dispatch({type:'castSkill',playerId:'p1',skillId:'fireball',targetId:'m1',clientSequence:1});
    expect(cast.accepted).toBe(true);
    expect(cast.events.some(e=>e.type==='damageDealt')).toBe(true);
    expect(sim.dispatch({type:'castSkill',playerId:'p1',skillId:'fireball',targetId:'m1',clientSequence:2}).reason).toBe('skill-cooldown');
  });

  it('resolves one AoE cast against every monster in radius with one cooldown',()=>{
    const world=createWorldState('forest1');const p=player();p.weaponFamily='staff';p.weaponMatk=80;addPlayer(world,p);
    const a=monster();a.id='a';a.position={x:20,y:0};const b=monster();b.id='b';b.position={x:40,y:0};addMonster(world,a);addMonster(world,b);
    const sim=new BunnySimulation(world,()=>0);
    const result=sim.dispatch({type:'castSkill',playerId:'p1',skillId:'thunderStorm',targetId:'a',clientSequence:1});
    expect(result.accepted).toBe(true);expect(a.hp).toBeLessThan(a.maxHp);expect(b.hp).toBeLessThan(b.maxHp);
    expect(result.events.filter(e=>e.type==='cooldownStarted'&&e.abilityId==='thunderStorm')).toHaveLength(1);
  });

  it('resolves ground AoE and movement skills authoritatively',()=>{
    const world=createWorldState('forest1');const p=player();p.weaponFamily='staff';p.weaponMatk=80;addPlayer(world,p);const m=monster();m.position={x:50,y:0};addMonster(world,m);
    const sim=new BunnySimulation(world,()=>0);
    const aoe=sim.dispatch({type:'castSkill',playerId:'p1',skillId:'meteorStorm',ground:{x:50,y:0},clientSequence:1});expect(aoe.accepted).toBe(true);expect(m.hp).toBeLessThan(m.maxHp);
    const x=p.position.x;const dash=sim.dispatch({type:'castSkill',playerId:'p1',skillId:'dash',direction:{x:1,y:0},clientSequence:2});expect(dash.accepted).toBe(true);expect(p.position.x).toBe(x+130);
  });

  it('moves players and monsters from server ticks rather than command frequency',()=>{
    const world=createWorldState('forest1');const p=player();p.moveSpeed=60;const m=monster();m.position={x:100,y:0};m.moveSpeed=30;addPlayer(world,p);addMonster(world,m);const sim=new BunnySimulation(world,()=>0.99);
    const intent=sim.dispatch({type:'move',playerId:'p1',direction:{x:1,y:0},clientSequence:1});expect(intent.accepted).toBe(true);expect(p.position.x).toBe(0);
    sim.step(1000/60);expect(p.position.x).toBeCloseTo(1,4);expect(m.position.x).toBeLessThan(100);
    sim.dispatch({type:'move',playerId:'p1',direction:{x:0,y:0},clientSequence:2});const stopped=p.position.x;sim.step(1000/60);expect(p.position.x).toBe(stopped);
  });

  it('dodge moves authoritatively and cannot be spammed',()=>{
    const world=createWorldState('forest1'); addPlayer(world,player()); const sim=new BunnySimulation(world,()=>0);
    const first=sim.dispatch({type:'dodge',playerId:'p1',direction:{x:1,y:0},clientSequence:1});
    expect(first.accepted).toBe(true);
    expect(world.players.get('p1')!.position.x).toBe(3);
    expect(sim.dispatch({type:'dodge',playerId:'p1',direction:{x:1,y:0},clientSequence:2}).reason).toBe('dodge-cooldown');
  });
});
