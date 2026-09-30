import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const box={};runInNewContext(readFileSync(new URL('./unified-core.js',import.meta.url),'utf8'),box);
const c=box.BunnyUnifiedCore;
const pose=(x,y,r=0)=>({x,y,r,sx:1,sy:1});
const rig={format:'bunny-rig-studio',parts:[
 {id:'body',name:'Body',src:'data:image/png;base64,AAAA',base:pose(10,0),pivot:{x:5,y:5}},
 {id:'staff',name:'Staff',src:'data:image/png;base64,AAAA',parent:'body',base:pose(0,-6),pivot:{x:4,y:4}}
],clips:[{id:'attack',frames:8,fps:8,tracks:{staff:[
 {f:0,pose:pose(0,-6,0)},{f:4,pose:pose(0,-6,180)},{f:7,pose:pose(0,-6,315)}
]}}]};
describe('Unified Studio rig + FX math',()=>{
 it('composes hierarchical transforms: staff rotates around parent pivot',()=>{
  c.validateRig(rig);
  const mats=c.worldMatrices(rig,rig.clips[0],0);
  expect(c.point(mats.get('staff'),0,0)).toEqual({x:10,y:-6});
  expect(c.point(mats.get('staff'),10,0)).toEqual({x:20,y:-6});
 });
 it('samples keys smoothly and rotates along shortest arc',()=>{
  const v=c.sample([{f:0,pose:pose(0,0,350)},{f:4,pose:pose(8,0,10)}],2,pose(0,0));
  expect(v.x).toBe(4);expect(v.r).toBeCloseTo(360);
 });
 it('uses current parent bone world transform to position FX',()=>{
  const mat=c.worldMatrices(rig,rig.clips[0],4).get('staff');
  const local=c.fromPose(pose(6,0,0));
  const attached=c.multiply(mat,local),p=c.point(attached,0,0);
  expect(p.x).toBeCloseTo(4);expect(p.y).toBeCloseTo(-6);
 });
 it('guards cyclic parenting and accepts ordinary nested rigs',()=>{
  const broken=structuredClone(rig);broken.parts[0].parent='staff';
  expect(()=>c.worldMatrices(broken,broken.clips[0],0)).toThrow(/Parent Bone/);
 });
 it('samples FX frames by scene FPS, once or looping',()=>{
  expect(c.frameIndex(0,8,4,4)).toBe(0);
  expect(c.frameIndex(6,8,4,4)).toBe(3);
  expect(c.frameIndex(10,8,4,4,true)).toBe(1);
  expect(c.frameIndex(10,8,4,4,false)).toBe(3);
 });
 it('validates imports and rejects incomplete rigs and FX JSON',()=>{
  expect(()=>c.validateRig({...rig,parts:[{id:'bad',src:null}]})).toThrow();
  expect(()=>c.validateFx({format:'bunny-fx-lab',width:512,height:512,frames:[{src:'bad'}]})).toThrow();
  expect(c.validateFx({format:'bunny-fx-lab',width:128,height:128,
    frames:[{src:'data:image/png;base64,AAA'}]}).frames.length).toBe(1);
 });
});