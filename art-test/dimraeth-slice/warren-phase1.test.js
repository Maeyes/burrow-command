import {describe,it,expect} from 'vitest';
import {unlockedTier,giveBunnyExp} from './warren-progression.js';
import {PHASE1_MAX_LEVEL,PHASE1_STAGES,FUTURE_REGIONS,NIGHT_INVASION_DIRECTIONS,warrenStageDifficulty,warrenMonsterStats,stageForWarren,frontierStage,lureQuote,LURE_MODES} from './warren-phase1.js';
describe('Burrow Command Phase 1 world and lure plan',()=>{
 it('uses only east, west and south monster entrances in every biome',()=>{
  expect(NIGHT_INVASION_DIRECTIONS.map(x=>x.side)).toEqual(['east','west','south']);
  expect(NIGHT_INVASION_DIRECTIONS.some(x=>x.ay<0)).toBe(false);
  for(const region of [...PHASE1_STAGES,...FUTURE_REGIONS])expect(NIGHT_INVASION_DIRECTIONS).toHaveLength(3);
 });
 it('alternates maps every five Warren levels with one equipment tier per ten levels',()=>{
  expect(PHASE1_MAX_LEVEL).toBe(20);
  expect(PHASE1_STAGES.map(s=>[s.min,s.max,s.mapId,s.tier])).toEqual([
   [1,5,'forest1',1],[6,10,'forest2',1],[11,15,'desert1',2],[16,20,'desert2',2]]);
  expect(stageForWarren(6).biome).toBe('forest');
  expect(stageForWarren(11).biome).toBe('desert');
  expect(stageForWarren(20).tier).toBe(2);
  expect([1,5,6,10,11,15,20,21].map(unlockedTier)).toEqual([1,1,1,1,2,2,2,3]);
  const bunny={level:1,exp:0};giveBunnyExp(bunny,10000,3);
  expect(bunny.level).toBe(3);expect(bunny.exp).toBeGreaterThan(0);
  giveBunnyExp(bunny,0,6);expect(bunny.level).toBe(6);
 });
 it('doubles base monster HP/ATK only when the Warren crosses each five-level boundary',()=>{
  const checkpoints=[1,2,5,6,7,10,11,12,15,16,17,20];
  const expected=[1,1,1,2,2,2,4,4,4,8,8,8];
  expect(checkpoints.map(warrenStageDifficulty)).toEqual(expected);
  // The stage and the monster power change together, not on every single
  // Warren upgrade or on a rabbit level-up.
  expect(checkpoints.map(level=>stageForWarren(level).mapId)).toEqual([
   'forest1','forest1','forest1','forest2','forest2','forest2',
   'desert1','desert1','desert1','desert2','desert2','desert2']);
  for(const [level,multiplier] of checkpoints.map((x,i)=>[x,expected[i]])){
   for(const [rank,baseHp,baseAtk] of [['normal',45,6],['elite',110,11],['boss',300,15]]){
    expect(warrenMonsterStats(rank,warrenStageDifficulty(level)),`${rank} at Warren ${level}`)
      .toEqual({hp:baseHp*multiplier,atk:baseAtk*multiplier});
   }
  }
  // Levels above 20 remain capped until their real rosters are authored.
  expect(warrenStageDifficulty(21)).toBe(8);
 });
 it('reserves Mine, Magma, Snow, Underwater and Asgard without activating them in Phase 1',()=>{
  expect(FUTURE_REGIONS.map(s=>s.biome)).toEqual(['mine','magma','snow','underwater','asgard']);
  expect(FUTURE_REGIONS.map(s=>s.tier)).toEqual([3,4,5,6,6]);
  expect(frontierStage(5).mapId).toBe('forest2');
  expect(frontierStage(10).mapId).toBe('desert1');
  expect(frontierStage(20)).toBeNull();
 });
 it('restricts lures to daytime and one per day, and does not expose the future Mine yet',()=>{
  const s={warren:11,day:6,night:false,lureDay:0};
  expect(lureQuote(s,'small').mats).toBe(100);
  expect(lureQuote(s,'elite').mats).toBe(200);
  expect(lureQuote(s,'frontier').mapId).toBe('desert2');
  expect(lureQuote({...s,lureDay:6},'elite').canUse).toBe(false);
  expect(lureQuote({...s,night:true},'small').canUse).toBe(false);
  expect(lureQuote({...s,warren:16},'frontier')).toBeNull();
  expect(Object.keys(LURE_MODES)).toEqual(['small','elite','frontier']);
 });
});
