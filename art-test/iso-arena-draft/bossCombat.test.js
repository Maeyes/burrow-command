// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  beginBossAttackState,
  getBossAttackProgress,
  updateBossAttackState,
} from './bossCombat.js';

function mushroomBrute() {
  return /** @type {any} */ ({
    isBoss: true,
    monsterType: 'mushroom',
    dead: false,
    anim: 'walk',
    attackTimer: 0,
  });
}

/** @param {any} monster */
function runAttack(monster, step = 0.05) {
  /** @type {string[]} */
  const events = [];
  for (let guard = 0; monster.bossAttackPhase && guard < 100; guard += 1) {
    events.push(...updateBossAttackState(monster, step));
  }
  return events;
}

describe('Mushroom Brute Heavy Slam', () => {
  it('runs telegraph -> impact -> recovery -> complete with attack animation held throughout', () => {
    const monster = mushroomBrute();

    expect(beginBossAttackState(monster)).toMatchObject({
      telegraph: 0.82,
      active: 0.16,
      recovery: 0.42,
      cooldown: 1.62,
      hitRange: 72,
    });
    expect(monster.bossAttackPhase).toBe('telegraph');
    expect(monster.anim).toBe('attack');

    const events = runAttack(monster);

    expect(events).toEqual(['impact', 'recovery', 'complete']);
    expect(monster.bossAttackPhase).toBeNull();
    expect(monster.anim).toBe('walk');
    expect(getBossAttackProgress(monster)).toBe(1);
  });

  it('can execute Heavy Slam repeatedly after its unchanged cooldown expires', () => {
    const monster = mushroomBrute();

    for (let cycle = 0; cycle < 3; cycle += 1) {
      expect(beginBossAttackState(monster)).not.toBeNull();
      expect(runAttack(monster)).toEqual(['impact', 'recovery', 'complete']);
      monster.attackTimer = 0;
    }
  });

  it('does not start the boss attack for a non-boss or unsupported monster type', () => {
    expect(beginBossAttackState({ ...mushroomBrute(), isBoss: false })).toBeNull();
    expect(beginBossAttackState({ ...mushroomBrute(), monsterType: 'mossblob1' })).toBeNull();
  });

  it('keeps phase timing deterministic across a long frame without losing the impact event', () => {
    const monster = mushroomBrute();
    beginBossAttackState(monster);

    expect(updateBossAttackState(monster, 1)).toEqual(['impact', 'recovery']);
    expect(monster.bossAttackPhase).toBe('recovery');
    expect(monster.anim).toBe('attack');

    expect(updateBossAttackState(monster, 0.5)).toEqual(['complete']);
    expect(monster.bossAttackPhase).toBeNull();
  });
});
