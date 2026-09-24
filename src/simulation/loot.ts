import type { RandomFn } from './engine';
import type { EnemyRank } from './mastery';

export interface DropRoll { itemId:string; chance:number; min?:number; max?:number }
export interface LootSourceV2 {
  id:string; rank:EnemyRank; level:number;
  goldMin:number; goldMax:number;
  material?:DropRoll;
  aetherstone?:DropRoll;
  modifier?:DropRoll;
  core?:DropRoll;
  blueprint?:DropRoll;
  unique?:DropRoll;
  signatureMaterial?:DropRoll;
  equipmentDrops?:DropRoll[];
  oreItemId:string;
}
export interface LootResultV2 { gold:number; items:Record<string,number> }

// Craft-economy baseline: ore should not be the progression bottleneck; Astralite remains rarer.
export const UNIVERSAL_ORE_CHANCE=0.12;
export const UNIVERSAL_ASTRALITE_CHANCE=0.02;

function quantity(roll:DropRoll,rng:RandomFn):number {
 const min=roll.min??1,max=roll.max??min;
 return min+Math.floor(rng()*(max-min+1));
}
function apply(out:Record<string,number>,roll:DropRoll|undefined,rng:RandomFn):void{
 if(!roll||rng()>=roll.chance)return;
 out[roll.itemId]=(out[roll.itemId]??0)+quantity(roll,rng);
}
export function scaledLootSource(source:LootSourceV2,dropMultiplier=1):LootSourceV2{const scale=(r:DropRoll|undefined)=>r?{...r,chance:Math.min(1,r.chance*Math.max(0,dropMultiplier))}:undefined;return{...source,material:scale(source.material),aetherstone:scale(source.aetherstone),modifier:scale(source.modifier),core:scale(source.core),blueprint:scale(source.blueprint),unique:scale(source.unique),signatureMaterial:scale(source.signatureMaterial),equipmentDrops:source.equipmentDrops?.map(r=>scale(r)!)};}
export interface LootEventMultipliersV2 {drop?:number;gold?:number;upgradeItem?:number;blueprint?:number}
export function rollLoot(source:LootSourceV2,rng:RandomFn=Math.random,dropMultiplier=1,event:LootEventMultipliersV2={}):LootResultV2{
 const generic=Math.max(0,dropMultiplier*(event.drop??1)),upgrade=Math.max(0,event.upgradeItem??1),blueprint=Math.max(0,event.blueprint??1);
 source=scaledLootSource(source,generic);
 const gold=Math.floor((source.goldMin+Math.floor(rng()*(source.goldMax-source.goldMin+1)))*Math.max(0,event.gold??1));
 const items:Record<string,number>={};
 apply(items,{itemId:source.oreItemId,chance:Math.min(1,UNIVERSAL_ORE_CHANCE*generic)},rng);
 apply(items,{itemId:'astraliteStone',chance:Math.min(1,UNIVERSAL_ASTRALITE_CHANCE*generic*upgrade)},rng);
 apply(items,source.material,rng); if(source.aetherstone)apply(items,{...source.aetherstone,chance:Math.min(1,source.aetherstone.chance*upgrade)},rng); apply(items,source.modifier,rng);
 apply(items,source.core,rng); if(source.blueprint)apply(items,{...source.blueprint,chance:Math.min(1,source.blueprint.chance*blueprint)},rng); apply(items,source.unique,rng); apply(items,source.signatureMaterial,rng);
 (source.equipmentDrops??[]).forEach(roll=>apply(items,roll,rng));
 return {gold,items};
}
