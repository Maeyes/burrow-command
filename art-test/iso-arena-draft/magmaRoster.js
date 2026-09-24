// Magma roster (PixelLab 2026-09-24). Each species = 3 variants, one of them elite.
// Walk-only species (imp, scorchwing, colt, golem, lizard) still need attack clips.
export const MAGMA_ASSET_ROOT = '/art-test/monster-generation/pixellab-magma-roster-2026-09-24/objects';
const p = (dir, anim, attack = null, count = 9) => ({ dir, anim, attack, count });
const IMP = 'The_character_drifts_forward_with_an_eerie_weight';
const WING = 'The_character_drifts_forward_with_an_eerie_weight';
const COLT = 'The_creature_surges_forward_with_a_powerful_rhyth';
const GOLEM = 'The_creature_surges_forward_with_a_powerful_rhyth';
const LIZARD = 'The_creature_begins_a_rhythmic_heavy-footed_strid';

export const MAGMA_MONSTERS = {
  emberImp: { ...p('ORIGINAL_Fire_imp_enemy_for_Bu', IMP), name: 'Ember Imp' },
  cinderImp: { ...p('ORIGINAL_Fire_imp_enemy_for_Bu_2', IMP), name: 'Cinder Imp' },
  blazeImp: { ...p('ORIGINAL_Fire_imp_enemy_for_Bu_3', IMP), name: 'Blaze Imp', elite: true },
  fireDrake: { ...p('ORIGINAL_tiny_volcano_enemy_na', 'walk', 'attack'), name: 'Fire Drake' },
  emberDrake: { ...p('ORIGINAL_tiny_volcano_enemy_na_2', 'walk', 'attack'), name: 'Ember Drake' },
  eliteFireDrake: { ...p('ORIGINAL_tiny_volcano_enemy_na_3', 'walk', 'attack'), name: 'Elite Fire Drake', elite: true },
  scorchwing: { ...p('ORIGINAL_Dragon_fire_enemy_for', WING), name: 'Scorchwing' },
  ashwing: { ...p('ORIGINAL_Dragon_fire_enemy_for_2', WING), name: 'Ashwing' },
  eliteScorchwing: { ...p('ORIGINAL_Dragon_fire_enemy_for_3', WING), name: 'Elite Scorchwing', elite: true },

  cinderColt: { ...p('ORIGINAL_fire_Horse_enemy_for', COLT), name: 'Cinder Colt' },
  flameColt: { ...p('ORIGINAL_fire_Horse_enemy_for_2', COLT), name: 'Flame Colt' },
  eliteCinderColt: { ...p('ORIGINAL_fire_Horse_enemy_for_3', COLT), name: 'Elite Cinder Colt', elite: true },
  fireLizard: { ...p('ORIGINAL_Lizard_fire_enemy_for_3', LIZARD), name: 'Fire Lizard' },
  emberLizard: { ...p('ORIGINAL_Lizard_fire_enemy_for_2', LIZARD), name: 'Ember Lizard' },
  lavaLizard: { ...p('ORIGINAL_Lizard_fire_enemy_for', LIZARD), name: 'Lava Lizard', elite: true },
  fireGolem: { ...p('ORIGINAL_Fire_Golems_enemy_for', GOLEM), name: 'Fire Golem' },
  magmaGolem: { ...p('ORIGINAL_Fire_Golems_enemy_for_2', GOLEM), name: 'Magma Golem' },
  infernalGolem: { ...p('ORIGINAL_Fire_Golems_enemy_for_3', GOLEM), name: 'Infernal Golem', elite: true },
};

export const MAGMA_BOSSES = {
  ignaroth: {
    ...p('ORIGINAL_GREAT_MYTHICAL_RED_FI', 'The_dragon_shifts_its_weight_forward_with_a_delibe', 'Pixel_art_boss_melee_animation_for_the_existing_dr'),
    name: 'Ignaroth, the Red Wyrm',
    skills: ['Inferno_Breath_Pixel_art_boss_attack_animation_fo', 'Meteor_Roar_Pixel_art_boss_skill_animation_for_t'],
  },
  darkDragonKnight: {
    ...p('ORIGINAL_THE_GREATEST_DRAGON_K', 'The_creature_moves_with_a_rhythmic_heavy_gait_it', 'Pixel_art_boss_attack_animation_for_the_existing_a'),
    name: 'Dark Dragon Knight',
    skills: ['Pixel_art_boss_combo_animation_for_the_existing_ar', 'Pixel_art_boss_dash_attack_for_the_existing_armore'],
    // Source art is 48x48; bosses are authored at 64x64.
    scale: 64 / 48,
  },
};

export const MAGMA_MAPS = {
  magma1: { title: 'Cinderpeak Caldera', level: 'Lv. 51–60', boss: 'Ignaroth, the Red Wyrm', bossType: 'ignaroth',
    pool: ['emberImp', 'cinderImp', 'blazeImp', 'fireDrake', 'emberDrake', 'eliteFireDrake', 'scorchwing', 'ashwing', 'eliteScorchwing'] },
  magma2: { title: 'Obsidian Throne', level: 'Lv. 61–70', boss: 'Dark Dragon Knight', bossType: 'darkDragonKnight',
    pool: ['cinderColt', 'flameColt', 'eliteCinderColt', 'fireLizard', 'emberLizard', 'lavaLizard', 'fireGolem', 'magmaGolem', 'infernalGolem'] },
};
