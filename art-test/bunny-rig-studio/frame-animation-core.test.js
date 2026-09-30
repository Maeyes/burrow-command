import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const sandbox={};
runInNewContext(readFileSync(new URL('./frame-animation-core.js',import.meta.url),'utf8'),sandbox);
const {sheetRects,naturalSort,fitRect,spriteSheetLayout,buildGif}=sandbox.BunnyFrameCore;

describe('Frame Animation grid slicing',()=>{
 it('extracts four equal transparent sprite-sheet cells from a horizontal strip',()=>{
  const rects=sheetRects(256,64,{columns:4,rows:1});
  expect(rects.length).toBe(4);
  expect(rects.map(r=>[r.x,r.y,r.w,r.h])).toEqual([[0,0,64,64],[64,0,64,64],[128,0,64,64],[192,0,64,64]]);
 });
 it('supports 2×2, vertical strips, margins and spacing',()=>{
  const grid=sheetRects(36,36,{columns:2,rows:2,margin:2,spacing:4});
  expect(grid.length).toBe(4);
  expect(grid[0]).toMatchObject({x:2,y:2,w:14,h:14});
  expect(grid[3]).toMatchObject({x:20,y:20,w:14,h:14});
  expect(sheetRects(16,64,{columns:1,rows:4}).map(r=>r.y)).toEqual([0,16,32,48]);
 });
 it('splits a single eight-frame file in both 8×1 and 4×2 layouts',()=>{
  const horizontal=sheetRects(512,64,{columns:8,rows:1});
  expect(horizontal).toHaveLength(8);
  expect(horizontal.map(r=>[r.x,r.y,r.w,r.h])).toEqual(Array.from({length:8},(_,i)=>[64*i,0,64,64]));
  const grid=sheetRects(256,128,{columns:4,rows:2});
  expect(grid).toHaveLength(8);
  expect(grid[4]).toMatchObject({x:0,y:64,w:64,h:64});
  expect(grid[7]).toMatchObject({x:192,y:64,w:64,h:64});
  expect(spriteSheetLayout(8,8,64,64)).toEqual({cols:8,rows:1,width:512,height:64});
 });
 it('splits uneven generated image dimensions without scaling, losing or duplicating pixels',()=>{
  const cells=sheetRects(103,65,{columns:4,rows:2});
  expect(cells).toHaveLength(8);
  expect(new Set(cells.map(r=>r.w))).toEqual(new Set([25,26]));
  expect(new Set(cells.map(r=>r.h))).toEqual(new Set([32,33]));
  const pixels=new Set();
  for(const r of cells){for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){
   const pixel=y*103+x;
   expect(pixels.has(pixel)).toBe(false);
   pixels.add(pixel);
  }}
  expect(pixels.size).toBe(103*65);
  expect(cells.at(-1).x+cells.at(-1).w).toBe(103);
  expect(cells.at(-1).y+cells.at(-1).h).toBe(65);
 });
 it('handles uneven dimensions with nonzero margins and grid spacing',()=>{
  const cells=sheetRects(107,71,{columns:4,rows:2,margin:1,spacing:2});
  expect(cells).toHaveLength(8);
  expect(cells[0]).toMatchObject({x:1,y:1});
  expect(cells[3].x+cells[3].w).toBe(106);
  expect(cells[7].y+cells[7].h).toBe(70);
  expect(cells.every(c=>c.w>=24&&c.h>=33)).toBe(true);
 });
 it('still rejects grids that physically cannot contain the requested cells and >64 frames',()=>{
  expect(()=>sheetRects(3,24,{columns:4,rows:1})).toThrow();
  expect(()=>sheetRects(64,64,{columns:9,rows:9})).toThrow();
 });
});
describe('Frame composition and exports',()=>{
 it('sorts separate PNG filenames in frame order',()=>{
  expect(naturalSort(['frame_10.png','frame_2.png','frame_1.png'])).toEqual(['frame_1.png','frame_2.png','frame_10.png']);
 });
 it('centers different image sizes at a shared foot baseline',()=>{
  expect(fitRect(20,30,64,64,{offsetX:3,offsetY:-5})).toEqual({x:25,y:29,w:20,h:30});
 });
 it('calculates a sprite sheet with a capped size and stable 4-column ordering',()=>{
  expect(spriteSheetLayout(4,4,64,64)).toEqual({cols:4,rows:1,width:256,height:64});
  expect(spriteSheetLayout(7,4,64,64)).toEqual({cols:4,rows:2,width:256,height:128});
  expect(()=>spriteSheetLayout(60,60,1024,1024)).toThrow();
 });
 it('exports a looping GIF89a with transparency and distinct frame control records',()=>{
  const opaque=new Uint8Array(4*4*4);
  opaque.fill(0);
  for(let i=0;i<opaque.length;i+=4){opaque[i]=240;opaque[i+3]=255}
  const transparent=new Uint8Array(4*4*4);
  const gif=buildGif({width:4,height:4,frames:[{pixels:opaque,hold:1},{pixels:transparent,hold:2}],fps:8});
  const data=Array.from(gif);
  expect(data.slice(0,6)).toEqual([71,73,70,56,57,97]);
  expect(data.slice(6,10)).toEqual([4,0,4,0]);
  expect(gif.at(-1)).toBe(59);
  const once=buildGif({width:4,height:4,frames:[{pixels:opaque,hold:1}],fps:8,loop:false});
  expect(String.fromCharCode(...once).includes('NETSCAPE2.0')).toBe(false);
  expect(data.reduce((sum,v,i)=>sum+(v===33&&data[i+1]===249?1:0),0)).toBe(2);
  expect(String.fromCharCode(...data.slice(784,795))).toContain('NETSCAPE');
 });
});
