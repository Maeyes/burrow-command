import type { EquipmentCombatContributionV2 } from './character';

export type EquipmentTier = 1|2|3|4|5;
export type WeaponFamilyV2 = 'greatsword'|'dagger'|'axe'|'hammer'|'bow'|'staff'|'swordShield';
export type CraftRoleV2 = 'neutral'|'damage'|'tank'|'support';
export type CraftSlotV2 = 'main'|'offhand'|'armor'|'cape'|'shoes'|'accessoryLeft'|'accessoryRight';

export interface RecipeMaterialV2 { itemId:string; qty:number }
export interface CanonicalRecipeV2 {
  blueprintId:string;
  oreId:string;
  oreQty:number;
  materials:RecipeMaterialV2[];
  gold:number;
  available:boolean;
}
export interface CanonicalEquipmentTemplateV2 {
  id:string;
  name:string;
  tier:EquipmentTier;
  requiredLevel:number;
  slot:CraftSlotV2;
  role:CraftRoleV2;
  weaponFamily?:WeaponFamilyV2;
  offhandType?:'weapon'|'shield';
  setId?:string;
  baseCombat:EquipmentCombatContributionV2;
  baseGoldCost:number;
  recipe:CanonicalRecipeV2;
}

export interface SetDefinitionV2 {
  id:string; tier:2|3|4|5; role:'damage'|'tank'|'support'; group:'body'|'accessory';
  requiredPieces:2|3; effect:string[]; balanceLocked:boolean;
}

export const TIER_LEVEL_RANGES = {
  1:[1,25], 2:[26,45], 3:[46,65], 4:[66,85], 5:[86,Number.POSITIVE_INFINITY],
} as const;

export function equipmentTierForLevel(level:number):EquipmentTier {
  if(level<=25)return 1;if(level<=45)return 2;if(level<=65)return 3;if(level<=85)return 4;return 5;
}
export function blueprintForLevel(level:number){return `tier${equipmentTierForLevel(level)}Blueprint`;}
export const GLOBAL_BLUEPRINT_DROP_CHANCE=.02;

const tierLevel:Record<EquipmentTier,number>={1:1,2:26,3:46,4:66,5:86};
const tierPower:Record<EquipmentTier,number>={1:18,2:35,3:60,4:95,5:140};
const weaponRatio:Record<WeaponFamilyV2,[number,number]>={
  greatsword:[1,.3],dagger:[.8,.2],axe:[1.2,.15],hammer:[1.3,.1],bow:[.95,.2],staff:[.2,1.25],swordShield:[.8,.35],
};
const tierOre:Record<EquipmentTier,string>={1:'copperOre',2:'moonstoneShard',3:'silverOre',4:'mithrilOre',5:'futureT5Ore'};
const tierMats:Record<EquipmentTier,[string,string]>={
  1:['livingMoss','brutalSpore'],
  2:['duneRunnerClaw','cactusSpine'],
  3:['djinnEssence','sunscarabCarapace'],
  4:['goblinIronScrap','cursedBone'],
  5:['futureT5MaterialA','futureT5MaterialB'],
};
const baseRecipe:Record<EquipmentTier,[number,number,number,number]>={
  1:[2,4,0,120],2:[3,6,2,320],3:[4,8,3,750],4:[6,11,4,1600],5:[10,20,10,5500],
};
const slotWeight:Record<CraftSlotV2,number>={main:1,offhand:.8,armor:1.2,cape:.8,shoes:.8,accessoryLeft:.6,accessoryRight:.6};
function recipe(tier:EquipmentTier,slot:CraftSlotV2,prefer=0):CanonicalRecipeV2{
 const [ore,primary,secondary,gold]=baseRecipe[tier],w=slotWeight[slot],m=tierMats[tier];
 return {blueprintId:`tier${tier}Blueprint`,oreId:tierOre[tier],oreQty:Math.max(2,Math.round(ore*w)),
  materials:[{itemId:m[prefer],qty:Math.max(2,Math.round(primary*w))},...(secondary?[{itemId:m[1-prefer],qty:Math.max(1,Math.round(secondary*w))}]:[])],
  gold:Math.round(gold*w/10)*10,available:tier<5};
}
function weapon(id:string,name:string,tier:EquipmentTier,family:WeaponFamilyV2):CanonicalEquipmentTemplateV2{
 const p=tierPower[tier],[a,m]=weaponRatio[family];
 return {id,name,tier,requiredLevel:tierLevel[tier],slot:'main',role:'neutral',weaponFamily:family,
  baseCombat:{atk:Math.round(p*a),matk:Math.round(p*m)},baseGoldCost:recipe(tier,'main',family==='staff'||family==='swordShield'?1:0).gold,
  recipe:recipe(tier,'main',family==='staff'||family==='swordShield'?1:0)};
}
function offhand(id:string,name:string,tier:EquipmentTier,type:'weapon'|'shield'):CanonicalEquipmentTemplateV2{
 const r=recipe(tier,'offhand',type==='weapon'?0:1);
 const p=tierPower[tier];
 return {id,name,tier,requiredLevel:tierLevel[tier],slot:'offhand',role:type==='shield'?'tank':'damage',offhandType:type,
  weaponFamily:type==='weapon'?'dagger':undefined,
  baseCombat:type==='weapon'?{atk:Math.round(p*.32),matk:Math.round(p*.08)}:
   ({1:{def:12,mdef:8,maxHp:50},2:{def:25,mdef:18,maxHp:120},3:{def:45,mdef:32,maxHp:220},4:{def:70,mdef:50,maxHp:350},5:{def:105,mdef:75,maxHp:550}} as const)[tier],
  baseGoldCost:r.gold,recipe:r};
}
const bodyBase={
  1:{armor:{def:22,mdef:14,maxHp:80},cape:{def:12,mdef:12,maxHp:40},shoes:{def:10,mdef:8,maxHp:30},accessoryLeft:{atk:3,matk:3,maxHp:20}},
  2:{damage:{armor:{def:42,mdef:28,maxHp:120,atk:8,matk:8},cape:{def:24,mdef:20,maxHp:60,atk:5,matk:5},shoes:{def:20,mdef:16,maxHp:50,atk:5,matk:5},accessoryLeft:{atk:8,matk:8,crit:2}},
     tank:{armor:{def:55,mdef:38,maxHp:220},cape:{def:32,mdef:28,maxHp:120},shoes:{def:28,mdef:20,maxHp:100},accessoryLeft:{def:8,mdef:8,maxHp:100}},
     support:{armor:{def:35,mdef:48,maxHp:100},cape:{def:20,mdef:32},shoes:{def:18,mdef:25},accessoryLeft:{matk:6}}},
} as const;
const scale:Record<EquipmentTier,number>={1:1,2:1,3:1.55,4:2.2,5:3};
function scaled(v:EquipmentCombatContributionV2,tier:EquipmentTier){const s=scale[tier];return Object.fromEntries(Object.entries(v).map(([k,n])=>[k,Math.round((n as number)*s)])) as EquipmentCombatContributionV2}
const roleNames={
  2:{damage:'Wildfang',tank:'Ironbark',support:'Spiritbloom'},
  3:{damage:'Sunscar',tank:'Dune Bastion',support:'Mirage'},
  4:{damage:'Blacksteel',tank:'Stoneguard',support:'Runebound'},
  5:{damage:'Apex',tank:'Immortal',support:'Celestial'},
} as const;
const suffix={armor:'Armor',cape:'Cape',shoes:'Boots',accessoryLeft:'Ring',accessoryRight:'Pendant'} as const;
function setItem(tier:2|3|4|5,role:'damage'|'tank'|'support',slot:keyof typeof suffix):CanonicalEquipmentTemplateV2{
 const family=roleNames[tier][role], id=`t${tier}${role[0].toUpperCase()+role.slice(1)}${slot[0].toUpperCase()+slot.slice(1)}`;
 const source=bodyBase[2][role][slot==='accessoryRight'?'accessoryLeft':slot] as EquipmentCombatContributionV2,r=recipe(tier,slot,role==='support'?1:0);
 return {id,name:`${family} ${suffix[slot]}`,tier,requiredLevel:tierLevel[tier],slot,role,setId:`t${tier}-${role}-${slot==='accessoryLeft'||slot==='accessoryRight'?'accessory':'body'}`,
  baseCombat:scaled(source,tier),baseGoldCost:r.gold,recipe:r};
}

const weaponNames={
  1:[['mosswoodSword','Mosswood Sword','greatsword'],['sporefangDagger','Sporefang Dagger','dagger'],['mosswoodAxe','Mosswood Axe','axe'],['copperrootHammer','Copperroot Hammer','hammer'],['mosswoodBow','Mosswood Bow','bow'],['sporewoodWand','Sporewood Wand','staff'],['sporewoodScepter','Sporewood Scepter','swordShield']],
  2:[['wildwoodSword','Wildwood Sword','greatsword'],['thornfangDagger','Thornfang Dagger','dagger'],['ironrootAxe','Ironroot Axe','axe'],['ironbarkHammer','Ironbark Hammer','hammer'],['thornwoodBow','Thornwood Bow','bow'],['bloomWand','Bloom Wand','staff'],['bloomScepter','Bloom Scepter','swordShield']],
  3:[['sunscarBlade','Sunscar Blade','greatsword'],['duneFangDagger','Dune Fang Dagger','dagger'],['sunbreakerAxe','Sunbreaker Axe','axe'],['duneforgeHammer','Duneforge Hammer','hammer'],['scorchwindBow','Scorchwind Bow','bow'],['mirageWand','Mirage Wand','staff'],['sunspireScepter','Sunspire Scepter','swordShield']],
  4:[['blacksteelSword','Blacksteel Sword','greatsword'],['goblinShiv','Goblin Shiv','dagger'],['blacksteelCleaver','Blacksteel Cleaver','axe'],['stonebreakerHammer','Stonebreaker Hammer','hammer'],['goblinWarbow','Goblin Warbow','bow'],['runeboundWand','Runebound Wand','staff'],['runeboundScepter','Runebound Scepter','swordShield']],
  5:[['apexSword','Apex Sword','greatsword'],['apexDagger','Apex Dagger','dagger'],['apexAxe','Apex Axe','axe'],['apexHammer','Apex Hammer','hammer'],['apexBow','Apex Bow','bow'],['celestialWand','Celestial Wand','staff'],['celestialScepter','Celestial Scepter','swordShield']],
} as const;

const templates:CanonicalEquipmentTemplateV2[]=[];
for(const tier of [1,2,3,4,5] as EquipmentTier[]) for(const [id,name,family] of weaponNames[tier]) templates.push(weapon(id,name,tier,family));
for(const tier of [1,2,3,4,5] as EquipmentTier[]){
 templates.push(offhand(`t${tier}OffhandDagger`,tier===1?'Sporefang Dirk':`T${tier} Offhand Dagger`,tier,'weapon'));
 templates.push(offhand(`t${tier}Shield`,tier===1?'Mossguard Buckler':`T${tier} Guard Shield`,tier,'shield'));
 if(tier===1){
  for(const [slot,name] of [['armor','Mossguard Armor'],['cape','Sporeveil Cape'],['shoes','Mossstep Shoes'],['accessoryLeft','Sporeloop Charm']] as const){
   const r=recipe(1,slot,slot==='cape'||slot==='accessoryLeft'?1:0);
   templates.push({id:`t1${slot[0].toUpperCase()+slot.slice(1)}`,name,tier:1,requiredLevel:1,slot,role:'neutral',baseCombat:bodyBase[1][slot],baseGoldCost:r.gold,recipe:r});
  }
 } else for(const role of ['damage','tank','support'] as const) for(const slot of ['armor','cape','shoes','accessoryLeft','accessoryRight'] as const) templates.push(setItem(tier,role,slot));
}
export const EQUIPMENT_MASTER_V2=Object.freeze(Object.fromEntries(templates.map(x=>[x.id,x]))) as Readonly<Record<string,CanonicalEquipmentTemplateV2>>;
export const CRAFT_RECIPES_V2=Object.freeze(Object.fromEntries(templates.map(x=>[x.id,x.recipe]))) as Readonly<Record<string,CanonicalRecipeV2>>;
export const CRAFTABLE_EQUIPMENT_COUNT=templates.length;

export const SET_DEFINITIONS_V2:SetDefinitionV2[]=[
 ...([2,3,4,5] as const).flatMap(tier=>(['damage','tank','support'] as const).flatMap(role=>[
  {id:`t${tier}-${role}-body`,tier,role,group:'body' as const,requiredPieces:3 as const,effect:
   role==='damage'?[tier===2?'ATK/MATK +5%':tier===3?'ATK/MATK +7%':tier===4?'ATK/MATK +9%; execute damage mechanic (balance pending)':'ATK/MATK +10%; Predator Focus mechanic (balance pending)']:
   role==='tank'?[tier===2?'HP +8%; DEF/MDEF +5%':tier===3?'HP +10%; DEF/MDEF +7%':tier===4?'HP +12%; DEF/MDEF +8%; Last Stand (balance pending)':'HP +15%; DEF/MDEF +10%; Undying Will (balance pending)']:
   [tier===2?'Max SP +10%; SP Recovery +10%':tier===3?'Max SP +12%; SP Recovery +15%':tier===4?'Max SP +15%; SP Recovery +20%; SP Cost -10%':'Max SP +20%; SP Recovery +25%; SP Cost -10%; Overflow (balance pending)'],
   balanceLocked:false},
  {id:`t${tier}-${role}-accessory`,tier,role,group:'accessory' as const,requiredPieces:2 as const,effect:
   role==='damage'?[tier===2?'CRIT +5':tier===3?'CRIT +7; CRIT DMG +10%':tier===4?'CRIT +10; CRIT DMG +15%':'CRIT +12; CRIT DMG +20%']:
   role==='tank'?[tier===2?'HP +5%':tier===3?'HP +7%; FLEE +5':tier===4?'HP +8%; DEF/MDEF +5%':'HP +10%; DEF/MDEF +6%']:
   [tier===2?'Max SP +8%':tier===3?'Max SP +10%; SP Recovery +10%':tier===4?'Max SP +10%; SP Recovery +15%; Healing +10%':'Healing +15%; Buff Duration +15%; SP Recovery +15%'],
   balanceLocked:false},
 ]))
];

if(CRAFTABLE_EQUIPMENT_COUNT!==109) throw new Error(`equipment-master-count:${CRAFTABLE_EQUIPMENT_COUNT}`);
