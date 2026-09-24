import { describe, expect, it } from 'vitest';
import {
  aspd, attacksPerSecond, critChance, damageAfterDefense, defenseReduction,
  flee, hit, hitChance, magicalAttack, meleeStatusAtk, physicalAttack,
  rangedStatusAtk, skillHitDamage, statusMatk,
  type CombatStats,
} from './combatMath';

const stats = (overrides: Partial<CombatStats> = {}): CombatStats => ({
  level: 1, str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5, ...overrides,
});

describe('Combat Math V1', () => {
  it('matches the RO-like ASPD reference points', () => {
    expect(attacksPerSecond(150)).toBeCloseTo(1);
    expect(attacksPerSecond(175)).toBeCloseTo(2);
    expect(attacksPerSecond(190)).toBeCloseTo(5);
    expect(attacksPerSecond(193)).toBeCloseTo(7);
    expect(aspd(stats({ agi: 120, dex: 100 }), 3)).toBe(193);
  });

  it('uses STR for melee, DEX for bow, and INT for magic', () => {
    expect(meleeStatusAtk(stats({ str: 50, dex: 30, luk: 10 }))).toBe(84);
    expect(rangedStatusAtk(stats({ dex: 100, str: 40, luk: 20 }))).toBe(214);
    expect(statusMatk(stats({ int: 100, dex: 60, luk: 20 }))).toBe(218);
    expect(physicalAttack(stats({ str: 50, dex: 30, luk: 10 }), 'greatsword', 60)).toBe(144);
    expect(magicalAttack(stats({ int: 80, dex: 50, luk: 20 }), 85)).toBe(245);
  });

  it('resolves HIT vs FLEE with normal 5%-95% bounds', () => {
    const attacker = stats({ level: 50, dex: 20 });
    const evasive = stats({ level: 50, agi: 120 });
    expect(hit(attacker)).toBe(245);
    expect(flee(evasive)).toBe(270);
    expect(hitChance(hit(attacker), flee(evasive))).toBeCloseTo(0.55);
    expect(hitChance(999, 1)).toBe(0.95);
    expect(hitChance(1, 999)).toBe(0.05);
  });

  it('has diminishing defense reduction', () => {
    expect(defenseReduction(50, 50)).toBeCloseTo(0.2);
    expect(defenseReduction(200, 50)).toBeCloseTo(0.5);
    expect(defenseReduction(400, 50)).toBeCloseTo(2 / 3);
    expect(damageAfterDefense(144, 50, 30)).toBe(110);
  });

  it('keeps crit rate bounded and uses percentage-point bonuses', () => {
    expect(critChance(stats({ luk: 30 }))).toBeCloseTo(0.10);
    expect(critChance(stats({ luk: 100 }), 10)).toBeCloseTo(0.41);
    expect(critChance(stats({ luk: 999 }), 99)).toBe(0.70);
  });

  it('resolves a deterministic landed skill hit without coupling to GameState', () => {
    expect(skillHitDamage({
      scalingAttack: 144,
      coefficient: 2,
      defense: 50,
      attackerLevel: 30,
    })).toBe(219);
    expect(skillHitDamage({
      scalingAttack: 144,
      coefficient: 2,
      defense: 50,
      attackerLevel: 30,
      critical: true,
    })).toBe(329);
  });
});
