import {describe,it,expect} from 'vitest';
import {defaultHomeBuilder,normalizeHomeBuilder} from './warren-home-builder.js';
import {HOME_NORTH_CLIFF,HOME_NORTH_FINAL,HOME_PLOTS,homeAtNorthernCliff,homeOwnedCell,homeWallTiles,homePerimeterBlueprint,homeWallLayoutId} from './warren-home-land.js';
import {applyHomeNorthernCliff,applyHomeTerrainToArrays,applyHomeTerrainBrush,makeHomeWaterfall,validateHomeTerrainBatch} from './warren-home-terrain.js';
const built=sides=>{
 const home=defaultHomeBuilder();home.ownedPlots.push(...sides.flatMap(side=>[1,2,3].map(i=>side+i)));
 home.expandedSides=sides;home.wallLayoutId=homeWallLayoutId(home);return home;
};
const edges=wall=>{
 const out=new Set();
 for(const f of wall)for(let t=0;t<(f.len||1);t++)
  out.add(f.axis+':'+(f.x+(f.axis==='x'?t:0))+':'+(f.y+(f.axis==='y'?t:0)));
 return out;
};
const boundary=home=>{
 const tiles=homeWallTiles(home),has=(i,j)=>tiles.has(i+','+j),out=new Set();
 for(const cell of tiles){
  const [i,j]=cell.split(',').map(Number);
  if(!has(i,j-1))out.add('x:'+(i-.5)+':'+(j-.5));
  if(!has(i,j+1))out.add('x:'+(i-.5)+':'+(j+.5));
  if(!has(i-1,j))out.add('y:'+(i-.5)+':'+(j-.5));
  if(!has(i+1,j))out.add('y:'+(i+.5)+':'+(j-.5));
 }
 return out;
};
describe('Home Builder final northern cliff and staged expansion',()=>{
 it('has just one additional 5x5 northern stage; no additional S/E/W expansion plots',()=>{
  expect(Object.keys(HOME_PLOTS)).toHaveLength(15);
  expect(HOME_PLOTS.northUpper1.bounds).toEqual({x0:13,x1:17,y0:3,y1:7});
  expect(HOME_PLOTS.northUpper3.bounds).toEqual({x0:23,x1:27,y0:3,y1:7});
  expect(Object.keys(HOME_PLOTS).filter(id=>id.startsWith('east')||id.startsWith('west')||id.startsWith('south'))).toHaveLength(9);
 });
 it('rejects forged final cliff expansion until first north strip is expanded and fully owned',()=>{
  const raw={ownedPlots:['base','northUpper1','northUpper2','northUpper3'],expandedSides:['northUpper']};
  const home=normalizeHomeBuilder(raw);
  expect(home.expandedSides).toEqual([]);
  expect(homeAtNorthernCliff(home)).toBe(false);
  expect(homeOwnedCell(home,20,5)).toBe(true);
  expect(homeWallTiles(home).has('20,5')).toBe(false);
 });
 it('moves the north wall to first strip and finally replaces its 15 northern pieces with cliff',()=>{
  const first=built(['north']),final=built(['north','northUpper']);
  const before=homePerimeterBlueprint(10,first),after=homePerimeterBlueprint(10,final);
  expect(before).toHaveLength(64);
  expect(after).toHaveLength(59); // 64 + 10 new side panels - 15 rock-replaced top panels
  expect(before.filter(f=>f.axis==='x'&&f.y===7.5)).toHaveLength(15);
  expect(after.some(f=>f.axis==='x'&&f.y===7.5)).toBe(false);
  expect(after.some(f=>f.axis==='x'&&f.y===2.5)).toBe(false);
  expect(after.filter(f=>f.axis==='y'&&f.x===12.5&&f.y===2.5)).toHaveLength(1);
  expect(after.filter(f=>f.axis==='y'&&f.x===27.5&&f.y===2.5)).toHaveLength(1);
  expect(after.filter(f=>f.kind==='gate').map(f=>f.side).sort()).toEqual(['east','south','west']);
  const expected=boundary(final);
  for(let x=12.5;x<27.5;x++)expected.delete('x:'+x+':2.5');
  expect(edges(after)).toEqual(expected);
 });
 it('remains closed when S/E/W are all expanded and final north touches the cliff',()=>{
  const home=built(['south','east','west','north','northUpper']);
  const wall=homePerimeterBlueprint(4,home);
  expect(wall).toHaveLength(89);
  expect(wall.filter(f=>f.kind==='gate')).toHaveLength(3);
  const expected=boundary(home);
  for(let x=12.5;x<27.5;x++)expected.delete('x:'+x+':2.5');
  expect(edges(wall)).toEqual(expected);
  expect(homeAtNorthernCliff(home)).toBe(true);
 });
 it('bakes a contiguous level-3 natural cliff across the entire north edge of 40x40 world',()=>{
  const n=160,arrays={level:new Uint8Array(n*n),road:new Uint8Array(n*n),forest:new Uint8Array(n*n),water:new Uint8Array(n*n)};
  applyHomeNorthernCliff(arrays,defaultHomeBuilder(),n);
  expect(HOME_NORTH_CLIFF.level).toBe(3);
  for(const x of [0,1,64,80,159])for(const y of [0,2,6,9])expect(arrays.level[y*n+x]).toBe(3);
  expect(arrays.level[10*n+80]).toBe(0);
  const h=built(['north','northUpper']);
  let edits=[];for(const j of [2,3,4,5])edits=applyHomeTerrainBrush(edits,20,j,'water');
  h.terrainEdits=edits;
  const fall=makeHomeWaterfall(h,{i:20,j:2},edits);
  expect(fall.ok).toBe(true);
  h.waterfalls.push(fall.waterfall);
  applyHomeNorthernCliff(arrays,h,n);
  for(let y=6;y<=9;y++)for(let x=78;x<=81;x++)expect(arrays.water[y*n+x]).toBe(1);
  applyHomeTerrainToArrays(arrays,edits,n);
  expect(arrays.level[9*n+80]).toBe(3);
  expect(arrays.water[10*n+80]).toBe(1); // real downhill water has a contiguous source
 });
 it('lets the player paint only purchased north land and preserves cliff ownership',()=>{
  const first=built(['north']),last=built(['north','northUpper']);
  const northUpper=applyHomeTerrainBrush([],20,5,'raise');
  expect(validateHomeTerrainBatch(first,northUpper).ok).toBe(false);
  expect(validateHomeTerrainBatch(last,northUpper).ok).toBe(true);
  expect(validateHomeTerrainBatch(last,[{i:20,j:2,ground:'grass',elevation:2,water:false}]).ok).toBe(false);
 });
});
