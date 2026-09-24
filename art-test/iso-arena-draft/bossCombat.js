export const BOSS_ATTACK_CONFIG = Object.freeze({
  mushroom: Object.freeze({ telegraph: 0.82, active: 0.16, recovery: 0.42, cooldown: 1.62, hitRange: 72 }),
  thornroot: Object.freeze({ telegraph: 0.62, active: 0.16, recovery: 0.42, cooldown: 1.42, hitRange: 78 }),
  dunemaw: Object.freeze({ telegraph: 0.72, active: 0.16, recovery: 0.42, cooldown: 1.52, hitRange: 82 }),
  colossus: Object.freeze({ telegraph: 0.82, active: 0.16, recovery: 0.46, cooldown: 1.66, hitRange: 92 }),
  goblinLeader: Object.freeze({ telegraph: 0.68, active: 0.18, recovery: 0.42, cooldown: 1.48, hitRange: 84 }),
});

export function getBossAttackConfig(monsterType) {
  return BOSS_ATTACK_CONFIG[monsterType] ?? null;
}

export function beginBossAttackState(monster) {
  const config = getBossAttackConfig(monster.monsterType);
  if (!monster.isBoss || !config || monster.dead || monster.bossAttackPhase) return null;

  monster.bossAttackPhase = 'telegraph';
  monster.bossAttackTimer = config.telegraph;
  monster.bossAttackElapsed = 0;
  monster.bossAttackDuration = config.telegraph + config.active + config.recovery;
  monster.bossAttackHit = false;
  monster.attackTimer = config.cooldown;
  monster.anim = 'attack';
  return config;
}

export function updateBossAttackState(monster, dt) {
  const config = getBossAttackConfig(monster.monsterType);
  if (!config || !monster.bossAttackPhase) return [];

  monster.anim = 'attack';
  monster.bossAttackElapsed = Math.min(monster.bossAttackDuration, (monster.bossAttackElapsed ?? 0) + dt);
  monster.bossAttackTimer -= dt;

  const events = [];
  while (monster.bossAttackPhase && monster.bossAttackTimer <= 0) {
    const overflow = -monster.bossAttackTimer;
    if (monster.bossAttackPhase === 'telegraph') {
      monster.bossAttackPhase = 'active';
      monster.bossAttackTimer = config.active - overflow;
      events.push('impact');
    } else if (monster.bossAttackPhase === 'active') {
      monster.bossAttackPhase = 'recovery';
      monster.bossAttackTimer = config.recovery - overflow;
      events.push('recovery');
    } else {
      monster.bossAttackPhase = null;
      monster.bossAttackTimer = 0;
      monster.bossAttackElapsed = monster.bossAttackDuration;
      monster.bossAttackHit = false;
      monster.anim = 'walk';
      events.push('complete');
    }
  }
  return events;
}

export function getBossAttackProgress(monster) {
  if (!monster.bossAttackDuration) return 0;
  return Math.max(0, Math.min(1, (monster.bossAttackElapsed ?? 0) / monster.bossAttackDuration));
}
