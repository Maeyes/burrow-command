import type { CharacterStateV2,EquipmentInstanceStateV2 } from './character';
import type { LootResultV2 } from './loot';
import type { RandomFn } from './engine';
import {RARITY_AFFIX_COUNT,OPTION_AFFIX_POOL,rollRarity} from './equipmentV2';
import {UTILITY_EQUIPMENT_V2} from './utilityEquipmentV2';

let dropSerial=0;
function affixesFor(rarity:EquipmentInstanceStateV2['rarity'],rng:RandomFn):string[]{
 const count=RARITY_AFFIX_COUNT[rarity],pool=[...OPTION_AFFIX_POOL],out:string[]=[];
 for(let i=0;i<count&&pool.length;i++){const index=Math.min(pool.length-1,Math.floor(rng()*pool.length));out.push(pool.splice(index,1)[0]);}
 return out;
}
export function grantLootWithEquipment(state:CharacterStateV2,loot:LootResultV2,rng:RandomFn=Math.random):CharacterStateV2{
 const inventory={...state.inventory},instances={...state.equipment.instances};
 for(const [id,qtyRaw] of Object.entries(loot.items)){
  const qty=Math.max(0,Math.floor(qtyRaw)),template=UTILITY_EQUIPMENT_V2[id];
  if(!template){if(qty)inventory[id]=(inventory[id]??0)+qty;continue;}
  for(let i=0;i<qty;i++){
   const rarity=rollRarity(rng());let instanceId='';do{instanceId=`${id}-drop-${++dropSerial}`}while(instances[instanceId]);
   instances[instanceId]={id:instanceId,templateId:id,slot:template.slot,rarity,affixes:affixesFor(rarity,rng),baseGoldCost:0,baseCombat:template.baseCombat,requiredLevel:template.requiredLevel};
  }
 }
 return {...state,gold:state.gold+Math.max(0,Math.floor(loot.gold)),inventory,equipment:{...state.equipment,instances}};
}
