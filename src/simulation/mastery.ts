import type { CombatWeaponFamily } from '../systems/combatMath';
import type { WeaponMasteryState } from './character';

export type EnemyRank = 'normal'|'elite'|'boss'|'worldBoss';

export const MASTERY_CAP = 50;

export function masteryContribution(rank: EnemyRank): number {
  if (rank === 'elite') return 5;
  if (rank === 'boss') return 20;
  if (rank === 'worldBoss') return 20;
  return 1;
}

export function masteryLevelMultiplier(heroLevel:number, enemyLevel:number,trainingMap=false): number {
  if(trainingMap){
    // Forest II is the weapon-training map: full Weapon Mastery XP through hero Lv50,
    // then exponential decay so high-level characters naturally graduate from the zone.
    if(heroLevel<=50)return 1;
    return Math.exp(-0.08*(heroLevel-50));
  }
  const delta=heroLevel-enemyLevel;
  if (delta<=10) return 1;
  if (delta<=20) return 0.5;
  if (delta<=30) return 0.1;
  return 0;
}

export function masteryXpRequired(level:number):number {
  const lv=Math.max(1,Math.min(MASTERY_CAP-1,level));
  const base=12 + lv*5 + Math.pow(lv,1.55)*2;
  // Early mastery should reach the first Lv10 identity milestone sooner; Lv10+ keeps the original curve.
  return Math.floor(base*(lv<10?0.75:1));
}

export function grantMasteryContribution(state:WeaponMasteryState,family:CombatWeaponFamily,heroLevel:number,enemyLevel:number,rank:EnemyRank,xpMultiplier=1,trainingMap=false):WeaponMasteryState {
  const current=state[family];
  if (!current || current.level>=MASTERY_CAP) return state;
  let level=current.level;
  let xp=current.xp + masteryContribution(rank)*masteryLevelMultiplier(heroLevel,enemyLevel,trainingMap)*Math.max(0,xpMultiplier);
  while(level<MASTERY_CAP && xp>=masteryXpRequired(level)){
    xp-=masteryXpRequired(level); level++;
  }
  if(level>=MASTERY_CAP) xp=0;
  return {...state,[family]:{level,xp}};
}

export const MASTERY_MILESTONES=[10,20,30,40,50] as const;
