export const FOREST_ASSET_ROOT='/art-test/monster-generation/pixellab-forest-roster-2026-09-21/objects';
const p=(dir,anim,count)=>({dir,anim,count});
export const FOREST_MONSTERS={
 mossblob1:{...p('ORIGINAL_tiny_hostile_woodland','Walk_Grounded',8),name:'Stone Mossblob'},
 mossblob2:{...p('ORIGINAL_tiny_hostile_woodland_2','Walk_Grounded',8),name:'Elite Mossblob',elite:true},
 mossblob3:{...p('ORIGINAL_tiny_hostile_woodland_3','Walk',8),name:'Mossblob'},
 sporekin1:{...p('ORIGINAL_tiny_mushroom_forest','Walk',8),name:'Poison Spore'},
 sporekin2:{...p('ORIGINAL_tiny_mushroom_forest_2','Walk',8),name:'Elite Spore',elite:true},
 sporekin3:{...p('ORIGINAL_tiny_mushroom_forest_3','Walk',8),name:'Spore'},
 acorn1:{...p('ORIGINAL_tiny_stout_Acorn_Guar','Walk_Grounded',8),name:'Elite Acorn Guard',elite:true},
 acorn2:{...p('ORIGINAL_tiny_stout_Acorn_Guar_2','Walk_Grounded',8),name:'Acorn Guard'},
 acorn3:{...p('ORIGINAL_tiny_stout_Acorn_Guar_3','Seamless_sturdy_eight-frame_walk_cycle_in_place_fa',9),name:'Flash Acorn Guard'},
 twig1:{...p('ORIGINAL_tiny_woodland_Twig_Im','Walk',8),name:'Elite Twig Imp',elite:true},
 twig2:{...p('ORIGINAL_tiny_woodland_Twig_Im_2','Walk',8),name:'Female Twig Imp'},
 barkBeetle1:{dir:'barkBeetle1',anim:'walk',attack:'attack',count:9,attackCount:9,name:'Elite Bark Beetle',elite:true},
 barkBeetle2:{dir:'barkBeetle2',anim:'walk',attack:'attack',count:9,attackCount:9,name:'Bark Beetle'},
 barkBeetle3:{dir:'barkBeetle3',anim:'walk',attack:'attack',count:9,attackCount:9,name:'Mossback Beetle'},
 thornBoar1:{dir:'thornBoar1',anim:'walk',attack:'attack',count:9,attackCount:9,name:'Elite Thorn Boar',elite:true},
 thornBoar2:{dir:'thornBoar2',anim:'walk',attack:'attack',count:9,attackCount:9,name:'Thorn Boar'},
 thornBoar3:{dir:'thornBoar3',anim:'walk',attack:'attack',count:9,attackCount:9,name:'Bristle Boar'},
 twig3:{...p('ORIGINAL_tiny_woodland_Twig_Im_3','Seamless_playful_eight-frame_walk_cycle_in_place_f',9),name:'Male Twig Imp'},
};
export const FOREST_BOSSES={
 mushroom:{...p('ORIGINAL_Mushroom_Brute_elite_enemy_for_Bunny_Worl','Walk',8),attack:'Attack',attackCount:8},
 thornroot:{...p('A_large_cute_ancient_forest_gu','Animate_this_exact_character_with_a_slow_heavy_8-',9),attack:'Create_an_8-frame_ATTACK_animation_for_this_exact',attackCount:9},
};
export const FOREST_MAPS={
 forest1:{title:'Mossveil Hollow',level:'Lv. 1–10',boss:'Mushroom Brute',pool:['mossblob1','mossblob2','mossblob3','sporekin1','sporekin2','sporekin3','barkBeetle1','barkBeetle2','barkBeetle3']},
 forest2:{title:'Elderroot Wilds',level:'Lv. 11–20',boss:'Thornroot Warden',pool:['acorn1','acorn2','acorn3','twig1','twig2','twig3','thornBoar1','thornBoar2','thornBoar3']},
};
