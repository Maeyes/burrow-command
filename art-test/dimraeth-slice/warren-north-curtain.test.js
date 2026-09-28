import {describe,it,expect} from 'vitest';
import {defaultHomeBuilder} from './warren-home-builder.js';
import {HOME_NORTH_CLIFF,homeWallLayoutId} from './warren-home-land.js';
import {applyHomeTerrainBrush,applyHomeNorthernCliff,applyHomeTerrainToArrays,normalizeHomeTerrain,validateHomeTerrainBatch,
 deriveHomeNorthCurtains,migrateLegacyNorthCliffSources,quoteHomeTerrain,quoteNewHomeNorthCurtains} from './warren-home-terrain.js';
import {sceneFromMap} from './scenes/custom.js';
const n=160;
const arrays=()=>({level:new Uint8Array(n*n),road:new Uint8Array(n*n),forest:new Uint8Array(n*n),water:new Uint8Array(n*n)});
const home=()=>{const h=defaultHomeBuilder();h.ownedPlots.push(...['north','northUpper'].flatMap(side=>[1,2,3].map(i=>side+i)));h.expandedSides=['north','northUpper'];h.wallLayoutId=homeWallLayoutId(h);return h;};
const painted=(columns,rows=[2,3,4,5])=>{
 let out=[];for(const i of columns)for(const j of rows)out=applyHomeTerrainBrush(out,i,j,'water');return out;
};
describe('Permanent northern cliff waterfall curtain',()=>{
 it('allows every purchased crest cell 13..27 including both endpoints but none outside',()=>{
  const h=home(),edits=painted(Array.from({length:15},(_,i)=>i+13));
  expect(validateHomeTerrainBatch(h,edits).ok).toBe(true);
  expect(edits.filter(e=>e.j===2)).toHaveLength(15);
  expect(applyHomeTerrainBrush(edits,12,2,'water')).toBeNull();
  expect(applyHomeTerrainBrush(edits,28,2,'water')).toBeNull();
  expect(validateHomeTerrainBatch(defaultHomeBuilder(),edits).ok).toBe(false);
  expect(applyHomeTerrainBrush(edits,20,2,'raise')).toBeNull();
 });
 it('builds one 15-tile native curtain with deterministic left/right caps and no duplicate mounds',()=>{
  const h=home(),edits=painted(Array.from({length:15},(_,i)=>i+13));
  const curtains=deriveHomeNorthCurtains(h,edits);
  expect(curtains).toHaveLength(1);
  const c=curtains[0];
  expect(c.type).toBe('north-curtain');
  expect(c.sourceTiles).toHaveLength(15);
  expect(c.basinTiles).toHaveLength(15);
  expect(c.faceTiles[0]).toMatchObject({i:13,cap:'left'});
  expect(c.faceTiles[14]).toMatchObject({i:27,cap:'right'});
  expect(c.faceTiles.slice(1,14).every(s=>s.cap==='middle')).toBe(true);
  expect(c.riverPath).toHaveLength(30);
  const a=arrays();applyHomeTerrainToArrays(a,edits,n);applyHomeNorthernCliff(a,{...h,terrainEdits:edits},n);
  for(let i=13;i<=27;i++){
   for(let y=6;y<=9;y++)for(let x=i*4-2;x<=i*4+1;x++){
    expect(a.level[y*n+x]).toBe(3);
    expect(a.water[y*n+x]).toBe(1);
    expect(a.forest[y*n+x]).toBe(1); // no random trees or extra land spawned on a wet crest
   }
   for(let y=10;y<=13;y++)for(let x=i*4-2;x<=i*4+1;x++){
    expect(a.level[y*n+x]).toBe(0); // no water-top pedestal
    expect(a.water[y*n+x]).toBe(1);
   }
  }
 });
 it('retains separate adjacent-run caps and never creates curtains without a connected basin',()=>{
  const h=home();const all=painted([13,14,16,27]);
  const groups=deriveHomeNorthCurtains(h,all);
  expect(groups.map(g=>g.sourceTiles.map(s=>s.i))).toEqual([[13,14],[16],[27]]);
  expect(groups[0].faceTiles.map(s=>s.cap)).toEqual(['left','right']);
  expect(groups[1].faceTiles[0].cap).toBe('single');
  const dry=painted([13,14],[2]);
  expect(deriveHomeNorthCurtains(h,dry)).toHaveLength(0);
 });
 it('charges one landmark fee per newly started connected curtain, not per tile or extension',()=>{
  const h=home(),old=deriveHomeNorthCurtains(h,painted([13,14])),extended=deriveHomeNorthCurtains(h,painted([13,14,15]));
  expect(quoteNewHomeNorthCurtains(old,extended)).toEqual({groups:0,mats:0,gold:0});
  expect(quoteNewHomeNorthCurtains([],extended)).toEqual({groups:1,mats:60,gold:35});
  const separate=deriveHomeNorthCurtains(h,painted([13,14,16,27]));
  expect(quoteNewHomeNorthCurtains([],separate)).toEqual({groups:3,mats:180,gold:105});
  const crest=applyHomeTerrainBrush([],13,2,'water');
  expect(quoteHomeTerrain([],crest)).toMatchObject({mats:20,gold:15,changes:1});
 });
 it('migrates legacy one-tile cliff waterfall water without charging or deleting its old plot',()=>{
  const h=home();h.terrainEdits=normalizeHomeTerrain(painted([20],[3,4,5]),h);
  migrateLegacyNorthCliffSources(h,[{sourceTile:{i:20,j:2},basinTiles:[{i:20,j:3}]}]);
  migrateLegacyNorthCliffSources(h,[{sourceTile:{i:20,j:2}}]);
  expect(h.terrainEdits.filter(e=>e.j===2)).toHaveLength(1);
  expect(deriveHomeNorthCurtains(h,h.terrainEdits)[0].sourceTile).toEqual({i:20,j:2});
  expect(h.recovery).toHaveLength(0);
 });
 it('prevents accidental raised water pedestals in the first basin row while preserving manual hills',()=>{
  const h=home(),old=[{i:20,j:3,ground:'grass',elevation:2,water:true}];
  const normalized=normalizeHomeTerrain(old,h);
  expect(normalized[0].elevation).toBe(0);
  expect(validateHomeTerrainBatch(h,old).ok).toBe(false);
  const fixed=applyHomeTerrainBrush([{i:20,j:3,ground:'grass',elevation:2,water:false}],20,3,'water');
  expect(fixed[0].elevation).toBe(0);
  const hill=applyHomeTerrainBrush([],20,9,'raise');
  expect(hill[0].elevation).toBe(1);
 });
 it('keeps long high-water cliff at level 3 without auto water settlement or organic left-edge gaps',()=>{
  const h=home(),edits=painted(Array.from({length:15},(_,i)=>i+13));
  const a=arrays();applyHomeTerrainToArrays(a,edits,n);applyHomeNorthernCliff(a,{...h,terrainEdits:edits},n);
  const enc=arr=>Array.from(arr,v=>String.fromCharCode(v+48)).join('');
  const scene=sceneFromMap({name:'test-north-curtain',biome:'forest',n,cell:16,
   level:enc(a.level),water:enc(a.water),road:enc(a.road),forest:enc(a.forest),
   northCliffFixed:true,objects:[]});
  expect(scene.terrain.height(13*64,2*64)).toBe(HOME_NORTH_CLIFF.level*44);
  expect(scene.terrain.height(27*64,2*64)).toBe(HOME_NORTH_CLIFF.level*44);
  expect(scene.terrain.height(13*64,3*64)).toBe(0);
  for(let i=13;i<=27;i++){
   expect(scene.terrain.waterMask(i*64,2*64)).toBe(true);
   expect(scene.terrain.waterMask(i*64,3*64)).toBe(true);
  }
  // The physical rise is too steep to walk across and is identical on both ends.
  expect(scene.terrain.height(13*64,2*64)-scene.terrain.height(13*64,3*64)).toBe(132);
  expect(scene.terrain.height(27*64,2*64)-scene.terrain.height(27*64,3*64)).toBe(132);
 });
});
