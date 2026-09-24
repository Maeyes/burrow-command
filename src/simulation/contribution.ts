import type { EntityId, PlayerId } from './contracts';

export interface ContributionLedger { damageByPlayer:Map<PlayerId,number> }
export function createContributionLedger():ContributionLedger{return {damageByPlayer:new Map()};}
export function recordContribution(ledger:ContributionLedger,playerId:PlayerId,damage:number):void{
 if(damage<=0)return; ledger.damageByPlayer.set(playerId,(ledger.damageByPlayer.get(playerId)??0)+damage);
}
export function eligibleContributors(ledger:ContributionLedger):PlayerId[]{return [...ledger.damageByPlayer.entries()].filter(([,d])=>d>0).map(([id])=>id);}
export interface PersonalReward<T>{playerId:PlayerId;reward:T}
export function personalRewards<T>(ledger:ContributionLedger,factory:(playerId:PlayerId)=>T):PersonalReward<T>[] {
 return eligibleContributors(ledger).map(playerId=>({playerId,reward:factory(playerId)}));
}
