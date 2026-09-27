// Use Bunny World's exact authoritative Skill Core simulation for Burrow casts.
// Never define a second Burrow-only skill catalog or reproduce its damage / Mod math.
import {BunnySimulation} from '../../src/simulation/engine.ts';
import {createWorldState,addPlayer,addMonster} from '../../src/simulation/world.ts';
import {SKILLS_V2,skillSpCostV2} from '../../src/simulation/skills.ts';
import {MONSTERS_V2} from '../../src/simulation/monsterDataV2.ts';
import {skillCoreDamageMultiplier,movementSkillDistanceBonus} from '../../src/simulation/skillCoreService.ts';
import {classSkillProxy,CLASS_CORE_UNLOCK,CORE_SLOT_UNLOCKS} from './warren-class-cores.js';
import {classWeaponMasterySkills} from './warren-progression.js';
import {WEAPON_MASTERY_MILESTONES} from '../../src/simulation/masteryMilestones.ts';

const FAMILIES={guard:'swordShield',archer:'bow',scout:'dagger',brute:'hammer',axe:'axe',vanguard:'greatsword',mage:'staff'};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function burrowMaxSp(u){return Math.round(40+Math.max(1,u.level)*4+5*3);}
export function regenBurrowSp(u,dt,resting=false){
 u.maxSp=burrowMaxSp(u);
 if(!Number.isFinite(u.sp))u.sp=u.maxSp;
 u.sp=Math.max(0,Math.min(u.maxSp,u.sp+Math.max(0,dt)*(resting?6:2)));
}
export function chooseBurrowCore(s,u,target,monsters){
 if(s.warren<CLASS_CORE_UNLOCK||u.down||!target||target.dead)return null;
 const equipped=(s.classSkills?.[u.cls]?.active??[])
  .map((id,slot)=>s.warren>=CORE_SLOT_UNLOCKS[slot]?id:null);
 // Every equipped active Core is auto-castable, including those marked manual
 // in the main game's UI. Rotate priority after a successful cast so Slot 1
 // cannot starve ready Cores in Slot 2/3.
 for(let offset=0;offset<equipped.length;offset++){
  const id=equipped[((u.nextCoreSlot||0)+offset)%equipped.length];
  const skill=SKILLS_V2[id];
  if(!skill||skill.kind!=='active')continue;
  if(skill.compatibleWeaponFamilies?.length&&!skill.compatibleWeaponFamilies.includes(FAMILIES[u.cls]))continue;
  if((u.coreCooldowns?.[id]??0)>s.time||u.sp<skillSpCostV2(skill))continue;
  const nearby=monsters.filter(m=>!m.dead&&distance(m,skill.targeting==='selfArea'?u:target)<=((skill.radius??0)||110));
  // Do not reserve a ready Core for elite/boss or a larger pack; readiness,
  // sufficient SP and one valid target are enough to fire in Burrow.
  if(skill.id==='healingPulse'&&u.hp>=u.maxHp*.72)continue;
  if(skill.id==='barrier'&&(u.coreBarrierHp??0)>0&&(u.coreBarrierUntil??0)>s.time)continue;
  if(skill.id==='valkyriesCall'&&(u.coreValkyrieUntil??0)>s.time)continue;
  if(skill.scaling&&skill.targeting!=='selfArea'&&distance(u,target)>(skill.range??110))continue;
  if(skill.scaling&&skill.targeting==='selfArea'&&nearby.length===0)continue;

  return skill;
 }
 return null;
}
function combatPlayer(s,u,skill){
 const state=classSkillProxy(s,u.cls),installed=state.skills.active
  .filter((id,slot)=>s.warren>=CORE_SLOT_UNLOCKS[slot]&&Boolean(id));
 const stats={level:u.level,str:5,agi:5,vit:5,int:5,dex:5,luk:u.luk||0};
 const coreCooldowns=Object.fromEntries(Object.entries(u.coreCooldowns||{}).map(([id,at])=>[id,Math.max(0,(at-s.time)*1000)]));
 const priorProc=u.weaponProc||{hits:0,gauge:0,readyAt:{}};
 const weaponProc={hits:priorProc.hits||0,gauge:priorProc.gauge||0,
  readyAtMs:Object.fromEntries(Object.entries(priorProc.readyAt||{}).map(([id,at])=>[id,Math.max(0,(at-s.time)*1000)]))};
 const family=FAMILIES[u.cls],masteryPassives=(WEAPON_MASTERY_MILESTONES[family]||[])
  .filter(entry=>s.mastery?.[u.cls]?.unlocked?.includes(entry.level)).map(entry=>family+':'+entry.id);
 const installedModifiers=Object.fromEntries(installed.map(id=>[id,state.skills.modifiersByActive?.[id]||[]]));
 const multipliers=Object.fromEntries(installed.map(id=>[id,skillCoreDamageMultiplier(state,id)]));
 const modMultipliers=Object.fromEntries([...new Set(Object.values(installedModifiers).flat().filter(Boolean))]
  .map(id=>[id,skillCoreDamageMultiplier(state,id)]));
 const base=Math.max(1,u.atk||1);
 return {
  id:'burrow-caster',kind:'player',position:{x:0,y:0},hp:Math.max(1,u.hp),maxHp:u.maxHp,alive:!u.down,
  sp:Number.isFinite(u.sp)?u.sp:burrowMaxSp(u),maxSp:burrowMaxSp(u),stats,
  weaponFamily:FAMILIES[u.cls],weaponAtk:u.cls==='mage'?0:base,weaponMatk:u.cls==='mage'?base:0,
  equipmentDef:u.def||0,equipmentMdef:0,hitBonus:35,fleeBonus:0,critBonusPercent:u.critBonus||0,equipmentAspd:0,
  attackRange:220,moveSpeed:100,dodgeDistance:0,dodgeCooldownMs:1000,nextDodgeAtMs:0,
  weaponProc,masteryPassives,
  resonanceReadyAtMs:Math.max(0,((u.coreResonanceReadyAt||0)-s.time)*1000),
  surgeCasts:(u.coreSurgeCasts||[]).map(x=>({id:x.id,at:(x.at-s.time)*1000})),
  arcaneSurgeUntilMs:Math.max(0,((u.coreArcaneSurgeUntil||0)-s.time)*1000),
  lastClientSequence:0,nextBasicAttackAtMs:0,cooldowns:coreCooldowns,
  skillEntitlements:{active:installed,movement:state.skills.movement??undefined,passive:state.skills.passive||[],
   weaponSkills:classWeaponMasterySkills(s,u.cls),modifiersByActive:installedModifiers},
  skillCoreDamageMultipliers:multipliers,skillModifierMultipliers:modMultipliers,
  movementSkillDistanceBonuses:state.skills.movement?{[state.skills.movement]:movementSkillDistanceBonus(state,state.skills.movement)}:{},
  barrierHp:(u.coreBarrierUntil||0)>s.time?(u.coreBarrierHp||0):0,
  barrierMaxHp:(u.coreBarrierUntil||0)>s.time?(u.coreBarrierMaxHp||0):0,
  barrierUntilMs:(u.coreBarrierUntil||0)>s.time?(u.coreBarrierUntil-s.time)*1000:0,
  barrierBreakHeal:(u.coreBarrierUntil||0)>s.time?(u.coreBarrierBreakHeal||0):0,
  valkyrieUntilMs:(u.coreValkyrieUntil||0)>s.time?(u.coreValkyrieUntil-s.time)*1000:0,
 };
}
/** Keep the main simulation's on-hit hit count, gauge and cooldowns across
 * Burrow's isolated combat snapshots (including Staff Spell Chain from a Core cast). */
export function persistBurrowMasteryRuntime(s,u,player){
 if(player.weaponProc){u.weaponProc={hits:player.weaponProc.hits,gauge:player.weaponProc.gauge,
  readyAt:Object.fromEntries(Object.entries(player.weaponProc.readyAtMs||{})
   .map(([id,at])=>[id,s.time+at/1000]))};}
 u.coreResonanceReadyAt=player.resonanceReadyAtMs?s.time+player.resonanceReadyAtMs/1000:0;
 u.coreSurgeCasts=(player.surgeCasts||[]).map(x=>({id:x.id,at:s.time+x.at/1000}));
 u.coreArcaneSurgeUntil=player.arcaneSurgeUntilMs?s.time+player.arcaneSurgeUntilMs/1000:0;
}
function combatEnemy(m,u){
 const meta=MONSTERS_V2[m.type]||{};
 const id='burrow-monster-'+m.id;
 return{id,kind:'monster',position:{x:m.x-u.x,y:m.y-u.y},hp:m.hp,maxHp:m.maxHp,alive:!m.dead,
  level:meta.level||1,atk:m.atk||5,matk:0,def:meta.def||0,mdef:meta.mdef||0,hit:150,flee:meta.flee||105,
  critChance:0,attackRange:m.range||40,moveSpeed:m.speed||65,attackIntervalMs:1000,
  nextBasicAttackAtMs:0,isElite:!!m.elite,isBoss:!!m.boss};
}
/** Resolve with main-game combat and return an isolated snapshot. The host commits events
 * into Burrow only when accepted; rejected casts never spend SP or start cooldowns. */
export function resolveBurrowMovement(s,u,target,walkable,rng=Math.random){
 const id=s.classSkills?.[u.cls]?.movement,skill=SKILLS_V2[id];
 if(s.warren<CLASS_CORE_UNLOCK||u.down||!target||skill?.kind!=='movement')
  return{accepted:false,reason:'movement-not-equipped',events:[]};
 if((u.coreCooldowns?.[id]??0)>s.time)return{accepted:false,reason:'skill-cooldown',events:[]};
 const dx=target.x-u.x,dy=target.y-u.y,mag=Math.hypot(dx,dy);
 if(mag<1)return{accepted:false,reason:'movement-target-too-close',events:[]};
 const dir={x:dx/mag,y:dy/mag},world=createWorldState('burrow'),player=combatPlayer(s,u,skill);
 addPlayer(world,player);
 // Main-engine movement and rarity travel, constrained by actual Burrow terrain.
 const sim=new BunnySimulation(world,rng,(start,end)=>{
  const len=Math.hypot(end.x-start.x,end.y-start.y),steps=Math.max(1,Math.ceil(len/8));
  let previous=start;
  for(let i=1;i<=steps;i++){
   const p={x:start.x+(end.x-start.x)*i/steps,y:start.y+(end.y-start.y)*i/steps};
   if(!walkable(u.x+p.x,u.y+p.y))break;
   previous=p;
  }
  return previous;
 });
 const result=sim.dispatch({type:'castSkill',playerId:player.id,skillId:id,clientSequence:1,direction:dir});
 return{...result,player,skill};
}
/** The host already applied the Burrow basic swing. Trigger ONLY the main
 * game's Weapon Mastery on-hit resolver, so the basic hit is never counted twice. */
export function resolveBurrowMasteryOnHit(s,u,target,monsters,rng=Math.random){
 if(u.down||!target||target.dead||!classWeaponMasterySkills(s,u.cls).some(Boolean))
  return{accepted:false,reason:'no-weapon-mastery',events:[]};
 const world=createWorldState('burrow'),player=combatPlayer(s,u),enemyById=new Map();
 addPlayer(world,player);
 for(const m of monsters.filter(m=>!m.dead&&distance(m,u)<500)){
  const snapshot=combatEnemy(m,u);addMonster(world,snapshot);enemyById.set(snapshot.id,m);
 }
 const sim=new BunnySimulation(world,rng);
 const events=sim.triggerWeaponMasteryOnHit(player.id,'burrow-monster-'+target.id);
 return{accepted:true,events,player,enemyById,world};
}
export function resolveBurrowCore(s,u,target,monsters,skillId,rng=Math.random){
 const skill=SKILLS_V2[skillId];
 if(!skill||skill.kind!=='active'||s.warren<CLASS_CORE_UNLOCK||u.down)return{accepted:false,reason:'core-unavailable',events:[]};
 const world=createWorldState('burrow'),player=combatPlayer(s,u,skill),enemyById=new Map();
 addPlayer(world,player);
 for(const m of monsters.filter(m=>!m.dead&&distance(m,u)<500)){
  const snapshot=combatEnemy(m,u);addMonster(world,snapshot);enemyById.set(snapshot.id,m);
 }
 const sim=new BunnySimulation(world,rng);
 const point=target?{x:target.x-u.x,y:target.y-u.y}:undefined;
 const result=sim.dispatch({type:'castSkill',playerId:player.id,clientSequence:1,skillId,
  targetId:target?'burrow-monster-'+target.id:undefined,
  ground:skill.targeting==='groundArea'?point:undefined});
 return{...result,player,enemyById,world,skill};
}
