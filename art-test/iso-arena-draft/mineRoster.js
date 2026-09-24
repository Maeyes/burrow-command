// Underground Mine roster — asset-backed only.
// Scope: roster/layout data only. Do not add combat FX or global-system behavior here.

export const MINE_BOSS_ROOT = '../ORIGINAL_underground_mine_BOSS/ORIGINAL_underground_mine_BOSS';

export const MINE_ASSET_ROOT = '/art-test/monster-generation/pixellab-mine-roster-2026-09-24/objects';
const p = (n, anim, attack, extra = {}) => ({ dir: `ORIGINAL_tiny_mine_enemy_named${n > 1 ? '_' + n : ''}`, anim, attack, count: 9, ...extra });
const MOLE = ['walk', 'attack'];
const SKEL = ['The_character_shifts_its_weight_forward_with_a_rhy', null];
const GOB = ['The_goblin_rhythmically_shifts_its_weight_from_foo', null];

// PixelLab mine roster (2026-09-24). Replaces the Sunnyside Goblin/Skeleton sheets.
// Skeleton/Goblin workers have walk only; attack clips still to be generated.
export const MINE_MONSTERS = {
  emeraldMole: { ...p(1, ...MOLE), name: 'Emerald Mole', family: 'mole', tier: 'normal' },
  oreMole: { ...p(2, ...MOLE), name: 'Ore Mole', family: 'mole', tier: 'normal' },
  ironMole: { ...p(3, ...MOLE), name: 'Iron Mole', family: 'mole', tier: 'normal' },
  sapphireMole: { ...p(4, ...MOLE), name: 'Sapphire Mole', family: 'mole', tier: 'normal' },
  rubyMole: { ...p(5, ...MOLE), name: 'Ruby Mole', family: 'mole', tier: 'elite', elite: true },
  skeletonWorker: { ...p(6, ...SKEL), name: 'Skeleton Worker', family: 'skeleton', tier: 'normal' },
  skeletonMiner: { ...p(7, ...SKEL), name: 'Skeleton Miner', family: 'skeleton', tier: 'elite', elite: true },
  skeletonDigger: { ...p(8, ...SKEL), name: 'Skeleton Digger', family: 'skeleton', tier: 'normal' },
  goblinWorker: { ...p(9, ...GOB), name: 'Goblin Worker', family: 'goblin', tier: 'normal' },
  goblinDigger: { ...p(10, ...GOB), name: 'Goblin Digger', family: 'goblin', tier: 'normal' },
  // #11 has no walk clip yet: the wake-up loop stands in for movement.
  goblinForeman: { ...p(11, 'The_creature_slowly_stirs_from_a_deep_slumber_its', 'The_goblin_executes_a_forceful_downward_smash_wit'), name: 'Goblin Foreman', family: 'goblin', tier: 'elite', elite: true },
};

export const MINE_BOSSES = {
  goblinLeader: {
    name: 'Goblin Leader',
    tier: 'boss',
    role: 'mine-boss',
    dir: 'ORIGINAL_underground_mine_BOSS',
    base: 'rotations/ORIGINAL_underground_mine_BOSS.png',
    animations: {
      brutal: 'Animate_this_exact_Goblin_Leader_performing_BRUTAL',
      warSt: 'Animate_this_exact_Goblin_Leader_performing_WAR_ST',
      leader: 'Animate_this_exact_Goblin_Leader_performing_LEADER',
    },
    frameCount: 9,
    frameSize: 64,
  },
};

export const MINE_MAP = {
  id: 'undergroundMine',
  title: 'Gloomvein Mine',
  progression: [
    { id: 'working-mine', label: 'Goblin Mine', roster: ['goblinWorker', 'goblinDigger', 'oreMole', 'emeraldMole'] },
    { id: 'contested-depths', label: 'Goblin / Skeleton Overlap', roster: ['goblinDigger', 'skeletonWorker', 'ironMole', 'sapphireMole'] },
    { id: 'abandoned-deep-mine', label: 'Abandoned Deep Mine', roster: ['skeletonDigger', 'skeletonMiner', 'rubyMole', 'goblinForeman'] },
    { id: 'leader-chamber', label: 'Goblin Leader Chamber', roster: [], boss: 'goblinLeader' },
  ],
  pool: Object.keys(MINE_MONSTERS),
  bossType: 'goblinLeader',
  boss: 'Goblin Leader',
};
