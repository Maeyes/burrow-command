// Burrow Command: stage gates. Only Forest/Desert are playable during the first 20 Warren levels.
export const PHASE1_MAX_LEVEL=20;
// The north edge is reserved for the future mountain/back-wall expansion.
// Every biome uses the same three invasion lanes: east, west and south only.
export const NIGHT_INVASION_DIRECTIONS=Object.freeze([
 {side:'east',ax:1,ay:0},{side:'west',ax:-1,ay:0},{side:'south',ax:0,ay:1},
]);
export const PHASE1_STAGES=Object.freeze([
 {min:1,max:5,biome:'forest',roster:'forest',mapId:'forest1',name:'Forest I',tier:1},
 {min:6,max:10,biome:'forest',roster:'forest',mapId:'forest2',name:'Forest II',tier:1},
 {min:11,max:15,biome:'desert',roster:'desert',mapId:'desert1',name:'Desert I',tier:2},
 {min:16,max:20,biome:'desert',roster:'desert',mapId:'desert2',name:'Desert II',tier:2},
]);
// Reserved design slots, not yet playable or populated. Underwater + Asgard share the T6 endgame.
export const FUTURE_REGIONS=Object.freeze([
 {min:21,max:30,biome:'mine',tier:3},{min:31,max:40,biome:'magma',tier:4},
 {min:41,max:50,biome:'snow',tier:5},{min:51,max:60,biome:'underwater',tier:6},
 {min:61,max:70,biome:'asgard',tier:6},
]);
// Difficulty is based exclusively on the Warren's *five-level band*, not on
// rabbit level, current night, or every single Warren level. Existing four
// playable stages therefore have base monster HP/ATK ×1, ×2, ×4 and ×8.
export function warrenStageDifficulty(level){
 const n=Math.max(1,Math.min(PHASE1_MAX_LEVEL,Math.floor(Number(level)||1)));
 return 2**Math.floor((n-1)/5);
}
// This stat function is used by real spawns as well as balancing tests, so
// all three ranks gain the same relative HP and ATK at each Warren band.
export function warrenMonsterStats(rank,power=1){
 const base=rank==='boss'?{hp:300,atk:15}:rank==='elite'?{hp:110,atk:11}:{hp:45,atk:6};
 return {hp:Math.round(base.hp*power),atk:base.atk*power};
}
export function stageForWarren(level){
 const n=Math.max(1,Math.min(PHASE1_MAX_LEVEL,Math.floor(Number(level)||1)));
 return PHASE1_STAGES.find(stage=>n>=stage.min&&n<=stage.max);
}
export function frontierStage(level){
 const current=stageForWarren(level),idx=PHASE1_STAGES.indexOf(current);
 return idx>=0?PHASE1_STAGES[idx+1]??null:null;
}
export const LURE_MODES=Object.freeze({
 small:{label:'Small · ฝูงมอน',mats:100,count:8,eliteChance:0,power:1.15},
 elite:{label:'Elite · ล่อหัวหน้า',mats:200,count:6,eliteChance:.75,power:1.3},
 frontier:{label:'Frontier · ข้ามเขต',mats:300,count:5,eliteChance:.35,power:1.45},
});
export function lureQuote(s,mode){
 const conf=LURE_MODES[mode];if(!conf)return null;
 const next=mode==='frontier'?frontierStage(s.warren):null;
 if(mode==='frontier'&&!next)return null;
 return {...conf,mode,mapId:next?.mapId??stageForWarren(s.warren).mapId,
  canUse:!s.night&&s.lureDay!==s.day,remainingDay:s.lureDay!==s.day};
}
