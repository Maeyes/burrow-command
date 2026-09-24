import type { CharacterStateV2 } from './character';
import type { LootResultV2 } from './loot';

export type EconomyCommandV2 =
 | {type:'grantLoot';loot:LootResultV2}
 | {type:'spend';gold:number;items:Record<string,number>};

export function applyEconomyCommand(state:CharacterStateV2,command:EconomyCommandV2):CharacterStateV2{
 if(command.type==='grantLoot'){
  const inventory={...state.inventory};
  for(const [id,qty] of Object.entries(command.loot.items))if(qty>0)inventory[id]=(inventory[id]??0)+Math.floor(qty);
  return{...state,gold:state.gold+Math.max(0,Math.floor(command.loot.gold)),inventory};
 }
 if(command.gold<0||Object.values(command.items).some(q=>q<0))throw new Error('invalid-cost');
 if(state.gold<command.gold)throw new Error('insufficient-gold');
 for(const [id,qty] of Object.entries(command.items))if((state.inventory[id]??0)<qty)throw new Error('insufficient-item');
 const inventory={...state.inventory};
 for(const [id,qty] of Object.entries(command.items)){inventory[id]-=qty;if(inventory[id]<=0)delete inventory[id];}
 return{...state,gold:state.gold-command.gold,inventory};
}
