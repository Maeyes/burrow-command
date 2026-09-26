import type { CombatWeaponFamily } from '../systems/combatMath';
import type { CharacterStateV2 } from './character';
import { grantCharacterExpV2 } from './character';
import type { ContributionLedger } from './contribution';
import { eligibleContributors } from './contribution';
import { grantMasteryContribution, masteryContribution, masteryLevelMultiplier, MASTERY_CAP, type EnemyRank } from './mastery';
import type { LootResultV2, LootSourceV2 } from './loot';
import { rollLoot } from './loot';
import type { RandomFn } from './engine';
import type { BossCorePityState } from './pity';
import { rollLootWithBossCorePity } from './pity';

import { expToNextLevelV2 } from './character';
import type { MonsterDefinitionV2 } from './monsterDataV2';

// EXP per kill follows the level curve so a same-level normal mob takes ~80 kills at Lv1
// rising to ~380 at Lv120, instead of the old flat level*4 that collapsed after Lv70.
export function monsterBaseExpV2(def:Pick<MonsterDefinitionV2,'level'|'rank'>):number{
 const rank=def.rank==='boss'?5:def.rank==='elite'?2:1;
 return Math.max(1,Math.round(expToNextLevelV2(def.level)/killsPerLevelV2(def.level)*rank));
}
/** Same-level normal kills per level. Early levels ramp from 6 (Lv1) so the first maps feel
 *  quick; from ~Lv23 the original 80+2.5*Lv pacing takes over. */
export function killsPerLevelV2(level:number):number{return Math.min(80+2.5*level,6*Math.max(1,level));}
export interface DefeatRewardContext {enemyLevel:number;rank:EnemyRank;baseExp:number;loot:LootSourceV2;weaponByPlayer:Record<string,CombatWeaponFamily>;trainingMap?:boolean;expMultiplierByPlayer?:Record<string,number>;dropMultiplierByPlayer?:Record<string,number>;eventMultipliers?:{exp?:number;weaponExp?:number;drop?:number;gold?:number;upgradeItem?:number;blueprint?:number}}
export interface PlayerRewardV2 {playerId:string;exp:number;loot:LootResultV2;character:CharacterStateV2;
 /** Weapon Mastery XP earned by this kill (0 at the cap), for the reward feed. */
 masteryXp?:number;masteryFamily?:CombatWeaponFamily}

export function resolveDefeatRewards(ledger:ContributionLedger,characters:Record<string,CharacterStateV2>,ctx:DefeatRewardContext,rng:RandomFn=Math.random,pityByPlayer?:Record<string,BossCorePityState>):PlayerRewardV2[]{
 const out:PlayerRewardV2[]=[];
 for(const playerId of eligibleContributors(ledger)){
  const character=characters[playerId]; const family=ctx.weaponByPlayer[playerId]; if(!character||!family)continue;
  const exp=Math.max(0,Math.round(ctx.baseExp*(ctx.expMultiplierByPlayer?.[playerId]??1)*(ctx.eventMultipliers?.exp??1)));
  let next=grantCharacterExpV2(character,exp);
  next={...next,weaponMastery:grantMasteryContribution(next.weaponMastery,family,next.level,ctx.enemyLevel,ctx.rank,ctx.eventMultipliers?.weaponExp??1,ctx.trainingMap??false)};
  const masteryXp=(character.weaponMastery[family]?.level??1)>=MASTERY_CAP?0:Math.round(masteryContribution(ctx.rank)*masteryLevelMultiplier(next.level,ctx.enemyLevel,ctx.trainingMap??false)*Math.max(0,ctx.eventMultipliers?.weaponExp??1));
  const pity=pityByPlayer?.[playerId];
  const dropMultiplier=ctx.dropMultiplierByPlayer?.[playerId]??1;
  const loot=pity?rollLootWithBossCorePity(ctx.loot,pity,rng,dropMultiplier,ctx.eventMultipliers):rollLoot(ctx.loot,rng,dropMultiplier,ctx.eventMultipliers);
  out.push({playerId,exp,loot,character:next,masteryXp,masteryFamily:family});
 }
 return out;
}
