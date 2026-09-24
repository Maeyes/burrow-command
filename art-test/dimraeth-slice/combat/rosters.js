// Roster adapter for the unified Dimraeth game page.
// Source data stays in iso-arena-draft roster modules; this file only normalizes it for the new renderer.
import { FOREST_ASSET_ROOT, FOREST_MONSTERS, FOREST_BOSSES, FOREST_MAPS } from '../../iso-arena-draft/forestRoster.js';
import { DESERT_ASSET_ROOT, DESERT_MONSTERS, DESERT_BOSSES, DESERT_MAPS } from '../../iso-arena-draft/desertRoster.js';
import { MINE_BOSS_ROOT, MINE_MONSTERS, MINE_BOSSES, MINE_MAP } from '../../iso-arena-draft/mineRoster.js';

const SUNNYSIDE_ROOT = '/Sunnyside_World_Assets';

const SOURCES = {
  forest: { id: 'forest', assetRoot: FOREST_ASSET_ROOT, monsters: FOREST_MONSTERS, bosses: FOREST_BOSSES, maps: FOREST_MAPS },
  desert: { id: 'desert', assetRoot: DESERT_ASSET_ROOT, monsters: DESERT_MONSTERS, bosses: DESERT_BOSSES, maps: DESERT_MAPS },
  mine: { id: 'mine', monsters: MINE_MONSTERS, bosses: MINE_BOSSES, map: MINE_MAP, bossRoot: MINE_BOSS_ROOT },
};

export const ROSTER_IDS = Object.freeze(Object.keys(SOURCES));

export function chooseRosterId(mapRoster, biome) {
  if (mapRoster && SOURCES[mapRoster]) return mapRoster;
  if (biome && SOURCES[biome]) return biome;
  return 'forest';
}

function mapFor(source, mapId) {
  if (source.map) return source.map;
  if (source.maps?.[mapId]) return source.maps[mapId];
  return source.maps ? Object.values(source.maps)[0] : null;
}

function bossTypeFor(source, mapId, mapInfo) {
  if (mapInfo?.bossType && source.bosses?.[mapInfo.bossType]) return mapInfo.bossType;
  if (!source.maps || !source.bosses || !source.maps[mapId]) return null;
  const mapKeys = Object.keys(source.maps), bossKeys = Object.keys(source.bosses);
  const index = mapKeys.indexOf(mapId);
  return index >= 0 ? (bossKeys[index] ?? null) : null;
}

export function getRoster(rosterId, mapId = '') {
  const source = SOURCES[rosterId] || SOURCES.forest;
  const mapInfo = mapFor(source, mapId);
  const pool = Array.isArray(mapInfo?.pool) && mapInfo.pool.length ? [...mapInfo.pool] : Object.keys(source.monsters);
  const bossType = bossTypeFor(source, mapId, mapInfo);
  const displayName = id => source.monsters[id]?.name || source.bosses[id]?.name || (id === bossType ? mapInfo?.boss : null) || id;

  return {
    id: source.id,
    source,
    mapId,
    mapInfo,
    pool,
    bossType,
    title: mapInfo?.title || source.id,
    displayName,
    monsterIds: [...new Set([...pool, ...(bossType ? [bossType] : [])])],
  };
}

export function monsterPresentation(roster, monsterType) {
  const source = roster.source;
  const normal = source.monsters?.[monsterType];
  const boss = source.bosses?.[monsterType];
  const asset = normal || boss;
  if (!asset) return null;

  if (roster.id === 'mine') {
    if (boss) {
      const animation = boss.animations?.leader;
      if (!animation) return null;
      return {
        id: monsterType,
        name: roster.displayName(monsterType),
        elite: false,
        isBoss: true,
        kind: 'sequence',
        count: boss.frameCount || 1,
        frameSrc: i => `${source.bossRoot}/animations/${animation}/unknown/frame_${String(i).padStart(3, '0')}.png`,
      };
    }
    const skeleton = asset.sheet === 'skeleton';
    return {
      id: monsterType,
      name: roster.displayName(monsterType),
      elite: asset.tier === 'elite',
      isBoss: false,
      kind: 'sheet',
      count: 8,
      sheetSrc: skeleton
        ? `${SUNNYSIDE_ROOT}/Characters/Skeleton/PNG/skeleton_walk_strip8.png`
        : `${SUNNYSIDE_ROOT}/Characters/Goblin/PNG/spr_walk_strip8.png`,
    };
  }

  return {
    id: monsterType,
    name: roster.displayName(monsterType),
    elite: !!asset.elite,
    isBoss: !!boss,
    kind: 'sequence',
    count: asset.count || 1,
    frameSrc: i => `${source.assetRoot}/${asset.dir}/animations/${asset.anim}/unknown/frame_${String(i).padStart(3, '0')}.png`,
  };
}
