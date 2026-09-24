import type { EquipmentCombatContributionV2 } from './character';
export type UtilityEquipmentSlotV2='hat'|'face'|'mouth';
export interface UtilityEquipmentTemplateV2 {id:string;name:string;slot:UtilityEquipmentSlotV2;requiredLevel:number;baseCombat:EquipmentCombatContributionV2;description:string}
const items:UtilityEquipmentTemplateV2[]=[
 {id:'mushroomCap',name:'Mushroom Cap',slot:'hat',requiredLevel:5,baseCombat:{maxHp:45},description:'A springy cap that improves early survivability.'},
 {id:'mossCrown',name:'Moss Crown',slot:'hat',requiredLevel:10,baseCombat:{maxHp:70,flee:2},description:'Forest headgear with HP and FLEE utility.'},
 {id:'sporeGoggles',name:'Spore Goggles',slot:'face',requiredLevel:5,baseCombat:{hit:3,mdef:2},description:'Clear lenses for HIT and magical defense.'},
 {id:'forestLeaf',name:'Forest Leaf',slot:'mouth',requiredLevel:2,baseCombat:{flee:2},description:'A lucky leaf held in the mouth.'},
 {id:'luckyTwig',name:'Lucky Twig',slot:'mouth',requiredLevel:12,baseCombat:{crit:2},description:'A charmed twig with a small CRIT bonus.'},
 {id:'cactusCrown',name:'Cactus Crown',slot:'hat',requiredLevel:22,baseCombat:{maxHp:110,def:4},description:'Desert headgear built for endurance.'},
 {id:'desertGoggles',name:'Desert Goggles',slot:'face',requiredLevel:24,baseCombat:{hit:5,flee:3},description:'Sandproof goggles for accuracy and evasion.'},
 {id:'desertScarf',name:'Desert Scarf',slot:'mouth',requiredLevel:26,baseCombat:{mdef:5,maxHp:40},description:'A scarf that softens harsh desert magic.'},
 {id:'sunscarabHelm',name:'Sunscarab Helm',slot:'hat',requiredLevel:40,baseCombat:{maxHp:150,mdef:8},description:'A radiant helm made for sustained combat.'},
 {id:'goblinMinerHelm',name:'Goblin Miner Helm',slot:'hat',requiredLevel:42,baseCombat:{maxHp:180,hit:5},description:'Mine gear with practical HP and HIT.'},
 {id:'goblinEyepatch',name:'Goblin Eyepatch',slot:'face',requiredLevel:43,baseCombat:{crit:3,hit:4},description:'A battered eyepatch favored by goblin fighters.'},
 {id:'boneVisor',name:'Bone Visor',slot:'face',requiredLevel:44,baseCombat:{mdef:8,flee:4},description:'A cursed visor with defensive utility.'},
 {id:'boneCharm',name:'Bone Charm',slot:'mouth',requiredLevel:46,baseCombat:{crit:2,maxHp:80},description:'A grim charm carrying HP and CRIT utility.'},
 {id:'foremanHelm',name:"Foreman's Helm",slot:'hat',requiredLevel:48,baseCombat:{maxHp:240,def:8,hit:5},description:'Elite mine headgear with strong utility stats.'},
 {id:'impHorns',name:'Imp Horns',slot:'hat',requiredLevel:53,baseCombat:{maxHp:200,matk:6},description:'Tiny horns that crackle with ember magic.'},
 {id:'drakeFang',name:'Drake Fang',slot:'mouth',requiredLevel:55,baseCombat:{crit:3,atk:6},description:'A hot fang held between the teeth.'},
 {id:'dragonCrest',name:'Dragon Crest',slot:'hat',requiredLevel:60,baseCombat:{maxHp:280,def:10,mdef:8},description:"Ignaroth's crest, forged into a helm."},
 {id:'emberGoggles',name:'Ember Goggles',slot:'face',requiredLevel:62,baseCombat:{hit:7,mdef:8},description:'Heat-proof lenses for lava fields.'},
 {id:'magmaKnuckle',name:'Magma Knuckle',slot:'mouth',requiredLevel:65,baseCombat:{crit:3,maxHp:120},description:'A cooled magma chunk carried as a charm.'},
 {id:'obsidianMask',name:'Obsidian Mask',slot:'face',requiredLevel:68,baseCombat:{def:8,mdef:10,flee:4},description:'Elite golem glass carved into a mask.'},
 {id:'knightsHelm',name:"Dragon Knight's Helm",slot:'hat',requiredLevel:70,baseCombat:{maxHp:340,def:12,atk:8},description:"The Dark Dragon Knight's horned helm."},
];
export const UTILITY_EQUIPMENT_V2=Object.freeze(Object.fromEntries(items.map(x=>[x.id,x]))) as Readonly<Record<string,UtilityEquipmentTemplateV2>>;
