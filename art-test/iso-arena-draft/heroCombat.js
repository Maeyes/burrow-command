export const HERO_DIRECTIONS = Object.freeze([
  'south', 'south-east', 'east', 'north-east',
  'north', 'north-west', 'west', 'south-west',
]);

export const HERO_NATIVE_DIRECTIONS = Object.freeze([
  'south', 'south-east', 'east', 'north-east', 'north',
]);

const DAGGER_DIRECTION_ASSETS = Object.freeze({
  south: Object.freeze({ direction: 'south', flipX: false }),
  'south-east': Object.freeze({ direction: 'south-east', flipX: false }),
  east: Object.freeze({ direction: 'east', flipX: false }),
  'north-east': Object.freeze({ direction: 'north-east', flipX: false }),
  north: Object.freeze({ direction: 'north', flipX: false }),
  'north-west': Object.freeze({ direction: 'north-east', flipX: true }),
  west: Object.freeze({ direction: 'east', flipX: true }),
  'south-west': Object.freeze({ direction: 'south-east', flipX: true }),
});

export const SWORD_ATTACK_01 = Object.freeze({
  animationId: 'hero_sword_attack_01',
  weaponFamily: 'sword',
  attackName: 'diagonal-slash',
  frames: 8,
  fps: 12,
  startupFrames: 3,
  activeFrames: Object.freeze([3, 4]),
  impactFrame: 4,
  recoveryFrames: 3,
  loop: false,
  impactPoseMinimumMs: 32,
  directions: HERO_DIRECTIONS,
  assetStatus: 'missing-pixellab-generation',
  fxEvents: Object.freeze([
    Object.freeze({ frame: 3, type: 'weaponTrail', fxId: 'sword-medium-slash-trail' }),
    Object.freeze({ frame: 4, type: 'gameplayImpact' }),
    Object.freeze({ frame: 4, type: 'impactSpark', fxId: 'sword-small-sharp-impact' }),
  ]),
});

export const DAGGER_ATTACK_01 = Object.freeze({
  animationId: 'hero_dagger_attack_01',
  weaponFamily: 'dagger',
  attackName: 'cross-slash',
  frames: 6,
  fps: 16,
  startupFrames: 2,
  activeFrames: Object.freeze([2, 3]),
  impactFrame: 3,
  recoveryFrames: 2,
  loop: false,
  impactPoseMinimumMs: 24,
  directions: HERO_DIRECTIONS,
  authoredDirections: HERO_NATIVE_DIRECTIONS,
  directionAssets: DAGGER_DIRECTION_ASSETS,
  assetStatus: 'approved',
  fxEvents: Object.freeze([
    Object.freeze({ frame: 2, type: 'weaponTrail', fxId: 'dagger-cross-streak' }),
    Object.freeze({ frame: 3, type: 'gameplayImpact' }),
    Object.freeze({ frame: 3, type: 'impactSpark', fxId: 'dagger-small-sharp-impact' }),
  ]),
});

export const weaponAnimations = Object.freeze({
  sword: Object.freeze({ attack_01: SWORD_ATTACK_01 }),
  dagger: Object.freeze({ attack_01: DAGGER_ATTACK_01 }),
});

export function validateAnimationDefinition(definition) {
  if (!definition || !Number.isInteger(definition.frames) || definition.frames < 2) return false;
  if (!(definition.fps > 0)) return false;
  if (!Number.isInteger(definition.impactFrame) || definition.impactFrame < 0 || definition.impactFrame >= definition.frames) return false;
  if (definition.startupFrames + definition.recoveryFrames > definition.frames) return false;
  if (!Array.isArray(definition.activeFrames) || !definition.activeFrames.includes(definition.impactFrame)) return false;
  if (!Array.isArray(definition.directions) || definition.directions.length !== 8) return false;
  return definition.fxEvents.every((event) => Number.isInteger(event.frame) && event.frame >= 0 && event.frame < definition.frames);
}

export function authoredDurationMs(definition) {
  return definition.frames / definition.fps * 1000;
}

export function playbackRateForAttackInterval(definition, attackIntervalMs) {
  if (!(attackIntervalMs > 0)) return 1;
  return Math.max(1, authoredDurationMs(definition) / attackIntervalMs);
}

export function createHeroAttackPlayback(definition = SWORD_ATTACK_01) {
  if (!validateAnimationDefinition(definition)) throw new Error(`Invalid hero combat animation: ${definition?.animationId ?? 'unknown'}`);
  return {
    definition,
    active: false,
    elapsedAuthoredMs: 0,
    frame: 0,
    playbackRate: 1,
    firedEvents: new Set(),
    payload: null,
    forcedFrame: null,
    forcedFrameRemainingMs: 0,
  };
}

export function beginHeroAttack(playback, options = {}) {
  const definition = options.definition ?? playback.definition;
  if (!validateAnimationDefinition(definition)) throw new Error(`Invalid hero combat animation: ${definition?.animationId ?? 'unknown'}`);
  playback.definition = definition;
  playback.active = true;
  playback.elapsedAuthoredMs = 0;
  playback.frame = 0;
  playback.playbackRate = playbackRateForAttackInterval(definition, options.attackIntervalMs);
  playback.firedEvents = new Set();
  playback.payload = options.payload ?? null;
  playback.forcedFrame = null;
  playback.forcedFrameRemainingMs = 0;
  return playback;
}

export function cancelHeroAttack(playback) {
  playback.active = false;
  playback.elapsedAuthoredMs = 0;
  playback.frame = 0;
  playback.firedEvents = new Set();
  playback.payload = null;
  playback.forcedFrame = null;
  playback.forcedFrameRemainingMs = 0;
  return playback;
}

export function updateHeroAttackPlayback(playback, deltaMs) {
  if (!playback.active || !(deltaMs > 0)) return [];
  const definition = playback.definition;
  // Treat the initial pose as being before frame 0. Using frame 0 here skipped any
  // frame-0 event and made boundary crossing dependent on the first render delta.
  const previousFrame = playback.elapsedAuthoredMs <= 0 ? -1 : Math.floor(playback.elapsedAuthoredMs * definition.fps / 1000);
  playback.elapsedAuthoredMs += deltaMs * playback.playbackRate;
  const rawFrame = Math.floor(playback.elapsedAuthoredMs * definition.fps / 1000);
  const currentFrame = Math.min(definition.frames - 1, rawFrame);
  const events = [];

  for (const event of definition.fxEvents) {
    const key = `${event.frame}:${event.type}:${event.fxId ?? ''}`;
    if (event.frame > previousFrame && event.frame <= rawFrame && !playback.firedEvents.has(key)) {
      playback.firedEvents.add(key);
      events.push({ ...event, animationId: definition.animationId, payload: playback.payload });
      if (event.frame === definition.impactFrame) {
        playback.forcedFrame = definition.impactFrame;
        playback.forcedFrameRemainingMs = definition.impactPoseMinimumMs ?? 0;
      }
    }
  }

  if (playback.forcedFrameRemainingMs > 0) {
    playback.forcedFrameRemainingMs = Math.max(0, playback.forcedFrameRemainingMs - deltaMs);
    playback.frame = playback.forcedFrame;
  } else {
    playback.forcedFrame = null;
    playback.frame = currentFrame;
  }

  if (rawFrame >= definition.frames) {
    playback.active = false;
    playback.frame = 0;
    playback.payload = null;
    events.push({ type: 'animationComplete', animationId: definition.animationId });
  }
  return events;
}

export function directionForIndex(directionIndex) {
  return HERO_DIRECTIONS[((directionIndex % 8) + 8) % 8];
}

export function heroCombatDirectionAsset(definition, direction) {
  if (!definition.directions.includes(direction)) throw new Error(`Unsupported direction: ${direction}`);
  return definition.directionAssets?.[direction] ?? { direction, flipX: false };
}

export function heroCombatFramePath(definition, direction, frame) {
  const asset = heroCombatDirectionAsset(definition, direction);
  if (!Number.isInteger(frame) || frame < 0 || frame >= definition.frames) throw new Error(`Invalid frame: ${frame}`);
  return `../isometric-player/combat/${definition.weaponFamily}/${definition.attackName}/${asset.direction}/frame_${String(frame).padStart(3, '0')}.png`;
}
