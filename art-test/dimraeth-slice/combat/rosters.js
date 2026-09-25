// Roster adapter for the unified Dimraeth game page.
// Source data stays in iso-arena-draft roster modules; this file only normalizes it for the new renderer.
import { FOREST_ASSET_ROOT, FOREST_MONSTERS, FOREST_BOSSES, FOREST_MAPS } from '../../iso-arena-draft/forestRoster.js';
import { DESERT_ASSET_ROOT, DESERT_MONSTERS, DESERT_BOSSES, DESERT_MAPS } from '../../iso-arena-draft/desertRoster.js';
import { MAGMA_ASSET_ROOT, MAGMA_MONSTERS, MAGMA_BOSSES, MAGMA_MAPS } from '../../iso-arena-draft/magmaRoster.js';
import { SNOW_ASSET_ROOT, SNOW_MONSTERS, SNOW_BOSSES, SNOW_MAPS } from '../../iso-arena-draft/snowRoster.js';
import { SEA_ASSET_ROOT, SEA_MONSTERS, SEA_BOSSES, SEA_MAPS } from '../../iso-arena-draft/seaRoster.js';
import { ASGARD_ASSET_ROOT, ASGARD_MONSTERS, ASGARD_BOSSES, ASGARD_MAPS } from '../../iso-arena-draft/asgardRoster.js';
import { MINE_ASSET_ROOT, MINE_BOSS_ROOT, MINE_MONSTERS, MINE_BOSSES, MINE_MAP } from '../../iso-arena-draft/mineRoster.js';

const SOURCES = {
  forest: { id: 'forest', assetRoot: FOREST_ASSET_ROOT, monsters: FOREST_MONSTERS, bosses: FOREST_BOSSES, maps: FOREST_MAPS },
  desert: { id: 'desert', assetRoot: DESERT_ASSET_ROOT, monsters: DESERT_MONSTERS, bosses: DESERT_BOSSES, maps: DESERT_MAPS },
  magma: { id: 'magma', assetRoot: MAGMA_ASSET_ROOT, monsters: MAGMA_MONSTERS, bosses: MAGMA_BOSSES, maps: MAGMA_MAPS },
  snow: { id: 'snow', assetRoot: SNOW_ASSET_ROOT, monsters: SNOW_MONSTERS, bosses: SNOW_BOSSES, maps: SNOW_MAPS },
  underwater: { id: 'underwater', assetRoot: SEA_ASSET_ROOT, monsters: SEA_MONSTERS, bosses: SEA_BOSSES, maps: SEA_MAPS },
  asgard: { id: 'asgard', assetRoot: ASGARD_ASSET_ROOT, monsters: ASGARD_MONSTERS, bosses: ASGARD_BOSSES, maps: ASGARD_MAPS },
  mine: { id: 'mine', assetRoot: MINE_ASSET_ROOT, monsters: MINE_MONSTERS, bosses: MINE_BOSSES, map: MINE_MAP, bossRoot: MINE_BOSS_ROOT },
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

// Look up art for a monster id across every roster source (used by the Monster Index,
// which lists monsters from all maps, not just the active one).
export function presentationForMonsterId(monsterType) {
  for (const source of Object.values(SOURCES)) {
    if (!source.monsters?.[monsterType] && !source.bosses?.[monsterType]) continue;
    const displayName = id => source.monsters?.[id]?.name || source.bosses?.[id]?.name || id;
    const view = monsterPresentation({ id: source.id, source, displayName }, monsterType);
    if (view) return view;
  }
  return null;
}

export function monsterPresentation(roster, monsterType) {
  const source = roster.source;
  const normal = source.monsters?.[monsterType];
  const boss = source.bosses?.[monsterType];
  const asset = normal || boss;
  if (!asset) return null;

  if (roster.id === 'mine' && boss) {
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

  return {
    id: monsterType,
    name: roster.displayName(monsterType),
    elite: !!asset.elite,
    isBoss: !!boss,
    kind: 'sequence',
    count: asset.count || 1,
    scale: asset.scale || 1,
    frameSrc: i => `${source.assetRoot}/${asset.dir}/animations/${asset.anim}/unknown/frame_${String(i).padStart(3, '0')}.png`,
    // Optional attack clip; monsters without one fall back to the code tackle in game.js.
    attackCount: asset.attack ? (asset.attackCount || asset.count || 1) : 0,
    attackSrc: asset.attack ? i => `${source.assetRoot}/${asset.dir}/animations/${asset.attack}/unknown/frame_${String(i).padStart(3, '0')}.png` : null,
  };
}
