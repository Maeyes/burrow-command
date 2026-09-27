// Village building progression. The Resource Workshop boosts actual monster Gold and common construction-material drops; it never generates idle/offline income.
export const BUILDING_LEVEL_MAX=10;
// Indexed by current level: the Lv1 entry is the price paid to reach Lv2.
export const FORGE_COST=Object.freeze([0,180,520,1000,1800,3000,4800,7200,10500,15000]);
export const RESOURCE_COST=Object.freeze([0,160,480,900,1600,2700,4200,6200,9000,12500]);
export const RESOURCE_BONUS_PER_LEVEL=.01;
export const buildingLevel=n=>Math.max(1,Math.min(BUILDING_LEVEL_MAX,Math.floor(Number(n)||1)));
export const BUILDING_LEVEL_GATES=Object.freeze([{warren:5,level:3},{warren:10,level:5},{warren:15,level:8},{warren:20,level:10}]);
export const buildingLevelCap=warren=>BUILDING_LEVEL_GATES.reduce((cap,gate)=>Number(warren)>=gate.warren?gate.level:cap,1);
export const resourceBonusRate=n=>buildingLevel(n)*RESOURCE_BONUS_PER_LEVEL;
// Convert a small amount of high-end rarity probability from common rolls without any guaranteed rarity.
export function forgeRarityRoll(roll,level){
 const x=Math.max(0,Math.min(.999999,Number(roll)||0));
 return 1-Math.pow(1-x,1+(buildingLevel(level)-1)*.10);
}
/** Apply a +1 percentage point bonus per workshop level to a monster's FINAL scaled Gold
 * and only its common construction-material drops. Fractional bonuses accumulate across kills
 * so small drops still earn a real bonus over time. This mutates the loot BEFORE it is either
 * sent to storage or assigned to a rabbit's carrying bag; never also pay the state directly. */
export function applyMonsterResourceBonus(s,loot,eligibleMaterials){
 const rate=resourceBonusRate(s.resourceLevel);
 const baseGold=Number.isSafeInteger(loot.gold)&&loot.gold>0?loot.gold:0;
 const goldTotal=(Number(s.resourceGoldBank)||0)+baseGold*rate;
 const extraGold=Math.floor(goldTotal+1e-9);
 s.resourceGoldBank=Math.max(0,goldTotal-extraGold);
 loot.gold+=extraGold;
 const allowed=new Set(eligibleMaterials);
 let matTotal=Number(s.resourceMatBank)||0,extraMaterials=0;
 for(const [id,qty] of Object.entries(loot.items||{})){
  if(!allowed.has(id)||!Number.isSafeInteger(qty)||qty<=0)continue;
  matTotal+=qty*rate;
  const bonus=Math.floor(matTotal+1e-9);
  matTotal=Math.max(0,matTotal-bonus);
  if(bonus){loot.items[id]+=bonus;extraMaterials+=bonus;}
 }
 s.resourceMatBank=matTotal;
 return {gold:extraGold,materials:extraMaterials};
}
export function castWarrenHeal(s,maxHall,phaseDay=s.day){
 const key=s.night?'nightHealDay':'dayHealDay';
 if(s[key]===phaseDay)return null;
 const amount=Math.max(1,Math.round(maxHall*.2));
 const healed=[];
 for(const u of s.units){if(u.down||u.hp<=0||u.hp>=u.maxHp)continue;
  const n=Math.min(amount,u.maxHp-u.hp);u.hp+=n;healed.push({unit:u,amount:n});
 }
 if(!healed.length)return null; // Never consume the one-use-per-phase skill at full health.
 s[key]=phaseDay;return {amount,healed};
}
