(function(root){
'use strict';
const LIMIT=64;
function positiveInteger(value,name,maximum=4096){
 const n=Number(value);
 if(!Number.isInteger(n)||n<1||n>maximum)throw Error(name+' ต้องเป็นจำนวนเต็ม 1–'+maximum);
 return n;
}
function sheetRects(width,height,{columns=4,rows=1,margin=0,spacing=0,limit=LIMIT}={}){
 width=positiveInteger(width,'ความกว้าง');height=positiveInteger(height,'ความสูง');
 columns=positiveInteger(columns,'Columns',LIMIT);rows=positiveInteger(rows,'Rows',LIMIT);
 margin=Number(margin);spacing=Number(spacing);
 if(!Number.isInteger(margin)||margin<0||margin>128||!Number.isInteger(spacing)||spacing<0||spacing>128)throw Error('Margin / Spacing ต้องอยู่ระหว่าง 0–128');
 if(columns*rows>limit)throw Error('หนึ่งคลิปใช้ได้สูงสุด '+limit+' เฟรม');
 const availableW=width-margin*2-spacing*(columns-1),availableH=height-margin*2-spacing*(rows-1);
 if(availableW<columns||availableH<rows)throw Error('พื้นที่ภาพหลังหัก Margin / Spacing เล็กเกินกว่าจะตัดตาม Grid นี้');
 // Generative image exports often have odd pixel dimensions. Use rounded
 // cumulative cell boundaries instead of requiring exact divisibility: each
 // source pixel is assigned to one cell, without scaling, gaps or overlaps.
 if(Math.ceil(availableW/columns)>1024||Math.ceil(availableH/rows)>1024)throw Error('แต่ละเฟรมต้องไม่เกิน 1024×1024px');
 return Array.from({length:columns*rows},(_,n)=>{
  const col=n%columns,row=Math.floor(n/columns);
  const x0=Math.round(col*availableW/columns),x1=Math.round((col+1)*availableW/columns);
  const y0=Math.round(row*availableH/rows),y1=Math.round((row+1)*availableH/rows);
  return {x:margin+col*spacing+x0,y:margin+row*spacing+y0,w:x1-x0,h:y1-y0};
 });
}
function naturalSort(names){
 return [...names].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'}));
}
function fitRect(imageW,imageH,cellW,cellH,{offsetX=0,offsetY=0,anchorX,footY}={}){
 const w=positiveInteger(imageW,'Frame Width'),h=positiveInteger(imageH,'Frame Height');
 const pivotX=Number.isFinite(anchorX)?anchorX:w/2,feet=Number.isFinite(footY)?footY:h;
 return {x:Math.round(cellW/2-pivotX+Number(offsetX||0)),y:Math.round(cellH-feet+Number(offsetY||0)),w,h};
}
function spriteSheetLayout(count,columns,width,height){
 count=positiveInteger(count,'เฟรม',LIMIT);columns=positiveInteger(columns,'คอลัมน์',LIMIT);
 width=positiveInteger(width,'Frame Width',1024);height=positiveInteger(height,'Frame Height',1024);
 const cols=Math.min(count,columns),rows=Math.ceil(count/cols);
 if(cols*width>8192||rows*height>8192||cols*width*rows*height>64000000)throw Error('Sprite Sheet ใหญ่เกินไป (สูงสุด 8192px ต่อด้าน และ 64 ล้านพิกเซล)');
 return {cols,rows,width:cols*width,height:rows*height};
}
function push16(out,n){out.push(n&255,(n>>8)&255)}
function rawGifLzw(pixels){
 // Repeated clear codes permit a fixed nine-bit code width and avoid fragile
 // dictionary growth across very long frames. GIF decoders will still rebuild
 // their dictionary normally; reset after at most 160 literal pixels.
 const codes=[256];let literals=0;
 for(const index of pixels){
  if(literals===160){codes.push(256);literals=0}
  codes.push(index);literals++;
 }
 codes.push(257);
 const bytes=[];let bits=0,value=0;
 for(const code of codes){
  value|=code<<bits;bits+=9;
  while(bits>=8){bytes.push(value&255);value>>>=8;bits-=8}
 }
 if(bits)bytes.push(value&255);
 const blocks=[];
 for(let i=0;i<bytes.length;i+=255){const part=bytes.slice(i,i+255);blocks.push(part.length,...part)}
 blocks.push(0);
 return blocks;
}
function buildGif({width,height,frames,fps=8,loop=true}){
 width=positiveInteger(width,'GIF Width',1024);height=positiveInteger(height,'GIF Height',1024);
 fps=positiveInteger(fps,'FPS',30);
 if(!Array.isArray(frames)||!frames.length||frames.length>LIMIT)throw Error('GIF ต้องมี 1–64 เฟรม');
 const bytes=[71,73,70,56,57,97];
 push16(bytes,width);push16(bytes,height);
 bytes.push(247,0,0); // 256 global RGB332 colors, palette index 0 transparent
 bytes.push(0,0,0);
 for(let i=1;i<256;i++){
  const code=i-1,red=(code>>5)&7,green=(code>>2)&7,blue=code&3;
  bytes.push(Math.round(red*255/7),Math.round(green*255/7),Math.round(blue*255/3));
 }
 if(loop)bytes.push(33,255,11,...[...('NETSCAPE2.0')].map(x=>x.charCodeAt(0)),3,1,0,0,0);
 for(const frame of frames){
  if(!frame?.pixels||frame.pixels.length!==width*height*4)throw Error('ข้อมูลเฟรม GIF ไม่ตรงกับขนาดภาพ');
  const delay=Math.max(2,Math.min(65535,Math.round(100/fps*(Number(frame.hold)||1))));
  bytes.push(33,249,4,9);push16(bytes,delay);bytes.push(0,0);
  bytes.push(44);push16(bytes,0);push16(bytes,0);push16(bytes,width);push16(bytes,height);
  bytes.push(0,8);
  const pixels=new Uint8Array(width*height);
  for(let p=0;p<pixels.length;p++){
   const k=p*4;if(frame.pixels[k+3]<128)continue;
   const r=frame.pixels[k]>>5,g=frame.pixels[k+1]>>5,b=frame.pixels[k+2]>>6;
   const rgb332=(r<<5)|(g<<2)|b;
   pixels[p]=Math.min(255,rgb332+1);
  }
  for(const b of rawGifLzw(pixels))bytes.push(b);
 }
 bytes.push(59);
 return new Uint8Array(bytes);
}
root.BunnyFrameCore=Object.freeze({LIMIT,sheetRects,naturalSort,fitRect,spriteSheetLayout,buildGif});
})(typeof window!=='undefined'?window:globalThis);
