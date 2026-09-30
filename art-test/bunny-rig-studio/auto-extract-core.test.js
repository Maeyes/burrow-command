import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const sandbox={};
runInNewContext(readFileSync(new URL('./auto-extract-core.js',import.meta.url),'utf8'),sandbox);
const {validRect,remapMask,trimBounds,connectedRegions,paintMask}=sandbox.BunnyExtractCore;
function rgba(width,height,points){
 const data=new Uint8ClampedArray(width*height*4);
 for(const [x,y] of points){const p=(y*width+x)*4;data.set([255,150,30,255],p)}
 return data;
}
describe('non-destructive Auto Extract helpers',()=>{
 it('validates independent extraction boundaries including overflow',()=>{
  expect(validRect({x:8,y:0,w:4,h:7},20,20)).toEqual({x:8,y:0,w:4,h:7});
  expect(()=>validRect({x:18,y:0,w:4,h:7},20,20)).toThrow();
  expect(()=>validRect({x:0,y:0,w:1025,h:7},2048,2048)).toThrow();
 });
 it('remaps a hand-edited mask when increasing or shrinking crop (new area retained)',()=>{
  const old={x:3,y:5,w:2,h:2};
  const mask=new Uint8Array([1,0,0,1]);
  const expanded=remapMask(mask,old,{x:2,y:4,w:4,h:4});
  expect([...expanded.slice(5,7)]).toEqual([1,0]);
  expect(expanded[0]).toBe(1);
  expect([...remapMask(expanded,{x:2,y:4,w:4,h:4},old)]).toEqual([...mask]);
 });
 it('detects detached tail, staff and main body but never auto-removes them',()=>{
  const pixels=rgba(20,12,[
   ...Array.from({length:5},(_,y)=>Array.from({length:4},(_,x)=>[x+8,y+4])).flat(),
   [0,0],[0,1],[1,0],    // detached weapon
   [19,10],[19,11],       // detached tail
  ]);
  const original=pixels.slice(),result=connectedRegions(pixels,20,12);
  expect(result.regions.map(r=>r.pixels).sort((a,b)=>b-a)).toEqual([20,3,2]);
  expect(result.regions[result.largestId].bounds.w).toBe(4);
  expect(pixels).toEqual(original);
 });
 it('manual brush can remove stray frame without removing other disconnected parts',()=>{
  const points=[[1,1],[2,1],[8,1],[8,2],[3,5]];
  const pixels=rgba(10,8,points);
  const mask=new Uint8Array(80).fill(1);
  expect(paintMask(mask,10,8,8,1,1,false,pixels)).toBeGreaterThan(0);
  const bbox=trimBounds(pixels,10,8,mask);
  expect(bbox).toEqual({x:1,y:1,w:3,h:5});
  expect(paintMask(mask,10,8,8,1,1,true,pixels)).toBeGreaterThan(0);
  expect(trimBounds(pixels,10,8,mask)).toEqual({x:1,y:1,w:8,h:5});
 });
 it('trim accounts for transparent margins, masks and fully empty selections',()=>{
  const data=rgba(14,12,[[3,2],[8,10],[4,4]]);
  expect(trimBounds(data,14,12)).toEqual({x:3,y:2,w:6,h:9});
  const mask=new Uint8Array(14*12).fill(1);mask[8+10*14]=0;
  expect(trimBounds(data,14,12,mask)).toEqual({x:3,y:2,w:2,h:3});
  expect(trimBounds(data,14,12,new Uint8Array(14*12))).toBeNull();
 });
 it('cannot paint transparency into new opaque pixels',()=>{
  const data=rgba(4,4,[[1,1]]);
  const mask=new Uint8Array(16);
  expect(paintMask(mask,4,4,0,0,3,true,data)).toBe(1);
  expect(mask.reduce((a,b)=>a+b)).toBe(1);
 });
});
