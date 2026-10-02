import {describe,it,expect} from 'vitest';
import {craftRevealCards,rarityCounts,renderCraftRevealHtml} from './warren-craft-reveal.js';

const p=(id,rarity)=>({id,templateId:'sporewoodScepter',rarity});
const result={made:[p('a','normal'),p('b','rare'),p('c','normal'),p('d','epic')],retained:[p('b','rare'),p('d','epic')],review:[p('c','normal')],
 dismantled:[p('a','normal')],fragments:3,reviewFor:{c:'mage'}};
describe('craft reveal',()=>{
 it('keeps craft order and marks each piece kept / review / dismantled',()=>{
  expect(craftRevealCards(result).map(c=>c.status)).toEqual(['dismantled','kept','review','kept']);
 });
 it('counts by rarity from low to high',()=>{
  expect(rarityCounts(craftRevealCards(result))).toEqual([{rarity:'normal',count:2},{rarity:'rare',count:1},{rarity:'epic',count:1}]);
 });
 it('labels salvaged pieces as dismantled and reports fragments',()=>{
  const html=renderCraftRevealHtml(result,{mage:{name:'นักเวท'}});
  expect(html).toContain('ย่อยแล้ว');expect(html).toContain('Stone Fragments +3');expect(html).toContain('เหมาะกับ นักเวท');
  expect(html).toContain('ดีที่สุด: Epic');
 });
});
