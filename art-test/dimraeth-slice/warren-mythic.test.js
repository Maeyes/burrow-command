import {describe,it,expect} from 'vitest';
import {defaultMythic,rollMythicOmen,validMythicSquad,settleMythic,mythicHpMultiplier} from './warren-mythic.js';
describe('mythic invasion',()=>{
 it('unlocks omens at Warren 5 and picks an allowed gate',()=>{expect(rollMythicOmen(defaultMythic(),{won:true,day:7,warren:4,rng:()=>0} ).pending).toBeNull();expect(rollMythicOmen(defaultMythic(),{won:true,day:7,warren:5,rng:()=>0}).pending).toMatchObject({bossId:'ancientDragon',gate:'west'});});
 it('keeps at most one rabbit from each class',()=>{const u=[{id:1,cls:'guard'},{id:2,cls:'guard'},{id:3,cls:'mage'}];expect(validMythicSquad(u,[1,2,3]).map(x=>x.id)).toEqual([1,3]);});
 it('pays stones now and keeps relic drops gated for the later archive system',()=>{const loss=settleMythic(defaultMythic(),{won:false,rng:()=>0});expect(loss.reward).toMatchObject({optionStone:2,reoptionStone:1,relic:null});const gated=settleMythic(defaultMythic(),{won:true,rng:()=>0});expect(gated.reward.relic).toBeNull();const enabled=settleMythic(defaultMythic(),{won:true,rng:()=>.19,relicEnabled:true});expect(enabled.reward.relic).toBe('dragonHeart');expect(mythicHpMultiplier(enabled.state)).toBe(1.01);});
});
