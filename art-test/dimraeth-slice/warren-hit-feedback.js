// Match Bunny World's authoritative mastery proc labels and combat text palette.
// The procedural dice are pure to allow reproducible combat checks and a later server port.
import {critChance,BASE_CRIT_DAMAGE} from '../../src/systems/combatMath.ts';
export {BASE_CRIT_DAMAGE};
export const HIT_COLORS=Object.freeze({normal:'#ffffff',critical:'#ffe36f',double:'#9fe8ff',additional:'#a98cff',core:'#87efbd'});
export function rollWarrenCrit(luk=0,critBonusPercent=0,rng=Math.random){
 return rng()<critChance({luk},critBonusPercent);
}
export function rollMasteryProc(family,unlocked=[],rng=Math.random){
 const has=level=>unlocked.includes(level);
 if(family==='dagger'&&has(10)){
  const chance=has(50)?.30:has(20)?.25:.20;
  return rng()<chance?{kind:'double',ratio:1,criticalAllowed:has(40)}:null;
 }
 if(family==='bow'&&has(10)){
  const chance=has(50)?.25:has(20)?.20:.15;
  return rng()<chance?{kind:'additional',ratio:has(50)?.75:.5,criticalAllowed:true}:null;
 }
 if(family==='greatsword'&&has(10))
  return {kind:'cleave',ratio:has(50)?1:has(40)?.75:has(20)?.60:.50,criticalAllowed:true,
   range:has(30)?104:82};
 return null;
}
export function hitFeedback(amount,{kind='normal',critical=false,coreName=null}={}){
 const name=kind==='double'?'DOUBLE ATTACK!':kind==='additional'?'ADDITIONAL HIT!':kind==='cleave'?'CLEAVE!':coreName?coreName.toUpperCase()+'!':'';
 const text=(name?name+(critical?' ★  ':'  '):critical?'CRITICAL! ★  ':'')+Math.max(1,Math.round(amount));
 return {text,color:critical?HIT_COLORS.critical:coreName?HIT_COLORS.core:HIT_COLORS[kind]||HIT_COLORS.normal,
  size:critical?18:kind==='normal'&&!coreName?14:16,lift:kind==='normal'?critical?38:24:46};
}
