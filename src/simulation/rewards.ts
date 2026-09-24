import type { CombatWeaponFamily } from '../systems/combatMath';
import type { CharacterStateV2 } from './character';
import { grantCharacterExpV2 } from './character';
import type { ContributionLedger } from './contribution';
import { eligibleContributors } from './contribution';
import { grantMasteryContribution, type EnemyRank } from './mastery';
import type { LootResultV2, LootSourceV2 } from './loot';
import { rollLoot } from './loot';
import type { RandomFn } from './engine';
import type { BossCorePityState } from './pity';
import { rollLootWithBossCorePity } from './pity';

export interface DefeatRewardContext {enemyLevel:number;rank:EnemyRank;baseExp:number;loot:LootSourceV2;weaponByPlayer:Record<string,CombatWeaponFamily>;trainingMap?:boolean;expMultiplierByPlayer?:Record<string,number>;dropMultiplierByPlayer?:Record<string,number>;eventMultipliers?:{exp?:number;weaponExp?:number;drop?:number;gold?:number;upgradeItem?:number;blueprint?:number}}
export interface PlayerRewardV2 {playerId:string;exp:number;loot:LootResultV2;character:CharacterStateV2}

export function resolveDefeatRewards(ledger:ContributionLedger,characters:Record<string,CharacterStateV2>,ctx:DefeatRewardContext,rng:RandomFn=Math.random,pityByPlayer?:Record<string,BossCorePityState>):PlayerRewardV2[]{
 const out:PlayerRewardV2[]=[];
 for(const playerId of eligibleContributors(ledger)){
  const character=characters[playerId]; const family=ctx.weaponByPlayer[playerId]; if(!character||!family)continue;
  const exp=Math.max(0,Math.round(ctx.baseExp*(ctx.expMultiplierByPlayer?.[playerId]??1)*(ctx.eventMultipliers?.exp??1)));
  let next=grantCharacterExpV2(character,exp);
  next={...next,weaponMastery:grantMasteryContribution(next.weaponMastery,family,next.level,ctx.enemyLevel,ctx.rank,ctx.eventMultipliers?.weaponExp??1,ctx.trainingMap??false)};
  const pity=pityByPlayer?.[playerId];
  const dropMultiplier=ctx.dropMultiplierByPlayer?.[playerId]??1;
  const loot=pity?rollLootWithBossCorePity(ctx.loot,pity,rng,dropMultiplier,ctx.eventMultipliers):rollLoot(ctx.loot,rng,dropMultiplier,ctx.eventMultipliers);
  out.push({playerId,exp,loot,character:next});
 }
 return out;
}
