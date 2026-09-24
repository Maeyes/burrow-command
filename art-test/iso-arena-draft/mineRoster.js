// Underground Mine roster — asset-backed only.
// Scope: roster/layout data only. Do not add combat FX or global-system behavior here.

export const MINE_BOSS_ROOT = '../ORIGINAL_underground_mine_BOSS/ORIGINAL_underground_mine_BOSS';

export const MINE_MONSTERS = {
  mineGoblin: {
    name: 'Mine Goblin',
    family: 'goblin',
    tier: 'normal',
    role: 'worker-melee',
    sheet: 'goblin',
    ambient: ['mining', 'dig', 'carry'],
  },
  goblinAxer: {
    name: 'Goblin Axer',
    family: 'goblin',
    tier: 'normal',
    role: 'aggressive-melee',
    sheet: 'goblin',
    presentation: 'axe',
    note: 'Role variant of the same Goblin asset; not a separate species.',
  },
  skeleton: {
    name: 'Skeleton',
    family: 'skeleton',
    tier: 'normal',
    role: 'undead-melee',
    sheet: 'skeleton',
  },
  goblinForeman: {
    name: 'Goblin Foreman',
    family: 'goblin',
    tier: 'elite',
    role: 'elite-placeholder',
    sheet: 'goblin',
    ambient: ['hammering'],
    note: 'Encounter role only until a distinct visual variant exists.',
  },
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
  title: 'Underground Mine',
  progression: [
    {
      id: 'working-mine',
      label: 'Goblin Mine',
      roster: ['mineGoblin', 'goblinAxer'],
      purpose: 'Establish the mine as an active goblin-controlled work area.',
    },
    {
      id: 'contested-depths',
      label: 'Goblin / Skeleton Overlap',
      roster: ['mineGoblin', 'goblinAxer', 'skeleton'],
      purpose: 'Introduce undead presence without replacing the goblin identity.',
    },
    {
      id: 'abandoned-deep-mine',
      label: 'Abandoned Deep Mine',
      roster: ['skeleton', 'goblinForeman'],
      purpose: 'Shift the dungeon toward danger and prepare the boss transition.',
    },
    {
      id: 'leader-chamber',
      label: 'Goblin Leader Chamber',
      roster: [],
      boss: 'goblinLeader',
      purpose: 'Dedicated final chamber; boss is not mixed into random spawns.',
    },
  ],
  pool: ['mineGoblin', 'goblinAxer', 'skeleton', 'goblinForeman'],
  bossType: 'goblinLeader',
  boss: 'Goblin Leader',
};
