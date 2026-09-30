(function(root){
'use strict';
// The original sheet is never changed. A frame mask is 1=retain / 0=hide,
// indexed in crop-local coordinates; new pixels exposed by crop edits are retained.
function validRect(rect,width,height){
 const x=Math.round(Number(rect.x)),y=Math.round(Number(rect.y)),
       w=Math.round(Number(rect.w)),h=Math.round(Number(rect.h));
 if(![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<1||h<1||
    x+w>width||y+h>height||w>1024||h>1024)
  throw Error('Crop ต้องอยู่ในภาพต้นฉบับ และไม่เกิน 1024×1024px');
 return {x,y,w,h};
}
function remapMask(oldMask,oldRect,nextRect){
 const next=new Uint8Array(nextRect.w*nextRect.h);next.fill(1);
 if(!oldMask)return next;
 for(let y=0;y<nextRect.h;y++){
  const sy=y+nextRect.y-oldRect.y;
  if(sy<0||sy>=oldRect.h)continue;
  for(let x=0;x<nextRect.w;x++){
   const sx=x+nextRect.x-oldRect.x;
   if(sx>=0&&sx<oldRect.w)next[y*nextRect.w+x]=oldMask[sy*oldRect.w+sx];
  }
 }
 return next;
}
function trimBounds(pixels,width,height,mask){
 if(pixels.length!==width*height*4||mask&&mask.length!==width*height)throw Error('Pixel dimensions mismatch');
 let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=y*width+x;
  if(pixels[p*4+3]===0||mask&&mask[p]===0)continue;
  if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
 }
 return maxX<0?null:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
}
// Connectivity is only a suggestion: disconnected equipment/tails/FX remain
// selected until the artist explicitly turns them off.
function connectedRegions(pixels,width,height,{alpha=8,diagonal=true}={}){
 if(pixels.length!==width*height*4)throw Error('Pixel dimensions mismatch');
 const idMap=new Int32Array(width*height);idMap.fill(-1);
 const queue=new Int32Array(width*height),regions=[];
 const neighbors=diagonal?[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[-1,1],[1,-1]]:
  [[1,0],[-1,0],[0,1],[0,-1]];
 for(let start=0;start<idMap.length;start++){
  if(idMap[start]!==-1||pixels[start*4+3]<alpha)continue;
  const id=regions.length;let head=0,tail=0,area=0;
  queue[tail++]=start;idMap[start]=id;
  let minX=width,minY=height,maxX=0,maxY=0;
  while(head<tail){
   const p=queue[head++],x=p%width,y=Math.floor(p/width);area++;
   if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;
   for(const [dx,dy] of neighbors){
    const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;
    const q=ny*width+nx;
    if(idMap[q]===-1&&pixels[q*4+3]>=alpha){idMap[q]=id;queue[tail++]=q}
   }
  }
  regions.push({id,pixels:area,bounds:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}});
 }
 const sorted=[...regions].sort((a,b)=>b.pixels-a.pixels);
 return {idMap,regions,largestId:sorted[0]?.id??null,sorted};
}
function paintMask(mask,width,height,x,y,radius,keep,alpha){
 if(mask.length!==width*height)throw Error('Mask dimensions mismatch');
 let changed=0;
 const r=Math.max(0,Math.min(64,Math.round(radius))),cx=Math.round(x),cy=Math.round(y);
 for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(dx*dx+dy*dy>r*r)continue;
  const xx=cx+dx,yy=cy+dy;if(xx<0||xx>=width||yy<0||yy>=height)continue;
  const p=yy*width+xx;if(keep&&alpha&&alpha[p*4+3]===0)continue;
  const value=keep?1:0;if(mask[p]!==value){mask[p]=value;changed++}
 }
 return changed;
}
root.BunnyExtractCore=Object.freeze({validRect,remapMask,trimBounds,connectedRegions,paintMask});
})(typeof window!=='undefined'?window:globalThis);
