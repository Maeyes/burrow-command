import {describe,it,expect} from 'vitest';
import {recolorPixels,isTrimPixel,CLASS_HUES} from './warren-class-colors.js';

// 1×10 column: ear pink at the top, scarf magenta lower down, plus fur and outline.
const px=rows=>new Uint8ClampedArray(rows.flatMap(c=>c?[...c,255]:[0,0,0,0]));
describe('class trim recolor',()=>{
 it('detects only bright saturated magenta',()=>{
  expect(isTrimPixel(219,43,114)).toBe(true);
  expect(isTrimPixel(245,239,245)).toBe(false); // fur
  expect(isTrimPixel(73,5,56)).toBe(false);     // outline
 });
 it('recolors the scarf but keeps the ears pink',()=>{
  const d=px([[219,43,114],[245,239,245],[245,239,245],[245,239,245],[245,239,245],[245,239,245],[219,43,114],[245,239,245],[73,5,56],[245,239,245]]);
  recolorPixels(d,1,10,CLASS_HUES.guard);
  expect([...d.slice(0,3)]).toEqual([219,43,114]);
  const [r,,b]=d.slice(24,27);expect(b).toBeGreaterThan(r);
  expect([...d.slice(32,35)]).toEqual([73,5,56]);
 });
 it('gives every class a distinct hue',()=>expect(new Set(Object.values(CLASS_HUES)).size).toBe(7));
});
import {auraPixels} from './warren-class-colors.js';
describe('aura cloak',()=>{
 it('glows around the lower body but not around the ears',()=>{
  const w=9,h=20,d=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++){const i=(y*w+4)*4;d[i]=d[i+1]=d[i+2]=d[i+3]=255;}
  auraPixels(d,w,h,CLASS_HUES.mage);
  expect(d[(1*w+5)*4+3]).toBe(0);          // beside the ear: no glow
  expect(d[(18*w+5)*4+3]).toBeGreaterThan(0); // beside the legs: glow
  expect(d[(18*w+4)*4+3]).toBe(255);       // sprite pixels untouched
 });
});
import {auraTier,bestRarity,SPARKLE_BY_RARITY} from './warren-class-colors.js';
describe('level aura and gear sparkles',()=>{
 it('aura tier rises with level',()=>{
  expect([1,4,5,10,19,20,60].map(auraTier)).toEqual([0,0,1,2,2,3,3]);
 });
 it('higher tier glows wider and brighter',()=>{
  const glow=tier=>{const w=15,h=20,d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++){const i=(y*w+7)*4;d[i]=d[i+1]=d[i+2]=d[i+3]=255;}
   auraPixels(d,w,h,0,tier);let n=0;for(let i=3;i<d.length;i+=4)if(d[i]&&d[i]<255)n+=d[i];return n;};
  expect(glow(3)).toBeGreaterThan(glow(0));
 });
 it('sparkles only for Rare and above, using the best equipped piece',()=>{
  expect(bestRarity(['normal','epic','good'])).toBe('epic');
  expect(bestRarity([])).toBe('normal');
  expect(SPARKLE_BY_RARITY.good).toBeUndefined();
  expect(SPARKLE_BY_RARITY.legend.count).toBeGreaterThan(SPARKLE_BY_RARITY.rare.count);
 });
});
