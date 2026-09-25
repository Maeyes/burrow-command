import {
  BASE_CRIT_DAMAGE, attacksPerSecond, aspd, damageAfterDefense, hit, hitChance,
  magicalAttack, physicalAttack, type MagicWeaponFamily, type PhysicalWeaponFamily,
} from '../systems/combatMath';
import type {
  AuthoritativeSimulation, CommandResult, EntityId, SimulationClock,
  SimulationCommand, SimulationEvent,
} from './contracts';
import { distance, normalized, type MonsterEntity, type PlayerEntity } from './entities';
import { entityById, type WorldState } from './world';
import { SKILLS_V2, type SkillDefinitionV2 , skillSpCostV2 } from './skills';
import { skillEntitlementReason } from './skillEntitlements';
import { stackedSkillModifierFraction } from './skillModifiersV2';
import type { EffectMeta } from './contracts';
const skillCoreEffect=(id:string):EffectMeta=>({origin:'SKILL_CORE',echoDepth:0,sourceCoreId:id});
const echoEffect=(e:EffectMeta):EffectMeta=>({origin:'ECHO',echoDepth:e.echoDepth+1,sourceCoreId:e.sourceCoreId});

export type RandomFn = () => number;

const MAGIC_FAMILIES = new Set<MagicWeaponFamily>(['staff']);
// Current five-map arena footprint. Authoritative movement clamps here so manual, Auto,
// Dodge and movement skills can never push the player outside the playable field.
const ARENA_BOUNDS={minX:-1206,maxX:1206,minY:-1076,maxY:1276};
function clampArenaPosition(p:{x:number;y:number}){return{x:Math.max(ARENA_BOUNDS.minX,Math.min(ARENA_BOUNDS.maxX,p.x)),y:Math.max(ARENA_BOUNDS.minY,Math.min(ARENA_BOUNDS.maxY,p.y))}}

export const MASTERY_COMBAT_V2={
 doubleAttack:{chance20:.20,chance50:.30,hitBonus30:20},
 cleave:{range:72,wideRange:90},
 heavyBlow:{chance10:.15,chance20:.20,chance40:.25,armorBreakMs:3000},
 hammer:{chance10:.10,chance20:.15,chance40:.20,stunMs:500,slowPercent:.20,slowMs:2000,shockwaveRadius:85,knockback:28},
 guard:{block10:.08,block40:.12,baseMitigation:.50,firmGuardBonus:.20,maxBlockChance:.35,counter30:.20,guardedReduction:.10,guardedMs:2000,noShieldScale:.25},
 bow:{multi10:.15,multi20:.20,multi50:.25,secondary10:.50,secondary50:.75,range30:1.10,defIgnore40:.10},
 staff:{echoChance:.10,echoEffect:.50,mobileMoveScale:.60,flowMoveScale:.80},
} as const;
/** Off-hand strikes land for 60% of a main-hand hit (they still roll their own hit and crit). */
export const OFFHAND_DAMAGE_SCALE=.6;
export const CC_DURATION_BY_RANK={normal:1,elite:.5,boss:.25,worldBoss:.25} as const;

function hasMasteryPassive(player:PlayerEntity,family:string,id:string){return player.masteryPassives?.includes(`${family}:${id}`)??false}
function hasAnyMasteryPassive(player:PlayerEntity,family:string){return player.masteryPassives?.some(key=>key.startsWith(`${family}:`))??false}

/** Combines Guard loadout, shield refinement and innate from any equipped shield, capped at 35%. */
export function blockChanceForPlayer(player:PlayerEntity):number{
 const scale=player.hasShieldEquipped?1:MASTERY_COMBAT_V2.guard.noShieldScale;
 const base=hasMasteryPassive(player,'swordShield','perfectGuard')?MASTERY_COMBAT_V2.guard.block40:hasAnyMasteryPassive(player,'swordShield')?MASTERY_COMBAT_V2.guard.block10:0;
 const shieldBonus=player.hasShieldEquipped?(player.shieldBlockChanceBonus??0):0;
 const innateShieldBonus=player.hasShieldEquipped?(player.innateBlockChanceBonus??0):0;
 return Math.min(MASTERY_COMBAT_V2.guard.maxBlockChance,base*scale+shieldBonus+innateShieldBonus);
}

export const WEAPON_PROC_RULES_V2={
  /** Lv10 skill: chance per basic attack, with its own internal cooldown. */
  chance:.25, chanceIcdMs:2000,
  /** Lv20 skill: fires on every Nth basic attack. */
  everyNthHit:5,
  /** Lv30 skill: releases when this many basic attacks have charged the gauge. */
  gaugeHits:14,
  /** Every weapon proc waits at least this fraction of the skill's authored cooldown. */
  cooldownFloor:.5,
} as const;

export class BunnySimulation implements AuthoritativeSimulation {
  private _clock: SimulationClock = { nowMs: 0, tick: 0 };
  /** Whether two positions can fight each other (e.g. not across a cliff). Hosts with terrain override it. */
  canEngage:(a:Readonly<{x:number;y:number}>,b:Readonly<{x:number;y:number}>)=>boolean=()=>true;

  constructor(public readonly world: WorldState, private readonly random: RandomFn = Math.random,
    private readonly resolveSkillMovement?: (start:Readonly<{x:number;y:number}>,end:{x:number;y:number})=>{x:number;y:number}) {}

  get clock(): SimulationClock { return this._clock; }

  dispatch(command: SimulationCommand): CommandResult {
    const player = this.world.players.get(command.playerId);
    if (!player || !player.alive) return this.reject('player-unavailable');

    if (command.clientSequence <= player.lastClientSequence) return this.reject('stale-command');
    player.lastClientSequence = command.clientSequence;

    switch (command.type) {
      case 'move': return this.move(player, command.direction);
      case 'basicAttack': return this.basicAttack(player, command.targetId);
      case 'castSkill': return this.castSkill(player, command.skillId, command.targetId, command.ground, command.direction);
      case 'dodge': return this.dodge(player, command.direction);
    }
  }

  step(deltaMs: number): readonly SimulationEvent[] {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return [];
    this._clock = { nowMs: this._clock.nowMs + deltaMs, tick: this._clock.tick + 1 };
    const events:SimulationEvent[]=[];
    const dt=Math.min(deltaMs,100)/1000;
    for(const player of this.world.players.values()){
      if((player.barrierUntilMs??0)>0&&(player.barrierUntilMs??0)<=this._clock.nowMs){player.barrierHp=0;player.barrierMaxHp=0;player.barrierUntilMs=0;}
      if(!player.alive||!player.moveIntent)continue;
      const dir=normalized(player.moveIntent);
      if(dir.x===0&&dir.y===0)continue;
      player.position=clampArenaPosition({x:player.position.x+dir.x*player.moveSpeed*dt,y:player.position.y+dir.y*player.moveSpeed*dt});
      events.push({type:'positionChanged',entityId:player.id,position:player.position});
    }
    for(const monster of this.world.monsters.values()){
      if(!monster.alive)continue;
      if((monster.stunnedUntilMs??0)>this._clock.nowMs)continue;
      if((monster.armorBreakUntilMs??0)<=this._clock.nowMs){monster.armorBreakPercent=undefined;monster.armorBreakUntilMs=undefined;}
      if((monster.slowUntilMs??0)<=this._clock.nowMs){monster.slowPercent=undefined;monster.slowUntilMs=undefined;}
      let target=monster.targetPlayerId?this.world.players.get(monster.targetPlayerId):undefined;
      if(target&&!target.alive){monster.targetPlayerId=undefined;target=undefined;}
      // Retaliating onboarding mobs must eventually let a retreating player disengage.
      // This is especially important for Auto Rest: Forest 1 is passive until attacked.
      if(!target){
        const candidate=this.nearestLivingPlayer(monster);
        const aggroRange=monster.aggroRange??150;
        if(aggroRange>0&&candidate&&distance(monster.position,candidate.position)<=aggroRange){
          target=candidate;monster.targetPlayerId=target.id;monster.roamTarget=undefined;
        }else{
          // Ambient roam is authoritative but deliberately local: idle mobs wander around
          // their authored/random population point instead of drifting toward the hero.
          const home=monster.homePosition??monster.position;
          const radius=Math.max(0,monster.roamRadius??0);
          if(radius>0){
            const reached=monster.roamTarget&&distance(monster.position,monster.roamTarget)<=4;
            if(reached){monster.roamTarget=undefined;monster.nextRoamAtMs=this._clock.nowMs+450+this.random()*1050;}
            if(!monster.roamTarget&&this._clock.nowMs>=(monster.nextRoamAtMs??0)){
              const angle=this.random()*Math.PI*2;
              const roamDistance=radius*(.35+this.random()*.65);
              monster.roamTarget={x:home.x+Math.cos(angle)*roamDistance,y:home.y+Math.sin(angle)*roamDistance};
            }
            if(monster.roamTarget){
              const d=distance(monster.position,monster.roamTarget);
              const dir=normalized({x:monster.roamTarget.x-monster.position.x,y:monster.roamTarget.y-monster.position.y});
              const travel=Math.min(monster.moveSpeed*.58*dt,d);
              if(travel>0){monster.position={x:monster.position.x+dir.x*travel,y:monster.position.y+dir.y*travel};events.push({type:'positionChanged',entityId:monster.id,position:monster.position});}
            }
          }
          continue;
        }
      }
      const d=distance(monster.position,target.position);
      if(d>monster.attackRange){
        const dir=normalized({x:target.position.x-monster.position.x,y:target.position.y-monster.position.y});
        const travel=Math.min(monster.moveSpeed*(1-(monster.slowPercent??0))*dt,Math.max(0,d-monster.attackRange));
        if(travel>0){monster.position={x:monster.position.x+dir.x*travel,y:monster.position.y+dir.y*travel};events.push({type:'positionChanged',entityId:monster.id,position:monster.position});}
      }
    }
    events.push(...this.monsterActions());
    // Natural HP recovery is intentionally slow enough that Auto Rest has a real downtime cost.
    // Combat: 0.15% Max HP/s + small VIT scaling. Resting begins after 5s out of combat and
    // recovers 1.5% Max HP/s + modest VIT scaling (roughly 50s from 25% to full before VIT).
    for(const player of this.world.players.values()){
      if(!player.alive||player.hp>=player.maxHp)continue;
      const resting=this._clock.nowMs-(player.lastCombatAtMs??-Infinity)>=5000;
      const rate=(resting?.015:.0015)*player.maxHp+player.stats.vit*(resting?.06:.015);
      player.hp=Math.min(player.maxHp,player.hp+rate*dt);
    }
    for(const player of this.world.players.values()){
      if(!player.alive||player.sp===undefined||player.maxSp===undefined||player.sp>=player.maxSp)continue;
      const resting=this._clock.nowMs-(player.lastCombatAtMs??-Infinity)>=3000;
      const rate=((resting?.05:.03)*player.maxSp+player.stats.int*(resting?.14:.04))*(player.spRecoveryMultiplier??1);
      player.sp=Math.min(player.maxSp,player.sp+rate*dt);
    }
    return events;
  }

  private move(player: PlayerEntity, direction: Readonly<{x:number;y:number}>): CommandResult {
    const dir = normalized(direction);
    player.moveIntent = dir;
    return this.accept([]);
  }

  private basicAttack(player: PlayerEntity, targetId: EntityId): CommandResult {
    const result=this.basicAttackStrike(player,targetId);
    if(!result.accepted)return result;
    const target=entityById(this.world,targetId);
    if(target&&target.kind==='monster')return this.accept([...result.events,...this.weaponSkillProcs(player,target)]);
    return result;
  }

  /**
   * Weapon Mastery skills are not pressed: they fire from basic attacks.
   * Slot 1 (Lv10) = chance per hit, slot 2 (Lv20) = every Nth hit, slot 3 (Lv30) = charge gauge.
   * Each proc also respects a floor of half the skill's authored cooldown so high ASPD cannot spam it.
   */
  private weaponSkillProcs(player: PlayerEntity, target: MonsterEntity): SimulationEvent[] {
    const skills=player.skillEntitlements.weaponSkills;if(!skills.length)return[];
    const st=player.weaponProc??={hits:0,gauge:0,readyAtMs:{}};const now=this._clock.nowMs;const R=WEAPON_PROC_RULES_V2;
    st.hits++;st.gauge=Math.min(R.gaugeHits,st.gauge+1);
    const ready=(id:string)=>now>=(st.readyAtMs[id]??0);
    const fire=(id:string,icdMs:number)=>{
      if(!target.alive)return[];
      const res=this.castSkill(player,id,target.id,target.position,undefined,true);
      if(!res.accepted)return[];
      st.readyAtMs[id]=now+Math.max(icdMs,(SKILLS_V2[id]?.cooldownMs??0)*R.cooldownFloor);
      return res.events;
    };
    const out:SimulationEvent[]=[];
    const [s10,s20,s30]=skills;
    if(s10&&ready(s10)&&this.random()<R.chance+(player.weaponProcChanceBonus??0))out.push(...fire(s10,R.chanceIcdMs));
    if(s20&&st.hits%R.everyNthHit===0&&ready(s20))out.push(...fire(s20,0));
    if(s30&&st.gauge>=R.gaugeHits&&ready(s30)){const ev=fire(s30,0);if(ev.length){st.gauge=0;out.push(...ev);}}
    return out;
  }

  /** Weapon lifesteal applies to actual physical HP damage, once per normal hit (not echoes). */
  private healFromWeaponInnate(player:PlayerEntity,actualDamage:number,events:SimulationEvent[],scale=1):void{
    const rate=player.innatePhysicalLifeSteal??0;
    if(rate<=0||actualDamage<=0||!player.alive)return;
    const amount=Math.min(Math.round(actualDamage*rate*scale),Math.max(0,player.maxHp-player.hp));
    if(amount<=0)return;
    player.hp+=amount;
    events.push({type:'healed',sourceId:player.id,targetId:player.id,amount});
  }

  private basicAttackStrike(player: PlayerEntity, targetId: EntityId): CommandResult {
    const target = entityById(this.world, targetId);
    if (!target || !target.alive || target.kind !== 'monster') return this.reject('invalid-target');
    const bowRange=hasMasteryPassive(player,'bow','eagleEye');
    const effectiveRange=player.attackRange*(bowRange?MASTERY_COMBAT_V2.bow.range30:1);
    if (distance(player.position, target.position) > effectiveRange) return this.reject('out-of-range');
    if (!this.canEngage(player.position, target.position)) return this.reject('unreachable-target');
    target.targetPlayerId=player.id; player.lastCombatAtMs=this._clock.nowMs;
    if (this._clock.nowMs < player.nextBasicAttackAtMs) return this.reject('attack-cooldown');
    const aps=attacksPerSecond(aspd(player.stats,player.equipmentAspd));
    player.nextBasicAttackAtMs=this._clock.nowMs+1000/aps;
    const events:SimulationEvent[]=[{type:'attackStarted',sourceId:player.id,targetId:target.id,abilityId:'basicAttack'}];

    const daggerAny=hasAnyMasteryPassive(player,'dagger'),greatAny=hasAnyMasteryPassive(player,'greatsword'),axeAny=hasAnyMasteryPassive(player,'axe'),hammerAny=hasAnyMasteryPassive(player,'hammer');
    const magic=MAGIC_FAMILIES.has(player.weaponFamily as MagicWeaponFamily);
    const pierce=Math.min(1,(hasMasteryPassive(player,'bow','piercingArrow')?MASTERY_COMBAT_V2.bow.defIgnore40:0)+(magic?0:player.innatePhysicalArmorPenetration??0));
    const attackRaw=()=>magic?magicalAttack(player.stats,player.weaponMatk):physicalAttack(player.stats,player.weaponFamily as PhysicalWeaponFamily,player.weaponAtk)*(player.innatePhysicalAttackMultiplier??1);
    const critChance=Math.min(.7,(1+player.stats.luk*.3+player.critBonusPercent)/100);
    const hitOne=(enemy:MonsterEntity,scale=1,hitBonus=0,canCrit=true,ability='basicAttack')=>{
      if(!enemy.alive)return;
      enemy.targetPlayerId=player.id;
      if(this.random()>=hitChance(hit(player.stats,player.hitBonus+hitBonus),enemy.flee)){events.push({type:'attackMissed',sourceId:player.id,targetId:enemy.id});return;}
      const baseDefense=magic?enemy.mdef:enemy.def;const armorBreak=(enemy.armorBreakUntilMs??0)>this._clock.nowMs?(enemy.armorBreakPercent??0):0;
      const defense=baseDefense*(1-armorBreak)*(1-pierce);
      let damage=Math.max(1,Math.round(damageAfterDefense(attackRaw(),defense,player.stats.level)*scale*(enemy.hp/enemy.maxHp<.30?(player.executeDamageMultiplier??1):1)));
      const critical=canCrit&&this.random()<critChance;if(critical)damage=Math.max(1,Math.round(damage*BASE_CRIT_DAMAGE*(player.critDamageMultiplier??1)));
      const actualDamage=Math.min(enemy.hp,damage);
      enemy.hp=Math.max(0,enemy.hp-damage);events.push({type:'damageDealt',sourceId:player.id,targetId:enemy.id,amount:damage,critical,effect:(ability==='basicAttack'||ability==='offhandAttack')?{origin:'PRIMARY',echoDepth:0}:{origin:'MASTERY_PROC',echoDepth:0,ability}});
      if(!magic)this.healFromWeaponInnate(player,actualDamage,events);
      if(enemy.hp===0){enemy.alive=false;events.push({type:'entityDefeated',entityId:enemy.id,killerId:player.id});}
    };

    hitOne(target);
    if(!target.alive)return this.accept(events);

    // Dual wield: an equipped weapon-type offhand performs its own strike. Its weapon ATK is kept
    // separate from the main-hand total by the adapter, so this hit is not double-counted.
    if(player.hasOffhandWeaponEquipped){
      const mainAtk=player.weaponAtk,mainMatk=player.weaponMatk;
      player.weaponAtk=player.offhandWeaponAtk??0;player.weaponMatk=player.offhandWeaponMatk??0;
      hitOne(target,OFFHAND_DAMAGE_SCALE,0,true,'offhandAttack');
      player.weaponAtk=mainAtk;player.weaponMatk=mainMatk;
      if(!target.alive)return this.accept(events);
    }

    // Mastery passives come only from the installed five-slot loadout.
    // Each selected milestone contributes its own piece; higher milestones no longer become globally active just because mastery level is high.
    const doubleChance=hasMasteryPassive(player,'dagger','doubleAttackIII') ? .30 : hasMasteryPassive(player,'dagger','doubleAttackII') ? .25 : daggerAny ? .20 : 0;
    const precisionFollowup=hasMasteryPassive(player,'dagger','precisionFollowup'),criticalFollowup=hasMasteryPassive(player,'dagger','criticalFollowup');
    if(doubleChance&&this.random()<doubleChance)hitOne(target,1,precisionFollowup?20:0,criticalFollowup,'doubleAttack');
    if(player.hasOffhandWeaponEquipped&&target.alive&&doubleChance&&this.random()<doubleChance){
      const mainAtk=player.weaponAtk,mainMatk=player.weaponMatk;
      player.weaponAtk=player.offhandWeaponAtk??0;player.weaponMatk=player.offhandWeaponMatk??0;
      hitOne(target,OFFHAND_DAMAGE_SCALE,precisionFollowup?20:0,criticalFollowup,'doubleAttackOffhand');
      player.weaponAtk=mainAtk;player.weaponMatk=mainMatk;
    }

    const cleaveScale=hasMasteryPassive(player,'greatsword','perfectCleave') ? 1 : hasMasteryPassive(player,'greatsword','cleaveIII') ? .75 : hasMasteryPassive(player,'greatsword','cleaveII') ? .60 : greatAny ? .50 : 0;
    if(cleaveScale){
      const r=hasMasteryPassive(player,'greatsword','wideCleave')?MASTERY_COMBAT_V2.cleave.wideRange:MASTERY_COMBAT_V2.cleave.range;
      const secondary=[...this.world.monsters.values()].filter(m=>m.alive&&m.id!==target.id&&distance(target.position,m.position)<=r).sort((a,b)=>distance(target.position,a.position)-distance(target.position,b.position))[0];
      if(secondary)hitOne(secondary,cleaveScale,0,true,'cleave');
    }

    const hasMulti=hasMasteryPassive(player,'bow','multiShot')||hasMasteryPassive(player,'bow','multiShotII')||hasMasteryPassive(player,'bow','multiShotIII');
    const multiChance=hasMasteryPassive(player,'bow','multiShotIII') ? .25 : hasMasteryPassive(player,'bow','multiShotII') ? .20 : hasMulti ? .15 : 0;
    if(multiChance&&this.random()<multiChance){
      const secondary=[...this.world.monsters.values()].filter(m=>m.alive&&m.id!==target.id&&distance(player.position,m.position)<=effectiveRange).sort((a,b)=>distance(player.position,a.position)-distance(player.position,b.position))[0];
      if(secondary)hitOne(secondary,hasMasteryPassive(player,'bow','multiShotIII') ? .75 : .50,0,true,'multiShot');
    }

    const heavyChance=hasMasteryPassive(player,'axe','heavyBlowIII') ? .25 : hasMasteryPassive(player,'axe','heavyBlowII') ? .20 : axeAny ? .15 : 0;
    if(heavyChance&&this.random()<heavyChance){
      target.staggeredUntilMs=this._clock.nowMs+250;
      const breakPct=hasMasteryPassive(player,'axe','crushingArmorBreak') ? .10 : hasMasteryPassive(player,'axe','armorBreak') ? .05 : 0;
      if(breakPct){target.armorBreakPercent=breakPct;target.armorBreakUntilMs=this._clock.nowMs+3000;}
    }
    const stunChance=hasMasteryPassive(player,'hammer','crushingImpactIII') ? .20 : hasMasteryPassive(player,'hammer','crushingImpactII') ? .15 : hammerAny ? .10 : 0;
    if(stunChance&&this.random()<stunChance){
      const rank=target.isBoss?'boss':target.isElite?'elite':'normal';const duration=500*CC_DURATION_BY_RANK[rank];
      target.stunnedUntilMs=this._clock.nowMs+duration;
      if(hasMasteryPassive(player,'hammer','concussion')){target.slowPercent=.20;target.slowUntilMs=target.stunnedUntilMs+2000;}
      if(hasMasteryPassive(player,'hammer','shockwave'))for(const m of this.world.monsters.values()){if(!m.alive||m.id===target.id||distance(m.position,target.position)>85)continue;const d=normalized({x:m.position.x-target.position.x,y:m.position.y-target.position.y});m.position={x:m.position.x+d.x*28,y:m.position.y+d.y*28};events.push({type:'positionChanged',entityId:m.id,position:m.position});}
    }
    return this.accept(events);
  }

  private castSkill(player: PlayerEntity, skillId: string, targetId?: EntityId, ground?: Readonly<{x:number;y:number}>, direction?: Readonly<{x:number;y:number}>, fromProc=false): CommandResult {
    const skill=SKILLS_V2[skillId];if(!skill)return this.reject('unknown-skill');
    if(skill.kind==='weapon'&&!fromProc)return this.reject('weapon-skill-triggers-on-attack');
    const entitlementReason=skillEntitlementReason(player.skillEntitlements,skillId,skill.kind);if(entitlementReason)return this.reject(entitlementReason);
    if(!fromProc&&skill.compatibleWeaponFamilies&&!skill.compatibleWeaponFamilies.includes(player.weaponFamily))return this.reject('incompatible-weapon');
    if(!fromProc&&this._clock.nowMs<(player.cooldowns[skillId]??0))return this.reject('skill-cooldown');
    const spCost=fromProc?0:Math.round(skillSpCostV2(skill)*(player.skillCostMultiplier??1));
    if(spCost>0&&player.sp!==undefined&&player.sp<spCost)return this.reject('insufficient-sp');
    if(skill.kind==='movement'){const dir=normalized(direction??{x:0,y:0});if(!dir.x&&!dir.y)return this.reject('movement-skill-requires-direction');const travel=(skill.movementDistance??120)+(player.movementSkillDistanceBonuses?.[skillId]??0);const desired={x:player.position.x+dir.x*travel,y:player.position.y+dir.y*travel};player.position=this.resolveSkillMovement?this.resolveSkillMovement(player.position,desired):clampArenaPosition(desired);const events:SimulationEvent[]=[{type:'skillCast',sourceId:player.id,skillId},{type:'positionChanged',entityId:player.id,position:player.position}];this.startSkillCooldown(player,skill,events);return this.accept(events);}
    player.lastCombatAtMs=this._clock.nowMs;const events:SimulationEvent[]=[{type:'skillCast',sourceId:player.id,skillId,targetId}];
    const staffEcho=hasMasteryPassive(player,'staff','coreEcho');const coreMeta:EffectMeta=skill.kind==='weapon'&&fromProc?{origin:'MASTERY_PROC',echoDepth:0,ability:skillId}:skillCoreEffect(skillId);
    const modIds=player.skillEntitlements.modifiersByActive?.[skillId]??[];
    const hasMod=(id:string)=>modIds.includes(id);
    const modPct=(id:string,base:number)=>stackedSkillModifierFraction(modIds,id,base*(player.skillModifierMultipliers?.[id]??1));
    if(skillId==='barrier'){const fraction=skill.barrierMaxHpFraction??.15,durationMs=skill.durationMs??5000,max=Math.max(1,Math.round(player.maxHp*fraction));player.barrierHp=max;player.barrierMaxHp=max;player.barrierUntilMs=this._clock.nowMs+durationMs;events.push({type:'barrierApplied',entityId:player.id,amount:max,durationMs});this.startSkillCooldown(player,skill,events);return this.accept(events);}
    if(skillId==='healingPulse'){const heal=Math.max(1,Math.round(player.maxHp*(skill.healMaxHpFraction??.2)*(player.healingMultiplier??1)));const actual=Math.min(heal,player.maxHp-player.hp);player.hp+=actual;if(actual>0)events.push({type:'healed',sourceId:player.id,targetId:player.id,amount:actual});if(actual>0&&staffEcho&&this.random()<MASTERY_COMBAT_V2.staff.echoChance){const amount=Math.min(Math.max(1,Math.round(actual*MASTERY_COMBAT_V2.staff.echoEffect)),player.maxHp-player.hp);player.hp+=amount;if(amount>0)events.push({type:'healed',sourceId:player.id,targetId:player.id,amount});}this.startSkillCooldown(player,skill,events);return this.accept(events);}
    if(!skill.scaling||!skill.coefficient){this.startSkillCooldown(player,skill,events);return this.accept(events);}
    const target=targetId?entityById(this.world,targetId):undefined;let center=player.position;
    const effectiveRange=(skill.range??player.attackRange)*(1+modPct('mobileCast',.20));
    const radiusScale=(1+modPct('expandedArea',.25))*(1+modPct('chain',.20));
    const effectiveRadius=(skill.radius??0)*radiusScale;
    if(skill.targeting==='groundArea'){if(!ground)return this.reject('ground-target-required');if(distance(player.position,ground)>effectiveRange)return this.reject('out-of-range');center=ground;}
    else if(skill.targeting==='targetArea'){if(!target||target.kind!=='monster'||!target.alive)return this.reject('invalid-target');if(distance(player.position,target.position)>effectiveRange)return this.reject('out-of-range');center=target.position;}
    else if(skill.targeting!=='selfArea'){if(!target||target.kind!=='monster'||!target.alive)return this.reject('invalid-target');if(distance(player.position,target.position)>effectiveRange)return this.reject('out-of-range');}
    const targets=skill.targeting?.endsWith('Area')?[...this.world.monsters.values()].filter(m=>m.alive&&distance(center,m.position)<=effectiveRadius):target&&target.kind==='monster'?[target]:[];if(!targets.length)return this.reject('no-targets');
    if(skillId==='blackHole'){for(const enemy of targets){const dx=center.x-enemy.position.x,dy=center.y-enemy.position.y,len=Math.hypot(dx,dy);if(len>18){const pull=Math.min(len-18,Math.max(36,len*.72));enemy.position={x:enemy.position.x+dx/len*pull,y:enemy.position.y+dy/len*pull};events.push({type:'positionChanged',entityId:enemy.id,position:{...enemy.position}});}}}
    const scaling=skill.scaling==='magicalAttack'?magicalAttack(player.stats,player.weaponMatk):physicalAttack(player.stats,player.weaponFamily as PhysicalWeaponFamily,player.weaponAtk)*(player.innatePhysicalAttackMultiplier??1);const hitCount=Math.max(1,skill.hitCount??1);
    const damageScale=(player.skillCoreDamageMultipliers?.[skillId]??1)*(skill.kind==='weapon'?(player.weaponSkillDamageMultiplier??1):(player.coreSkillDamageMultiplier??1))*(1+modPct('lingering',.20))*(1+modPct('chain',.10))*(1+(skill.element==='fire'?modPct('combustion',.30):0))*(1+(skill.element==='lightning'?modPct('overcharge',.30):0))*(1+(!skill.targeting?.endsWith('Area')?modPct('concentratedForce',.35):0));
    const elementScale=skill.element&&skill.element!=='physical'?(player.elementDamageMultiplier??1):1;
    const rawPerHit=(scaling*skill.coefficient+(skill.flatPower??0))*damageScale*elementScale/hitCount;
    // AoE heals at full value on the first successfully hit enemy; each later target contributes half.
    let lifestealTargetsHit=0;
    for(const enemy of targets){enemy.targetPlayerId=player.id;if(skill.accuracy!=='alwaysHit'&&this.random()>=hitChance(hit(player.stats,player.hitBonus),enemy.flee)){events.push({type:'attackMissed',sourceId:player.id,targetId:enemy.id});continue;}const innateLifestealScale=skill.targeting?.endsWith('Area')&&lifestealTargetsHit++>0?.5:1;const defense=skill.defenseType==='ignore'?0:skill.defenseType==='mdef'?enemy.mdef:enemy.def*(1-(skill.scaling==='physicalAttack'?(player.innatePhysicalArmorPenetration??0):0));for(let i=0;i<hitCount&&enemy.alive;i++){let damage=damageAfterDefense(rawPerHit,defense,player.stats.level);if(enemy.hp/enemy.maxHp<.30)damage=Math.max(1,Math.round(damage*(1+modPct('execution',.25))*(player.executeDamageMultiplier??1)));const critical=Boolean(skill.canCrit)&&this.random()<Math.min(.7,(1+player.stats.luk*.3+player.critBonusPercent)/100);if(critical)damage=Math.max(1,Math.round(damage*BASE_CRIT_DAMAGE*(player.critDamageMultiplier??1)));const actualDamage=Math.min(enemy.hp,damage);enemy.hp=Math.max(0,enemy.hp-damage);events.push({type:'damageDealt',sourceId:player.id,targetId:enemy.id,amount:damage,critical,effect:coreMeta});if(skill.scaling==='physicalAttack')this.healFromWeaponInnate(player,actualDamage,events,innateLifestealScale);if(hasMod('lifeDrain')&&damage>0){const heal=Math.min(Math.max(1,Math.round(damage*modPct('lifeDrain',.05))),player.maxHp-player.hp);player.hp+=heal;if(heal>0)events.push({type:'healed',sourceId:player.id,targetId:player.id,amount:heal});}if(enemy.alive&&(hasMod('echo')||hasMod('extraStrike'))&&this.random()<Math.max(modPct('echo',.20),modPct('extraStrike',.20))){const bonusScale=Math.max(modPct('echo',.50),modPct('extraStrike',.50));const bonus=Math.max(1,Math.round(damage*bonusScale));enemy.hp=Math.max(0,enemy.hp-bonus);events.push({type:'damageDealt',sourceId:player.id,targetId:enemy.id,amount:bonus,critical:false,effect:echoEffect(coreMeta)});}if(enemy.alive&&staffEcho&&this.random()<MASTERY_COMBAT_V2.staff.echoChance){const echoDamage=Math.max(1,Math.round(damage*MASTERY_COMBAT_V2.staff.echoEffect));enemy.hp=Math.max(0,enemy.hp-echoDamage);events.push({type:'damageDealt',sourceId:player.id,targetId:enemy.id,amount:echoDamage,critical:false,effect:echoEffect(coreMeta)});}if(enemy.hp===0){enemy.alive=false;events.push({type:'entityDefeated',entityId:enemy.id,killerId:player.id});}}}
    this.startSkillCooldown(player,skill,events);return this.accept(events);
  }

  private dodge(player: PlayerEntity, direction: Readonly<{x:number;y:number}>): CommandResult {
    if (this._clock.nowMs < player.nextDodgeAtMs) return this.reject('dodge-cooldown');
    const dir = normalized(direction);
    if (dir.x === 0 && dir.y === 0) return this.reject('invalid-direction');
    player.position = clampArenaPosition({
      x: player.position.x + dir.x * player.dodgeDistance,
      y: player.position.y + dir.y * player.dodgeDistance,
    });
    player.nextDodgeAtMs = this._clock.nowMs + player.dodgeCooldownMs;
    return this.accept([
      { type: 'dodged', entityId: player.id, position: player.position },
      { type: 'positionChanged', entityId: player.id, position: player.position },
      { type: 'cooldownStarted', entityId: player.id, abilityId: 'dodge', durationMs: player.dodgeCooldownMs },
    ]);
  }

  private startSkillCooldown(player: PlayerEntity, skill: SkillDefinitionV2, events: SimulationEvent[]): void {
    if(skill.kind==='weapon')return;
    const spCost=Math.round(skillSpCostV2(skill)*(player.skillCostMultiplier??1));if(spCost>0&&player.sp!==undefined)player.sp=Math.max(0,player.sp-spCost);
    const modIds=player.skillEntitlements.modifiersByActive?.[skill.id]??[];
    const rapidReduction=stackedSkillModifierFraction(modIds,'rapidCasting',.20);
    const durationMs = Math.round((skill.cooldownMs ?? 0)*(1-rapidReduction)*(player.coreCooldownMultiplier??1));
    if (durationMs <= 0) return;
    player.cooldowns[skill.id] = this._clock.nowMs + durationMs;
    events.push({ type: 'cooldownStarted', entityId: player.id, abilityId: skill.id, durationMs });
  }

  private monsterActions(): SimulationEvent[] {
    const events: SimulationEvent[] = [];
    for (const monster of this.world.monsters.values()) {
      if (!monster.alive || this._clock.nowMs < monster.nextBasicAttackAtMs) continue;
      const target = monster.targetPlayerId ? this.world.players.get(monster.targetPlayerId) : undefined;
      if (!target || !target.alive || distance(monster.position, target.position) > monster.attackRange || !this.canEngage(monster.position, target.position)) continue;

      monster.targetPlayerId = target.id;
      target.lastCombatAtMs=this._clock.nowMs;
      monster.nextBasicAttackAtMs = this._clock.nowMs + monster.attackIntervalMs;
      events.push({ type: 'attackStarted', sourceId: monster.id, targetId: target.id, abilityId: monster.isBoss ? 'bossAttack' : 'basicAttack' });
      if (this.random() >= hitChance(monster.hit, 100 + target.stats.level + target.stats.agi + target.fleeBonus)) {
        events.push({ type: 'attackMissed', sourceId: monster.id, targetId: target.id });
        continue;
      }

      let damage = damageAfterDefense(monster.atk, target.equipmentDef + Math.floor(target.stats.vit / 2), monster.level);
      damage=Math.max(1,Math.round(damage*(target.damageTakenMultiplier??1)*(target.hp/target.maxHp<.30?(target.lastStandDamageTakenMultiplier??1):1)));
      const shieldScale=target.hasShieldEquipped?1:MASTERY_COMBAT_V2.guard.noShieldScale;
      const blockChance=blockChanceForPlayer(target);
      const blocked=blockChance>0&&this.random()<blockChance;
      // Every successful Block reduces damage by 50%; Firm Guard increases it to 70% with a shield.
      // Preserve the existing reduced effectiveness of Guard passives without a shield.
      if(blocked){const mitigation=(MASTERY_COMBAT_V2.guard.baseMitigation+(hasMasteryPassive(target,'swordShield','firmGuard')?MASTERY_COMBAT_V2.guard.firmGuardBonus:0))*shieldScale;damage=Math.max(1,Math.round(damage*(1-mitigation)));}
      if((target.guardedUntilMs??0)>this._clock.nowMs)damage=Math.max(1,Math.round(damage*(1-MASTERY_COMBAT_V2.guard.guardedReduction*shieldScale)));
      const critical = this.random() < monster.critChance;
      if (critical) damage = Math.max(1, Math.round(damage * BASE_CRIT_DAMAGE));
      if((target.barrierUntilMs??0)<=this._clock.nowMs){target.barrierHp=0;target.barrierMaxHp=0;}
      if((target.barrierHp??0)>0){const absorbed=Math.min(damage,target.barrierHp??0);target.barrierHp=Math.max(0,(target.barrierHp??0)-absorbed);damage-=absorbed;events.push({type:'barrierAbsorbed',entityId:target.id,amount:absorbed,remaining:target.barrierHp??0});}
      target.hp = Math.max(0, target.hp - damage);
      if(blocked&&hasMasteryPassive(target,'swordShield','aegisMastery'))target.guardedUntilMs=this._clock.nowMs+MASTERY_COMBAT_V2.guard.guardedMs;
      if(blocked&&hasMasteryPassive(target,'swordShield','counterGuard')&&this.random()<MASTERY_COMBAT_V2.guard.counter30*shieldScale&&monster.alive){const raw=physicalAttack(target.stats,target.weaponFamily as PhysicalWeaponFamily,target.weaponAtk);const counter=damageAfterDefense(raw,monster.def,target.stats.level);monster.hp=Math.max(0,monster.hp-counter);events.push({type:'damageDealt',sourceId:target.id,targetId:monster.id,amount:counter,critical:false});if(monster.hp===0){monster.alive=false;events.push({type:'entityDefeated',entityId:monster.id,killerId:target.id});}}
      events.push({ type: 'damageDealt', sourceId: monster.id, targetId: target.id, amount: damage, critical });
      if (target.hp === 0) {
        target.alive = false;
        events.push({ type: 'entityDefeated', entityId: target.id, killerId: monster.id });
      }
    }
    return events;
  }

  private nearestLivingPlayer(monster: MonsterEntity): PlayerEntity | undefined {
    let best: PlayerEntity | undefined;
    let bestDistance = Infinity;
    for (const player of this.world.players.values()) {
      if (!player.alive) continue;
      const d = distance(monster.position, player.position);
      if (d < bestDistance) { best = player; bestDistance = d; }
    }
    return best;
  }

  private accept(events: SimulationEvent[]): CommandResult { return { accepted: true, events }; }
  private reject(reason: string): CommandResult { return { accepted: false, reason, events: [] }; }
}
