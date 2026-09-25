// Snow roster (PixelLab 2026-09-25). Each species = 3 variants, one elite; captain/king/elder species are all elite.
// Art lives in one folder per map, so each entry carries its own root.
const R = '/art-test/monster-generation';
const p = (map, dir, anim, attack = null, count = 9) => ({ dir: `pixellab-${map}-roster-2026-09-25/objects/${dir}`, anim, attack, count });
export const SNOW_ASSET_ROOT = R;

export const SNOW_MONSTERS = {
  snowFox: { ...p('snow1', 'Snow_Fox_1', 'walk', 'attack'), name: 'Snow Fox' },
  frostFox: { ...p('snow1', 'Snow_Fox_2', 'walk', 'attack'), name: 'Frost Fox', elite: true },
  mammoth: { ...p('snow1', 'Mammoth_1', 'walk', 'attack'), name: 'Mammoth' },
  woollyMammoth: { ...p('snow1', 'Mammoth_2', 'walk', 'attack'), name: 'Woolly Mammoth' },
  eliteMammoth: { ...p('snow1', 'Mammoth_3', 'walk', 'attack'), name: 'Elite Mammoth', elite: true },
  yeti: { ...p('snow1', 'Yeti_1', 'walk', 'attack'), name: 'Yeti' },
  frostYeti: { ...p('snow1', 'Yeti_2', 'walk', 'attack'), name: 'Frost Yeti' },
  eliteYeti: { ...p('snow1', 'Yeti_3', 'walk', 'attack'), name: 'Elite Yeti', elite: true },
  elderMammoth: { ...p('snow1', 'Elder_Mammoth_1', 'walk', 'attack'), name: 'Elder Mammoth', elite: true },
  glacialElder: { ...p('snow1', 'Elder_Mammoth_2', 'walk', 'attack'), name: 'Glacial Elder', elite: true },
  ancientElder: { ...p('snow1', 'Elder_Mammoth_3', 'walk', 'attack'), name: 'Ancient Elder', elite: true },
  frostWolf: { ...p('snow2', 'Frost_Wolf_1', 'walk', 'attack'), name: 'Frost Wolf' },
  rimeWolf: { ...p('snow2', 'Frost_Wolf_2', 'walk', 'attack'), name: 'Rime Wolf' },
  eliteFrostWolf: { ...p('snow2', 'Frost_Wolf_3', 'walk', 'attack'), name: 'Elite Frost Wolf', elite: true },
  iceWraith: { ...p('snow2', 'Ice_Wraith_1', 'walk', 'attack'), name: 'Ice Wraith' },
  frostWraith: { ...p('snow2', 'Ice_Wraith_2', 'walk', 'attack'), name: 'Frost Wraith' },
  eliteIceWraith: { ...p('snow2', 'Ice_Wraith_3', 'walk', 'attack'), name: 'Elite Ice Wraith', elite: true },
  snowTroll: { ...p('snow2', 'Snow_Troll_1', 'walk', 'attack'), name: 'Snow Troll' },
  iceTroll: { ...p('snow2', 'Snow_Troll_2', 'walk', 'attack'), name: 'Ice Troll' },
  eliteSnowTroll: { ...p('snow2', 'Snow_Troll_3', 'walk', 'attack'), name: 'Elite Snow Troll', elite: true },
  frostGiantJunior: { ...p('snow2', 'Frost_Giant_Junior_1', 'walk', 'attack'), name: 'Frost Giant Junior', elite: true },
};

export const SNOW_BOSSES = {
  iceTrollKing: { ...p('snow-bosses', 'Ice_Troll_Boss', 'walk', 'skill1'), name: 'Grimhollow, the Ice Troll King', skills: ["skill2", "skill3", "skill4"] },
  frostGiantLord: { ...p('snow-bosses', 'Frost_Giant_Boss', 'walk', 'skill1'), name: 'Ymirax, the Frost Giant', skills: ["skill2", "skill3", "skill4"] },
};

export const SNOW_MAPS = {
  snow1: { title: 'Frostfang Tundra', level: 'Lv. 71–80', boss: 'Grimhollow, the Ice Troll King', bossType: 'iceTrollKing',
    pool: ["snowFox", "frostFox", "mammoth", "woollyMammoth", "eliteMammoth", "yeti", "frostYeti", "eliteYeti", "elderMammoth", "glacialElder", "ancientElder"] },
  snow2: { title: 'Rimeheart Glacier', level: 'Lv. 81–90', boss: 'Ymirax, the Frost Giant', bossType: 'frostGiantLord',
    pool: ["frostWolf", "rimeWolf", "eliteFrostWolf", "iceWraith", "frostWraith", "eliteIceWraith", "snowTroll", "iceTroll", "eliteSnowTroll", "frostGiantJunior"] },
};
