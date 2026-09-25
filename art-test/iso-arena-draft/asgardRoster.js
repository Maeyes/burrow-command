// Asgard roster (PixelLab 2026-09-25). Each species = 3 variants, one elite; captain/king/elder species are all elite.
// Art lives in one folder per map, so each entry carries its own root.
const R = '/art-test/monster-generation';
const p = (map, dir, anim, attack = null, count = 9) => ({ dir: `pixellab-${map}-roster-2026-09-25/objects/${dir}`, anim, attack, count });
export const ASGARD_ASSET_ROOT = R;

export const ASGARD_MONSTERS = {
  stormRaven: { ...p('asgard1', 'Storm_Raven_1', 'walk', 'attack'), name: 'Storm Raven' },
  thunderRaven: { ...p('asgard1', 'Storm_Raven_2', 'walk', 'attack'), name: 'Thunder Raven' },
  eliteStormRaven: { ...p('asgard1', 'Storm_Raven_3', 'walk', 'attack'), name: 'Elite Storm Raven', elite: true },
  einherjar: { ...p('asgard1', 'Einherjar_1', 'walk', 'attack'), name: 'Einherjar' },
  shieldEinherjar: { ...p('asgard1', 'Einherjar_2', 'walk', 'attack'), name: 'Shield Einherjar' },
  eliteEinherjar: { ...p('asgard1', 'Einherjar_3', 'walk', 'attack'), name: 'Elite Einherjar', elite: true },
  runeSentinel: { ...p('asgard1', 'Rune_Sentinel_1', 'walk', 'attack'), name: 'Rune Sentinel' },
  stoneSentinel: { ...p('asgard1', 'Rune_Sentinel_2', 'walk', 'attack'), name: 'Stone Sentinel' },
  eliteRuneSentinel: { ...p('asgard1', 'Rune_Sentinel_3', 'walk', 'attack'), name: 'Elite Rune Sentinel', elite: true },
  valkyrie: { ...p('asgard1', 'Valkyrie_1', 'walk', 'attack'), name: 'Valkyrie' },
  shieldmaiden: { ...p('asgard1', 'Valkyrie_2', 'walk', 'attack'), name: 'Shieldmaiden' },
  eliteValkyrie: { ...p('asgard1', 'Valkyrie_3', 'walk', 'attack'), name: 'Elite Valkyrie', elite: true },
  fenrirPup: { ...p('asgard2', 'Fenrir_Pup_1', 'walk', 'attack'), name: 'Fenrir Pup' },
  shadowFenrirPup: { ...p('asgard2', 'Fenrir_Pup_2', 'walk', 'attack'), name: 'Shadow Fenrir Pup' },
  eliteFenrirPup: { ...p('asgard2', 'Fenrir_Pup_3', 'walk', 'attack'), name: 'Elite Fenrir Pup', elite: true },
  sleipnirSpawn: { ...p('asgard2', 'Sleipnir_Spawn_1', 'walk', 'attack'), name: 'Sleipnir Spawn' },
  royalSleipnir: { ...p('asgard2', 'Sleipnir_Spawn_2', 'walk', 'attack'), name: 'Royal Sleipnir' },
  eliteSleipnirSpawn: { ...p('asgard2', 'Sleipnir_Spawn_3', 'walk', 'attack'), name: 'Elite Sleipnir Spawn', elite: true },
  goldenEinherjar: { ...p('asgard2', 'Golden_Einherjar_1', 'walk', 'attack'), name: 'Golden Einherjar' },
  gildedEinherjar: { ...p('asgard2', 'Golden_Einherjar_2', 'walk', 'attack'), name: 'Gilded Einherjar' },
  eliteGoldenEinherjar: { ...p('asgard2', 'Golden_Einherjar_3', 'walk', 'attack'), name: 'Elite Golden Einherjar', elite: true },
  runeColossus: { ...p('asgard2', 'Rune_Colossus_1', 'walk', 'attack'), name: 'Rune Colossus' },
  graniteColossus: { ...p('asgard2', 'Rune_Colossus_2', 'walk', 'attack'), name: 'Granite Colossus' },
  eliteRuneColossus: { ...p('asgard2', 'Rune_Colossus_3', 'walk', 'attack'), name: 'Elite Rune Colossus', elite: true },
  valkyrieCaptain: { ...p('asgard2', 'Valkyrie_Captain_1', 'walk', 'attack'), name: 'Valkyrie Captain', elite: true },
  stormCaptain: { ...p('asgard2', 'Valkyrie_Captain_2', 'walk', 'attack'), name: 'Storm Captain', elite: true },
  skyCaptain: { ...p('asgard2', 'Valkyrie_Captain_3', 'walk', 'attack'), name: 'Sky Captain', elite: true },
};

export const ASGARD_BOSSES = {
  thor: { ...p('asgard1', 'Boss_Thor', 'walk', 'skill1'), name: 'Thor, the Thunderer', skills: ["skill2", "skill3"] },
  odin: { ...p('asgard2', 'Boss_Odin', 'walk', 'skill1'), name: 'Odin, the Allfather', skills: ["skill2", "skill3"] },
};

export const ASGARD_MAPS = {
  asgard1: { title: 'Bifrost Heights', level: 'Lv. 111–120', boss: 'Thor, the Thunderer', bossType: 'thor',
    pool: ["stormRaven", "thunderRaven", "eliteStormRaven", "einherjar", "shieldEinherjar", "eliteEinherjar", "runeSentinel", "stoneSentinel", "eliteRuneSentinel", "valkyrie", "shieldmaiden", "eliteValkyrie"] },
  asgard2: { title: 'Valhalla', level: 'Lv. 120', boss: 'Odin, the Allfather', bossType: 'odin',
    pool: ["fenrirPup", "shadowFenrirPup", "eliteFenrirPup", "sleipnirSpawn", "royalSleipnir", "eliteSleipnirSpawn", "goldenEinherjar", "gildedEinherjar", "eliteGoldenEinherjar", "runeColossus", "graniteColossus", "eliteRuneColossus", "valkyrieCaptain", "stormCaptain", "skyCaptain"] },
};
