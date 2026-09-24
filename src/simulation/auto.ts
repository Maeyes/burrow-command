import type { SimulationCommand } from './contracts';
import { distance } from './entities';
import type { MonsterEntity,PlayerEntity } from './entities';
import { SKILLS_V2 } from './skills';
export type ControlMode='manual'|'semiAuto'|'fullAuto';
export interface AutoContext {mode:ControlMode;sequence:number;activeSkillIds?:readonly string[];weaponSkillIds?:readonly string[];movementSkillId?:string;hpFraction?:number;nowMs?:number;recovering?:boolean;skillPriority?:readonly string[];allowedMonsterIds?:ReadonlySet<string>;maxTargetLevel?:number}
export function nearestTarget(player:PlayerEntity,monsters:Iterable<MonsterEntity>):MonsterEntity|undefined{let best:MonsterEntity|undefined,d=Infinity;for(const m of monsters){if(!m.alive)continue;const x=distance(player.position,m.position);if(x<d){best=m;d=x}}return best}
function ready(player:PlayerEntity,id:string,nowMs:number){return (player.cooldowns[id]??0)<=nowMs}
function candidateIds(ctx:AutoContext){const owned=[...(ctx.activeSkillIds??[]),...(ctx.weaponSkillIds??[])];if(!ctx.skillPriority?.length)return owned;const rank=new Map(ctx.skillPriority.map((id,i)=>[id,i]));return [...owned].sort((a,b)=>(rank.get(a)??999)-(rank.get(b)??999))}
function eligibleAutoSkill(player:PlayerEntity,target:MonsterEntity,monsters:readonly MonsterEntity[],ctx:AutoContext){
 for(const id of candidateIds(ctx)){const skill=SKILLS_V2[id];if(!skill||(skill.kind!=='active'&&skill.kind!=='weapon')||!skill.auto?.canAutoUse)continue;
  if(skill.compatibleWeaponFamilies&&!skill.compatibleWeaponFamilies.includes(player.weaponFamily))continue;
  if(!ready(player,id,ctx.nowMs??0))continue;
  if(id==='healingPulse'&&(ctx.hpFraction??1)>.6)continue;
  if(skill.auto.reserveForEliteBoss&&!target.isElite&&!target.isBoss)continue;
  const center=skill.targeting==='selfArea'?player.position:target.position;
  const nearby=monsters.filter(m=>m.alive&&distance(center,m.position)<=Math.max(skill.radius??100,80)).length;
  const min=skill.auto.minimumEnemyCount??skill.auto.minimumExpectedTargets??1;if(nearby<min)continue;
  if(skill.range!==undefined&&skill.targeting!=='selfArea'&&distance(player.position,target.position)>skill.range)continue;
  return skill;
 }return undefined;
}
function castCommand(player:PlayerEntity,target:MonsterEntity,skillId:string,sequence:number):SimulationCommand{
 const skill=SKILLS_V2[skillId];
 if(skill.targeting==='groundArea')return{type:'castSkill',playerId:player.id,skillId,ground:{...target.position},clientSequence:sequence};
 return{type:'castSkill',playerId:player.id,skillId,targetId:skillId==='healingPulse'?undefined:target.id,clientSequence:sequence};
}
export function nextAutoCommand(player:PlayerEntity,monsters:Iterable<MonsterEntity>,ctx:AutoContext):SimulationCommand|undefined{
 if(ctx.mode==='manual'||!player.alive)return undefined;
 const list=[...monsters].filter(m=>(!ctx.allowedMonsterIds||ctx.allowedMonsterIds.has(m.id))&&(ctx.maxTargetLevel===undefined||m.level<=ctx.maxTargetLevel));const target=nearestTarget(player,list);const hp=ctx.hpFraction??1;const now=ctx.nowMs??0;
 if(ctx.mode==='fullAuto'&&ctx.recovering){
  // HP REST is a hard pause: never attack, cast, chase, or dodge while recovering.
  // Keeping the player completely stationary also allows the engine's out-of-combat
  // regen timer to become eligible once incoming combat has ended.
  return{type:'move',playerId:player.id,direction:{x:0,y:0},clientSequence:ctx.sequence};
 }
 if(hp<=.6&&(ctx.activeSkillIds??[]).includes('healingPulse')&&ready(player,'healingPulse',now))return{type:'castSkill',playerId:player.id,skillId:'healingPulse',clientSequence:ctx.sequence};
 if(!target)return undefined;
 if((ctx.activeSkillIds??[]).includes('barrier')&&ready(player,'barrier',now)&&(player.barrierHp??0)<=0){const barrier=SKILLS_V2.barrier;if(!barrier.auto?.reserveForEliteBoss||target.isElite||target.isBoss)return{type:'castSkill',playerId:player.id,skillId:'barrier',clientSequence:ctx.sequence};}
 const threatDistance=distance(player.position,target.position);
 // Auto Hunt never disengages or dodges on its own. It finishes the selected target.
 const skill=eligibleAutoSkill(player,target,list,ctx);if(skill)return castCommand(player,target,skill.id,ctx.sequence);
 if(threatDistance<=player.attackRange)return{type:'basicAttack',playerId:player.id,targetId:target.id,clientSequence:ctx.sequence};
 if(ctx.mode==='fullAuto')return{type:'move',playerId:player.id,direction:{x:target.position.x-player.position.x,y:target.position.y-player.position.y},clientSequence:ctx.sequence};
 return undefined;
}
