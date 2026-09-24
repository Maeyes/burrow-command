// Player-facing map names. Map ids (forest1, desert2, ...) stay stable for saves and
// portals; every UI that shows a map name should read it from here.
export interface MapNameV2 { title:string; levels:string }

export const MAP_NAMES_V2:Readonly<Record<string,MapNameV2>>=Object.freeze({
 forest1:{title:'Mossveil Hollow',levels:'Lv. 1–10'},
 forest2:{title:'Elderroot Wilds',levels:'Lv. 11–20'},
 desert1:{title:'Duneshade Basin',levels:'Lv. 21–30'},
 desert2:{title:'Sunscorch Expanse',levels:'Lv. 31–40'},
 mine:{title:'Gloomvein Mine',levels:'Lv. 41–50'},
 magma1:{title:'Cinderpeak Caldera',levels:'Lv. 51–60'},
 magma2:{title:'Obsidian Throne',levels:'Lv. 61–70'},
 snow1:{title:'Frostfang Tundra',levels:'Lv. 71–80'},
 snow2:{title:'Rimeheart Glacier',levels:'Lv. 81–90'},
 underwater1:{title:'Coralgleam Reef',levels:'Lv. 91–100'},
 underwater2:{title:'Abyssal Trench',levels:'Lv. 101–110'},
 asgard1:{title:'Bifrost Heights',levels:'Lv. 111–120'},
 asgard2:{title:'Valhalla',levels:'Lv. 120'},
});

/** Map order along the portal chain; also the Monster Index tab order. */
export const MAP_ORDER_V2=Object.freeze(Object.keys(MAP_NAMES_V2));

export function mapTitleV2(id:string):string{return MAP_NAMES_V2[id]?.title??id;}
