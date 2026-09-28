import {ARCHIVE_BOSS_BY_ID,LIVE_ARCHIVE_BOSS_IDS,archiveProgress} from './warren-relic-archive.js';
export const MYTHIC_OMEN_CHANCE=.15;
export const MYTHIC_UNLOCK_LEVEL=5;
export const MYTHIC_BOSSES={ancientDragon:{id:'ancientDragon',name:'Ancient Dragon',nameTh:'มังกรโบราณ',relic:'dragonHeart'}};
export const MYTHIC_RELICS={dragonHeart:{id:'dragonHeart',name:'Dragon Heart',bonus:'Max HP +1%'}};

export function defaultMythic(){return {pending:null,selected:[],optionStones:0,reoptionStones:0,relics:{},defeats:{},essence:0,lastOmenDay:0,lastResult:null,collectionRewardClaimed:false};}
export function normalizeMythic(value){
 const d=defaultMythic(),v=value&&typeof value==='object'?value:{};
 const relics=v.relics&&typeof v.relics==='object'&&!Array.isArray(v.relics)?{...v.relics}:{};
 const defeats={};if(v.defeats&&typeof v.defeats==='object')for(const [id,count] of Object.entries(v.defeats))if(ARCHIVE_BOSS_BY_ID[id]&&Number.isFinite(Number(count)))defeats[id]=Math.max(0,Math.floor(Number(count)));
 return {...d,...v,selected:Array.isArray(v.selected)?v.selected.filter(Number.isFinite):[],relics,defeats,
  essence:Math.max(0,Math.floor(Number(v.essence)||0)),collectionRewardClaimed:Boolean(v.collectionRewardClaimed)||archiveProgress({relics}).complete};
}
// Central, version-tolerant award path. Future encounters must explicitly opt into this system.
export function recordMythicVictory(value,{bossId,relicDropped=false,allowUnreleased=false}={}){
 const state=normalizeMythic(value),boss=ARCHIVE_BOSS_BY_ID[bossId];
 if(!boss||!allowUnreleased&&!LIVE_ARCHIVE_BOSS_IDS.includes(bossId))return {state,accepted:false,duplicate:false,collectionUnlocked:false};
 const wasComplete=archiveProgress(state).complete,duplicate=Boolean(relicDropped&&state.relics[boss.relicId]);
 const relics={...state.relics};if(relicDropped)relics[boss.relicId]=1;
 const updated={...state,relics,defeats:{...state.defeats,[bossId]:(state.defeats[bossId]||0)+1},essence:state.essence+(duplicate?1:0)};
 const collectionUnlocked=!wasComplete&&archiveProgress(updated).complete;
 if(collectionUnlocked)updated.collectionRewardClaimed=true;
 return {state:updated,accepted:true,duplicate,collectionUnlocked};
}
export function rollMythicOmen(state,{won,day,warren,rng=Math.random,force=false}={}){
 const s=normalizeMythic(state);if(s.pending||!won||warren<MYTHIC_UNLOCK_LEVEL||s.lastOmenDay===day||(!force&&rng()>=MYTHIC_OMEN_CHANCE))return s;
 return {...s,pending:{bossId:'ancientDragon',day,gate:['west','east','south'][Math.floor(rng()*3)]},selected:[],lastOmenDay:day};
}
export function validMythicSquad(units,ids){const chosen=[];for(const id of ids||[]){const u=units.find(x=>x.id===Number(id));if(u&&!chosen.some(x=>x.id===u.id)&&!chosen.some(x=>x.cls===u.cls))chosen.push(u);if(chosen.length===7)break;}return chosen;}
export function defaultMythicSquad(units){const seen=new Set();return units.filter(u=>!seen.has(u.cls)&&seen.add(u.cls)).slice(0,7).map(u=>u.id);}
export function settleMythic(state,{won,rng=Math.random,relicEnabled=false}={}){
 const s=normalizeMythic(state),reward={optionStone:won?4:2,reoptionStone:won?2:1,relic:null,duplicate:false,collectionUnlocked:false};
 const boss=ARCHIVE_BOSS_BY_ID.ancientDragon;
 const relicDropped=Boolean(relicEnabled&&won&&rng()<.2);
 const award=won?recordMythicVictory(s,{bossId:boss.id,relicDropped}):{state:s};
 if(relicDropped){reward.relic=boss.relicId;reward.duplicate=award.duplicate;}
 reward.collectionUnlocked=Boolean(award.collectionUnlocked);
 const updated={...award.state,pending:null,selected:[],optionStones:s.optionStones+reward.optionStone,reoptionStones:s.reoptionStones+reward.reoptionStone,lastResult:{won,reward}};
 return {state:updated,reward};
}
export const mythicHpMultiplier=state=>normalizeMythic(state).relics.dragonHeart?1.01:1;
