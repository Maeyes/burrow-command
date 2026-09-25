// Sea roster (PixelLab 2026-09-25). Each species = 3 variants, one elite; captain/king/elder species are all elite.
// Art lives in one folder per map, so each entry carries its own root.
const R = '/art-test/monster-generation';
const p = (map, dir, anim, attack = null, count = 9) => ({ dir: `pixellab-${map}-roster-2026-09-25/objects/${dir}`, anim, attack, count });
export const SEA_ASSET_ROOT = R;

export const SEA_MONSTERS = {
  bubbleCrab: { ...p('sea1', 'Bubble_Crab_1', 'walk', 'attack'), name: 'Bubble Crab' },
  sandCrab: { ...p('sea1', 'Bubble_Crab_2', 'walk', 'attack'), name: 'Sand Crab' },
  eliteBubbleCrab: { ...p('sea1', 'Bubble_Crab_3', 'walk', 'attack'), name: 'Elite Bubble Crab', elite: true },
  pufferling: { ...p('sea1', 'Pufferling_1', 'walk', 'attack'), name: 'Pufferling' },
  coralPuffer: { ...p('sea1', 'Pufferling_2', 'walk', 'attack'), name: 'Coral Puffer' },
  elitePufferling: { ...p('sea1', 'Pufferling_3', 'walk', 'attack'), name: 'Elite Pufferling', elite: true },
  jellyDrifter: { ...p('sea1', 'Jelly_Drifter_1', 'walk', 'attack'), name: 'Jelly Drifter' },
  glowJelly: { ...p('sea1', 'Jelly_Drifter_2', 'walk', 'attack'), name: 'Glow Jelly' },
  eliteJellyDrifter: { ...p('sea1', 'Jelly_Drifter_3', 'walk', 'attack'), name: 'Elite Jelly Drifter', elite: true },
  coralCrabKnight: { ...p('sea1', 'Coral_Crab_Knight_1', 'walk', 'attack'), name: 'Coral Crab Knight', elite: true },
  reefCrabKnight: { ...p('sea1', 'Coral_Crab_Knight_2', 'walk', 'attack'), name: 'Reef Crab Knight', elite: true },
  crimsonCrabKnight: { ...p('sea1', 'Coral_Crab_Knight_3', 'walk', 'attack'), name: 'Crimson Crab Knight', elite: true },
  mossClamKing: { ...p('sea1', 'Giant_Clam_King_1', 'walk', 'attack'), name: 'Moss Clam King', elite: true },
  emberClamKing: { ...p('sea1', 'Giant_Clam_King_2', 'walk', 'attack'), name: 'Ember Clam King', elite: true },
  pearlClamKing: { ...p('sea1', 'Giant_Clam_King_3', 'walk', 'attack'), name: 'Pearl Clam King', elite: true },
  squidling: { ...p('sea2', 'Squidling_1', 'walk', 'attack'), name: 'Squidling' },
  inkSquidling: { ...p('sea2', 'Squidling_2', 'walk', 'attack'), name: 'Ink Squidling' },
  violetSquidling: { ...p('sea2', 'Squidling_3', 'walk', 'attack'), name: 'Violet Squidling' },
  eliteSquidling: { ...p('sea2', 'Squidling_4', 'walk', 'attack'), name: 'Elite Squidling', elite: true },
  abyssEel: { ...p('sea2', 'Abyss_Eel_1', 'walk', 'attack'), name: 'Abyss Eel' },
  tideEel: { ...p('sea2', 'Abyss_Eel_2', 'walk', 'attack'), name: 'Tide Eel' },
  eliteAbyssEel: { ...p('sea2', 'Abyss_Eel_3', 'walk', null), name: 'Elite Abyss Eel', elite: true },
  abyssMermaid: { ...p('sea2', 'Abyss_Mermaid_1', 'walk_mermaid_swimming_forward_to_the_right_tai', 'mermaid_lunges_forward_to_the_right_and_thrusts_he'), name: 'Abyss Mermaid' },
  duskMermaid: { ...p('sea2', 'Abyss_Mermaid_2', 'walk_mermaid_swimming_forward_to_the_right_tai', 'mermaid_lunges_forward_to_the_right_and_thrusts_he'), name: 'Dusk Mermaid' },
  kelpMermaid: { ...p('sea2', 'Abyss_Mermaid_3', 'walk_mermaid_swimming_forward_to_the_right_tai', 'mermaid_lunges_forward_to_the_right_and_thrusts_he'), name: 'Kelp Mermaid' },
  abyssSiren: { ...p('sea2', 'Abyss_Mermaid_4', 'walk', 'attack'), name: 'Abyss Siren', elite: true },
  abyssShark: { ...p('sea2', 'Abyss_Shark_1', 'walk', 'attack'), name: 'Abyss Shark' },
  reefShark: { ...p('sea2', 'Abyss_Shark_2', 'walk', 'attack'), name: 'Reef Shark' },
  eliteAbyssShark: { ...p('sea2', 'Abyss_Shark_3', 'walk', 'attack'), name: 'Elite Abyss Shark', elite: true },
};

export const SEA_BOSSES = {
  kraken: { ...p('sea1', 'Boss_Kraken', 'walk', 'skill1'), name: 'Kraken of the Reef', skills: ["skill3", "skill_2_spins_and_sweeps_all_its_thick_tentacles"] },
  kingTriton: { ...p('sea2', 'Boss_King_Triton', 'walk', 'skill1'), name: 'King Triton', skills: ["skill2", "skill3"] },
};

export const SEA_MAPS = {
  underwater1: { title: 'Coralgleam Reef', level: 'Lv. 91–100', boss: 'Kraken of the Reef', bossType: 'kraken',
    pool: ["bubbleCrab", "sandCrab", "eliteBubbleCrab", "pufferling", "coralPuffer", "elitePufferling", "jellyDrifter", "glowJelly", "eliteJellyDrifter", "coralCrabKnight", "reefCrabKnight", "crimsonCrabKnight", "mossClamKing", "emberClamKing", "pearlClamKing"] },
  underwater2: { title: 'Abyssal Trench', level: 'Lv. 101–110', boss: 'King Triton', bossType: 'kingTriton',
    pool: ["squidling", "inkSquidling", "violetSquidling", "eliteSquidling", "abyssEel", "tideEel", "eliteAbyssEel", "abyssMermaid", "duskMermaid", "kelpMermaid", "abyssSiren", "abyssShark", "reefShark", "eliteAbyssShark"] },
};
