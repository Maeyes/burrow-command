import {describe,it,expect} from 'vitest';
import {HOME_ITEMS,defaultHomeBuilder,snapHome,validateHomePlacement,normalizeHomeBuilder,refundHome,homeMainRoute} from './warren-home-builder.js';
import {renderHomeBuilderHtml} from './warren-home-ui.js';
const tile=(i,j)=>[i*64,j*64];
const valid=()=>validateHomePlacement(defaultHomeBuilder(),'oak',...tile(15,25));
describe('Home Builder Foundation v1',()=>{
 it('offers 23 cosmetic pieces including modular houses without stat modifiers',()=>{
  expect(Object.keys(HOME_ITEMS)).toHaveLength(23);
  for(const item of Object.values(HOME_ITEMS)){
   expect(item.mats).toBeGreaterThan(0);
   expect(item.gold).toBeGreaterThan(0);
   expect(item.stats).toBeUndefined();
  }
 });
 it('snaps to the permanent base grid and refuses unowned land',()=>{
  expect(snapHome(15*64+20,25*64-12)).toEqual({x:960,y:1600});
  expect(valid().ok).toBe(true);
  expect(validateHomePlacement(defaultHomeBuilder(),'oak',...tile(13,25)).ok).toBe(false);
 });
 it('reserves the south/east/west gate routes for rabbits and raiders',()=>{
  for(const pos of [[20,25],[20,22],[15,20],[25,20]]){
   expect(homeMainRoute(...tile(...pos))).toBe(true);
   expect(validateHomePlacement(defaultHomeBuilder(),'oak',...tile(...pos)).ok).toBe(false);
  }
  expect(validateHomePlacement(defaultHomeBuilder(),'dirtPath',...tile(20,25)).ok).toBe(true);
 });
 it('refuses existing hall, purchased buildings and real runtime blockers',()=>{
  expect(validateHomePlacement(defaultHomeBuilder(),'crate',...tile(20,20)).ok).toBe(false);
  expect(validateHomePlacement(defaultHomeBuilder(),'oak',...tile(15,25),0,{canStand:()=>false}).ok).toBe(false);
  expect(validateHomePlacement(defaultHomeBuilder(),'oak',...tile(15,25),0,{defenses:[{x:960,y:1600,radius:45}]}).ok).toBe(false);
 });
 it('does not stack decoration and can ignore the moved object itself',()=>{
  const home=defaultHomeBuilder();
  home.placedObjects.push({id:'decor-1',prefab:'oak',x:960,y:1600});
  expect(validateHomePlacement(home,'bush',960,1600).ok).toBe(false);
  expect(validateHomePlacement(home,'oak',960,1600,0,{ignoreId:'decor-1'}).ok).toBe(true);
 });
 it('recovers invalid old placements instead of silently deleting items',()=>{
  const home=normalizeHomeBuilder({nextId:4,placedObjects:[
   {id:'decor-1',prefab:'oak',x:960,y:1600,rotation:0,spent:{livingMoss:4},variant:0},
   {id:'decor-2',prefab:'oak',x:1280,y:1600,rotation:0,spent:{copperOre:3}},
   {id:'decor-3',prefab:'unknown',x:960,y:1600,rotation:0,spent:{}}
  ]});
  expect(home.version).toBe(4);expect(home.placedObjects).toHaveLength(1);
  expect(home.recovery).toHaveLength(2);expect(home.recovery[0].spent).toEqual({copperOre:3});
  expect(home.placedObjects[0].spent).toEqual({livingMoss:4});
 });
 it('advances generated decoration ids on old saves without a nextId',()=>{
  const home=normalizeHomeBuilder({placedObjects:[{id:'decor-41',prefab:'oak',x:960,y:1600,rotation:0,spent:{livingMoss:4}}]});
  expect(home.nextId).toBe(42);
 });
 it('allows only common materials in a refundable receipt and returns 75 percent overall',()=>{
  const home=normalizeHomeBuilder({placedObjects:[{id:'decor-1',prefab:'oak',x:960,y:1600,rotation:0,spent:{livingMoss:2,copperOre:2,astralite:200}}]});
  expect(home.placedObjects[0].spent).toEqual({livingMoss:2,copperOre:2});
  const refund=refundHome(home.placedObjects[0].spent);
  expect(Object.values(refund).reduce((s,n)=>s+n,0)).toBe(3);
  expect(refund.astralite).toBeUndefined();
 });
 it('renders selectable categories, controls and saved decor list',()=>{
  const s={night:false,homeCategory:'nature',homeSelected:'oak',homeAction:'place',homeRotation:0,homeUndo:null,homeBuilder:{placedObjects:[{id:'decor-1',prefab:'oak',x:960,y:1600}],recovery:[]}};
  const html=renderHomeBuilderHtml(s);
  expect(html).toContain('data-home-type="oak"');
  expect(html).toContain('data-home-move="decor-1"');
  expect(html).toContain('data-home-demolish="decor-1"');
  expect(html).toContain('data-home-rotate');
 });
});
