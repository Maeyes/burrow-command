import type { SimulationCommand } from './contracts';
import { distance } from './entities';
import type { MonsterEntity,PlayerEntity } from './entities';
import { SKILLS_V2, skillSpCostV2 } from './skills';
export type ControlMode='manual'|'semiAuto'|'fullAuto';
export interface AutoContext {mode:ControlMode;sequence:number;activeSkillIds?:readonly string[];weaponSkillIds?:readonly (string|undefined)[];movementSkillId?:string;hpFraction?:number;nowMs?:number;recovering?:boolean;skillPriority?:readonly string[];allowedMonsterIds?:ReadonlySet<string>;maxTargetLevel?:number}
export function nearestTarget(player:PlayerEntity,monsters:Iterable<MonsterEntity>):MonsterEntity|undefined{let best:MonsterEntity|undefined,d=Infinity;for(const m of monsters){if(!m.alive)continue;const x=distance(player.position,m.position);if(x<d){best=m;d=x}}return best}
function ready(player:PlayerEntity,id:string,nowMs:number){return (player.cooldowns[id]??0)<=nowMs}
function canPaySkill(player:PlayerEntity,id:string){const skill=SKILLS_V2[id];if(!skill)return false;const cost=Math.round(skillSpCostV2(skill)*(player.skillCostMultiplier??1));return cost<=0||player.sp===undefined||player.sp>=cost}
const AUTO_RESERVE_MIN_COOLDOWN_MS=15000,AUTO_PACK_SCAN_RADIUS=320;
function candidateIds(ctx:AutoContext){// Weapon skills fire from basic attacks (engine weaponSkillProcs), so auto only casts core actives.
 const owned=[...(ctx.activeSkillIds??[])];if(!ctx.skillPriority?.length)return owned;const rank=new Map(ctx.skillPriority.map((id,i)=>[id,i]));return [...owned].sort((a,b)=>(rank.get(a)??999)-(rank.get(b)??999))}
function eligibleAutoSkill(player:PlayerEntity,target:MonsterEntity,monsters:readonly MonsterEntity[],ctx:AutoContext){
 for(const id of candidateIds(ctx)){const skill=SKILLS_V2[id];if(!skill||skill.kind!=='active'||!skill.auto?.canAutoUse)continue;
  if(skill.compatibleWeaponFamilies&&!skill.compatibleWeaponFamilies.includes(player.weaponFamily))continue;
  if(!ready(player,id,ctx.nowMs??0))continue;
  if(!canPaySkill(player,id))continue;
  if(id==='healingPulse'&&(ctx.hpFraction??1)>.6)continue;
  // Only long-cooldown ultimates are held for elites/bosses; anything under 15s is used on every fight.
  if(skill.auto.reserveForEliteBoss&&(skill.cooldownMs??0)>=AUTO_RESERVE_MIN_COOLDOWN_MS&&!target.isElite&&!target.isBoss)continue;
  const center=skill.targeting==='selfArea'?player.position:target.position,radius=Math.max(skill.radius??100,80);
  if(skill.targeting==='selfArea'&&distance(player.position,target.position)>radius)continue;
  const nearby=monsters.filter(m=>m.alive&&distance(center,m.position)<=radius).length;
  // AoE waits for a pack only when a pack is actually around: if every monster near the hero is already
  // inside the blast, cast now instead of waiting forever on a lone target.
  const around=monsters.filter(m=>m.alive&&distance(player.position,m.position)<=AUTO_PACK_SCAN_RADIUS).length;
  const min=Math.min(skill.auto.minimumEnemyCount??skill.auto.minimumExpectedTargets??1,Math.max(1,around));if(nearby<min)continue;
  const effectiveRange=skill.range??player.attackRange;if(skill.targeting!=='selfArea'&&distance(player.position,target.position)>effectiveRange)continue;
  return skill;
 }return undefined;
}
function castCommand(player:PlayerEntity,target:MonsterEntity,skillId:string,sequence:number):SimulationCommand{
 const skill=SKILLS_V2[skillId];
 if(skill.targeting==='groundArea')return{type:'castSkill',playerId:player.id,skillId,ground:{...target.position},clientSequence:sequence};
 return{type:'castSkill',playerId:player.id,skillId,targetId:skillId==='healingPulse'||skillId==='barrier'?undefined:target.id,clientSequence:sequence};
}

/** Pure selector used by both simulation Auto and the map-level Auto Hunt navigator. */
export function nextAutoSkillCommand(player:PlayerEntity,target:MonsterEntity|undefined,monsters:readonly MonsterEntity[],ctx:AutoContext):SimulationCommand|undefined{
 if(ctx.mode==='manual'||!player.alive||ctx.recovering)return undefined;
 const hp=ctx.hpFraction??1,now=ctx.nowMs??0;
 if(hp<=.6&&(ctx.activeSkillIds??[]).includes('healingPulse')&&ready(player,'healingPulse',now)&&canPaySkill(player,'healingPulse'))return{type:'castSkill',playerId:player.id,skillId:'healingPulse',clientSequence:ctx.sequence};
 if(!target)return undefined;
 if((ctx.activeSkillIds??[]).includes('barrier')&&ready(player,'barrier',now)&&canPaySkill(player,'barrier')&&(player.barrierHp??0)<=0){const barrier=SKILLS_V2.barrier;if(!barrier.auto?.reserveForEliteBoss||target.isElite||target.isBoss||hp<.85)return{type:'castSkill',playerId:player.id,skillId:'barrier',clientSequence:ctx.sequence};}
 const skill=eligibleAutoSkill(player,target,monsters,ctx);return skill?castCommand(player,target,skill.id,ctx.sequence):undefined;
}

export function nextAutoCommand(player:PlayerEntity,monsters:Iterable<MonsterEntity>,ctx:AutoContext):SimulationCommand|undefined{
 if(ctx.mode==='manual'||!player.alive)return undefined;
 const list=[...monsters].filter(m=>(!ctx.allowedMonsterIds||ctx.allowedMonsterIds.has(m.id))&&(ctx.maxTargetLevel===undefined||m.level<=ctx.maxTargetLevel));const target=nearestTarget(player,list);const hp=ctx.hpFraction??1;
 if(ctx.mode==='fullAuto'&&ctx.recovering){
  // HP REST is a hard pause: never attack, cast, chase, or dodge while recovering.
  // Keeping the player completely stationary also allows the engine's out-of-combat
  // regen timer to become eligible once incoming combat has ended.
  return{type:'move',playerId:player.id,direction:{x:0,y:0},clientSequence:ctx.sequence};
 }
 const autoSkill=nextAutoSkillCommand(player,target,list,ctx);if(autoSkill)return autoSkill;
 if(!target)return undefined;
 const threatDistance=distance(player.position,target.position);
 // Auto Hunt never disengages or dodges on its own. It finishes the selected target.
 if(threatDistance<=player.attackRange)return{type:'basicAttack',playerId:player.id,targetId:target.id,clientSequence:ctx.sequence};
 if(ctx.mode==='fullAuto')return{type:'move',playerId:player.id,direction:{x:target.position.x-player.position.x,y:target.position.y-player.position.y},clientSequence:ctx.sequence};
 return undefined;
}
