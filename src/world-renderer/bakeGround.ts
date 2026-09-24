import {cliffColor,groundColor,type GroundScene} from './ground';
import type {RGB} from './palette';
export interface BakedGround {width:number;height:number;rgba:Uint8ClampedArray}
export interface BakeBounds{x0:number;y0:number;width:number;height:number}
function put(d:Uint8ClampedArray,o:number,c:RGB,shade=1){if(shade<1){d[o]=c[0]*shade*.88;d[o+1]=c[1]*shade*.95;d[o+2]=Math.min(255,c[2]*shade*1.12+6)}else{d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2]}d[o+3]=255}
export function bakeProceduralGround(bounds:BakeBounds,s:GroundScene):BakedGround{
 const w=bounds.width,h=bounds.height,d=new Uint8ClampedArray(w*h*4),HH=s.plateauHeight;
 for(let py=0;py<h;py++){const sy=bounds.y0+py+.5;for(let px=0;px<w;px++){const sx=bounds.x0+px+.5,a=sx+2*sy,b=2*sy-sx;let top=false,face:null|'x'|'y'=null,faceE=0,faceH=0;
  for(const p of s.plateaus){const hi=Math.max((p.x0-a)/2,(p.y0-b)/2),ho=Math.min((p.x1-a)/2,(p.y1-b)/2);if(hi>ho)continue;if(HH>=hi&&HH<=ho){top=true;break}if(ho>=0&&ho<HH&&face===null){face=(p.x1-a)/2<(p.y1-b)/2?'x':'y';faceE=face==='x'?b+2*ho:a+2*ho;faceH=ho}}
  let col:RGB,shade=1;if(top){col=groundColor(a+2*HH,b+2*HH,px,py,s)}else if(face){col=cliffColor(face,faceE,faceH,px,py,s)}else{col=groundColor(a,b,px,py,s);for(const p of s.plateaus){if(b>=p.y0&&b<=p.y1+30&&a>p.x1&&a<p.x1+80)shade=Math.min(shade,.64);if(a>=p.x0&&a<=p.x1&&b>p.y1&&b<p.y1+16)shade=Math.min(shade,.8)}}put(d,(py*w+px)*4,col,shade)
 }}return{width:w,height:h,rgba:d}
}
