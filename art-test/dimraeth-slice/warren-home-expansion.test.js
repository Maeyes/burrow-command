import {describe,it,expect} from 'vitest';
import {perimeterBlueprint,perimeterTier} from './warren-perimeter.js';
import {defaultHomeBuilder,normalizeHomeBuilder,validateHomePlacement,HOME_ITEMS} from './warren-home-builder.js';
import {HOME_PLOTS,HOME_PLOT_COST,HOME_WALL_COST,homeOwnedCell,fullyOwnedSide,homeWallTiles,homePerimeterBlueprint,homeWallLayoutId} from './warren-home-land.js';
import {applyHomeTerrainBrush,validateHomeTerrainBatch,makeHomeWaterfall,applyHomeTerrainToArrays,quoteHomeTerrain,normalizeHomeTerrain,deriveHomeRivers} from './warren-home-terrain.js';
const purchased=(...sides)=>{const home=defaultHomeBuilder();home.ownedPlots.push(...sides.flatMap(s=>[s+'1',s+'2',s+'3']));home.expandedSides=sides;home.wallLayoutId=homeWallLayoutId(home);return home;};
describe('Home Builder land and terrain expansion',()=>{
 it('has fifteen fixed 5×5 deeds including a final northern strip; ownership does not relocate the wall',()=>{
  expect(Object.keys(HOME_PLOTS)).toHaveLength(15);
  expect(HOME_PLOT_COST.mats).toBeGreaterThan(0);
  expect(HOME_WALL_COST.mats).toBeGreaterThan(HOME_PLOT_COST.mats);
  const home=defaultHomeBuilder();home.ownedPlots.push('south1');
  expect(homeOwnedCell(home,15,30)).toBe(true);
  expect(homeOwnedCell(home,25,30)).toBe(false);
  expect(fullyOwnedSide(home,'south')).toBe(false);
  expect(homePerimeterBlueprint(2,home)).toEqual(perimeterBlueprint(2));
 });
 it('builds only prepaid sides and keeps one S/E/W gate, solid north',()=>{
  const home=purchased('south','east','north');
  expect(home.wallLayoutId).toContain('south');
  const walls=homePerimeterBlueprint(2,home);
  const gates=walls.filter(w=>w.kind==='gate');
  expect(gates).toHaveLength(3);
  expect(gates.map(g=>g.side).sort()).toEqual(['east','south','west']);
  expect(gates.find(g=>g.side==='south').y).toBe(32.5);
  expect(gates.find(g=>g.side==='east').x).toBe(32.5);
  expect(gates.find(g=>g.side==='west').x).toBe(12.5);
  expect(walls.some(f=>f.y===7.5&&f.kind==='fence')).toBe(true);
  expect(homeWallTiles(home).has('31,31')).toBe(false);
  expect(new Set(walls.map(f=>f.axis+':'+f.x+':'+f.y)).size).toBe(walls.length);
 });
 it('never accepts forged expansion flags in a save and preserves paid parcels',()=>{
  const raw={ownedPlots:['base','south1','south2','bogus'],expandedSides:['south','east']};
  const home=normalizeHomeBuilder(raw);
  expect(home.ownedPlots).toEqual(['base','south1','south2']);
  expect(home.expandedSides).toEqual([]);
  expect(homeWallTiles(home).has('20,32')).toBe(false);
 });
 it('allows houses on fully owned ground but not across a property boundary',()=>{
  const home=defaultHomeBuilder();
  expect(HOME_ITEMS.farmerHouse.group).toBe('houses');
  expect(validateHomePlacement(home,'farmerHouse',14*64,25*64).ok).toBe(false);
  const south=purchased('south');
  expect(validateHomePlacement(south,'farmerHouse',20*64,30*64).ok).toBe(false); // reserved gate route
 });
 it('terrain brush is deterministic, and water cannot cut an entry corridor',()=>{
  const home=defaultHomeBuilder();
  let painted=applyHomeTerrainBrush([],15,25,'dirt');
  painted=applyHomeTerrainBrush(painted,15,25,'stone');
  expect(painted).toHaveLength(1);expect(painted[0].ground).toBe('stone');
  expect(validateHomeTerrainBatch(home,applyHomeTerrainBrush([],20,25,'water')).ok).toBe(false);
  expect(validateHomeTerrainBatch(home,applyHomeTerrainBrush([],15,25,'water')).ok).toBe(true);
  expect(validateHomeTerrainBatch(home,applyHomeTerrainBrush([],20,20,'water')).ok).toBe(false);
 });
 it('north hill must wait for purchased plots and north-wall expansion',()=>{
  const source=[{i:19,j:9,ground:'grass',elevation:1,water:false}];
  const notYet=defaultHomeBuilder();
  expect(validateHomeTerrainBatch(notYet,source).ok).toBe(false);
  const yes=purchased('north');
  expect(validateHomeTerrainBatch(yes,source).ok).toBe(true);
 });
 it('requires 3 contiguous hill tiles, a water source, basin and downstream river',()=>{
  const home=purchased('north'),add=(edits,i,j,brush)=>applyHomeTerrainBrush(edits,i,j,brush);
  let edits=[];
  for(const i of [19,20,21])edits=add(edits,i,9,'raise');
  expect(makeHomeWaterfall(home,{i:20,j:9},edits).ok).toBe(false);
  for(const [i,j] of [[20,9],[20,10],[20,11],[20,12]])edits=add(edits,i,j,'water');
  const result=makeHomeWaterfall(home,{i:20,j:9},edits);
  expect(result.ok).toBe(true);
  expect(result.waterfall.cliffTiles).toHaveLength(3);
  expect(result.waterfall.riverPath.length).toBe(2);
  expect(validateHomeTerrainBatch(home,edits).ok).toBe(true);
  const rivers=deriveHomeRivers(edits);
  expect(rivers).toHaveLength(1);expect(rivers[0].tiles).toHaveLength(4);
 });
 it('bakes real engine elevation and water from saved edits and charges only draft changes',()=>{
  const n=160,size=n*n,arrays={level:new Uint8Array(size),road:new Uint8Array(size),forest:new Uint8Array(size),water:new Uint8Array(size)};
  const edits=[{i:20,j:9,ground:'grass',elevation:1,water:true},{i:15,j:25,ground:'stone',elevation:0,water:false}];
  applyHomeTerrainToArrays(arrays,edits,n);
  expect(arrays.level[(9*4)*n+20*4]).toBe(1);
  expect(arrays.water[(9*4)*n+20*4]).toBe(1);
  expect(arrays.road[(25*4)*n+15*4]).toBe(1);
  const quote=quoteHomeTerrain([],edits);
  expect(quote.changes).toBe(2);expect(quote.mats).toBeGreaterThan(20);
  expect(quoteHomeTerrain(edits,edits).changes).toBe(0);
 });
 it('keeps invalid old terrain in Recovery Storage, not among authored edits',()=>{
  const home=defaultHomeBuilder();
  const normalized=normalizeHomeTerrain([{i:15,j:25,ground:'stone',elevation:0,water:false},{i:33,j:33,ground:'grass',elevation:1,water:false}],home);
  expect(normalized).toHaveLength(1);expect(home.recovery).toHaveLength(1);
  expect(home.recovery[0].type).toBe('terrain');
 });
});
