import {describe,it,expect} from 'vitest';
import * as P from './engine/palettes.js';
import {modularHouseOptions} from './warren-home-art.js';

const houses=['farmerHouse','smithHouse','mageHouse','storeHouse','barnHouse','pavilion'];
describe('Modular house sprite contracts',()=>{
 it('provides valid buildingSprite options for every house, rotation and roof variant',()=>{
  let combinations=0;
  for(const prefab of houses)for(let rotation=0;rotation<4;rotation++)for(let variant=0;variant<3;variant++){
   const o=modularHouseOptions(prefab,rotation,variant);
   expect(o.x1-o.x0).toBeGreaterThan(70);
   expect(o.y1-o.y0).toBeGreaterThan(70);
   expect(o.roofH).toBeGreaterThan(0);
   expect(o.roof).toHaveLength(5);
   expect(o.door?.at).toBe(.5);
   expect(o.windows).toHaveLength(4);
   if(o.awning){
    expect(o.awning.cols).toHaveLength(2);
    expect(o.awning.cols.every(c=>/^#[0-9a-f]{6}$/i.test(c))).toBe(true);
    expect(o.awning.face).toBe(rotation%2?'x':'y');
    expect(o.awning.at).toBe(.5);
   }
   if(o.tower){
    expect(o.tower.w).toBeGreaterThan(0);
    expect(o.tower.h).toBeGreaterThan(0);
    expect(o.tower.roof).toEqual(P.SLATE);
   }
   combinations++;
  }
  expect(combinations).toBe(72);
 });
 it('configures blacksmith, store and barn awnings as full objects (never booleans)',()=>{
  for(const name of ['smithHouse','storeHouse','barnHouse']){
   expect(modularHouseOptions(name,0,0).awning.cols).toHaveLength(2);
  }
 });
 it('configures wizard house tower as a correctly typed object',()=>{
  const o=modularHouseOptions('mageHouse',0,0);
  expect(o.tower).toEqual({w:26,h:42,roof:P.SLATE});
 });
 it('keeps standalone farmer house and pavilion free of unsupported attachments',()=>{
  for(const name of ['farmerHouse','pavilion']){
   const o=modularHouseOptions(name,0,0);
   expect(o.awning).toBeUndefined();
   expect(o.tower).toBeUndefined();
  }
 });
});
