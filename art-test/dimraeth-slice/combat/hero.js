import blessedManifest from '../../isometric-player/blessed-bunny/manifest.json';

const FRAME_URLS = import.meta.glob('../../isometric-player/blessed-bunny/**/*.png', {
  query: '?url',
  import: 'default',
});

export const BLESSED_ATTACK_FAMILIES = Object.freeze([
  'greatsword', 'dagger', 'axe', 'hammer', 'bow', 'swordShield',
]);

export const HERO_DIRECTIONS = Object.freeze([
  'north', 'north-east', 'east', 'south-east',
  'south', 'south-west', 'west', 'north-west',
]);

const NATIVE_DIRECTION = Object.freeze({
  south: ['south', false],
  'south-east': ['south-east', false],
  east: ['east', false],
  'north-east': ['north-east', false],
  north: ['north', false],
  'north-west': ['north-east', true],
  west: ['east', true],
  'south-west': ['south-east', true],
});

const ATTACK_ANIM = Object.freeze({
  greatsword: 'atk_greatsword',
  dagger: 'atk_dagger',
  axe: 'atk_axe',
  hammer: 'atk_hammer',
  bow: 'atk_bow',
  swordShield: 'atk_swordShield',
});

const REQUIRED_ANIMS = Object.freeze([
  'idle', 'walk', 'run', 'hurt', 'death',
  ...Object.values(ATTACK_ANIM),
]);

const HURT_SECONDS = 0.36;
const DEATH_SECONDS = 1.1;
const DEFAULT_ATTACK_SECONDS = 0.375;

function frameKey(anim, direction, index) {
  return `../../isometric-player/blessed-bunny/${anim}/${direction}/frame_${String(index).padStart(3, '0')}.png`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Blessed Bunny frame failed to load: ${src}`));
    image.src = src;
  });
}

async function loadDirection(anim, direction) {
  const [nativeDirection, flipX] = NATIVE_DIRECTION[direction];
  const meta = blessedManifest?.[anim]?.[nativeDirection];
  if (!meta) throw new Error(`Blessed Bunny manifest missing ${anim}/${nativeDirection}`);

  const frames = await Promise.all(Array.from({ length: meta.frames }, async (_, index) => {
    const resolveUrl = FRAME_URLS[frameKey(anim, nativeDirection, index)];
    if (!resolveUrl) throw new Error(`Blessed Bunny frame missing from Vite asset graph: ${frameKey(anim, nativeDirection, index)}`);
    return loadImage(await resolveUrl());
  }));

  return {
    frames,
    flipX,
    footY: meta.footY,
    width: meta.w,
    height: meta.h,
    nativeDirection,
  };
}

async function loadAnimation(anim) {
  const entries = await Promise.all(HERO_DIRECTIONS.map(async direction => [
    direction,
    await loadDirection(anim, direction),
  ]));
  return Object.fromEntries(entries);
}

function clampFrame(index, count) {
  return Math.max(0, Math.min(count - 1, index));
}

function frameByTime(set, fps, nowMs) {
  return set.frames[Math.floor(nowMs / (1000 / fps)) % set.frames.length];
}

function visualOf(set, image, extra = {}) {
  return { image, flipX: set.flipX, footY: set.footY, ...extra };
}

function attackDefinition(family, direction) {
  const anim = ATTACK_ANIM[family];
  if (!anim) {
    // Staff has no authored Blessed Bunny attack. Keep timing + code slash only.
    return {
      animationId: 'blessed_staff_attack',
      weaponFamily: 'staff',
      attackName: 'staff-code-slash',
      frames: 6,
      fps: 16,
      startupFrames: 2,
      activeFrames: [2, 3],
      impactFrame: 3,
      recoveryFrames: 2,
      loop: false,
      impactPoseMinimumMs: 24,
      directions: HERO_DIRECTIONS,
      fxEvents: [
        { frame: 2, type: 'weaponTrail', fxId: 'staff-code-slash' },
        { frame: 3, type: 'gameplayImpact' },
      ],
    };
  }

  const [nativeDirection] = NATIVE_DIRECTION[direction] || NATIVE_DIRECTION.south;
  const count = blessedManifest[anim][nativeDirection].frames;
  const impactFrame = Math.max(1, Math.min(count - 2, Math.floor(count * 0.5)));
  const startupFrames = impactFrame;
  const recoveryFrames = Math.max(1, count - impactFrame - 1);

  return {
    animationId: `blessed_${anim}_${nativeDirection}`,
    weaponFamily: family,
    attackName: anim,
    frames: count,
    fps: count / DEFAULT_ATTACK_SECONDS,
    startupFrames,
    activeFrames: [impactFrame],
    impactFrame,
    recoveryFrames,
    loop: false,
    impactPoseMinimumMs: 24,
    directions: HERO_DIRECTIONS,
    // Baked Blessed Bunny attacks already include weapon + slash arc.
    fxEvents: [{ frame: impactFrame, type: 'gameplayImpact' }],
  };
}

/** @type {Promise<any>|null} */
let blessedHeroPromise = null;

async function createBlessedHero() {
  const loaded = Object.fromEntries(await Promise.all(REQUIRED_ANIMS.map(async anim => [
    anim,
    await loadAnimation(anim),
  ])));

  let hurtRemaining = 0;
  let dead = false;
  let deathElapsed = 0;

  return {
    manifest: blessedManifest,
    animations: loaded,

    attackDefinition,

    hurt() {
      if (!dead) hurtRemaining = HURT_SECONDS;
    },

    die() {
      dead = true;
      deathElapsed = 0;
      hurtRemaining = 0;
    },

    respawn() {
      dead = false;
      deathElapsed = 0;
      hurtRemaining = 0;
    },

    update(dt) {
      const delta = Math.max(0, Number(dt) || 0);
      hurtRemaining = Math.max(0, hurtRemaining - delta);
      if (dead) deathElapsed += delta;
    },

    getState() {
      return { hurtRemaining, dead, deathElapsed };
    },

    visual({ direction = 'south', moving = false, running = false, playback = null, weaponFamily = 'dagger', nowMs = performance.now() } = {}) {
      const dir = NATIVE_DIRECTION[direction] ? direction : 'south';

      if (dead) {
        const set = loaded.death[dir];
        const frame = clampFrame(Math.floor((deathElapsed / DEATH_SECONDS) * set.frames.length), set.frames.length);
        return visualOf(set, set.frames[frame], { state: 'death' });
      }

      if (hurtRemaining > 0 && !playback?.active) {
        const set = loaded.hurt[dir];
        const progress = 1 - hurtRemaining / HURT_SECONDS;
        const frame = clampFrame(Math.floor(progress * set.frames.length), set.frames.length);
        return visualOf(set, set.frames[frame], { state: 'hurt' });
      }

      const attackAnim = ATTACK_ANIM[weaponFamily];
      if (playback?.active && attackAnim) {
        const set = loaded[attackAnim][dir];
        const playbackCount = Math.max(1, playback.definition?.frames || set.frames.length);
        const frame = clampFrame(Math.floor((playback.frame / playbackCount) * set.frames.length), set.frames.length);
        return visualOf(set, set.frames[frame], { state: attackAnim });
      }

      if (playback?.active && weaponFamily === 'staff') {
        const set = loaded.idle[dir];
        return visualOf(set, frameByTime(set, 7, nowMs), {
          state: 'staff-attack',
          slashArc: true,
          slashDirection: dir,
          slashProgress: Math.max(0, Math.min(1, (playback.frame + 1) / Math.max(1, playback.definition?.frames || 6))),
        });
      }

      if (moving) {
        const anim = running ? 'run' : 'walk';
        const set = loaded[anim][dir];
        return visualOf(set, frameByTime(set, running ? 12 : 9, nowMs), { state: anim });
      }

      const set = loaded.idle[dir];
      return visualOf(set, frameByTime(set, 7, nowMs), { state: 'idle' });
    },
  };
}

export function loadBlessedHero() {
  blessedHeroPromise ||= createBlessedHero();
  return blessedHeroPromise;
}

export function directionForIndex(index) {
  return HERO_DIRECTIONS[((Number(index) || 0) % 8 + 8) % 8];
}

export function hasBakedAttack(family) {
  return BLESSED_ATTACK_FAMILIES.includes(family);
}
