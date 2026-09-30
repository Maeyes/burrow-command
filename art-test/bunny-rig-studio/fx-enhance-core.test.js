import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const sandbox={window:{}};
runInNewContext(readFileSync(new URL('./fx-enhance-core.js',import.meta.url),'utf8'),sandbox);
const core=sandbox.window.BunnyFXEnhanceCore;
const w=12,h=12;
function fixture(){
 const pixels=new Uint8ClampedArray(w*h*4);
 for(const [x,y] of [[1,1],[2,1],[3,1],[10,9],[11,9]]){
  pixels.set([240,160,40,255],(y*w+x)*4);
 }
 return pixels;
}
describe('FX Layer selection masks',()=>{
 it('click selects only the connected visible region, preserving detached sparks',()=>{
  const data=fixture(),before=data.slice(),a=core.getRegion(data,w,h,1,1);
  expect(a.bounds).toEqual({x:1,y:1,w:3,h:1});
  expect(a.mask.reduce((sum,v)=>sum+v,0)).toBe(3);
  expect(a.mask[9*w+10]).toBe(0);
  expect(data).toEqual(before);
 });
 it('marquee selects only opaque pixels inside its rectangle',()=>{
  const data=fixture();
  const selected=core.getMarquee(data,w,h,0,0,3,4);
  expect(selected.bounds).toEqual({x:0,y:0,w:4,h:5});
  expect(selected.mask.reduce((sum,v)=>sum+v,0)).toBe(3);
  expect(core.getMarquee(data,w,h,5,5,6,6)).toBe(null);
 });
 it('transparent clicks never select the character reference',()=>{
  expect(core.getRegion(fixture(),w,h,5,5)).toBe(null);
  expect(core.getRegion(fixture(),w,h,-1,5)).toBe(null);
 });
});
