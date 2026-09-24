import {describe,expect,it} from 'vitest'; import {createInitialCharacterV2} from './character'; import {grantMasteryContribution,masteryLevelMultiplier,WEAPON_TRAINING_MAPS} from './mastery';
describe('mastery',()=>{it('penalizes trivial enemies without scaling them',()=>{expect(masteryLevelMultiplier(50,45)).toBe(1);expect(masteryLevelMultiplier(50,35)).toBe(.5);expect(masteryLevelMultiplier(50,25)).toBe(.1);expect(masteryLevelMultiplier(50,19)).toBe(0)});it('awards only selected weapon family',()=>{const c=createInitialCharacterV2('c');const n=grantMasteryContribution(c.weaponMastery,'greatsword',10,10,'boss');expect(n.greatsword.xp).toBeGreaterThan(0);expect(n.bow.xp).toBe(0)})});
describe('weapon training maps',()=>{
 it('are the mid-game mine and first magma map',()=>{expect([...WEAPON_TRAINING_MAPS]).toEqual(['mine','magma1'])});
 it('pay full XP to Lv60 regardless of level gap, then decay',()=>{
  expect(masteryLevelMultiplier(60,1,true)).toBe(1);
  expect(masteryLevelMultiplier(70,41,true)).toBeCloseTo(Math.exp(-.8));
  expect(masteryLevelMultiplier(60,1,false)).toBe(0);
 });
});
