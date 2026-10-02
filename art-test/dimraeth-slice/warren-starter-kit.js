// Starter kit for a brand-new village, so every tutorial step can actually be tried:
// craft materials for ~2 Tier 1 pieces of any recipe, upgrade stones, a Rare weapon on the Guard
// (crafted gear is usually Normal, which has no option lines) and a few option stones.
import {EQUIPMENT_MASTER_V2,CRAFT_RECIPES_V2,CLASS_FAMILIES,buildFor,gearSlot} from './warren-progression.js';

export const STARTER_CRAFTS=2;
export const STARTER_ITEMS={verdantAetherstone:6,astraliteStone:4,optionStone:2,reoptionStone:1};
export const STARTER_KIT_GOLD=800; // pays for the kit's crafts, enhances and refines on top of the 500 starting Gold

// Pure: the most any single Tier 1 recipe needs of each ingredient, times STARTER_CRAFTS.
export function starterCraftMaterials(){
 const need={};
 const bump=(id,q)=>{if(id&&q>0)need[id]=Math.max(need[id]||0,q*STARTER_CRAFTS);};
 for(const [id,r] of Object.entries(CRAFT_RECIPES_V2)){
  const t=EQUIPMENT_MASTER_V2[id];if(!t||t.tier!==1||!r?.available||!gearSlot(id))continue;
  bump(r.blueprintId,1);bump(r.oreId,r.oreQty);for(const m of r.materials||[])bump(m.itemId,m.qty);
 }
 return need;
}

export function starterWeaponTemplate(cls='guard'){
 return Object.values(EQUIPMENT_MASTER_V2).find(t=>t.tier===1&&gearSlot(t.id)==='weapon'&&t.weaponFamily===CLASS_FAMILIES[cls])?.id||null;
}

// Mutates the new save: inventory, gold, and one equipped Rare weapon. Returns what was given.
export function grantStarterKit(s,cls='guard'){
 const items={...starterCraftMaterials()};
 for(const [id,q] of Object.entries(STARTER_ITEMS))items[id]=(items[id]||0)+q;
 for(const [id,q] of Object.entries(items))s.inventory[id]=(s.inventory[id]||0)+q;
 s.gold+=STARTER_KIT_GOLD;
 let weapon=null;const tid=starterWeaponTemplate(cls),build=buildFor(s,cls);
 if(tid&&build){
  weapon={id:'bc-gear-'+(++s.nextGearId),templateId:tid,rarity:'rare',enhance:0,refine:0,locked:true,options:[]};
  s.gear.push(weapon);build.gear.weapon=weapon.id;
 }
 return {items,gold:STARTER_KIT_GOLD,weapon};
}
