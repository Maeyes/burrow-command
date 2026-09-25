import type { CombatWeaponFamily } from '../systems/combatMath';
export interface MasteryMilestoneV2 {level:10|20|30|40|50;id:string;kind:'mechanic'|'upgrade'|'utility'|'capstone';description:string}
export const WEAPON_MASTERY_MILESTONES:Record<CombatWeaponFamily,MasteryMilestoneV2[]>={
 greatsword:[
  {level:10,id:'cleave',kind:'mechanic',description:'Basic Attack hits 1 nearby secondary target for 50% damage.'},
  {level:20,id:'cleaveII',kind:'upgrade',description:'Cleave secondary damage increases to 60%.'},
  {level:30,id:'wideCleave',kind:'utility',description:'Cleave target acquisition range increases.'},
  {level:40,id:'cleaveIII',kind:'upgrade',description:'Cleave secondary damage increases to 75%.'},
  {level:50,id:'perfectCleave',kind:'capstone',description:'Cleave secondary damage increases to 100%.'},
 ],
 dagger:[
  {level:10,id:'doubleAttack',kind:'mechanic',description:'Basic Attack has 20% chance to add one 100% follow-up hit.'},
  {level:20,id:'doubleAttackII',kind:'upgrade',description:'Double Attack chance increases to 25%.'},
  {level:30,id:'precisionFollowup',kind:'utility',description:'Double Attack follow-up gains HIT +20.'},
  {level:40,id:'criticalFollowup',kind:'upgrade',description:'Double Attack follow-up can Crit using normal CRI.'},
  {level:50,id:'doubleAttackIII',kind:'capstone',description:'Double Attack chance increases to 30%.'},
 ],
 axe:[
  {level:10,id:'heavyBlow',kind:'mechanic',description:'Basic Attack has 15% chance to Stagger.'},
  {level:20,id:'heavyBlowII',kind:'upgrade',description:'Heavy Blow chance increases to 20%.'},
  {level:30,id:'armorBreak',kind:'utility',description:'Heavy Blow applies DEF -5% for 3 seconds.'},
  {level:40,id:'heavyBlowIII',kind:'upgrade',description:'Heavy Blow chance increases to 25%.'},
  {level:50,id:'crushingArmorBreak',kind:'capstone',description:'Armor Break becomes DEF -10% for 3 seconds.'},
 ],
 hammer:[
  {level:10,id:'crushingImpact',kind:'mechanic',description:'Basic Attack has 10% chance to Stun for 0.5 seconds.'},
  {level:20,id:'crushingImpactII',kind:'upgrade',description:'Crushing Impact chance increases to 15%.'},
  {level:30,id:'concussion',kind:'utility',description:'After a Crushing Impact Stun, Slow 20% for 2 seconds.'},
  {level:40,id:'crushingImpactIII',kind:'upgrade',description:'Crushing Impact chance increases to 20%.'},
  {level:50,id:'shockwave',kind:'capstone',description:'Crushing Impact knocks back nearby monsters; no bonus damage.'},
 ],
 bow:[
  {level:10,id:'multiShot',kind:'mechanic',description:'Basic Attack has 15% chance to hit 1 additional target for 50% damage.'},
  {level:20,id:'multiShotII',kind:'upgrade',description:'Multi Shot chance increases to 20%.'},
  {level:30,id:'eagleEye',kind:'utility',description:'Attack Range +10%; Multi Shot uses the resulting range.'},
  {level:40,id:'piercingArrow',kind:'upgrade',description:'Basic Attack and Multi Shot ignore 10% DEF.'},
  {level:50,id:'multiShotIII',kind:'capstone',description:'Multi Shot chance becomes 25% and secondary damage 75%.'},
 ],
 staff:[
  {level:10,id:'concentration',kind:'mechanic',description:'Taking damage does not interrupt casting.'},
  {level:20,id:'mobileCasting',kind:'utility',description:'Can move while casting with a movement-speed penalty.'},
  {level:30,id:'flowCasting',kind:'upgrade',description:'Reduces the Mobile Casting movement penalty.'},
  {level:40,id:'coreEcho',kind:'mechanic',description:'Skill Core effects have 10% chance to Echo at 50% effectiveness; Echo is terminal.'},
  {level:50,id:'perfectCasting',kind:'capstone',description:'Move at normal speed while casting.'},
 ],
 swordShield:[
  {level:10,id:'guard',kind:'mechanic',description:'Block Chance +8%; successful Blocks reduce incoming damage by 50% with a shield.'},
  {level:20,id:'firmGuard',kind:'upgrade',description:'Successful Block mitigation rises from 50% to 70% with a shield.'},
  {level:30,id:'counterGuard',kind:'mechanic',description:'Successful Block has 20% chance to Counter Attack.'},
  {level:40,id:'perfectGuard',kind:'upgrade',description:'Block Chance gains another +4% (total +12%).'},
  {level:50,id:'aegisMastery',kind:'capstone',description:'Successful Block grants Guarded for 2s: Damage Taken -10%.'},
 ],
};
export function unlockedMasteryMilestones(family:CombatWeaponFamily,level:number){return WEAPON_MASTERY_MILESTONES[family].filter(x=>level>=x.level)}
