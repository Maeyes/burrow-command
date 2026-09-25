import{describe,expect,it}from'vitest';
import{enhancementRequirement,masterRefinementBonus,protectionRequirement,resolveRefinement,rollRarity}from'./equipmentV2';
describe('equipment v2 rules',()=>{
 it('uses locked craft rarity boundaries',()=>{expect(rollRarity(0)).toBe('normal');expect(rollRarity(.50)).toBe('good');expect(rollRarity(.9999)).toBe('whiteAscended')});
 it('uses one bracket stone per enhancement',()=>{expect(enhancementRequirement(20,20).stoneId).toBe('verdantAetherstone');expect(enhancementRequirement(20,21).stoneId).toBe('azureAetherstone');expect(enhancementRequirement(20,81).stoneId).toBe('violetAetherstone')});
 it('implements protection quantities',()=>{expect(protectionRequirement(6)).toEqual({id:'refineProtectionLv1',qty:1});expect(protectionRequirement(10)?.qty).toBe(4);expect(protectionRequirement(15)).toEqual({id:'refineProtectionLv2',qty:4})});
 it('never falls below safe floor',()=>{expect(resolveRefinement(9,.99,false).level).toBe(9);expect(resolveRefinement(8,.99,false).level).toBe(7);expect(resolveRefinement(8,.99,true).level).toBe(8)});
 it('uses only highest exact Master Refinement milestone for six slots',()=>{
  expect(masterRefinementBonus([15,15,15,15,15,15])).toEqual({milestone:15,atkPct:.15,matkPct:.15,maxHpPct:.12,maxSpPct:.12});
  expect(masterRefinementBonus([10,10,10,10,10,10,15])).toEqual({milestone:10,atkPct:.10,matkPct:.10,maxHpPct:.08,maxSpPct:.08});
  expect(masterRefinementBonus([5,5,5,5,5,5])).toEqual({milestone:5,atkPct:.05,matkPct:.05,maxHpPct:.05,maxSpPct:.05});
  expect(masterRefinementBonus([15,15,15,15,15])).toEqual({milestone:0,atkPct:0,matkPct:0,maxHpPct:0,maxSpPct:0});
 });
});
