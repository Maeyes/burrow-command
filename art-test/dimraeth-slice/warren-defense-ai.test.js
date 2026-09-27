import {describe,it,expect} from 'vitest';
import {NIGHT_DEFENSE,selectNightDefenseTarget,chooseRaidGate,nearestClosedGate,assignedGateDefensePost} from './warren-defense-ai.js';

const C={x:0,y:0}, tower=(x,y=0)=>({x,y,hp:270});
const raider=(x,y=0,extra={})=>({x,y,night:true,dead:false,claims:0,...extra});
const distanceForTest=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

describe('Burrow Command: proactive nighttime defense',()=>{
 it('fans defenders across all three gates without stacking their posts',()=>{
  const center={x:1280,y:1280},units=Array.from({length:14},(_,id)=>({id}));
  const gates=[
   {x:18.5,y:27.5,axis:'x',len:3,kind:'gate',side:'south',hp:240},
   {x:12.5,y:18.5,axis:'y',len:3,kind:'gate',side:'west',hp:240},
   {x:27.5,y:18.5,axis:'y',len:3,kind:'gate',side:'east',hp:240},
  ];
  const posts=units.map(u=>assignedGateDefensePost(u,units,gates,center));
  expect(new Set(posts.map(p=>p.gate))).toEqual(new Set(['south','west','east']));
  expect(new Set(posts.map(p=>`${p.x}:${p.y}`)).size).toBe(units.length);
  expect(Math.min(...posts.flatMap((p,i)=>posts.slice(i+1).map(q=>distanceForTest(p,q))))).toBeGreaterThanOrEqual(45);
 });
 it('intercepts raiders outside a bunny ring sector before they destroy an outer tower',()=>{
  const guard={x:-235,y:0},post={...guard},t=tower(500),m=raider(700);
  expect(Math.hypot(post.x-m.x,post.y-m.y)).toBeGreaterThan(250); // prior AI ignored it
  expect(selectNightDefenseTarget(guard,post,[m],[t],C)).toBe(m);
  expect(m.claims).toBe(1);
 });
 it('protects a tower in immediate danger over an equally distant harmless raider',()=>{
  const u={x:0,y:0},post={...u},t=tower(520);
  const harmless=raider(-520),towerAttacker=raider(520);
  expect(selectNightDefenseTarget(u,post,[harmless,towerAttacker],[t],C)).toBe(towerAttacker);
 });
 it('engages direct hall invaders even with no towers built',()=>{
  const u={x:240,y:0},post={...u},m=raider(690);
  expect(selectNightDefenseTarget(u,post,[m],[],C)).toBe(m);
 });
 it('spreads multiple defenders across equally urgent tower threats',()=>{
  const west=raider(-500),east=raider(500),u={x:0,y:0};
  const towers=[tower(-400),tower(400)];
  expect(selectNightDefenseTarget(u,u,[east,west],towers,C)).toBe(east);
  expect(selectNightDefenseTarget(u,u,[east,west],towers,C)).toBe(west);
  expect([east.claims,west.claims]).toEqual([1,1]);
 });
 it('ignores dead/daytime/out-of-perimeter raiders and never chases across the full map',()=>{
  const u={x:240,y:0},post={...u},t=tower(500);
  expect(selectNightDefenseTarget(u,post,[raider(1600),raider(900,0,{night:false}),raider(400,0,{dead:true})],[t],C)).toBeNull();
  expect(selectNightDefenseTarget(u,post,[raider(950)],[t],C)).toBeNull();
  expect(selectNightDefenseTarget({x:-700,y:0},{x:-700,y:0},[raider(700)],[t],C)).toBeNull();
 });
 it('does not prioritize destroyed towers but still defends the village perimeter',()=>{
  const u={x:0,y:0},m=raider(710),broken=tower(500);broken.hp=0;
  expect(selectNightDefenseTarget(u,u,[m],[broken],C)).toBe(m);
 });
 it('steers a raider near a built barrier through the open gate rather than into the fence',()=>{
  const center={x:1280,y:1280};
  const gates=[{x:20,y:26,axis:'x',kind:'gate'},{x:24,y:22,axis:'y',kind:'gate'}];
  const fences=[{x:20,y:25,axis:'x',kind:'fence'},{x:23,y:22,axis:'y',kind:'fence'},...gates];
  expect(chooseRaidGate({x:1300,y:1640},fences,center)).toEqual({x:1312,y:1664});
  expect(chooseRaidGate({x:1510,y:1410},fences,center)).toEqual({x:1536,y:1440});
  expect(chooseRaidGate({x:1300,y:1640,passedGate:true},fences,center)).toBeNull();
  expect(chooseRaidGate({x:1300,y:1640},[],center)).toBeNull();
  expect(chooseRaidGate({x:1300,y:1640},gates,center)).toBeNull();
  expect(chooseRaidGate({x:1280,y:2400},fences,center)).toBeNull();
 });
 it('prefers a vulnerable closed gate on the raider side and routes other raiders to the open gate',()=>{
  const center={x:1280,y:1280};
  const south={x:18.5,y:27.5,axis:'x',len:3,kind:'gate',side:'south',closed:true,hp:240};
  const west={x:12.5,y:18.5,axis:'y',len:3,kind:'gate',side:'west',closed:true,hp:240};
  const east={x:27.5,y:18.5,axis:'y',len:3,kind:'gate',side:'east',closed:false,hp:240};
  const fence={x:17.5,y:27.5,axis:'x',len:1,kind:'fence',hp:55};
  expect(nearestClosedGate({x:1280,y:1890},[south,west,east])).toBe(south);
  expect(nearestClosedGate({x:480,y:1280},[south,west,east])).toBeNull();
  expect(chooseRaidGate({x:1280,y:1820},[south,west,east,fence],center)).toEqual({x:1760,y:1280});
  south.hp=0;
  expect(nearestClosedGate({x:1280,y:1890},[south,west,east])).toBeNull();
 });
 it('has a defense perimeter outside maximum buildable tower radius',()=>{
  expect(NIGHT_DEFENSE.villageRadius).toBeGreaterThan(520);
 });
});
