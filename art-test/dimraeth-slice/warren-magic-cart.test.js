import {describe,it,expect} from 'vitest';
import {MAGIC_CART_COST,magicCartCap,normalizeMagicCart} from './warren-magic-cart.js';

describe('Magic siege cart progression',()=>{
 it('unlocks 2, 4 and 6 carts at Warren levels 15, 20 and 25',()=>{
  expect([1,14,15,19,20,24,25,30].map(magicCartCap)).toEqual([0,0,2,2,4,4,6,6]);
 });
 it('preserves only Mage garrisons and safely normalizes HP',()=>{
  expect(normalizeMagicCart({x:10,y:20}).hp).toBe(MAGIC_CART_COST.hp);
  expect(normalizeMagicCart({x:10,y:20,level:5,hp:9999,garrison:{cls:'mage',name:'Mimi',level:4,exp:9}})).toMatchObject({level:5,hp:1100,garrison:{cls:'mage',name:'Mimi',level:4,exp:9}});
  expect(normalizeMagicCart({x:10,y:20,hp:40,garrison:{cls:'archer'}}).garrison).toBeNull();
  expect(normalizeMagicCart({x:'bad',y:20})).toBeNull();
 });
});
