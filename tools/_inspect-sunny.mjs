import { readFileSync } from 'node:fs'; import sharp from 'sharp';
const files=['Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_16px.png','Sunnyside_World_Assets/Tileset/spr_tileset_sunnysideworld_forest_32px.png','Sunnyside_World_Assets/Elements/Plants/spr_deco_tree_01_strip4.png','Sunnyside_World_Assets/Elements/Plants/spr_deco_tree_02_strip4.png','Sunnyside_World_Assets/Elements/Other/spr_deco_windmill_withshadow_strip9.png'];
for(const f of files){const m=await sharp(f).metadata(); console.log(f,m.width,m.height);}
