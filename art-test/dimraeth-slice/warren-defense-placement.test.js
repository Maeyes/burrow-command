import {describe,it,expect} from 'vitest';
import {defaultHomeBuilder} from './warren-home-builder.js';
import {homePerimeterBlueprint} from './warren-home-land.js';
import {validateDefensePlacement,DEFENSE_FOOTPRINT} from './warren-defense-placement.js';
const T=64,p=(i,j)=>({x:i*T,y:j*T});
const create=(kind,home=defaultHomeBuilder(),more={})=>({kind,home,
 x:15*T,y:24*T,walls:homePerimeterBlueprint(2,home),
 defenses:[],colliders:[],objects:[],decorations:[],canStand:()=>true,...more});
const east=()=>{
 const home=defaultHomeBuilder();home.ownedPlots.push('east1','east2','east3');home.expandedSides.push('east');return home;
};
describe('defense placement within actual constructed wall footprint',()=>{
 it('removes the 520 radius limit and allows far purchased/expanded eastern annex',()=>{
  const home=east(),xy=p(30,16),arg=create('tower',home,xy);
  expect(Math.hypot(xy.x-20*T,xy.y-20*T)).toBeGreaterThan(520);
  expect(validateDefensePlacement(arg)).toMatchObject({ok:true});
  expect(validateDefensePlacement({...arg,kind:'magicCart'}).ok).toBe(true);
 });
 it('rejects land purchased outside the wall until the wall is expanded',()=>{
  const home=east(),xy=p(30,16);
  home.expandedSides=[];
  expect(validateDefensePlacement(create('tower',home,xy)).ok).toBe(false);
 });
 it('accepts free tiles near the former 170-unit exclusion if not overlapping the Hall',()=>{
  const arg=create('tower',defaultHomeBuilder(),p(21,22));
  expect(Math.hypot(arg.x-20*T,arg.y-20*T)).toBeLessThan(170);
  expect(validateDefensePlacement(arg).ok).toBe(true);
 });
 it('blocks the gates, intact walls and even destroyed wall positions',()=>{
  const home=defaultHomeBuilder();
  for(const kind of ['tower','magicCart']){
   expect(validateDefensePlacement(create(kind,home,p(20,27))).ok).toBe(false);
   const walls=homePerimeterBlueprint(2,home).map(f=>({...f,hp:0}));
   expect(validateDefensePlacement(create(kind,home,{...p(13,18),walls})).ok).toBe(false);
  }
 });
 it('disallows placements outside the enclosed irregular footprint or across its edges',()=>{
  const home=east();
  for(const kind of ['tower','magicCart']){
   expect(validateDefensePlacement(create(kind,home,p(30,30))).ok).toBe(false);
   expect(validateDefensePlacement(create(kind,home,p(32.4,16))).ok).toBe(false);
   expect(validateDefensePlacement(create(kind,home,p(30,16))).ok).toBe(true);
  }
 });
 it('rejects static tree colliders and overlapping building bounding boxes',()=>{
  const home=east(),spot=p(30,16);
  expect(validateDefensePlacement(create('tower',home,{...spot,colliders:[{type:'c',...spot,r:10}]})).ok).toBe(false);
  expect(validateDefensePlacement(create('tower',home,{...spot,colliders:[{type:'b',x0:spot.x-40,x1:spot.x+40,y0:spot.y-15,y1:spot.y+15}]})).ok).toBe(false);
  expect(validateDefensePlacement(create('tower',home,{...spot,objects:[{kind:'sprite',box:{x0:spot.x-10,x1:spot.x+10,y0:spot.y-10,y1:spot.y+10}}]})).ok).toBe(false);
 });
 it('preserves tower/cart spacing using their actual footprints, not an oversized build radius',()=>{
  const home=east(),spot=p(30,16),close={x:spot.x+25,y:spot.y,kind:'tower'};
  expect(validateDefensePlacement(create('tower',home,{...spot,defenses:[close]})).ok).toBe(false);
  const far={...close,x:spot.x+70};
  expect(validateDefensePlacement(create('magicCart',home,{...spot,defenses:[far]})).ok).toBe(true);
  expect(DEFENSE_FOOTPRINT.magicCart).toBeGreaterThan(DEFENSE_FOOTPRINT.tower);
 });
 it('reserves placement space around saved decorations and native path tiles',()=>{
  const home=east(),spot=p(30,16);
  expect(validateDefensePlacement(create('tower',home,{...spot,decorations:[{...spot,prefab:'stonePath',radius:0}]})).ok).toBe(false);
  expect(validateDefensePlacement(create('tower',home,{...spot,decorations:[{...spot,prefab:'flowerBush',radius:0}]})).ok).toBe(false);
 });
 it('does not trap a living rabbit or monster while building',()=>{
  const home=east(),spot=p(30,16);
  expect(validateDefensePlacement(create('tower',home,{...spot,occupants:[{...spot,r:12}]})).ok).toBe(false);
  expect(validateDefensePlacement(create('magicCart',home,{...spot,occupants:[{x:spot.x+10,y:spot.y,r:14}]})).ok).toBe(false);
 });
 it('requires a flat, accessible terrain footprint rather than a clear center alone',()=>{
  const home=east(),spot=p(30,16);
  expect(validateDefensePlacement(create('tower',home,{...spot,canStand:(x,y)=>x<=spot.x})).ok).toBe(false);
  expect(validateDefensePlacement(create('tower',home,{...spot,canStand:()=>true}))).toMatchObject({ok:true});
 });
});
