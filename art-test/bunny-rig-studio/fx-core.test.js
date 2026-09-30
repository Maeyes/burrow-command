import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const sandbox={};
runInNewContext(readFileSync(new URL('./fx-core.js',import.meta.url),'utf8'),sandbox);
const fx=sandbox.BunnyFXCore;
describe('FX pixel operations',()=>{
 it('supports RGBA hex parsing and validates dimensions',()=>{
  expect(fx.validSize(64,96)).toEqual({width:64,height:96});
  expect(()=>fx.validSize(600,64)).toThrow();
  expect(fx.color('#ffcc33')).toEqual([255,204,51,255]);
  expect(fx.color('#00bbff80')).toEqual([0,187,255,128]);
 });
 it('draws and erases pixels without affecting neighbors',()=>{
  const img=new Uint8ClampedArray(12*12*4),ink=fx.color('#ffd166');
  fx.pixel(img,12,12,4,4,ink);
  expect(fx.pick(img,12,12,4,4)).toEqual(ink);
  expect(fx.pick(img,12,12,5,4)).toEqual([0,0,0,0]);
  fx.brush(img,12,12,4,4,1,[0,0,0,0]);
  expect(fx.pick(img,12,12,4,4)).toEqual([0,0,0,0]);
 });
 it('draws lines and circles with transparent interiors',()=>{
  const img=new Uint8ClampedArray(20*20*4),ink=fx.color('#ffffff');
  expect(fx.line(img,20,20,0,0,9,9,ink)).toBe(10);
  for(let i=0;i<10;i++)expect(fx.pick(img,20,20,i,i)).toEqual(ink);
  img.fill(0);
  expect(fx.ellipse(img,20,20,2,2,17,17,ink)).toBeGreaterThan(20);
  expect(fx.pick(img,20,20,10,10)[3]).toBe(0);
 });
 it('flood fills bounded regions and keeps detached pixels unchanged',()=>{
  const img=new Uint8ClampedArray(12*12*4),wall=fx.color('#ffffff'),fill=fx.color('#ff000088');
  for(let y=0;y<12;y++)fx.pixel(img,12,12,6,y,wall);
  expect(fx.fill(img,12,12,0,0,fill)).toBe(72);
  expect(fx.pick(img,12,12,9,0)).toEqual([0,0,0,0]);
  expect(fx.fill(img,12,12,0,0,fill)).toBe(0);
 });
 it('finds alpha bounding boxes',()=>{
  const img=new Uint8ClampedArray(12*12*4);
  expect(fx.opaqueBounds(img,12,12)).toBe(null);
  fx.pixel(img,12,12,1,2,fx.color('#ffcc22'));
  fx.pixel(img,12,12,11,10,fx.color('#ffcc22'));
  expect(fx.opaqueBounds(img,12,12)).toEqual({x:1,y:2,w:11,h:9});
 });
});
