import { describe, expect, it } from 'vitest';
import { blockChanceForPlayer, BunnySimulation } from './engine';
import { distance, type MonsterEntity, type PlayerEntity } from './entities';
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
  it('exposes host-only mastery on-hit procs without adding a second basic swing or a new client command',()=>{
    const world=createWorldState('forest1'),p=player(),m=monster();
    p.weaponFamily='greatsword';
    p.skillEntitlements.weaponSkills=['bowlingBash'];
    m.hp=m.maxHp=50000;addPlayer(world,p);addMonster(world,m);
    const sim=new BunnySimulation(world,()=>.1);
    const proc=sim.triggerWeaponMasteryOnHit(p.id,m.id);
    expect(proc.some(e=>e.type==='skillCast'&&e.skillId==='bowlingBash')).toBe(true);
    const hitEvents=proc.filter(e=>e.type==='damageDealt');
    expect(hitEvents.length).toBeGreaterThan(0);
    expect(hitEvents.every(e=>e.effect?.origin==='MASTERY_PROC')).toBe(true);
    expect(m.hp).toBe(50000-hitEvents.reduce((n,e)=>n+e.amount,0));
    expect(proc.some(e=>e.type==='attackStarted')).toBe(false);
    expect(p.weaponProc?.hits).toBe(1);
    expect(sim.triggerWeaponMasteryOnHit(p.id,m.id)).toEqual([]); // authored cooldown floor
    expect(sim.dispatch({type:'castSkill',playerId:p.id,skillId:'bowlingBash',targetId:m.id,clientSequence:1}))
      .toMatchObject({accepted:false,reason:'weapon-skill-triggers-on-attack'});
  });
  it('combines shield refine, innate shield and Guard passives for any weapon, capped at 35%',()=>{
    const p=player();
    p.hasShieldEquipped=true;
    expect(blockChanceForPlayer(p)).toBe(0);
    p.shieldBlockChanceBonus=.02;
    expect(blockChanceForPlayer(p)).toBeCloseTo(.02);
    p.masteryPassives=['swordShield:guard'];
    expect(blockChanceForPlayer(p)).toBeCloseTo(.10);
    p.masteryPassives=['swordShield:guard','swordShield:perfectGuard'];
    p.shieldBlockChanceBonus=.06;
    expect(blockChanceForPlayer(p)).toBeCloseTo(.18);
    p.weaponFamily='dagger';p.innateBlockChanceBonus=.05;
    expect(blockChanceForPlayer(p)).toBeCloseTo(.23);
    p.weaponFamily='staff';
    expect(blockChanceForPlayer(p)).toBeCloseTo(.23);
    p.shieldBlockChanceBonus=.40;
    expect(blockChanceForPlayer(p)).toBeCloseTo(.35);
    p.hasShieldEquipped=false;
    expect(blockChanceForPlayer(p)).toBeCloseTo(.03); // No shield refine bonus; mastery is penalized.
  });
  it('reduces damage by 50% on every successful Block or 70% with installed Firm Guard',()=>{
    const hit=(passives:string[])=>{
      const world=createWorldState('forest1'),p=player(),m=monster();
      p.hasShieldEquipped=true;p.masteryPassives=passives;
      addPlayer(world,p);addMonster(world,m);
      const events=new BunnySimulation(world,()=>0).step(16);
      const damage=events.find(e=>e.type==='damageDealt'&&e.sourceId===m.id&&e.targetId===p.id);
      expect(damage?.type).toBe('damageDealt');
      return damage?.type==='damageDealt'?damage.amount:0;
    };
    const normal=hit([]),guard=hit(['swordShield:guard']),firm=hit(['swordShield:guard','swordShield:firmGuard']);
    expect(normal).toBeGreaterThan(0);
    expect(guard).toBeCloseTo(normal*.5,0);
    expect(firm).toBeCloseTo(normal*.3,0);
    expect(firm).toBeLessThan(guard);
  });
  it('axe innate penetration raises physical basic hit damage and 2% lifesteal restores only actual HP damage',()=>{
    const run=(innate:boolean)=>{
      const world=createWorldState('forest1'),p=player(),m=monster();
      p.weaponFamily='axe';p.weaponAtk=220;p.hp=200;m.def=200;m.hp=m.maxHp=100000;
      p.innatePhysicalArmorPenetration=innate?.10:0;
      p.innatePhysicalLifeSteal=innate?.02:0;
      addPlayer(world,p);addMonster(world,m);
      const events=new BunnySimulation(world,()=>.5).dispatch({type:'basicAttack',playerId:p.id,targetId:m.id,clientSequence:1}).events;
      const dealt=events.find(e=>e.type==='damageDealt'&&e.sourceId===p.id&&e.targetId===m.id);
      const healed=events.filter(e=>e.type==='healed'&&e.sourceId===p.id).reduce((s,e)=>s+e.amount,0);
      return{damage:dealt?.type==='damageDealt'?dealt.amount:0,healed,hp:p.hp};
    };
    const ordinary=run(false),innate=run(true);
    expect(innate.damage).toBeGreaterThan(ordinary.damage);
    expect(ordinary.healed).toBe(0);
    expect(innate.healed).toBe(Math.round(innate.damage*.02));
    expect(innate.hp).toBe(200+innate.healed);
  });
  it('axe innate lifesteal on AoE physical skills is halved for the second hit enemy (and excludes magical casts)',()=>{
    const world=createWorldState('forest1'),p=player();
    p.weaponFamily='axe';p.weaponAtk=250;p.hp=100;p.innatePhysicalLifeSteal=.02;
    p.skillEntitlements.active=['cyclone'];
    const first=monster();first.id='a';first.hp=first.maxHp=100000;
    const second=monster();second.id='b';second.hp=second.maxHp=100000;second.position={x:10,y:0};
    addPlayer(world,p);addMonster(world,first);addMonster(world,second);
    const out=new BunnySimulation(world,()=>.5).dispatch({type:'castSkill',playerId:p.id,skillId:'cyclone',clientSequence:1});
    expect(out.accepted).toBe(true);
    const hits=out.events.filter(e=>e.type==='damageDealt'&&e.sourceId===p.id);
    const firstHits=hits.filter(e=>e.targetId==='a'),secondHits=hits.filter(e=>e.targetId==='b');
    expect(firstHits).toHaveLength(3);expect(secondHits).toHaveLength(3);
    const expected=firstHits.reduce((s,e)=>s+Math.round(e.amount*.02),0)
       +secondHits.reduce((s,e)=>s+Math.round(e.amount*.01),0);
    const healed=out.events.filter(e=>e.type==='healed'&&e.sourceId===p.id).reduce((s,e)=>s+e.amount,0);
    expect(healed).toBe(expected);
    expect(p.hp).toBe(100+healed);

    const magicWorld=createWorldState('forest1'),caster=player(),enemy=monster();
    caster.weaponFamily='staff';caster.weaponMatk=250;caster.innatePhysicalLifeSteal=.02;caster.hp=100;
    caster.skillEntitlements.active=['fireball'];addPlayer(magicWorld,caster);addMonster(magicWorld,enemy);
    const magic=new BunnySimulation(magicWorld,()=>.5).dispatch({type:'castSkill',playerId:caster.id,skillId:'fireball',targetId:enemy.id,clientSequence:1});
    expect(magic.accepted).toBe(true);
    expect(magic.events.some(e=>e.type==='healed')).toBe(false);
    expect(caster.hp).toBe(100);
  });
  it('server simulation computes damage rather than accepting it from command',()=>{
    const world=createWorldState('forest1'); addPlayer(world,player()); addMonster(world,monster());
    const sim=new BunnySimulation(world,()=>0);
    const result=sim.dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:1});
    expect(result.accepted).toBe(true);
    expect(result.events.find(e=>e.type==='damageDealt')).toMatchObject({type:'damageDealt',sourceId:'p1',targetId:'m1',amount:165,critical:true});
    expect(world.monsters.get('m1')?.hp).toBe(335);
  });

  it('applies mastery passives only when they are installed in the loadout snapshot',()=>{
    const run=(passives:string[])=>{const world=createWorldState('forest1');const p=player();p.weaponFamily='dagger';p.masteryPassives=passives;const m=monster();m.hp=m.maxHp=100000;addPlayer(world,p);addMonster(world,m);return new BunnySimulation(world,()=>.1).dispatch({type:'basicAttack',playerId:'p1',targetId:'m1',clientSequence:1}).events.filter(e=>e.type==='damageDealt'&&e.sourceId==='p1').length;};
    expect(run([])).toBe(1);
    expect(run(['dagger:doubleAttack'])).toBe(2);
  });

  it('computes dual-wield main and offhand hits from each hand weapon ATK',()=>{
    const world=createWorldState('forest1');const p=player();p.weaponFamily='dagger';p.weaponAtk=80;p.offhandWeaponAtk=10;p.offhandWeaponMatk=0;p.hasOffhandWeaponEquipped=true;p.masteryPassives=[];const m=monster();m.hp=m.maxHp=1000;
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

  it('applies Barrier before HP damage and expires it on authoritative time',()=>{
    const world=createWorldState('forest1');const p=player();p.skillEntitlements.active=['barrier'];const m=monster();addPlayer(world,p);addMonster(world,m);const sim=new BunnySimulation(world,()=>0);
    const cast=sim.dispatch({type:'castSkill',playerId:'p1',skillId:'barrier',clientSequence:1});
    expect(cast.accepted).toBe(true);
    expect(cast.events).toContainEqual({type:'barrierApplied',entityId:'p1',amount:75,durationMs:5000});
    expect(p.barrierHp).toBe(75);
    const before=p.hp;const combatEvents=sim.step(16);
    expect(combatEvents.some(e=>e.type==='barrierAbsorbed'&&e.entityId==='p1'&&e.amount>0)).toBe(true);
    expect(p.hp).toBe(before);
    sim.step(5001);expect(p.barrierHp).toBe(0);expect(p.barrierMaxHp).toBe(0);
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

  it('uses upgraded Skill Mod rarity for authoritative damage and duplicate stacking',()=>{
    const cast=(multiplier:number,slots:string[])=>{
      const world=createWorldState('forest1'),p=player(),m=monster();
      p.weaponFamily='staff';p.weaponMatk=100;
      p.skillEntitlements.active=['fireball'];
      p.skillEntitlements.modifiersByActive={fireball:slots};
      p.skillModifierMultipliers={lingering:multiplier};
      m.hp=m.maxHp=100000;addPlayer(world,p);addMonster(world,m);
      const result=new BunnySimulation(world,()=>0).dispatch({type:'castSkill',playerId:'p1',skillId:'fireball',targetId:'m1',clientSequence:1});
      expect(result.accepted).toBe(true);
      return result.events.filter(e=>e.type==='damageDealt').reduce((n,e)=>n+(e.type==='damageDealt'?e.amount:0),0);
    };
    const ordinary=cast(1,['lingering']);
    const upgraded=cast(1.1,['lingering']);
    const upgradedDouble=cast(1.1,['lingering','lingering']);
    expect(upgraded).toBeGreaterThan(ordinary);
    expect(upgradedDouble).toBeGreaterThan(upgraded);
  });

  it('Black Hole pulls monsters toward the caster without clamping them into the legacy arena bounds',()=>{
    const world=createWorldState('forest1');const p=player();p.position={x:4000,y:4000};p.weaponFamily='staff';p.weaponMatk=80;p.skillEntitlements.active=['blackHole'];addPlayer(world,p);
    const m=monster();m.position={x:4200,y:4000};addMonster(world,m);
    const sim=new BunnySimulation(world,()=>0);
    const before=distance(p.position,m.position);
    const result=sim.dispatch({type:'castSkill',playerId:'p1',skillId:'blackHole',clientSequence:1});
    expect(result.accepted).toBe(true);
    expect(distance(p.position,m.position)).toBeLessThan(before);
    expect(m.position.x).toBeGreaterThan(1206);
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
