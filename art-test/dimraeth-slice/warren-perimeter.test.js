import {describe,it,expect} from 'vitest';
import {PERIMETER_TIERS,perimeterBlueprint,perimeterFootprint,perimeterHealth,perimeterMid,nearestPerimeterSection,normalizeGateSelections,toggleGateSelection,gateShouldClose} from './warren-perimeter.js';

describe('One-click Warren perimeter',()=>{
 it('keeps the same 15×15 footprint through wood, stone and reinforced stone upgrades',()=>{
  expect(PERIMETER_TIERS).toHaveLength(11);
  expect(PERIMETER_TIERS.map(t=>t.radius*2)).toEqual([0,...Array(10).fill(15)]);
  expect(PERIMETER_TIERS.map(t=>t.material)).toEqual(['none','wood',...Array(9).fill('stone')]);
  const baseline=perimeterBlueprint(1).map(f=>f.axis+':'+f.x+':'+f.y);
  for(const level of [2,3])expect(perimeterBlueprint(level).map(f=>f.axis+':'+f.x+':'+f.y)).toEqual(baseline);
  for(let level=1;level<=3;level++){
   const side=perimeterFootprint(level).side;
   const walls=perimeterBlueprint(level);
   expect(walls).toHaveLength(side+3*(side-3)+3);
   expect(walls.filter(w=>w.kind==='gate')).toHaveLength(3);
   expect(walls.filter(w=>w.kind==='fence')).toHaveLength(side+3*(side-3));
   expect(walls.filter(w=>w.kind==='gate').map(w=>w.side)).toEqual(['south','west','east']);
   expect(new Set(walls.map(w=>w.axis+':'+w.x+':'+w.y)).size).toBe(walls.length);
   const min=20-side/2,max=20+side/2;
   // Every segment remains on the actual square edges and cannot cross an interior house.
   for(const f of walls){
    expect(f.axis==='x'?[min,max].includes(f.y):[min,max].includes(f.x)).toBe(true);
    expect(f.x).toBeGreaterThanOrEqual(min);
    expect(f.y).toBeGreaterThanOrEqual(min);
    expect(f.x+(f.axis==='x'?f.len:0)).toBeLessThanOrEqual(max);
    expect(f.y+(f.axis==='y'?f.len:0)).toBeLessThanOrEqual(max);
   }
   const gates=walls.filter(w=>w.kind==='gate').map(f=>perimeterMid(f));
   expect(gates).toEqual([
    {x:20*64,y:max*64},
    {x:min*64,y:20*64},{x:max*64,y:20*64},
   ]);
   expect(walls.every(w=>w.material===PERIMETER_TIERS[level].material)).toBe(true);
   expect(walls.every(w=>w.kind==='gate'?w.maxHp===PERIMETER_TIERS[level].gateHp:w.maxHp===PERIMETER_TIERS[level].sectionHp)).toBe(true);
   expect(walls.every(w=>!!w.reinforced===(level===3))).toBe(true);
  }
 });
 it('at most two selectable closed sides always leave one open approach',()=>{
  const gates=perimeterBlueprint(1).filter(f=>f.kind==='gate');
  expect(normalizeGateSelections(['south','east','west','unknown','south'])).toEqual(['south','east']);
  expect(toggleGateSelection([], 'south')).toEqual(['south']);
  expect(toggleGateSelection(['south'], 'east')).toEqual(['south','east']);
  expect(toggleGateSelection(['south','east'], 'west')).toBeNull();
  expect(toggleGateSelection(['south','east'], 'south')).toEqual(['east']);
  const selected=['south','east'];
  expect(gates.filter(g=>gateShouldClose(g,true,selected)).map(g=>g.side)).toEqual(selected);
  expect(gates.some(g=>!gateShouldClose(g,true,selected))).toBe(true);
  expect(gates.every(g=>!gateShouldClose(g,false,selected))).toBe(true);
  const smashed=gates.find(g=>g.side==='south');smashed.hp=0;
  expect(gateShouldClose(smashed,true,selected)).toBe(false);
 });
 it('keeps all three authored houses and the main plaza inside even at the smallest size',()=>{
  const r=perimeterFootprint(1).halfSide;
  // Centers from Warren map: main house (20,20); side houses (16.2,17.4) and (23.8,17.2).
  for(const [x,y] of [[20,20],[16.2,17.4],[23.8,17.2]]) {
   expect(Math.max(Math.abs(x-20),Math.abs(y-20))).toBeLessThan(r-1);
  }
 });
 it('reports missing HP for the all-repair UI and ignores broken sections in targeting',()=>{
  const parts=perimeterBlueprint(1);
  const first=parts.find(p=>p.kind==='fence');
  first.hp=0;
  const info=perimeterHealth(parts);
  expect(info.broken).toBe(1);
  expect(info.damaged).toBe(1);
  expect(info.hp).toBe(info.maxHp-first.maxHp);
  expect(nearestPerimeterSection(perimeterMid(first),[first])).toBeNull();
 });
});
