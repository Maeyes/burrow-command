/**
 * Bunny World Combat Math V1
 *
 * Pure, deterministic RO-inspired combat primitives.
 * Keep this module free of GameState/UI dependencies so Arena Draft and the
 * main game can share one source of truth while legacy combat is migrated.
 */

export type CombatStats = {
  level: number;
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
};

export type PhysicalWeaponFamily = 'greatsword' | 'dagger' | 'axe' | 'hammer' | 'bow' | 'swordShield';
export type MagicWeaponFamily = 'staff';
export type CombatWeaponFamily = PhysicalWeaponFamily | MagicWeaponFamily;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function meleeStatusAtk({ str, dex, luk }: CombatStats): number {
  return str + Math.floor((str * str) / 100) + Math.floor(dex / 5) + Math.floor(luk / 3);
}

export function rangedStatusAtk({ str, dex, luk }: CombatStats): number {
  return dex + Math.floor((dex * dex) / 100) + Math.floor(str / 5) + Math.floor(luk / 3);
}

export function statusMatk({ int, dex, luk }: CombatStats): number {
  return int + Math.floor((int * int) / 100) + Math.floor(dex / 5) + Math.floor(luk / 3);
}

export function physicalAttack(stats: CombatStats, family: PhysicalWeaponFamily, weaponAtk: number): number {
  return (family === 'bow' ? rangedStatusAtk(stats) : meleeStatusAtk(stats)) + Math.max(0, weaponAtk);
}

export function magicalAttack(stats: CombatStats, weaponMatk: number): number {
  return statusMatk(stats) + Math.max(0, weaponMatk);
}

export function hit(stats: CombatStats, hitBonus = 0): number {
  return 175 + stats.level + stats.dex + hitBonus;
}

export function flee(stats: CombatStats, fleeBonus = 0): number {
  return 100 + stats.level + stats.agi + fleeBonus;
}

/** Returns 0.05..0.95 for ordinary accuracy checks. */
export function hitChance(attackerHit: number, defenderFlee: number): number {
  return clamp(80 + attackerHit - defenderFlee, 5, 95) / 100;
}

/** critBonusPercent is percentage points, e.g. 6 means +6%. */
export function critChance(stats: CombatStats, critBonusPercent = 0): number {
  return clamp(1 + stats.luk * 0.3 + critBonusPercent, 0, 70) / 100;
}

export const BASE_CRIT_DAMAGE = 1.5;

export function aspd(stats: CombatStats, equipmentAspd = 0): number {
  return Math.min(199, Math.floor(150 + stats.agi * 0.25 + stats.dex * 0.1 + equipmentAspd));
}

export function attacksPerSecond(aspdValue: number): number {
  // Canonical RO-like cadence. All weapon families share this curve;
  // weapon identity comes from base stats/mastery/skills, not hidden speed modifiers.
  // Reference points: 150=1/s, 175=2/s, 190=5/s, 193=7/s.
  const value = Math.max(150, Math.min(193, aspdValue));
  const points = [
    [150, 1],
    [175, 2],
    [190, 5],
    [193, 7],
  ] as const;
  for (let i = 1; i < points.length; i++) {
    const [hiAspd, hiRate] = points[i];
    const [loAspd, loRate] = points[i - 1];
    if (value <= hiAspd) {
      const t = (value - loAspd) / (hiAspd - loAspd);
      return loRate + (hiRate - loRate) * t;
    }
  }
  return 7;
}

export function maxHp(stats: CombatStats, equipmentHp = 0): number {
  return Math.max(1, 100 + stats.level * 12 + stats.vit * 10 + equipmentHp);
}

export function maxSp(stats: CombatStats, equipmentSp = 0): number {
  return Math.max(0, 30 + stats.level * 2 + stats.int * 3 + equipmentSp);
}

export function totalDef(stats: CombatStats, equipmentDef = 0, explicitBonus = 0): number {
  return Math.max(0, equipmentDef + Math.floor(stats.vit / 2) + explicitBonus);
}

export function totalMdef(stats: CombatStats, equipmentMdef = 0, explicitBonus = 0): number {
  return Math.max(0, equipmentMdef + Math.floor(stats.int / 2) + Math.floor(stats.vit / 4) + explicitBonus);
}

export function defenseReduction(defense: number, attackerLevel: number): number {
  const safeDefense = Math.max(0, defense);
  return safeDefense / (safeDefense + 100 + Math.max(1, attackerLevel) * 2);
}

export function damageAfterDefense(rawDamage: number, defense: number, attackerLevel: number): number {
  if (rawDamage <= 0) return 0;
  return Math.max(1, Math.round(rawDamage * (1 - defenseReduction(defense, attackerLevel))));
}

export type SkillDamageInput = {
  scalingAttack: number;
  coefficient: number;
  flatPower?: number;
  defense: number;
  attackerLevel: number;
  critical?: boolean;
  critMultiplier?: number;
};

/**
 * Resolves one landed skill hit. Accuracy, element and proc resolution belong
 * to the caller because skills may define special rules for those systems.
 */
export function skillHitDamage(input: SkillDamageInput): number {
  const raw = Math.max(0, input.scalingAttack * input.coefficient + (input.flatPower ?? 0));
  const defended = damageAfterDefense(raw, input.defense, input.attackerLevel);
  return Math.max(1, Math.round(defended * (input.critical ? input.critMultiplier ?? BASE_CRIT_DAMAGE : 1)));
}
