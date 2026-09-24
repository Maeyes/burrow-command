export type EquipmentRarity='normal'|'good'|'rare'|'epic'|'legend'|'mythic'|'whiteAscended';
export type EquipmentSlot='armor'|'cape'|'shoes'|'accessoryLeft'|'accessoryRight'|'hat'|'face'|'mouth'|'main'|'offhand';
export type EquipmentProgressionCategory='offensive'|'defensive'|'utility';
export interface EquipmentV2 {id:string;templateId:string;slot:EquipmentSlot;rarity:EquipmentRarity;affixes:string[];baseGoldCost:number;offhandType?:'weapon'|'shield'}
export interface MasterRefinementBonusV2 {milestone:0|5|10|15;atk:number;matk:number;maxHp:number;maxSp:number}

export const CRAFT_RARITY_TABLE:ReadonlyArray<readonly[EquipmentRarity,number]>=[['normal',.50],['good',.27],['rare',.15],['epic',.06],['legend',.017],['mythic',.0028],['whiteAscended',.0002]];
export const RARITY_AFFIX_COUNT:Record<EquipmentRarity,number>={normal:0,good:0,rare:0,epic:1,legend:2,mythic:3,whiteAscended:4};
export const EQUIPMENT_RARITY_STAT_MULTIPLIER:Record<EquipmentRarity,number>={normal:1,good:1.2,rare:1.4,epic:1.6,legend:1.8,mythic:2,whiteAscended:2};
export function equipmentRarityStatMultiplier(rarity:EquipmentRarity):number{return EQUIPMENT_RARITY_STAT_MULTIPLIER[rarity]??1}
export function rollRarity(r:number):EquipmentRarity{let x=Math.max(0,Math.min(.999999,r));let c=0;for(const [rarity,p] of CRAFT_RARITY_TABLE){c+=p;if(x<c)return rarity}return'normal'}

export function progressionCategory(slot:string,offhandType?:'weapon'|'shield'):EquipmentProgressionCategory{
 if(slot==='main'||slot==='accessoryLeft'||slot==='accessoryRight')return'offensive';
 if(slot==='armor'||slot==='cape'||slot==='shoes')return'defensive';
 if(slot==='offhand')return offhandType==='shield'?'defensive':'offensive';
 return'utility';
}
export function enhancementStoneForLevel(nextLevel:number):'verdantAetherstone'|'azureAetherstone'|'violetAetherstone'{if(nextLevel<=40)return'verdantAetherstone';if(nextLevel<=80)return'azureAetherstone';return'violetAetherstone'}
export function enhancementRequirement(_baseGold:number,nextLevel:number){if(nextLevel<1||nextLevel>120)throw new Error('invalid-enhancement-level');return{stoneId:enhancementStoneForLevel(nextLevel),stoneQty:1,gold:Math.max(100,Math.round((100*Math.pow(1.06,nextLevel-1))/10)*10)}}

export const REFINE_SUCCESS=[1,.95,.90,.85,.75,.65,.55,.45,.35,.25,.20,.15,.10,.07,.05] as const;
export const REFINE_SAFE_FLOORS=[0,6,9,12,15] as const;
export function astraliteCost(target:number):number{if(target<=3)return 1;if(target<=6)return 2;if(target<=9)return 4;if(target<=12)return 8;return 16}
export function protectionRequirement(target:number):{id:'refineProtectionLv1'|'refineProtectionLv2';qty:number}|null{
 if(target>=6&&target<=10)return{id:'refineProtectionLv1',qty:target===10?4:target>=8?2:1};
 if(target>=11&&target<=15)return{id:'refineProtectionLv2',qty:target===15?4:target===14?2:1}; return null;
}
function safeFloor(level:number):number{let f=0;for(const x of REFINE_SAFE_FLOORS)if(x<=level)f=x;return f}
export function resolveRefinement(current:number,rng:number,protectedAttempt=false):{success:boolean;level:number;astralite:number;protection:ReturnType<typeof protectionRequirement>}{
 if(current<0||current>=15)throw new Error('invalid-refine-level');const target=current+1;const protection=protectedAttempt?protectionRequirement(target):null;
 const success=rng<REFINE_SUCCESS[current]; if(success)return{success:true,level:target,astralite:astraliteCost(target),protection};
 return{success:false,level:protectedAttempt?current:Math.max(safeFloor(current),current-1),astralite:astraliteCost(target),protection};
}
export function masterRefinementBonus(refines:number[]):MasterRefinementBonusV2{
 const qualifying=(n:number)=>refines.filter(x=>x>=n).length>=6;
 if(qualifying(15))return{milestone:15,atk:800,matk:800,maxHp:1500,maxSp:500};
 if(qualifying(10))return{milestone:10,atk:400,matk:400,maxHp:900,maxSp:300};
 if(qualifying(5))return{milestone:5,atk:200,matk:200,maxHp:500,maxSp:200};
 return{milestone:0,atk:0,matk:0,maxHp:0,maxSp:0};
}

export const OPTION_AFFIX_POOL=['atkPct','matkPct','defPct','mdefPct','hpPct','crit','aspd','expPct','dropPct'] as const;
export function optionStoneCost(existingAffixes:number):number{return[1,2,4,8][Math.max(0,Math.min(3,existingAffixes))]}
export function reoptionStoneCost(lockedAffixes:number):number{if(lockedAffixes<0)throw new Error('invalid-lock-count');return 1+lockedAffixes}
export function dismantleFragments(rarity:EquipmentRarity):number{return{normal:1,good:2,rare:4,epic:7,legend:12,mythic:20,whiteAscended:32}[rarity]}
export function dismantleProtectionLv1(rarity:EquipmentRarity,rng:number):number{return rarity==='legend'?(rng<.5?1:2):0}
export function protectionLv1ToLv2(qty:number):{lv2:number;remainder:number}{return{lv2:Math.floor(Math.max(0,qty)/10),remainder:Math.max(0,qty)%10}}
