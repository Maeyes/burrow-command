(function(root){
'use strict';
// Small, offline-only primitives shared by FX Lab's raster layer model.
// Selection is non-destructive until Apply; no interaction ever modifies
// imported character-reference pixels.
function getRegion(data,w,h,x,y){
 x=Math.floor(x);y=Math.floor(y);
 if(x<0||x>=w||y<0||y>=h||data[(y*w+x)*4+3]===0)return null;
 const visited=new Uint8Array(w*h),queue=new Int32Array(w*h),indices=[];
 let head=0,tail=0,minX=w,minY=h,maxX=-1,maxY=-1;
 const start=y*w+x;visited[start]=1;queue[tail++]=start;
 while(head<tail){
  const p=queue[head++],px=p%w,py=(p/w)|0;indices.push(p);
  minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
   const nx=px+dx,ny=py+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
   const n=ny*w+nx;if(!visited[n]&&data[n*4+3]>0){visited[n]=1;queue[tail++]=n}
  }
 }
 return makeSelection(data,w,h,indices,{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1});
}
function getMarquee(data,w,h,x1,y1,x2,y2){
 const l=Math.max(0,Math.min(w-1,Math.min(x1,x2))),r=Math.max(0,Math.min(w-1,Math.max(x1,x2)));
 const t=Math.max(0,Math.min(h-1,Math.min(y1,y2))),b=Math.max(0,Math.min(h-1,Math.max(y1,y2)));
 const bounds={x:Math.floor(l),y:Math.floor(t),w:Math.floor(r)-Math.floor(l)+1,h:Math.floor(b)-Math.floor(t)+1};
 const indices=[];for(let y=bounds.y;y<bounds.y+bounds.h;y++)for(let x=bounds.x;x<bounds.x+bounds.w;x++){
  const index=y*w+x;if(data[index*4+3]>0)indices.push(index);
 }
 return indices.length?makeSelection(data,w,h,indices,bounds):null;
}
function makeSelection(data,w,h,indices,bounds){
 const pixels=new Uint8ClampedArray(bounds.w*bounds.h*4),mask=new Uint8Array(w*h);
 for(const index of indices){
  const x=index%w,y=(index/w)|0,dest=((y-bounds.y)*bounds.w+x-bounds.x)*4;
  pixels.set(data.subarray(index*4,index*4+4),dest);mask[index]=1;
 }
 return {bounds,pixels,mask,dx:0,dy:0,angle:0,scale:1,flipH:false,flipV:false};
}
function transform(source,w,h,selection,{duplicate=false,smoothing=false}={}){
 if(!selection)return source.slice();
 const {bounds:b,pixels,mask}=selection;
 if(pixels.length!==b.w*b.h*4||mask.length!==w*h)throw Error('Invalid selection');
 const src=document.createElement('canvas');src.width=b.w;src.height=b.h;
 const sc=src.getContext('2d');sc.putImageData(new ImageData(pixels,b.w,b.h),0,0);
 const out=document.createElement('canvas');out.width=w;out.height=h;const g=out.getContext('2d');
 const original=new Uint8ClampedArray(source);
 if(!duplicate)for(let i=0;i<mask.length;i++)if(mask[i])original[i*4+3]=0;
 g.putImageData(new ImageData(original,w,h),0,0);
 g.save();
 const cx=b.x+b.w/2+selection.dx,cy=b.y+b.h/2+selection.dy;
 g.translate(cx,cy);g.rotate(selection.angle*Math.PI/180);
 g.scale((selection.flipH?-1:1)*selection.scale,(selection.flipV?-1:1)*selection.scale);
 g.imageSmoothingEnabled=smoothing;
 g.drawImage(src,-b.w/2,-b.h/2);g.restore();
 return new Uint8ClampedArray(g.getImageData(0,0,w,h).data);
}
function effectCanvas(src,settings,style='pixel'){
 const w=src.width,h=src.height,result=document.createElement('canvas');result.width=w;result.height=h;
 const ctx=result.getContext('2d');ctx.imageSmoothingEnabled=style!=='pixel';
 let base=src;
 if(settings?.gradient?.enabled){
  const mask=document.createElement('canvas');mask.width=w;mask.height=h;const m=mask.getContext('2d');
  m.drawImage(src,0,0);m.globalCompositeOperation='source-in';
  const gradient=settings.gradient.type==='radial'?
   m.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.max(w,h)/2):
   m.createLinearGradient(0,0,w,h);
  gradient.addColorStop(0,settings.gradient.from||'#fff6b2');gradient.addColorStop(1,settings.gradient.to||'#ff382d');
  m.fillStyle=gradient;m.fillRect(0,0,w,h);base=mask;
 }
 function shadow(color,dx,dy,blur){
  ctx.save();ctx.shadowColor=color;ctx.shadowOffsetX=dx;ctx.shadowOffsetY=dy;
  ctx.shadowBlur=style==='pixel'?0:blur;
  // Isolate shadow from the source to avoid drawing the source multiple times.
  const temp=document.createElement('canvas');temp.width=w;temp.height=h;const t=temp.getContext('2d');
  t.drawImage(base,0,0);t.globalCompositeOperation='source-in';t.fillStyle=color;t.fillRect(0,0,w,h);
  if(blur===0||style==='pixel')ctx.globalAlpha=.75;
  ctx.drawImage(temp,0,0);ctx.restore();
 }
 const sh=settings?.shadow,gl=settings?.glow;
 if(sh?.enabled)shadow(sh.color||'#30152d',Number(sh.x)||0,Number(sh.y)||0,Math.max(0,Number(sh.blur)||0));
 if(gl?.enabled)shadow(gl.color||'#ffd166',0,0,Math.max(0,Number(gl.blur)||0));
 ctx.drawImage(base,0,0);return result;
}
root.BunnyFXEnhanceCore=Object.freeze({getRegion,getMarquee,transform,effectCanvas});
})(window);
