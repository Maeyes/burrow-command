import {describe,it,expect} from 'vitest';
import {homeWallTiles,homePerimeterBlueprint,homeWallIntegrity,reconcileHomeWall,homeWallSegmentKey} from './warren-home-land.js';
const sides=['south','east','west','north'];
const homeFor=selected=>({ownedPlots:['base',...selected.flatMap(s=>[1,2,3].map(n=>s+n))],expandedSides:selected});
function boundaryEdges(home){
 const tiles=homeWallTiles(home),edges=new Set(),has=(i,j)=>tiles.has(i+','+j);
 for(const cell of tiles){
  const [i,j]=cell.split(',').map(Number);
  if(!has(i,j-1))edges.add('x:'+ (i-.5)+':'+(j-.5));
  if(!has(i,j+1))edges.add('x:'+ (i-.5)+':'+(j+.5));
  if(!has(i-1,j))edges.add('y:'+ (i-.5)+':'+(j-.5));
  if(!has(i+1,j))edges.add('y:'+ (i+.5)+':'+(j-.5));
 }
 return edges;
}
function actualEdges(sections){
 const edges=[];
 for(const f of sections)for(let n=0;n<(f.len||1);n++)
  edges.push(f.axis+':'+(f.x+(f.axis==='x'?n:0))+':'+(f.y+(f.axis==='y'?n:0)));
 return edges;
}
describe('expanded wall continuity and legacy-save reconciliation',()=>{
 for(let mask=0;mask<16;mask++){
  const picked=sides.filter((_,i)=>mask&(1<<i));
  it('fully encloses the owned '+(picked.join('+')||'base')+' layout at levels 1, 3 and 10',()=>{
   const home=homeFor(picked),expected=54+10*picked.length;
   for(const level of [1,3,10]){
    const wall=homePerimeterBlueprint(level,home),unitEdges=actualEdges(wall);
    expect(wall.length).toBe(expected);
    expect(new Set(wall.map(homeWallSegmentKey)).size).toBe(expected);
    expect(unitEdges.length).toBe(expected+6); // each gate replaces three edge units
    expect(new Set(unitEdges)).toEqual(boundaryEdges(home));
    expect(wall.filter(f=>f.kind==='gate').map(f=>f.side).sort()).toEqual(['east','south','west']);
    expect(wall.every(f=>f.hp===f.maxHp)).toBe(true);
   }
  });
 }
 it('repairs incomplete saved blueprints without healing surviving damaged segments',()=>{
  const home=homeFor(['south','west','north']),full=homePerimeterBlueprint(4,home);
  const broken=full.find(f=>f.kind==='fence');
  broken.hp=0;
  const partial=full.filter((f,i)=>i%7!==0);
  // Make sure the damaged section is retained in this partial save.
  if(!partial.includes(broken))partial.push(broken);
  const report=homeWallIntegrity(4,home,partial);
  expect(report.expected).toBe(84);
  expect(report.actual).toBeLessThan(84);
  expect(report.missing).toBeGreaterThan(0);
  const repaired=reconcileHomeWall(4,home,partial);
  expect(repaired).toHaveLength(84);
  expect(homeWallIntegrity(4,home,repaired).missing).toBe(0);
  expect(repaired.find(f=>homeWallSegmentKey(f)===homeWallSegmentKey(broken)).hp).toBe(0);
  const additions=repaired.filter(f=>!partial.some(o=>homeWallSegmentKey(o)===homeWallSegmentKey(f)));
  expect(additions.length).toBeGreaterThan(0);
  expect(additions.every(f=>f.hp===f.maxHp)).toBe(true);
 });
 it('replaces obsolete inner-wall sections after relocation without duplicating corner posts',()=>{
  const base=homePerimeterBlueprint(3,homeFor([]));
  const home=homeFor(['east','south']);
  const repaired=reconcileHomeWall(3,home,base);
  const report=homeWallIntegrity(3,home,repaired);
  expect(repaired).toHaveLength(74);
  expect(report.missing).toBe(0);
  expect(report.obsolete).toBe(0);
  expect(new Set(actualEdges(repaired)).size).toBe(boundaryEdges(home).size);
 });
});
