export const DESERT_ASSET_ROOT='/art-test/monster-generation/pixellab-desert-roster-2026-09-21/objects';
const p=(dir,anim,count=9)=>({dir,anim,count});

export const DESERT_MONSTERS={
  dust1:{...p('ORIGINAL_tiny_desert_enemy_nam','Animate_this_exact_Dust_Djinn_with_a_seamless_8-fr'),name:'Elite Dust Djinn',elite:true},
  dust2:{...p('ORIGINAL_tiny_desert_enemy_nam_2','Animate_this_exact_Dust_Djinn_with_a_seamless_8-fr'),name:'Mirage Djinn'},
  dust3:{...p('ORIGINAL_tiny_desert_enemy_nam_3','Animate_this_exact_Dust_Djinn_with_a_seamless_8-fr'),name:'Dust Djinn'},
  scarab1:{...p('ORIGINAL_tiny_desert_enemy_nam_4','Animate_this_exact_Sunscarab_with_a_seamless_8-fra'),name:'Sunscarab'},
  scarab2:{...p('ORIGINAL_tiny_desert_enemy_nam_5','Animate_this_exact_Sunscarab_with_a_seamless_8-fra'),name:'Solar Scarab'},
  scarab3:{...p('ORIGINAL_tiny_desert_enemy_nam_6','Animate_this_exact_Sunscarab_with_a_seamless_8-fra'),name:'Elite Sunscarab',elite:true},
  cactling1:{...p('ORIGINAL_tiny_desert_enemy_nam_7','Animate_this_exact_Cactling_Bandit_with_a_seamless'),name:'Cactling Bandit'},
  cactling2:{...p('ORIGINAL_tiny_desert_enemy_nam_8','Animate_this_exact_Cactling_Bandit_with_a_seamless'),name:'Elite Cactling Bandit',elite:true},
  cactling3:{...p('ORIGINAL_tiny_desert_enemy_nam_9','Animate_this_exact_Cactling_Bandit_with_a_seamless'),name:'Bloom Cactling'},
  duneling1:{...p('ORIGINAL_tiny_desert_enemy_nam_10','Animate_this_exact_Duneling_character_with_a_seaml'),name:'Elite Duneling',elite:true},
  duneling2:{...p('ORIGINAL_tiny_desert_enemy_nam_11','Animate_this_exact_Duneling_character_with_a_seaml'),name:'Dune Runner'},
  duneling3:{...p('ORIGINAL_tiny_desert_enemy_nam_12','Animate_this_exact_Duneling_character_with_a_seaml'),name:'Duneling'},
};

export const DESERT_BOSSES={
  colossus:{...p('ORIGINAL_desert_MAP_BOSS_named','Animate_this_exact_Sunforge_Colossus_boss_with_a_s'),name:'Sunforge Colossus',attack:'Create_an_8-frame_ATTACK_animation_for_this_exact',attackCount:9},
  dunemaw:{...p('ORIGINAL_desert_MAP_BOSS_named_2','Animate_this_exact_Dune_Maw_boss_with_a_seamless_8'),name:'Dune Maw',attack:'Create_an_8-frame_ATTACK_animation_for_this_exact',attackCount:9},
};

export const DESERT_MAPS={
  desert1:{title:'Duneshade Basin',level:'Lv. 31–45',boss:'Dune Maw',bossType:'dunemaw',pool:['duneling1','duneling2','duneling3','cactling1','cactling2','cactling3']},
  desert2:{title:'Sunscorch Expanse',level:'Lv. 46–60',boss:'Sunforge Colossus',bossType:'colossus',pool:['dust1','dust2','dust3','scarab1','scarab2','scarab3']},
};
