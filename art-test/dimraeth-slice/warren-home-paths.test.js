import {describe,it,expect} from 'vitest';
import {applyHomeNativePathsToArrays,isHomeNativePath} from './warren-home-paths.js';
import {normalizeHomeBuilder} from './warren-home-builder.js';
const n=160,world=(i,j)=>({x:i*64,y:j*64,rotation:0});
const arrays=()=>({road:new Uint8Array(n*n),water:new Uint8Array(n*n)});
const check=(road,i,j)=>{const out=[];for(let y=j*4-2;y<=j*4+1;y++)for(let x=i*4-2;x<=i*4+1;x++)out.push(road[y*n+x]);return out;};
describe('Home Builder native Map Editor path masks',()=>{
 it('converts four-by-four editor subcells for native dirt and stone, with no floating sprite requirement',()=>{
  expect(isHomeNativePath('dirtPath')).toBe(true);
  expect(isHomeNativePath('stonePath')).toBe(true);
  expect(isHomeNativePath('oak')).toBe(false);
  const a=arrays();
  applyHomeNativePathsToArrays(a,[{prefab:'dirtPath',...world(15,25)},{prefab:'stonePath',...world(16,25)}],n);
  expect(check(a.road,15,25)).toEqual(Array(16).fill(2));
  expect(check(a.road,16,25)).toEqual(Array(16).fill(1));
  expect(check(a.road,17,25)).toEqual(Array(16).fill(0));
 });
 it('preserves water priority and ignores unrelated decorations',()=>{
  const a=arrays(),k=25*4*n+15*4;a.water[k]=1;
  applyHomeNativePathsToArrays(a,[{prefab:'stonePath',...world(15,25)},{prefab:'oak',...world(16,25)}],n);
  expect(a.road[k]).toBe(0);
  expect(check(a.road,15,25).filter(v=>v===1)).toHaveLength(15);
  expect(check(a.road,16,25)).toEqual(Array(16).fill(0));
 });
 it('keeps legacy saved path records, original IDs and refund receipts intact',()=>{
  const raw={placedObjects:[
   {id:'decor-7',prefab:'dirtPath',...world(15,25),spent:{livingMoss:1}},
   {id:'decor-8',prefab:'stonePath',...world(16,25),spent:{livingMoss:2}}
  ]};
  const home=normalizeHomeBuilder(raw);
  expect(home.placedObjects.map(o=>o.id)).toEqual(['decor-7','decor-8']);
  expect(home.placedObjects.map(o=>o.spent)).toEqual([{livingMoss:1},{livingMoss:2}]);
  const a=arrays();applyHomeNativePathsToArrays(a,home.placedObjects,n);
  expect(check(a.road,15,25)).toEqual(Array(16).fill(2));
  expect(check(a.road,16,25)).toEqual(Array(16).fill(1));
 });
 it('moving or demolishing one recorded path changes only its terrain mask',()=>{
  const old=[{id:'a',prefab:'dirtPath',...world(15,25)},{id:'b',prefab:'stonePath',...world(16,25)}];
  const moved=[{...old[0],...world(15,26)},old[1]];
  const before=arrays(),after=arrays();
  applyHomeNativePathsToArrays(before,old,n);applyHomeNativePathsToArrays(after,moved,n);
  expect(check(after.road,15,25)).toEqual(Array(16).fill(0));
  expect(check(after.road,15,26)).toEqual(Array(16).fill(2));
  expect(check(after.road,16,25)).toEqual(check(before.road,16,25));
  const removed=arrays();applyHomeNativePathsToArrays(removed,[old[1]],n);
  expect(check(removed.road,15,25)).toEqual(Array(16).fill(0));
 });
});
