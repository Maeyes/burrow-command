import type { CombatStats, CombatWeaponFamily } from '../systems/combatMath';

export type WeaponMasteryState = Record<CombatWeaponFamily, { level: number; xp: number }>;
export type MasteryActiveLevelV2=10|20|30;
export interface MasteryPassiveSelectionV2 { family:CombatWeaponFamily; milestoneId:string }
export interface WeaponMasteryLoadoutV2 { passive:MasteryPassiveSelectionV2[]; active:Partial<Record<MasteryActiveLevelV2,string>> }

export interface SkillLoadoutV2 {
  active: [string?, string?, string?];
  movement?: string;
  passive: [string?, string?];
  modifiersByActive: Record<string, string[]>;
  /** Mods parked on an empty core slot (0/1/2). Mods belong to the slot: swapping the core keeps them. */
  slotMods?: [string[]?, string[]?, string[]?];
  /** Upgrade rarity per Skill Core, Skill Mod or Movement Core ID. Missing = normal. */
  coreRarity?: Record<string, 'normal'|'good'|'rare'|'epic'|'legend'|'mythic'|'whiteAscended'>;
}

export interface EquipmentCombatContributionV2 { atk?:number;matk?:number;def?:number;mdef?:number;maxHp?:number;crit?:number;aspd?:number;hit?:number;flee?:number }
export interface EquipmentInstanceStateV2 { id:string;templateId:string;slot:string;rarity:'normal'|'good'|'rare'|'epic'|'legend'|'mythic'|'whiteAscended';affixes:string[];baseGoldCost:number;baseCombat?:EquipmentCombatContributionV2;offhandType?:'weapon'|'shield';setId?:string;requiredLevel?:number }
export interface EquipmentProgressV2 {
  equippedBySlot: Record<string, string | null>;
  enhancementBySlot: Record<string, number>;
  refinementBySlot: Record<string, number>;
  instances: Record<string,EquipmentInstanceStateV2>;
}

export interface CharacterStateV2 {
  schemaVersion: 2;
  characterId: string;
  name: string;
  level: number;
  exp: number;
  unspentStatPoints: number;
  stats: CombatStats;
  gold: number;
  inventory: Record<string, number>;
  equipment: EquipmentProgressV2;
  weaponMastery: WeaponMasteryState;
  masteryLoadout: WeaponMasteryLoadoutV2;
  skills: SkillLoadoutV2;
  unlockedMaps: string[];
  currentMapId: string;
  /** 2 = forest1/forest2 naming (see equipmentMigration). */
  mapIdVersion?: number;
}

const families: CombatWeaponFamily[] = ['greatsword','dagger','axe','hammer','bow','staff','swordShield'];
const RO_BASE_EXP_TO_NEXT_LEVEL:number[] = [550,900,1500,2200,3200,3800,4200,4550,5000,5500,6000,6100,6350,6700,7350,8000,8400,8800,9200,9700,10300,11000,11800,13000,14000,15000,16000,17000,18000,19000,20000,21000,22000,23200,24000,26000,27500,29000,30000,31500,33000,34000,36000,37500,38000,40000,42000,44500,47000,49000,51000,53000,55000,57000,59000,61500,63000,65000,67000,69000,70000,73000,77000,80000,84000,88000,91000,95000,110000,128000,140000,155000,163000,170000,180000,188000,195000,200000,230000,260000,300000,350000,400000,480000,550000,600000,680000,750000,900000,1000000,1027160,1055057,1083712,1113146,1143379,1174432,1206330,1239093,1272747,1354980,1442526,1535729,1634954,1740590,1853051,1972778,2100241,2235940,2800454,2981395,3174026,3379103,3597431,3829865,4077317,4340757,4621218,4919800,6161918];
function roBaseExpToNextLevel(level:number):number{return RO_BASE_EXP_TO_NEXT_LEVEL[Math.max(0,Math.min(118,Math.floor(level)-1))];}

export function createInitialCharacterV2(characterId: string, name = 'Bunny'): CharacterStateV2 {
  const starterDaggerId='starter-dagger';
  return {
    schemaVersion: 2,
    characterId,
    name,
    level: 1,
    exp: 0,
    // Character creation starts neutral. The player owns the initial build choice.
    unspentStatPoints: 24,
    stats: { level: 1, str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 },
    gold: 0,
    inventory: {},
    // New characters begin with one real basic dagger equipped. It is an equipment instance,
    // not a presentation-only weapon, so Dagger mastery matches what the character is using.
    equipment: {
      equippedBySlot: { main: starterDaggerId },
      enhancementBySlot: {},
      refinementBySlot: {},
      instances: {
        [starterDaggerId]: { id:starterDaggerId, templateId:'starterDagger', slot:'main', rarity:'normal', affixes:[], baseGoldCost:0, baseCombat:{atk:19} },
      },
    },
    weaponMastery: Object.fromEntries(families.map(f => [f,{level:1,xp:0}])) as WeaponMasteryState,
    masteryLoadout:{passive:[],active:{}},
    skills: { active: [], passive: [], modifiersByActive: {} },
    unlockedMaps: ['forest1'],
    currentMapId: 'forest1',
    mapIdVersion: 2,
  };
}


export function allocateCharacterStatsV2(state:CharacterStateV2, allocation:Partial<Record<'str'|'agi'|'vit'|'int'|'dex'|'luk',number>>):CharacterStateV2{
 const keys=['str','agi','vit','int','dex','luk'] as const;
 let spent=0;const stats={...state.stats};
 for(const key of keys){const amount=Math.max(0,Math.floor(allocation[key]??0));spent+=amount;stats[key]+=amount;}
 if(spent<=0||spent>state.unspentStatPoints)return state;
 return{...state,unspentStatPoints:state.unspentStatPoints-spent,stats};
}

/** Stat reset for switching builds: every allocated point returns; costs Gold scaled by level. */
export function statResetCostV2(level:number):number{return Math.max(0,Math.round(level*level*20));}
export function resetCharacterStatsV2(state:CharacterStateV2):CharacterStateV2{
 const keys=['str','agi','vit','int','dex','luk'] as const;
 const refund=keys.reduce((n,k)=>n+Math.max(0,state.stats[k]-1),0);
 if(refund<=0)throw new Error('nothing-to-reset');
 const cost=statResetCostV2(state.level);
 if(state.gold<cost)throw new Error('not-enough-gold');
 const stats={...state.stats};for(const k of keys)stats[k]=1;
 return{...state,gold:state.gold-cost,unspentStatPoints:state.unspentStatPoints+refund,stats};
}

export function expToNextLevelV2(level: number): number {
  const lv = Math.max(1, level);
  // Character leveling was outrunning map/content progression. Preserve the early curve,
  // then progressively stretch each level from Lv20 onward (about 2.9x at Lv68, 4.5x at Lv120).
  return roBaseExpToNextLevel(lv);
}

export function grantCharacterExpV2(state: CharacterStateV2, amount: number): CharacterStateV2 {
  if (amount <= 0) return state;
  let level = state.level;
  let exp = state.exp + Math.floor(amount);
  let points = state.unspentStatPoints;
  while (level < 120 && exp >= expToNextLevelV2(level)) {
    exp -= expToNextLevelV2(level);
    level += 1;
    points += 3;
  }
  if (level >= 120) exp = Math.min(exp, expToNextLevelV2(120) - 1);
  return { ...state, level, exp, unspentStatPoints: points, stats: { ...state.stats, level } };
}
