(function(root){
'use strict';
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const identity=()=>[1,0,0,1,0,0];
const multiply=(p,q)=>[
 p[0]*q[0]+p[2]*q[1],p[1]*q[0]+p[3]*q[1],
 p[0]*q[2]+p[2]*q[3],p[1]*q[2]+p[3]*q[3],
 p[0]*q[4]+p[2]*q[5]+p[4],p[1]*q[4]+p[3]*q[5]+p[5]
];
const fromPose=({x=0,y=0,r=0,sx=1,sy=1}={})=>{
 const a=Number(r)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return [c*sx,s*sx,-s*sy,c*sy,Number(x),Number(y)];
};
const point=(m,x=0,y=0)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
const normalized=(p)=>({x:Number(p?.x)||0,y:Number(p?.y)||0,r:Number(p?.r)||0,
 sx:Number.isFinite(Number(p?.sx))?Number(p.sx):1,sy:Number.isFinite(Number(p?.sy))?Number(p.sy):1,
 opacity:Number.isFinite(Number(p?.opacity))?Number(p.opacity):1});
function sample(keys=[],frame=0,fallback={},smooth=false){
 if(!keys.length)return normalized(fallback);
 const base=normalized(fallback),sorted=[...keys].sort((a,b)=>a.f-b.f);
 if(frame<=sorted[0].f)return sorted[0].f===0?{...base,...sorted[0].pose}:base;
 if(frame>=sorted.at(-1).f)return {...base,...sorted.at(-1).pose};
 for(let i=1;i<sorted.length;i++){
  const next=sorted[i],prev=sorted[i-1];if(frame>next.f)continue;
  let t=clamp((frame-prev.f)/(next.f-prev.f),0,1);if(smooth)t=t*t*(3-2*t);
  const start={...base,...prev.pose},end={...base,...next.pose};
  const result={};
  for(const field of ['x','y','sx','sy','opacity'])result[field]=start[field]+(end[field]-start[field])*t;
  const delta=((end.r-start.r+540)%360)-180;result.r=start.r+delta*t;
  return result;
 }
 return base;
}
function validateRig(rig){
 if(!rig||rig.format!=='bunny-rig-studio'||!Array.isArray(rig.parts)||!Array.isArray(rig.clips)||
    rig.parts.length>100||rig.clips.length<1)throw Error('ต้องใช้ JSON จาก Bone Rig Editor');
 if(rig.parts.some(p=>!p.id||typeof p.src!=='string'||!p.src.startsWith('data:image/')))
  throw Error('Rig มีภาพชิ้นส่วนไม่ครบ');
 if(rig.clips.some(c=>!Number.isInteger(c.frames)||c.frames<1||c.frames>256||
  !Number.isFinite(c.fps)||c.fps<=0||c.fps>60))throw Error('จำนวนเฟรมหรือ FPS ไม่ถูกต้อง');
 return rig;
}
function worldMatrices(rig,clip,frame){
 const byId=new Map(rig.parts.map(p=>[p.id,p])),cache=new Map(),active=new Set();
 function visit(id){
  if(cache.has(id))return cache.get(id);
  if(active.has(id))throw Error('Rig มี Parent Bone เป็นวงจร');
  const part=byId.get(id);if(!part)return identity();active.add(id);
  const v=sample(clip.tracks?.[id],frame,part.base,clip.easing==='smooth');
  const parent=part.parent&&byId.has(part.parent)?visit(part.parent):identity();
  const result=multiply(parent,fromPose(v));cache.set(id,result);active.delete(id);return result;
 }
 rig.parts.forEach(p=>visit(p.id));return cache;
}
function frameIndex(frame,rigFPS,fxFPS,count,loop=true){
 if(!count)return -1;
 const n=Math.max(0,Math.floor((frame/rigFPS)*fxFPS+1e-7));
 return loop?n%count:Math.min(count-1,n);
}
function validateFx(fx){
 if(!fx||fx.format!=='bunny-fx-lab'||!Number.isInteger(fx.width)||!Number.isInteger(fx.height)||
    fx.width<8||fx.height<8||fx.width>512||fx.height>512||!Array.isArray(fx.frames)||
    fx.frames.length<1||fx.frames.length>64)throw Error('ต้องใช้ Bunny FX Lab JSON');
 if(fx.frames.some(f=>typeof f.src!=='string'||!/^data:image\/png;base64,/i.test(f.src)))
  throw Error('FX JSON ขาด PNG เฟรม');
 return fx;
}
root.BunnyUnifiedCore=Object.freeze({clamp,identity,multiply,fromPose,point,normalized,sample,
 validateRig,validateFx,worldMatrices,frameIndex});
})(typeof window!=='undefined'?window:globalThis);
