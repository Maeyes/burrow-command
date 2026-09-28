// Render Home Builder objects with existing Dimraeth procedural pixel-art language.
import {broadTree,pineTree,bushSprite,flowerPatchSprite,planterSprite,benchSprite,signpostSprite,haySprite,boxSprite,barrelSprite,wellSprite,buildingSprite} from './engine/sprites.js';
import * as P from './engine/palettes.js';
const cache=new Map();
function lanternArt(){
 const c=document.createElement('canvas');c.width=58;c.height=104;
 const g=c.getContext('2d');g.imageSmoothingEnabled=false;
 g.fillStyle='#332416';g.fillRect(27,48,6,51);g.fillRect(20,96,20,4);
 g.fillStyle='#aa783f';g.fillRect(25,45,10,52);g.fillRect(18,31,24,5);
 g.fillStyle='#433a24';g.fillRect(18,15,24,8);g.fillRect(22,11,16,5);
 g.fillStyle='#f2be57';g.fillRect(21,24,18,20);g.fillStyle='#ffe7a0';g.fillRect(25,27,10,14);
 g.fillStyle='#8c5e30';g.fillRect(18,23,4,23);g.fillRect(38,23,4,23);g.fillRect(18,45,24,4);
 return {img:c,ox:29,oy:100};
}

function groundSprite(kind){
 const c=document.createElement('canvas');c.width=128;c.height=68;
 const g=c.getContext('2d'),pond=kind==='pond',sand=kind==='sandPatch';
 g.imageSmoothingEnabled=false;
 g.beginPath();g.moveTo(64,4);g.lineTo(122,34);g.lineTo(64,64);g.lineTo(6,34);g.closePath();
 g.fillStyle=pond?'#205874':'#c7a46a';g.fill();
 g.strokeStyle=pond?'#7dc4c2':'#e1bd7e';g.lineWidth=3;g.stroke();
 for(let i=0;i<26;i++){
  const x=64+(((i*37)%91)-45),y=34+(((i*19)%41)-20);
  if(Math.abs(x-64)*.5+Math.abs(y-34)>24)continue;
  g.fillStyle=pond?(i%2?'#317e99':'#5eaabb'):(i%2?'#bc975d':'#ead19a');
  g.fillRect(x,y,i%3+2,i%2+1);
 }
 return {img:c,ox:64,oy:34};
}
export function modularHouseOptions(prefab,rotation,variant){
 const presets={
  farmerHouse:{w:92,d:76,h:49,roof:1,wall:'timber',chimney:true,flowers:true,awnings:false},
  smithHouse:{w:89,d:80,h:54,roof:2,wall:'stone',chimney:true,awningColors:['#a4673e','#dfad69']},
  mageHouse:{w:83,d:82,h:66,roof:2,wall:'stone',chimney:true,tower:true},
  storeHouse:{w:98,d:78,h:46,roof:0,wall:'wood',chimney:false,awningColors:['#a96043','#e1c189']},
  barnHouse:{w:121,d:93,h:57,roof:0,wall:'wood',chimney:false,awningColors:['#af783e','#e7c27c'],wide:true},
  pavilion:{w:84,d:84,h:36,roof:1,wall:'timber',chimney:false,flowers:true}
 };
 const p=presets[prefab],flipped=rotation%2===1,roofs=[P.RED,P.GREENR,P.SLATE,P.ORANGE];
 const width=flipped?p.d:p.w,depth=flipped?p.w:p.d;
 return {x0:0,y0:0,x1:width,y1:depth,wallH:p.h,roofH:prefab==='mageHouse'?47:32,
  wall:p.wall,roof:roofs[(p.roof+variant)%roofs.length],ridge:flipped?'y':'x',
  door:{face:rotation===2||rotation===3?'x':'y',at:.5,wide:prefab==='barnHouse'},
  windows:[{face:'x',at:.28},{face:'x',at:.75},{face:'y',at:.21},{face:'y',at:.78}],
  chimney:p.chimney,flowers:p.flowers,
  ...(p.awningColors?{awning:{face:flipped?'x':'y',at:.5,cols:p.awningColors}}:{}),
  ...(p.tower?{tower:{w:26,h:42,roof:P.SLATE}}:{}),floors:prefab==='mageHouse'?2:1};
}
function modularHouse(prefab,rotation,variant){
 return buildingSprite(modularHouseOptions(prefab,rotation,variant));
}

function spriteFor(name){
 switch(name){
 case 'pond':case 'sandPatch':return groundSprite(name);
 case 'oak':return broadTree(921,78,P.LEAF);
 case 'pine':return pineTree(529,92);
 case 'blossom':return broadTree(809,74,P.LEAF_BLOSSOM);
 case 'bush':return bushSprite(812,44,P.BUSH);
 case 'flowerBush':return bushSprite(778,42,P.BUSH,['#e8627a','#f6cc50']);
 case 'vegetable':return planterSprite();
 case 'flowerBed':return flowerPatchSprite(512,['#e8627a','#f4d35e','#f2f0e8']);
 case 'lantern':return lanternArt();
 case 'sign':return signpostSprite(340);
 case 'bench':return benchSprite(38,16,15);
 case 'hay':return haySprite(428);
 case 'crate':return boxSprite(26,24,22,14);
 case 'barrel':return barrelSprite();
 case 'decoFence':return boxSprite(40,6,19,84);
 default:return wellSprite();
 }
}
export function homeArt(prefab,rotation=0,variant=0){
 if(prefab==='dirtPath'||prefab==='stonePath')throw Error('Native Map Editor paths do not have floating sprite art');
 const key=prefab+':'+rotation+':'+variant;if(cache.has(key))return cache.get(key);
 if(['farmerHouse','smithHouse','mageHouse','storeHouse','barnHouse','pavilion'].includes(prefab)){
  const house=modularHouse(prefab,rotation,variant);cache.set(key,house);return house;
 }
 const original=spriteFor(prefab);
 // Rotation is data-first; four directions of long furniture have distinct footprint orientations.
 // Standalone trees and other radial decorations look identical in all four directions.
 if(![ 'bench','decoFence' ].includes(prefab)||rotation%2===0){cache.set(key,original);return original;}
 const w=original.img.height,h=original.img.width,c=document.createElement('canvas');c.width=w;c.height=h;
 const g=c.getContext('2d');g.translate(w/2,h/2);g.rotate(Math.PI/2);g.drawImage(original.img,-original.img.width/2,-original.img.height/2);
 const sprite={...original,img:c,ox:Math.round(w/2),oy:Math.round(h/2)};
 cache.set(key,sprite);return sprite;
}
