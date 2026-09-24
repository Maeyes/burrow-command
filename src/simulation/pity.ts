import type { RandomFn } from './engine';
import type { DropRoll, LootEventMultipliersV2, LootResultV2, LootSourceV2 } from './loot';
import { rollLoot } from './loot';

export interface BossCorePityState { failuresByKey:Record<string,number> }
export function createBossCorePityState():BossCorePityState{return{failuresByKey:{}}}

export function signatureCorePityChance(failures:number):number{
  if(failures>=9)return 1;
  return Math.min(1,0.10+Math.max(0,failures)*0.02);
}

export function rollLootWithBossCorePity(source:LootSourceV2,state:BossCorePityState,rng:RandomFn=Math.random,dropMultiplier=1,event:LootEventMultipliersV2={}):LootResultV2{
  if(source.rank!=='boss'||!source.core)return rollLoot(source,rng,dropMultiplier,event);
  const core=source.core;
  const key=`${source.id}::${core.itemId}`;
  const failures=state.failuresByKey[key]??0;
  // Roll the normal table without the signature core, then resolve the core exactly once with pity.
  const withoutCore:LootSourceV2={...source,core:undefined};
  const result=rollLoot(withoutCore,rng,dropMultiplier,event);
  if(rng()<signatureCorePityChance(failures)){
    result.items[core.itemId]=(result.items[core.itemId]??0)+(core.min??1);
    state.failuresByKey[key]=0;
  }else state.failuresByKey[key]=failures+1;
  return result;
}
