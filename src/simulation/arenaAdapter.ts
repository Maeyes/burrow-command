import { magicalAttack, maxHp, meleeStatusAtk, rangedStatusAtk, type CombatWeaponFamily } from '../systems/combatMath';
import { monsterBaseExpV2 } from './rewards';
import { WEAPON_TRAINING_MAPS } from './mastery';
import { normalizeCharacterStateV2 } from './equipmentMigration';
import type { CharacterStateV2 } from './character';
import { skillEntitlementsForCharacter } from './skillEntitlements';
import { equipmentCombatTotals } from './equipmentCombat';
import { weaponInnateBonuses } from './weaponInnatePassives';
import { equipmentRarityStatMultiplier } from './equipmentV2';
import { EQUIPMENT_MASTER_V2 } from './itemMasterV2';
import { applyEquipmentCommand, type EquipmentCommandV2, type EquipmentCommandResultV2 } from './equipmentService';
import { grantLootWithEquipment } from './equipmentLoot';
import { applySkillCoreCommand, skillCoreDamageMultiplier, movementSkillDistanceBonus, type SkillCoreCommandV2 } from './skillCoreService';
import { applyMasteryLoadoutCommand, masteryPassiveKeys, type MasteryLoadoutCommandV2 } from './masteryLoadout';
import { allocateCharacterStatsV2, createInitialCharacterV2 } from './character';
import type { SimulationCommand, SimulationEvent, Vec2 } from './contracts';
import { createContributionLedger, recordContribution, type ContributionLedger } from './contribution';
import { nextAutoCommand, type ControlMode } from './auto';
import type { MonsterEntity, PlayerEntity } from './entities';
import { BunnySimulation, type RandomFn } from './engine';
import { MONSTERS_V2, type MonsterDefinitionV2 } from './monsterDataV2';
import { resolveDefeatRewards, type PlayerRewardV2 } from './rewards';
import { createBossCorePityState, type BossCorePityState } from './pity';
import { addMonster, addPlayer, createWorldState } from './world';

export interface ArenaMonsterView {
  id:string;
  monsterType?:string;
  x:number; y:number;
  hp:number; maxHp:number;
  dead:boolean;
  level?:number;
  elite?:boolean;
  isBoss?:boolean;
  attackRange?:number;
  speed?:number;
  aggroRange?:number;
  maxHpOverride?:number;
  levelOverride?:number;
}

export interface ArenaPlayerView {
  x:number; y:number;
  hp?:number; maxHp?:number;
  sp?:number; maxSp?:number;
}

export interface GmEventMultipliersV2 {exp:number;weaponExp:number;drop:number;gold:number;upgradeItem:number;blueprint:number}
export interface ArenaV2AdapterOptions {
  zoneId:string;
  player:ArenaPlayerView;
  monsters:ArenaMonsterView[];
  weaponFamily?:CombatWeaponFamily;
  character?:CharacterStateV2;
  random?:RandomFn;
  safeZoneContains?:(position:Vec2)=>boolean;
  /** Areas monsters may never walk into or respawn in (e.g. warp safe zones). */
  monsterForbiddenContains?:(position:Vec2)=>boolean;
  /** Optional authored navigation constraint (for image-mask maps). Simulation movement may not leave this space. */
  walkableContains?:(position:Vec2)=>boolean;
  /** Map-wide respawn spot for a defeated field mob (bosses always return to their lair). */
  respawnPointPicker?:(heroPosition:Vec2|undefined)=>Vec2|null;
  /** Terrain rule for fighting: false when the two positions are on different ground levels. */
  canEngage?:(a:Vec2,b:Vec2)=>boolean;
  onReward?:(reward:PlayerRewardV2,character:CharacterStateV2,defeated?:Readonly<ArenaMonsterView>)=>void;
}

/**
 * Cutover boundary for the legacy Arena renderer.
 * Presentation may sync positions inward. Combat HP, damage, rewards, Gold,
 * inventory and mastery never sync inward from presentation.
 */
const BASE_MOVE_SPEED=180,BASE_DODGE_COOLDOWN_MS=1200;
function gearHooks(gear:ReturnType<typeof equipmentCombatTotals>){
  return{weaponSkillDamageMultiplier:gear.weaponSkillDamageMultiplier,coreSkillDamageMultiplier:gear.coreSkillDamageMultiplier,coreCooldownMultiplier:gear.coreCooldownMultiplier,
    damageTakenMultiplier:gear.damageTakenMultiplier,lastStandDamageTakenMultiplier:gear.lastStandDamageTakenMultiplier,executeDamageMultiplier:gear.executeDamageMultiplier,weaponProcChanceBonus:gear.weaponProcChanceBonus};
}

function innateHooks(innate:ReturnType<typeof weaponInnateBonuses>){
  return {innatePhysicalAttackMultiplier:innate.physicalAtkMultiplier,innatePhysicalArmorPenetration:innate.physicalArmorPenetration,
    innatePhysicalLifeSteal:innate.physicalLifeSteal,innateBlockChanceBonus:innate.blockChanceBonus};
}

/** Field mobs return 8s after death somewhere else on the map; bosses hold their lair for 5 min (phase 1). */
export const MONSTER_RESPAWN_MS=8000;
export const BOSS_RESPAWN_MS=5*60*1000;

export class ArenaV2Adapter {
  readonly playerId='arena-player';
  readonly simulation:BunnySimulation;
  private sequence=0;
  private readonly monsterViews=new Map<string,ArenaMonsterView>();
  private readonly contributions=new Map<string,ContributionLedger>();
  private characterState:CharacterStateV2;
  private weaponFamily:CombatWeaponFamily;
  private readonly pityState:BossCorePityState=createBossCorePityState();
  private readonly respawnAtMs=new Map<string,number>();
  private playerRespawnAtMs:number|null=null;
  private autoResting=false;
  private gmEventMultipliers:GmEventMultipliersV2={exp:1,weaponExp:1,drop:1,gold:1,upgradeItem:1,blueprint:1};
  private autoRestEnabled=true;
  private autoRestBelow=.4;
  private autoResumeAbove=.75;
  private readonly playerSpawn:Vec2;

  constructor(private readonly options:ArenaV2AdapterOptions){
    this.weaponFamily=options.weaponFamily??'dagger';
    this.playerSpawn={x:options.player.x,y:options.player.y};
    this.characterState=normalizeCharacterStateV2(options.character??createInitialCharacterV2(this.playerId,'Arena Bunny'));
    this.weaponFamily=weaponInnateBonuses(this.characterState).family??this.weaponFamily;
    const world=createWorldState(options.zoneId);
    addPlayer(world,this.makePlayer(options.player,this.weaponFamily));
    options.monsters.forEach((view,index)=>{
      const id=view.id||`arena-monster-${index}`;
      view.id=id; this.monsterViews.set(id,view); this.contributions.set(id,createContributionLedger());
      addMonster(world,this.makeMonster(view,id));
    });
    // Movement skills traverse the current scene's walkable geometry instead of legacy arena bounds.
    const movementResolver=options.walkableContains?(start:Readonly<Vec2>,end:Vec2):Vec2=>{
      const steps=Math.max(1,Math.ceil(Math.hypot(end.x-start.x,end.y-start.y)/8));
      let last={...start};
      for(let i=1;i<=steps;i++){const t=i/steps,point={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t};if(!options.walkableContains!(point))break;last=point;}
      return last;
    }:undefined;
    this.simulation=new BunnySimulation(world,options.random,movementResolver);
    if(options.canEngage)this.simulation.canEngage=options.canEngage;
    this.syncPresentation();
  }

  get character():Readonly<CharacterStateV2>{return this.characterState;}
  grantEventItems(items:Readonly<Record<string,number>>):Readonly<CharacterStateV2>{
    const inventory={...this.characterState.inventory};for(const [id,qty] of Object.entries(items)){if(qty>0)inventory[id]=(inventory[id]??0)+Math.floor(qty);}
    this.characterState={...this.characterState,inventory};return this.characterState;
  }

  move(direction:Vec2){return this.dispatch({type:'move',playerId:this.playerId,direction,clientSequence:this.nextSequence()});}
  basicAttack(targetId:string){return this.dispatch({type:'basicAttack',playerId:this.playerId,targetId,clientSequence:this.nextSequence()});}
  castSkill(skillId:string,targetId?:string,ground?:Vec2,direction?:Vec2){return this.dispatch({type:'castSkill',playerId:this.playerId,skillId,targetId,ground,direction,clientSequence:this.nextSequence()});}
  dodge(direction:Vec2){return this.dispatch({type:'dodge',playerId:this.playerId,direction,clientSequence:this.nextSequence()});}
  allocateStats(allocation:Partial<Record<'str'|'agi'|'vit'|'int'|'dex'|'luk',number>>):boolean{
    const next=allocateCharacterStatsV2(this.characterState,allocation);if(next===this.characterState)return false;
    this.characterState=next;this.refreshPlayerBuild();this.syncPresentation();return true;
  }
  setGmEventMultipliers(next:Partial<GmEventMultipliersV2>){this.gmEventMultipliers={...this.gmEventMultipliers,...next};}
  getGmEventMultipliers():Readonly<GmEventMultipliersV2>{return this.gmEventMultipliers;}
  equipmentCommand(command:EquipmentCommandV2):EquipmentCommandResultV2{
    const result=applyEquipmentCommand(this.characterState,command,this.options.random);
    this.characterState=result.state;this.refreshPlayerBuild();this.syncPresentation();return result;
  }
  skillCoreCommand(command:SkillCoreCommandV2):Readonly<CharacterStateV2>{
    this.characterState=applySkillCoreCommand(this.characterState,command,this.options.random);
    this.refreshPlayerBuild();this.syncPresentation();return this.characterState;
  }
  masteryLoadoutCommand(command:MasteryLoadoutCommandV2):Readonly<CharacterStateV2>{
    this.characterState=applyMasteryLoadoutCommand(this.characterState,command);
    this.refreshPlayerBuild();this.syncPresentation();return this.characterState;
  }
  autoStep(mode:ControlMode,filter?:{allowedMonsterIds?:ReadonlySet<string>;maxTargetLevel?:number;restEnabled?:boolean;restBelowHpFraction?:number;resumeAboveHpFraction?:number}){
    const player=this.simulation.world.players.get(this.playerId)!;
    const hpFraction=player.hp/player.maxHp;
    this.autoRestEnabled=mode==='fullAuto'&&filter?.restEnabled!==false;
    this.autoRestBelow=Math.max(.01,Math.min(.99,filter?.restBelowHpFraction??.4));
    this.autoResumeAbove=Math.max(this.autoRestBelow,Math.min(1,filter?.resumeAboveHpFraction??.75));
    // Do not enter rest in the middle of a fight. Rest is latched only after this player
    // defeats a monster (consumeAuthoritativeEvents). While resting, resume at the configured HP.
    if(!this.autoRestEnabled)this.autoResting=false;
    else if(this.autoResting&&hpFraction>=this.autoResumeAbove)this.autoResting=false;
    const command=nextAutoCommand(player,this.simulation.world.monsters.values(),{mode,sequence:this.nextSequence(),activeSkillIds:player.skillEntitlements.active,weaponSkillIds:player.skillEntitlements.weaponSkills,movementSkillId:player.skillEntitlements.movement,hpFraction,nowMs:this.simulation.clock.nowMs,recovering:this.autoResting,allowedMonsterIds:filter?.allowedMonsterIds,maxTargetLevel:filter?.maxTargetLevel});
    if(!command)return undefined;
    const result=this.simulation.dispatch(command);if(result.accepted)this.consumeAuthoritativeEvents(result.events);this.syncPresentation();return{command,result};
  }
  applyBossHazardDamage(sourceId:string,amount:number):readonly SimulationEvent[]{
    const player=this.simulation.world.players.get(this.playerId);if(!player||!player.alive||amount<=0)return[];
    const damage=Math.max(1,Math.round(amount));player.hp=Math.max(0,player.hp-damage);
    const events:SimulationEvent[]=[{type:'damageDealt',sourceId,targetId:this.playerId,amount:damage,critical:false}];
    if(player.hp===0){player.alive=false;events.push({type:'entityDefeated',entityId:this.playerId,killerId:sourceId});}
    this.consumeAuthoritativeEvents(events);this.syncPresentation();return events;
  }

  step(deltaMs:number):readonly SimulationEvent[]{
    const player=this.simulation.world.players.get(this.playerId)!;
    const safe=this.options.safeZoneContains?.(player.position)??false;
    // Authoritative safe-zone invariant: monsters cannot retain a target or resolve an attack
    // against a player inside a safe zone. This happens before the simulation combat step.
    if(safe){for(const monster of this.simulation.world.monsters.values()){if(monster.targetPlayerId===this.playerId)monster.targetPlayerId=undefined;monster.nextBasicAttackAtMs=Math.max(monster.nextBasicAttackAtMs,this.simulation.clock.nowMs+deltaMs+1);}}
    // Keep the previous authoritative positions so image-mask maps can reject any engine AI
    // movement that would cross authored non-walkable pixels. Presentation-only collision is
    // insufficient because simulation.step() also moves monsters while chasing/roaming.
    const beforePlayer={...player.position};
    const beforeMonsters=new Map([...this.simulation.world.monsters].map(([id,m])=>[id,{...m.position}]));
    const events=[...this.simulation.step(deltaMs)];
    if(this.options.walkableContains&&!this.options.walkableContains(player.position))player.position=beforePlayer;
    if(this.options.walkableContains||this.options.monsterForbiddenContains){
      for(const [id,monster] of this.simulation.world.monsters){
        if((this.options.walkableContains?.(monster.position)??true)&&!this.options.monsterForbiddenContains?.(monster.position))continue;
        const previous=beforeMonsters.get(id);if(previous)monster.position=previous;
        // A mob held back by its ground (the hero stood on a ledge it cannot reach) drops the chase.
        if(monster.targetPlayerId&&this.options.canEngage&&!this.options.canEngage(monster.position,player.position))monster.targetPlayerId=undefined;
        // Force a fresh roam decision rather than repeatedly pushing into the same wall.
        monster.roamTarget=undefined;monster.nextRoamAtMs=this.simulation.clock.nowMs+250;
      }
    }
    this.consumeAuthoritativeEvents(events);
    for(const [id,at] of [...this.respawnAtMs]){
      if(this.simulation.clock.nowMs<at)continue;
      const view=this.monsterViews.get(id);const monster=this.simulation.world.monsters.get(id);
      if(!view||!monster){this.respawnAtMs.delete(id);continue;}
      monster.hp=monster.maxHp;monster.alive=true;monster.nextBasicAttackAtMs=this.simulation.clock.nowMs;
      // Respawn is a fresh monster instance from an aggro perspective. Never inherit the
      // previous life's retaliation target, otherwise passive Forest 1 mobs spawn angry.
      monster.targetPlayerId=undefined;monster.roamTarget=undefined;monster.nextRoamAtMs=this.simulation.clock.nowMs+500;
      monster.position=this.respawnPoint(monster);
      this.contributions.set(id,createContributionLedger());this.respawnAtMs.delete(id);
      events.push({type:'entityRespawned',entityId:id,position:{...monster.position}});
    }
    if(this.playerRespawnAtMs!==null && this.simulation.clock.nowMs>=this.playerRespawnAtMs){
      const player=this.simulation.world.players.get(this.playerId)!;player.hp=player.maxHp;if(player.maxSp!==undefined)player.sp=player.maxSp;player.alive=true;player.position={...this.playerSpawn};
      player.nextBasicAttackAtMs=this.simulation.clock.nowMs;this.playerRespawnAtMs=null;
      events.push({type:'entityRespawned',entityId:this.playerId,position:{...player.position}});
    }
    this.syncPresentation();return events;
  }

  /** A defeated mob comes back somewhere else in its home area, out of the hero's face (RO-style),
   *  never inside walls/water. Falls back to its authored home spot. */
  private respawnPoint(monster:{position:{x:number;y:number};homePosition?:{x:number;y:number};isBoss?:boolean}):{x:number;y:number}{
    const rnd=this.options.random??Math.random,home=monster.homePosition??monster.position;
    const hero=this.simulation.world.players.get(this.playerId)?.position;
    if(monster.isBoss)return {...home};
    const picked=this.options.respawnPointPicker?.(hero);
    if(picked){if('homePosition' in monster)monster.homePosition={...picked};return picked;}
    for(let i=0;i<24;i++){
      const a=rnd()*Math.PI*2,r=120+rnd()*260,p={x:home.x+Math.cos(a)*r,y:home.y+Math.sin(a)*r};
      if(this.options.walkableContains&&!this.options.walkableContains(p))continue;
      if(this.options.monsterForbiddenContains?.(p))continue;
      if(hero&&Math.hypot(p.x-hero.x,p.y-hero.y)<320)continue;
      return p;
    }
    return {...home};
  }

  syncFromPresentationPositions():void{
    const p=this.simulation.world.players.get(this.playerId)!;
    p.position={x:this.options.player.x,y:this.options.player.y};
    for(const [id,view] of this.monsterViews){const m=this.simulation.world.monsters.get(id);if(m)m.position={x:view.x,y:view.y};}
  }

  /** Move a monster (and its roam home) — used to scatter the field once the map's terrain exists. */
  placeMonster(id:string,position:Vec2):void{
    const m=this.simulation.world.monsters.get(id),view=this.monsterViews.get(id);if(!m)return;
    m.position={...position};m.homePosition={...position};m.roamTarget=undefined;if(view){view.x=position.x;view.y=position.y;}
  }

  respawnMonster(id:string):boolean{
    const monster=this.simulation.world.monsters.get(id); if(!monster)return false;
    monster.hp=monster.maxHp;monster.alive=true;monster.nextBasicAttackAtMs=this.simulation.clock.nowMs;monster.targetPlayerId=undefined;monster.roamTarget=undefined;monster.nextRoamAtMs=this.simulation.clock.nowMs+500;
    this.contributions.set(id,createContributionLedger());this.syncPresentation();return true;
  }

  private dispatch(command:SimulationCommand){
    const result=this.simulation.dispatch(command);
    if(result.accepted)this.consumeAuthoritativeEvents(result.events);
    this.syncPresentation();return result;
  }
  private nextSequence(){return ++this.sequence;}

  private consumeAuthoritativeEvents(events:readonly SimulationEvent[]):void{
    for(const event of events){
      if(event.type==='entityDefeated' && event.entityId===this.playerId)this.playerRespawnAtMs=this.simulation.clock.nowMs+10000;
      if(event.type==='damageDealt' && event.sourceId===this.playerId){
        const ledger=this.contributions.get(event.targetId);if(ledger)recordContribution(ledger,this.playerId,event.amount);
      }
      if(event.type==='entityDefeated' && event.killerId===this.playerId){
        // HP REST decision point: finish the current monster first, then inspect HP once.
        // If HP is at/below the configured threshold, Auto Hunt pauses before selecting another target.
        const player=this.simulation.world.players.get(this.playerId);
        if(this.autoRestEnabled&&player&&player.hp/player.maxHp<=this.autoRestBelow)this.autoResting=true;
        const view=this.monsterViews.get(event.entityId);const def=view&&this.definitionFor(view);const ledger=this.contributions.get(event.entityId);
        if(view)this.respawnAtMs.set(event.entityId,this.simulation.clock.nowMs+(view.isBoss?BOSS_RESPAWN_MS:MONSTER_RESPAWN_MS));
        if(!view||!def||!ledger)continue;
        const rewardGear=equipmentCombatTotals(this.characterState);
        const [reward]=resolveDefeatRewards(ledger,{[this.playerId]:this.characterState},{
          enemyLevel:def.level,rank:def.rank,baseExp:this.baseExp(def),weaponByPlayer:{[this.playerId]:this.weaponFamily},loot:def.loot,trainingMap:WEAPON_TRAINING_MAPS.has(this.options.zoneId),
          expMultiplierByPlayer:{[this.playerId]:rewardGear.expMultiplier},dropMultiplierByPlayer:{[this.playerId]:rewardGear.dropMultiplier},eventMultipliers:this.gmEventMultipliers,
        },this.options.random,{[this.playerId]:this.pityState});
        if(!reward)continue;
        this.characterState=grantLootWithEquipment(reward.character,reward.loot,this.options.random);
        this.refreshPlayerBuild();
        this.options.onReward?.(reward,this.characterState,view);
      }
    }
  }

  private baseExp(def:MonsterDefinitionV2):number{
    return monsterBaseExpV2(def);
  }

  private definitionFor(view:ArenaMonsterView):MonsterDefinitionV2|undefined{return view.monsterType?MONSTERS_V2[view.monsterType]:undefined;}

  private syncPresentation():void{
    const p=this.simulation.world.players.get(this.playerId)!;
    this.options.player.x=p.position.x;this.options.player.y=p.position.y;this.options.player.hp=p.hp;this.options.player.maxHp=p.maxHp;this.options.player.sp=p.sp;this.options.player.maxSp=p.maxSp;
    for(const [id,view] of this.monsterViews){const m=this.simulation.world.monsters.get(id);if(!m)continue;view.x=m.position.x;view.y=m.position.y;view.hp=m.hp;view.maxHp=m.maxHp;view.dead=!m.alive;}
  }

  private refreshPlayerBuild():void{
    const player=this.simulation.world.players.get(this.playerId);if(!player)return;
    const gear=equipmentCombatTotals(this.characterState);const innate=weaponInnateBonuses(this.characterState);const hpFraction=player.maxHp>0?player.hp/player.maxHp:1;
    player.stats=this.characterState.stats;
    const mainId=this.characterState.equipment.equippedBySlot.main;const mainItem=mainId?this.characterState.equipment.instances[mainId]:undefined;const equippedFamily=mainItem?EQUIPMENT_MASTER_V2[mainItem.templateId]?.weaponFamily:undefined;if(equippedFamily){player.weaponFamily=equippedFamily;this.weaponFamily=equippedFamily;}
    player.attackRange=player.weaponFamily==='bow'?420:58;
    const physicalStatus=player.weaponFamily==='bow'?rangedStatusAtk(player.stats):meleeStatusAtk(player.stats);
    const magicalStatus=magicalAttack(player.stats,0);
    const offhand=this.offhandWeaponContribution();
    player.offhandWeaponAtk=Math.max(0,Math.round((physicalStatus+offhand.atk)*gear.offhandAtkMultiplier-physicalStatus));player.offhandWeaponMatk=Math.max(0,Math.round((magicalStatus+offhand.matk)*gear.offhandMatkMultiplier-magicalStatus));player.hasOffhandWeaponEquipped=offhand.equipped;
    player.weaponAtk=Math.max(0,Math.round((physicalStatus+gear.weaponAtk-offhand.atk)*gear.atkMultiplier-physicalStatus));
    player.weaponMatk=Math.max(0,Math.round((magicalStatus+gear.weaponMatk-offhand.matk)*gear.matkMultiplier*innate.matkMultiplier-magicalStatus));
    const vitDefense=Math.floor(player.stats.vit/2);
    player.equipmentDef=Math.max(0,Math.round((35+gear.equipmentDef+vitDefense)*gear.defMultiplier*innate.defMultiplier-vitDefense));
    player.equipmentMdef=Math.max(0,Math.round((25+gear.equipmentMdef)*gear.mdefMultiplier));
    player.hitBonus=gear.hitBonus+innate.hitBonus;player.fleeBonus=gear.fleeBonus;Object.assign(player,gearHooks(gear),innateHooks(innate));player.critDamageMultiplier=gear.critDamageMultiplier+innate.critDamageBonus;player.moveSpeed=BASE_MOVE_SPEED*gear.moveSpeedMultiplier;player.dodgeCooldownMs=BASE_DODGE_COOLDOWN_MS*gear.dodgeCooldownMultiplier;
    player.critBonusPercent=gear.critBonusPercent+innate.critBonus;player.equipmentAspd=3+gear.equipmentAspd+innate.aspdBonus;
    player.maxHp=Math.max(1,Math.round(maxHp(player.stats,gear.equipmentMaxHp)*gear.maxHpMultiplier*innate.hpMultiplier));
    const spFraction=(player.maxSp??1)>0?(player.sp??player.maxSp??1)/(player.maxSp??1):1;
    player.maxSp=Math.max(1,Math.round((40+player.stats.level*4+player.stats.int*3+gear.masterMaxSp)*gear.maxSpMultiplier));player.spRecoveryMultiplier=gear.spRecoveryMultiplier;player.healingMultiplier=gear.healingMultiplier;player.skillCostMultiplier=gear.skillCostMultiplier;
    player.sp=Math.max(0,Math.min(player.maxSp,player.maxSp*spFraction));
    player.hp=Math.max(1,Math.min(player.maxHp,Math.round(player.maxHp*hpFraction)));player.skillEntitlements=skillEntitlementsForCharacter(this.characterState,player.weaponFamily);player.skillCoreDamageMultipliers=Object.fromEntries(this.characterState.skills.active.filter(Boolean).map(id=>[id!,skillCoreDamageMultiplier(this.characterState,id!)]));player.skillModifierMultipliers=Object.fromEntries(Object.values(this.characterState.skills.modifiersByActive??{}).flat().filter(Boolean).map(id=>[id,skillCoreDamageMultiplier(this.characterState,id)]));player.movementSkillDistanceBonuses=this.characterState.skills.movement?{[this.characterState.skills.movement]:movementSkillDistanceBonus(this.characterState,this.characterState.skills.movement)}:{};player.masteryPassives=masteryPassiveKeys(this.characterState);player.hasShieldEquipped=innate.hasShieldEquipped;player.shieldBlockChanceBonus=innate.hasShieldEquipped?gear.shieldBlockChanceBonus:0;
  }

  private offhandWeaponContribution():{atk:number;matk:number;equipped:boolean}{
    // Defensive invariant for legacy/stale saves: a two-handed main weapon can never gain an offhand hit.
    const mainId=this.characterState.equipment.equippedBySlot.main;
    const mainItem=mainId?this.characterState.equipment.instances[mainId]:undefined;
    const mainFamily=mainItem?EQUIPMENT_MASTER_V2[mainItem.templateId]?.weaponFamily:undefined;
    if(mainFamily==='bow'||mainFamily==='axe'||mainFamily==='greatsword')return{atk:0,matk:0,equipped:false};
    const id=this.characterState.equipment.equippedBySlot.offhand;
    const item=id?this.characterState.equipment.instances[id]:undefined;
    if(!item||item.offhandType!=='weapon')return{atk:0,matk:0,equipped:false};
    const enhancement=this.characterState.equipment.enhancementBySlot.offhand??0;
    const refinement=this.characterState.equipment.refinementBySlot.offhand??0;
    const affixAtk=(item.affixes??[]).filter(a=>a==='atkPct').length;
    const affixMatk=(item.affixes??[]).filter(a=>a==='matkPct').length;
    // Slot refinement is applied later through the hand-specific multiplier. Keeping it out here
    // prevents offhand refinement from being counted twice and from leaking into the main hand.
    const rarityMultiplier=equipmentRarityStatMultiplier(item.rarity);
    const atk=Math.round((item.baseCombat?.atk??0)*rarityMultiplier*(1+affixAtk*.03)+enhancement*2);
    const matk=Math.round((item.baseCombat?.matk??0)*rarityMultiplier*(1+affixMatk*.03)+enhancement*2);
    return{atk,matk,equipped:true};
  }

  private makePlayer(view:ArenaPlayerView,family:CombatWeaponFamily):PlayerEntity{
    const stats=this.characterState.stats;const gear=equipmentCombatTotals(this.characterState);const innate=weaponInnateBonuses(this.characterState);
    const physicalStatus=family==='bow'?rangedStatusAtk(stats):meleeStatusAtk(stats);const magicalStatus=magicalAttack(stats,0);
    const offhand=this.offhandWeaponContribution();
    const weaponAtk=Math.max(0,Math.round((physicalStatus+gear.weaponAtk-offhand.atk)*gear.atkMultiplier-physicalStatus));
    const weaponMatk=Math.max(0,Math.round((magicalStatus+gear.weaponMatk-offhand.matk)*gear.matkMultiplier*innate.matkMultiplier-magicalStatus));
    const offhandWeaponAtk=Math.max(0,Math.round((physicalStatus+offhand.atk)*gear.offhandAtkMultiplier-physicalStatus));
    const offhandWeaponMatk=Math.max(0,Math.round((magicalStatus+offhand.matk)*gear.offhandMatkMultiplier-magicalStatus));
    const vitDefense=Math.floor(stats.vit/2);
    const equipmentDef=Math.max(0,Math.round((35+gear.equipmentDef+vitDefense)*gear.defMultiplier*innate.defMultiplier-vitDefense));
    const equipmentMdef=Math.max(0,Math.round((25+gear.equipmentMdef)*gear.mdefMultiplier));
    const resolvedMaxHp=Math.max(1,Math.round(maxHp(stats,gear.equipmentMaxHp)*gear.maxHpMultiplier*innate.hpMultiplier));
    const resolvedMaxSp=Math.max(1,Math.round((40+stats.level*4+stats.int*3+gear.masterMaxSp)*gear.maxSpMultiplier));
    return{id:this.playerId,kind:'player',position:{x:view.x,y:view.y},hp:view.hp??resolvedMaxHp,maxHp:view.maxHp??resolvedMaxHp,alive:true,sp:view.sp??resolvedMaxSp,maxSp:view.maxSp??resolvedMaxSp,spRecoveryMultiplier:gear.spRecoveryMultiplier,healingMultiplier:gear.healingMultiplier,skillCostMultiplier:gear.skillCostMultiplier,
      stats,weaponFamily:family,weaponAtk,weaponMatk,offhandWeaponAtk,offhandWeaponMatk,hasOffhandWeaponEquipped:offhand.equipped,equipmentDef,equipmentMdef,hitBonus:gear.hitBonus+innate.hitBonus,fleeBonus:gear.fleeBonus,
      critBonusPercent:gear.critBonusPercent+innate.critBonus,equipmentAspd:3+gear.equipmentAspd+innate.aspdBonus,castSpeed:gear.castSpeed,critDamageMultiplier:gear.critDamageMultiplier+innate.critDamageBonus,elementDamageMultiplier:gear.elementDamageMultiplier,attackRange:family==='bow'?420:58,moveSpeed:BASE_MOVE_SPEED*gear.moveSpeedMultiplier,dodgeDistance:90,dodgeCooldownMs:BASE_DODGE_COOLDOWN_MS*gear.dodgeCooldownMultiplier,...gearHooks(gear),...innateHooks(innate),nextDodgeAtMs:0,
      lastClientSequence:0,nextBasicAttackAtMs:0,cooldowns:{},skillEntitlements:skillEntitlementsForCharacter(this.characterState,family),skillCoreDamageMultipliers:Object.fromEntries(this.characterState.skills.active.filter(Boolean).map(id=>[id!,skillCoreDamageMultiplier(this.characterState,id!)])),
      skillModifierMultipliers:Object.fromEntries(Object.values(this.characterState.skills.modifiersByActive??{}).flat().filter(Boolean).map(id=>[id,skillCoreDamageMultiplier(this.characterState,id)])),movementSkillDistanceBonuses:this.characterState.skills.movement?{[this.characterState.skills.movement]:movementSkillDistanceBonus(this.characterState,this.characterState.skills.movement)}:{},
      masteryPassives:masteryPassiveKeys(this.characterState),hasShieldEquipped:innate.hasShieldEquipped,shieldBlockChanceBonus:innate.hasShieldEquipped?gear.shieldBlockChanceBonus:0};
  }

  private makeMonster(view:ArenaMonsterView,id:string):MonsterEntity{
    const def=this.definitionFor(view);
    const level=view.levelOverride??def?.level??view.level??(view.isBoss?35:view.elite?30:25);
    const maxHp=view.maxHpOverride??def?.maxHp??(view.isBoss?900:view.elite?320:180);
    return{id,kind:'monster',position:{x:view.x,y:view.y},hp:maxHp,maxHp,alive:!view.dead,level,
      atk:def?.atk??(view.isBoss?95:view.elite?65:42),matk:0,def:def?.def??(view.isBoss?90:view.elite?55:28),
      mdef:def?.mdef??(view.isBoss?70:view.elite?40:20),hit:175+level+35,flee:def?.flee??100+level+25,critChance:0,
      attackRange:def?.attackRange??view.attackRange??(view.isBoss?62:view.elite?48:42),moveSpeed:def?.moveSpeed??view.speed??68,
      attackIntervalMs:def?.attackIntervalMs??(view.isBoss?1100:850),nextBasicAttackAtMs:0,
      // Mossveil Woods (forest1) is the onboarding map: monsters never initiate combat.
      // From forest2 onward, proximity aggro is enabled.
      aggroRange:def?.mapId==='forest1'?0:(view.aggroRange??(view.isBoss?300:view.elite?190:150)),
      homePosition:{x:view.x,y:view.y},roamRadius:view.isBoss?0:(view.elite?135:180),nextRoamAtMs:250+([...id].reduce((n,c)=>n+c.charCodeAt(0),0)%7)*170,
      isElite:def?.rank==='elite'||!!view.elite,isBoss:def?.rank==='boss'||!!view.isBoss};
  }
}
