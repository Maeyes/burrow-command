import type { CharacterStateV2, EquipmentInstanceStateV2 } from './character';
import { normalizeMasteryLoadout } from './masteryLoadout';

type LegacyEquipmentInstance = EquipmentInstanceStateV2 & {refine?:number;enhancementGrowth?:unknown};

/**
 * Normalizes persisted V2 characters into the slot-bound equipment progression model.
 * Legacy item-bound refinement is migrated only from the item currently equipped in a slot.
 * Once normalized, item progression fields are stripped so they cannot remain authoritative.
 */
// Map ids v1 named the starter forest "forest2" and the second forest "forestii".
// v2 renamed them to forest1/forest2 to match the monster data.
function legacyMapIdFor(version:number|undefined){return(id:string)=>version===2?id:id==='forest2'?'forest1':id==='forestii'?'forest2':id;}
export function normalizeCharacterStateV2(state:CharacterStateV2):CharacterStateV2{
 const legacyMapId=legacyMapIdFor(state.mapIdVersion);
 const equipment=state.equipment as CharacterStateV2['equipment'] & {refinementBySlot?:Record<string,number>};
 const legacyMastery=state.weaponMastery as unknown as Record<string,{level:number;xp:number}>;
 const weaponMastery={...legacyMastery} as Record<string,{level:number;xp:number}>;
 const migrate=(from:string,to:string)=>{if(!weaponMastery[to]&&legacyMastery[from])weaponMastery[to]={...legacyMastery[from]};delete weaponMastery[from];};
 migrate('sword','greatsword');migrate('wand','staff');migrate('scepter','swordShield');
 for(const family of ['greatsword','dagger','axe','hammer','bow','staff','swordShield'])weaponMastery[family]??={level:1,xp:0};
 const refinementBySlot={...(equipment.refinementBySlot??{})};
 const instances:Record<string,EquipmentInstanceStateV2>={};
 for(const [id,raw] of Object.entries(equipment.instances)){
  const legacy=raw as LegacyEquipmentInstance;
  const {refine:_legacyRefine,enhancementGrowth:_legacyEnhancementGrowth,...intrinsic}=legacy;
  instances[id]=intrinsic;
 }
 for(const [slot,id] of Object.entries(equipment.equippedBySlot)){
  if(refinementBySlot[slot]!==undefined||!id)continue;
  const legacy=equipment.instances[id] as LegacyEquipmentInstance|undefined;
  if(legacy?.refine!==undefined)refinementBySlot[slot]=Math.max(0,Math.min(15,Math.floor(legacy.refine)));
 }
 const next={
  ...state,
  masteryLoadout:state.masteryLoadout??{passive:[],active:{}},
  unlockedMaps:(Array.isArray(state.unlockedMaps)?state.unlockedMaps:['forest1']).map(legacyMapId),
  currentMapId:legacyMapId(state.currentMapId||'forest1'),
  mapIdVersion:2,
  weaponMastery:weaponMastery as CharacterStateV2['weaponMastery'],
  equipment:{
   ...equipment,
   enhancementBySlot:{...(equipment.enhancementBySlot??{})},
   refinementBySlot,
   instances,
  },
 } as CharacterStateV2;
 next.masteryLoadout=normalizeMasteryLoadout(next);
 return next;
}
