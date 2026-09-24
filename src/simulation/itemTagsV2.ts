import { SKILLS_V2 } from './skills';

export type InventoryItemCategoryV2='Crafting Mat'|'Upgrading Mat'|'Blueprint'|'Skill Core'|'Quest'|'Misc';
export interface InventoryItemMetaV2 { id:string; category:InventoryItemCategoryV2; tags:string[]; }

const crafting=new Set([
 'livingMoss','brutalSpore','duneRunnerClaw','cactusSpine','djinnEssence','sunscarabCarapace','goblinIronScrap','cursedBone','drakeScale','magmaCore',
 'copperOre','ironOre','moonstoneShard','silverOre','mithrilOre','obsidianOre','bruteSpore','ancientRootHeart','duneMawFang','sunforgeCore','leaderEmblem',
 // Legacy saves may still contain these removed resources. Keep their semantic tag so they never fall into Misc.
 'beastPelt','pelt','hide','fang','core'
]);
const upgrading=new Set(['verdantAetherstone','azureAetherstone','violetAetherstone','astraliteStone','refineProtectionLv1','refineProtectionLv2','optionStone','reoptionStone']);
const modifiers=new Set(['lifeDrain','lingering','expandedArea','execution','rapidCasting','mobileCast','combustion','echo','overcharge','chain','extraStrike','concentratedForce']);

export function inventoryItemMeta(id:string):InventoryItemMetaV2{
 const skill=SKILLS_V2[id];
 if(skill&&skill.kind!=='weapon')return{id,category:'Skill Core',tags:['skill-core',skill.kind]};
 if(/^tier[1-5]Blueprint$/.test(id))return{id,category:'Blueprint',tags:['blueprint','crafting']};
 if(crafting.has(id))return{id,category:'Crafting Mat',tags:['crafting-material']};
 if(upgrading.has(id))return{id,category:'Upgrading Mat',tags:['upgrade-material']};
 if(modifiers.has(id))return{id,category:'Skill Core',tags:['skill-modifier']};
 if(/quest|notice/i.test(id))return{id,category:'Quest',tags:['quest']};
 return{id,category:'Misc',tags:['misc']};
}
export const inventoryCategoryFor=(id:string)=>inventoryItemMeta(id).category;
export const isSkillCoreItem=(id:string)=>inventoryItemMeta(id).tags.includes('skill-core');
