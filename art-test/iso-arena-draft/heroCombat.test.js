import { describe, expect, it } from 'vitest';
import {
  DAGGER_ATTACK_01,
  SWORD_ATTACK_01,
  authoredDurationMs,
  beginHeroAttack,
  createHeroAttackPlayback,
  directionForIndex,
  heroCombatDirectionAsset,
  heroCombatFramePath,
  playbackRateForAttackInterval,
  updateHeroAttackPlayback,
  validateAnimationDefinition,
} from './heroCombat.js';

describe('hero combat animation playback', () => {
  it('validates the Sword reference definition and all eight directions', () => {
    expect(validateAnimationDefinition(SWORD_ATTACK_01)).toBe(true);
    expect(SWORD_ATTACK_01.directions).toHaveLength(8);
    expect(directionForIndex(0)).toBe('south');
    expect(directionForIndex(7)).toBe('south-west');
  });

  it('fires trail and authoritative impact events exactly once even when frames are skipped', () => {
    const playback = createHeroAttackPlayback();
    const payload = { targetId: 'monster-1', damage: 18 };
    beginHeroAttack(playback, { attackIntervalMs: 480, payload });
    const events = updateHeroAttackPlayback(playback, 260);
    expect(events.map((event) => event.type)).toEqual(['weaponTrail', 'gameplayImpact', 'impactSpark']);
    expect(events[1].payload).toBe(payload);
    expect(updateHeroAttackPlayback(playback, 20)).toEqual([]);
  });

  it('scales authored timing to high ASPD intervals without dropping impact', () => {
    expect(authoredDurationMs(SWORD_ATTACK_01)).toBeCloseTo(666.67, 1);
    expect(playbackRateForAttackInterval(SWORD_ATTACK_01, 140)).toBeGreaterThan(4);
    const playback = createHeroAttackPlayback();
    beginHeroAttack(playback, { attackIntervalMs: 140 });
    const types = [];
    for (let elapsed = 0; elapsed < 200; elapsed += 16) {
      types.push(...updateHeroAttackPlayback(playback, 16).map((event) => event.type));
    }
    expect(types.filter((type) => type === 'gameplayImpact')).toHaveLength(1);
    expect(types).toContain('animationComplete');
    expect(playback.active).toBe(false);
  });

  it('builds deterministic direction/frame paths without mirroring', () => {
    expect(heroCombatFramePath(SWORD_ATTACK_01, 'north-west', 4))
      .toBe('../isometric-player/combat/sword/diagonal-slash/north-west/frame_004.png');
    expect(() => heroCombatFramePath(SWORD_ATTACK_01, 'side', 0)).toThrow('Unsupported direction');
  });

  it('registers the approved dagger cross slash and mirrors only runtime-safe directions', () => {
    expect(validateAnimationDefinition(DAGGER_ATTACK_01)).toBe(true);
    expect(DAGGER_ATTACK_01.frames).toBe(6);
    expect(DAGGER_ATTACK_01.impactFrame).toBe(3);
    expect(heroCombatDirectionAsset(DAGGER_ATTACK_01, 'north-west'))
      .toEqual({ direction: 'north-east', flipX: true });
    expect(heroCombatFramePath(DAGGER_ATTACK_01, 'south-west', 3))
      .toBe('../isometric-player/combat/dagger/cross-slash/south-east/frame_003.png');
  });
});
