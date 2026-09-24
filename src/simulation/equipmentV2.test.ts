import{describe,expect,it}from'vitest';
import{enhancementRequirement,masterRefinementBonus,protectionRequirement,resolveRefinement,rollRarity}from'./equipmentV2';
describe('equipment v2 rules',()=>{
 it('uses locked craft rarity boundaries',()=>{expect(rollRarity(0)).toBe('normal');expect(rollRarity(.50)).toBe('good');expect(rollRarity(.9999)).toBe('whiteAscended')});
 it('uses one bracket stone per enhancement',()=>{expect(enhancementRequirement(20,20).stoneId).toBe('verdantAetherstone');expect(enhancementRequirement(20,21).stoneId).toBe('azureAetherstone');expect(enhancementRequirement(20,81).stoneId).toBe('violetAetherstone')});
 it('implements protection quantities',()=>{expect(protectionRequirement(6)).toEqual({id:'refineProtectionLv1',qty:1});expect(protectionRequirement(10)?.qty).toBe(4);expect(protectionRequirement(15)).toEqual({id:'refineProtectionLv2',qty:4})});
 it('never falls below safe floor',()=>{expect(resolveRefinement(9,.99,false).level).toBe(9);expect(resolveRefinement(8,.99,false).level).toBe(7);expect(resolveRefinement(8,.99,true).level).toBe(8)});
 it('uses only highest exact Master Refinement milestone for six slots',()=>{
  expect(masterRefinementBonus([15,15,15,15,15,15])).toEqual({milestone:15,atk:800,matk:800,maxHp:1500,maxSp:500});
  expect(masterRefinementBonus([10,10,10,10,10,10,15])).toEqual({milestone:10,atk:400,matk:400,maxHp:900,maxSp:300});
  expect(masterRefinementBonus([5,5,5,5,5,5])).toEqual({milestone:5,atk:200,matk:200,maxHp:500,maxSp:200});
  expect(masterRefinementBonus([15,15,15,15,15])).toEqual({milestone:0,atk:0,matk:0,maxHp:0,maxSp:0});
 });
});
