(function(root){
'use strict';
// Pure, dependency-free pixel operations. All drawing writes only to the
// explicitly supplied RGBA buffer, never to a character reference/source.
function validSize(width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||height<8||width>512||height>512)
  throw Error('FX canvas ต้องมีขนาด 8–512px ต่อด้าน');
 return {width,height};
}
function color(hex){
 const s=String(hex).trim();
 if(!/^#[\da-f]{6}([\da-f]{2})?$/i.test(s))throw Error('Color ต้องเป็น #RRGGBB หรือ #RRGGBBAA');
 const bytes=s.slice(1).match(/../g).map(x=>parseInt(x,16));
 return [bytes[0],bytes[1],bytes[2],bytes[3]??255];
}
function same(data,i,rgba){
 const n=i*4;return data[n]===rgba[0]&&data[n+1]===rgba[1]&&data[n+2]===rgba[2]&&data[n+3]===rgba[3];
}
function pixel(data,width,height,x,y,rgba){
 x=Math.round(x);y=Math.round(y);
 if(x<0||x>=width||y<0||y>=height)return false;
 const p=(y*width+x)*4;
 if(data[p]===rgba[0]&&data[p+1]===rgba[1]&&data[p+2]===rgba[2]&&data[p+3]===rgba[3])return false;
 data.set(rgba,p);return true;
}
function brush(data,width,height,x,y,size,rgba){
 const s=Math.max(1,Math.min(32,Math.round(size))),left=Math.floor((s-1)/2);
 let changed=0;
 for(let yy=0;yy<s;yy++)for(let xx=0;xx<s;xx++)
  if(pixel(data,width,height,Math.round(x)-left+xx,Math.round(y)-left+yy,rgba))changed++;
 return changed;
}
function line(data,width,height,x0,y0,x1,y1,rgba,size=1){
 x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
 let dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0);
 const sx=x0<x1?1:-1,sy=y0<y1?1:-1;
 let err=dx+dy,changed=0;
 // Clip grossly out-of-range user coordinates before entering this algorithm.
 if([x0,y0,x1,y1].some(n=>Math.abs(n)>4096))throw Error('Line outside canvas bounds');
 while(true){
  changed+=brush(data,width,height,x0,y0,size,rgba);
  if(x0===x1&&y0===y1)break;
  const e=err*2;
  if(e>=dy){err+=dy;x0+=sx}if(e<=dx){err+=dx;y0+=sy}
 }
 return changed;
}
function ellipse(data,width,height,x0,y0,x1,y1,rgba,size=1){
 const left=Math.min(Math.round(x0),Math.round(x1)),top=Math.min(Math.round(y0),Math.round(y1));
 const right=Math.max(Math.round(x0),Math.round(x1)),bottom=Math.max(Math.round(y0),Math.round(y1));
 const rx=(right-left)/2,ry=(bottom-top)/2,cx=(left+right)/2,cy=(top+bottom)/2;
 if([left,right,top,bottom].some(n=>Math.abs(n)>4096))throw Error('Circle outside canvas bounds');
 if(rx===0||ry===0)return line(data,width,height,left,top,right,bottom,rgba,size);
 let changed=0;
 const steps=Math.min(8192,Math.max(32,Math.ceil(Math.PI*2*Math.max(rx,ry)*2)));
 let prev=null,first=null;
 for(let i=0;i<=steps;i++){
  const a=Math.PI*2*i/steps,p=[Math.round(cx+rx*Math.cos(a)),Math.round(cy+ry*Math.sin(a))];
  if(!first)first=p;
  if(prev)changed+=line(data,width,height,prev[0],prev[1],p[0],p[1],rgba,size);
  prev=p;
 }
 return changed+line(data,width,height,prev[0],prev[1],first[0],first[1],rgba,size);
}
function fill(data,width,height,x,y,rgba){
 x=Math.round(x);y=Math.round(y);
 if(x<0||x>=width||y<0||y>=height)return 0;
 const origin=y*width+x,target=Array.from(data.subarray(origin*4,origin*4+4));
 if(rgba.every((v,k)=>v===target[k]))return 0;
 const queue=new Int32Array(width*height),visited=new Uint8Array(width*height);
 let head=0,tail=0,changed=0;
 queue[tail++]=origin;visited[origin]=1;
 while(head<tail){
  const p=queue[head++];if(!same(data,p,target))continue;
  data.set(rgba,p*4);changed++;
  const col=p%width,row=Math.floor(p/width);
  if(col>0&&!visited[p-1]){visited[p-1]=1;queue[tail++]=p-1}
  if(col+1<width&&!visited[p+1]){visited[p+1]=1;queue[tail++]=p+1}
  if(row>0&&!visited[p-width]){visited[p-width]=1;queue[tail++]=p-width}
  if(row+1<height&&!visited[p+width]){visited[p+width]=1;queue[tail++]=p+width}
 }
 return changed;
}
function pick(data,width,height,x,y){
 x=Math.round(x);y=Math.round(y);
 if(x<0||x>=width||y<0||y>=height)return null;
 return Array.from(data.subarray((y*width+x)*4,(y*width+x)*4+4));
}
function toHex(rgba){return '#'+rgba.slice(0,3).map(x=>x.toString(16).padStart(2,'0')).join('')}
function opaqueBounds(data,width,height){
 let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(data[(y*width+x)*4+3]===0)continue;
  minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);
 }
 return maxX<0?null:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
}
root.BunnyFXCore=Object.freeze({validSize,color,pixel,brush,line,ellipse,fill,pick,toHex,opaqueBounds});
})(typeof window!=='undefined'?window:globalThis);
