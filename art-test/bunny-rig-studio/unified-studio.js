(function(){
'use strict';
const core=window.BunnyUnifiedCore,fxCore=window.BunnyFXEnhanceCore;
const $=id=>document.getElementById(id),canvas=$('stage'),ctx=canvas.getContext('2d');
const W=512,H=512,origin={x:W/2,y:H*.58};
const state={rig:null,clips:[],clipIndex:0,images:new Map(),fxSources:[],tracks:[],frame:0,
 tool:'fx',transformTool:'move',selectedBone:null,selectedFX:null,playing:false,last:0,elapsed:0,drag:null,
 history:[],future:[],dirty:false,renderCount:0};
const clone=x=>JSON.parse(JSON.stringify(x));
function status(s,bad=false){$('status').textContent=(bad?'⚠ ':'● ')+s;$('status').style.color=bad?'#ffb2a5':'#bcebd2'}
function currentClip(){return state.rig?.clips[state.clipIndex]}
function chosenTrack(){return state.tracks.find(t=>t.id===state.selectedFX)||null}
function validNumber(id,low,high){const n=Number($(id).value);if(!Number.isFinite(n)||n<low||n>high)throw Error(id+' ต้องอยู่ในช่วง '+low+'–'+high);return n}
function filename(){return String(state.rig?.name||'unified-studio').replace(/[^a-z0-9ก-๙_-]/ig,'_').slice(0,50)||'unified-studio'}
function parseFile(file,maxMB=50){
 if(!file||file.size>maxMB*1024*1024)throw Error('JSON ขนาดเกิน '+maxMB+' MB');
 return file.text().then(s=>JSON.parse(s));
}
function loadImage(src){
 return new Promise((resolve,reject)=>{
  if(typeof src!=='string'||!/^data:image\/(png|webp|jpeg);base64,/i.test(src))
   return reject(Error('ภาพต้องเป็น PNG/JPEG/WebP ที่บันทึกใน JSON'));
  const img=new Image();img.onload=()=>img.width&&img.height&&img.width<=4096&&img.height<=4096?
   resolve(img):reject(Error('ภาพเกิน 4096px'));img.onerror=()=>reject(Error('อ่านภาพไม่สำเร็จ'));img.src=src;
 });
}
function tempCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function paintSource(w,h,draw){
 const c=tempCanvas(w,h),g=c.getContext('2d');draw(g);return c.toDataURL('image/png');
}
function demoRig(){
 const shape={
  tail:paintSource(33,27,g=>{g.fillStyle='#b6a6de';g.beginPath();g.ellipse(16,13,15,9,.4,0,Math.PI*2);g.fill()}),
  body:paintSource(56,66,g=>{g.fillStyle='#ece1cf';g.beginPath();g.ellipse(28,33,25,31,0,0,Math.PI*2);g.fill();g.fillStyle='#d8ac72';g.fillRect(13,26,30,24)}),
  head:paintSource(49,48,g=>{g.fillStyle='#eed2aa';g.beginPath();g.ellipse(25,25,21,20,0,0,Math.PI*2);g.fill();g.fillStyle='#814b37';g.fillRect(7,10,35,9);g.fillStyle='#162434';g.fillRect(17,24,3,3);g.fillRect(31,24,3,3)}),
  staff:paintSource(116,25,g=>{g.fillStyle='#a34f24';g.fillRect(2,10,112,7);g.fillStyle='#f9ce65';g.fillRect(2,8,14,11);g.fillRect(99,8,15,11);g.fillStyle='#ffeb93';g.fillRect(9,9,4,9);g.fillRect(106,9,4,9)})
 };
 return {format:'bunny-rig-studio',version:1,name:'Training Bunny — Staff Spin',
  parts:[
   {id:'tail',name:'Tail',src:shape.tail,parent:'body',base:{x:-25,y:17,r:0,sx:1,sy:1},pivot:{x:15,y:13},visible:true},
   {id:'body',name:'Body',src:shape.body,parent:null,base:{x:0,y:12,r:0,sx:1,sy:1},pivot:{x:28,y:33},visible:true},
   {id:'head',name:'Head',src:shape.head,parent:'body',base:{x:0,y:-45,r:0,sx:1,sy:1},pivot:{x:25,y:30},visible:true},
   {id:'staff',name:'Staff',src:shape.staff,parent:'body',base:{x:5,y:-7,r:0,sx:1,sy:1},pivot:{x:57,y:13},visible:true}
  ],
  clips:[{id:'staff_spin',name:'Staff Spin 360°',frames:8,fps:8,easing:'linear',
   tracks:{staff:[{f:0,pose:{x:5,y:-7,r:0,sx:1,sy:1}},
    {f:2,pose:{x:5,y:-7,r:90,sx:1,sy:1}},
    {f:4,pose:{x:5,y:-7,r:180,sx:1,sy:1}},
    {f:6,pose:{x:5,y:-7,r:270,sx:1,sy:1}},
    {f:7,pose:{x:5,y:-7,r:315,sx:1,sy:1}}]}}]};
}
function demoFX(){
 const frames=Array.from({length:8},(_,i)=>{
  const src=paintSource(152,152,g=>{
   const start=-Math.PI*.85+i*Math.PI/4;g.lineCap='round';
   for(let k=0;k<3;k++){
    g.beginPath();g.arc(76,76,45+k*4,start,start+Math.PI*.58);
    g.strokeStyle=['#fff9c5','#ffd15f','#f48a32'][k];g.globalAlpha=1-k*.2;g.lineWidth=5-k;
    g.stroke();
   }
   g.globalAlpha=1;
  });
  return {src,hold:1};
 });
 return {format:'bunny-fx-lab',version:1,name:'Gold Staff Trail',width:152,height:152,fps:8,frames};
}
const defaultPose=()=>({x:0,y:0,r:0,sx:1,sy:1,opacity:1});
function sourceIndex(source,frame,track){
 const holds=source.holds||source.frames.map(f=>f.hold||1),total=holds.reduce((a,b)=>a+b,0);
 const t=Math.max(0,Math.floor((frame-track.first)/(currentClip().fps)*(source.fps||8)+1e-7));
 let position=track.loop?t%total:Math.min(t,total-1);
 for(let i=0;i<holds.length;i++){if(position<holds[i])return i;position-=holds[i]}
 return holds.length-1;
}
function trackPose(track,frame=state.frame){
 return core.sample(track.keys.filter(k=>k.f<currentClip().frames),frame,defaultPose(),true);
}
function boneMatrices(frame=state.frame){return core.worldMatrices(state.rig,currentClip(),frame)}
function drawParts(g,frame,guide=false,alpha=1){
 const matrices=boneMatrices(frame);
 g.save();g.globalAlpha=alpha;
 for(const part of state.rig.parts){
  const img=state.images.get(part.id);if(!part.visible||!img)continue;
  const m=matrices.get(part.id);g.save();g.transform(...m);g.imageSmoothingEnabled=false;
  g.drawImage(img,-part.pivot.x,-part.pivot.y);
  if(guide&&state.tool==='bone'&&state.selectedBone===part.id){
   g.globalAlpha=1;g.strokeStyle='#ffe39b';g.lineWidth=1.2;g.setLineDash([5,3]);
   g.strokeRect(-part.pivot.x,-part.pivot.y,img.width,img.height);g.setLineDash([]);
  }
  g.restore();
 }
 g.restore();
 if(guide){
  for(const part of state.rig.parts){
   const m=matrices.get(part.id),p=core.point(m);
   if(part.parent){const pm=matrices.get(part.parent);if(pm){const from=core.point(pm);
    g.beginPath();g.strokeStyle='#6ce6f0aa';g.lineWidth=1;g.moveTo(from.x,from.y);g.lineTo(p.x,p.y);g.stroke()}}
   g.beginPath();g.fillStyle=part.id===state.selectedBone?'#ffd98c':'#8edeea';g.arc(p.x,p.y,part.id===state.selectedBone?5:3,0,Math.PI*2);g.fill();
  }
 }
}
function matrixForTrack(track,frame=state.frame){
 const matrices=boneMatrices(frame);
 const parent=matrices.get(track.boneId)||core.identity();
 return core.multiply(parent,core.fromPose(trackPose(track,frame)));
}
function activeTrack(track,frame){return frame>=track.first&&frame<=track.last&&track.visible}
function drawFX(g,frame,selection=false){
 for(const track of state.tracks){
  if(!activeTrack(track,frame))continue;
  const source=state.fxSources.find(s=>s.id===track.sourceId);if(!source)continue;
  const index=sourceIndex(source,frame,track),img=source.frames[index]?.img;if(!img)continue;
  const m=matrixForTrack(track,frame),v=trackPose(track,frame);
  g.save();g.transform(...m);g.globalAlpha=core.clamp(v.opacity,0,1);g.imageSmoothingEnabled=false;
  g.drawImage(img,-img.width/2,-img.height/2);
  if(selection&&track.id===state.selectedFX){
   g.strokeStyle='#ffe095';g.lineWidth=1/(Math.abs(v.sx)||1);g.setLineDash([5,3]);
   g.strokeRect(-img.width/2,-img.height/2,img.width,img.height);g.setLineDash([]);
   g.fillStyle='#fff1aa';g.fillRect(-3,-3,6,6);
  }
  g.restore();
 }
}
function selectedGizmo(frame=state.frame){
 if(state.tool==='bone'){
  const part=state.rig.parts.find(p=>p.id===state.selectedBone);if(!part)return null;
  const img=state.images.get(part.id),m=boneMatrices(frame).get(part.id);if(!img||!m)return null;
  return {center:core.point(m),radius:Math.min(105,Math.max(32,Math.max(img.width,img.height)*.55+15)),
   name:part.name};
 }
 const track=chosenTrack();if(!track||!activeTrack(track,frame))return null;
 const source=state.fxSources.find(s=>s.id===track.sourceId);
 const img=source?.frames[sourceIndex(source,frame,track)]?.img;if(!img)return null;
 return {center:core.point(matrixForTrack(track,frame)),
  radius:Math.min(115,Math.max(42,Math.max(img.width,img.height)*.53+13)),name:track.name};
}
function drawGizmo(g){
 const gizmo=selectedGizmo();if(!gizmo||state.playing)return;
 const {center,radius}=gizmo;
 g.save();g.strokeStyle=state.transformTool==='rotate'?'#ffe395':'#9fdddf';g.fillStyle='#ffe395';
 g.lineWidth=1.6;g.beginPath();g.arc(center.x,center.y,6,0,Math.PI*2);g.stroke();
 g.beginPath();g.moveTo(center.x-9,center.y);g.lineTo(center.x+9,center.y);
 g.moveTo(center.x,center.y-9);g.lineTo(center.x,center.y+9);g.stroke();
 if(state.transformTool==='rotate'){
  g.setLineDash([5,4]);g.beginPath();g.arc(center.x,center.y,radius,0,Math.PI*2);g.stroke();g.setLineDash([]);
  g.beginPath();g.moveTo(center.x,center.y);g.lineTo(center.x,center.y-radius);g.stroke();
  g.beginPath();g.arc(center.x,center.y-radius,8,0,Math.PI*2);g.fill();
  g.font='bold 13px system-ui';g.textAlign='center';g.fillStyle='#1d2c41';
  g.fillText('↻',center.x,center.y-radius+4);
 }
 g.restore();
}
function setTransformTool(next){
 state.transformTool=next;
 $('moveTool').classList.toggle('active',next==='move');
 $('rotateTool').classList.toggle('active',next==='rotate');
 $('toolHelp').textContent=next==='rotate'?
  '↻ Rotate: ลากกระบองหรือวงหมุนสีทองเพื่อหมุน • ใช้ปุ่ม ±15° เพื่อปรับละเอียด':
  '✥ Move: คลิกตรงภาพกระบองหรือ FX แล้วลากได้ทุกเฟรม • ไม่ต้องคลิกที่จุด Bone';
 render();
}
function boundedAngle(angle){return Math.abs(angle)>360?((angle%360)+360)%360:angle}
function rotateBy(degrees){
 if(!state.rig)return;
 const before=editableSnapshot(),frame=state.frame;
 if(state.tool==='fx'){
  const track=chosenTrack();if(!track)return status('เลือก FX ก่อนหมุน',true);
  writeKey(frame,{...trackPose(track),r:boundedAngle(trackPose(track).r+degrees)});
 }else{
  const part=state.rig.parts.find(p=>p.id===state.selectedBone);
  if(!part)return status('เลือก Bone ก่อนหมุน',true);
  const pose=core.sample(currentClip().tracks?.[part.id],frame,part.base,currentClip().easing==='smooth');
  writeKey(frame,{...pose,r:boundedAngle(pose.r+degrees)});
 }
 remember(before);refresh();status('หมุน '+degrees+'° ที่เฟรม '+(frame+1)+' • Ctrl+Z ย้อนกลับได้');
}
function background(g){
 g.clearRect(0,0,W,H);
 for(let y=0;y<H;y+=24)for(let x=0;x<W;x+=24){g.fillStyle=((x+y)/24)%2?'#25374b':'#2c4058';g.fillRect(x,y,24,24)}
 g.strokeStyle='#aec5da55';g.setLineDash([5,5]);g.beginPath();g.moveTo(W/2,0);g.lineTo(W/2,H);
 g.moveTo(0,origin.y);g.lineTo(W,origin.y);g.stroke();g.setLineDash([]);
}
function render(){
 if(!state.rig)return;
 background(ctx);
 ctx.save();ctx.translate(origin.x,origin.y);
 if($('onion').checked&&state.frame>0){drawParts(ctx,state.frame-1,false,.14)}
 drawParts(ctx,state.frame,$('showBones').checked,.99);
 drawFX(ctx,state.frame,true);drawGizmo(ctx);ctx.restore();
 $('playhead').textContent='F '+String(state.frame+1).padStart(2,'0')+' / '+String(currentClip().frames).padStart(2,'0');
 $('previewNote').textContent=currentClip().name+' • '+currentClip().fps+' FPS';
 state.renderCount++;
}
function renderHierarchy(){
 const host=$('hierarchy');host.replaceChildren();
 for(const part of state.rig.parts){
  const b=document.createElement('button');b.className=state.selectedBone===part.id&&state.tool==='bone'?'active':'';
  b.textContent=(part.parent?'  ↳ ':'◈ ')+part.name;b.onclick=()=>{state.selectedBone=part.id;state.tool='bone';refresh()};
  host.append(b);
 }
}
function renderFX(){
 const host=$('fxTracks');host.replaceChildren();
 state.tracks.forEach(track=>{
  const b=document.createElement('button');b.className=state.selectedFX===track.id&&state.tool==='fx'?'active':'';
  const s=state.fxSources.find(s=>s.id===track.sourceId);
  b.textContent=(track.visible?'◉ ':'○ ')+track.name;
  b.title='Click: select • double-click: toggle visibility';
  b.onclick=()=>{state.selectedFX=track.id;state.tool='fx';refresh()};
  b.ondblclick=()=>{track.visible=!track.visible;state.dirty=true;refresh()};
  host.append(b);
 });
 $('fxInfo').textContent=state.tracks.length?state.tracks.length+' FX Track(s) • Click เพื่อเลือก / Double-click ซ่อน':'Import FX Lab JSON หรือ Generate demo';
}
function renderTimeline(){
 const host=$('tracks');host.replaceChildren();
 const clip=currentClip(),count=clip.frames;
 const addRow=(name,keys,action)=>{
  const row=document.createElement('div');row.className='track';
  const title=document.createElement('div');title.className='name';title.title=name;title.textContent=name;
  const lane=document.createElement('div');lane.className='lane';lane.style.setProperty('--cell',(100/count)+'%');
  for(let i=0;i<count;i++){
   const b=document.createElement('button');b.type='button';
   b.className='frameKey'+(i===state.frame?' now':'')+(keys.some(k=>k.f===i)?' mark':'');
   b.title=name+' • Frame '+(i+1);b.onclick=()=>{action();setFrame(i)};
   lane.append(b);
  }
  row.append(title,lane);host.append(row);
 };
 for(const part of state.rig.parts)addRow('🦴 '+part.name,clip.tracks?.[part.id]||[],()=>{
  state.tool='bone';state.selectedBone=part.id});
 for(const track of state.tracks)addRow('✨ '+track.name,track.keys,()=>{
  state.tool='fx';state.selectedFX=track.id});
}
function inspector(){
 const isFX=state.tool==='fx',item=isFX?chosenTrack():state.rig.parts.find(p=>p.id===state.selectedBone);
 const clip=currentClip();
 $('selectFX').classList.toggle('active',isFX);$('selectBone').classList.toggle('active',!isFX);
 $('inspectorTitle').textContent=item?(isFX?'✨ ':'🦴 ')+item.name:'Choose a '+(isFX?'FX Track':'Bone');
 $('fxInspector').hidden=!item;
 const options=$('attachBone');options.replaceChildren();
 for(const part of state.rig.parts){
  const o=document.createElement('option');o.value=part.id;o.textContent=part.name;options.append(o);
 }
 options.disabled=!isFX;options.value=isFX?(item?.boneId||''):(item?.parent||'');
 $('firstFrame').disabled=$('lastFrame').disabled=$('fxLoop').disabled=!isFX;
 if(!item){$('addKey').disabled=$('removeKey').disabled=true;return}
 const p=isFX?trackPose(item):core.sample(clip.tracks?.[item.id],state.frame,item.base,clip.easing==='smooth');
 $('poseX').value=p.x;$('poseY').value=p.y;$('poseR').value=Math.round(p.r*10)/10;
 $('poseS').value=p.sx;$('opacity').value=isFX?Math.round(p.opacity*100):100;
 $('opacity').disabled=!isFX;
 if(isFX){$('firstFrame').value=item.first+1;$('lastFrame').value=item.last+1;$('fxLoop').checked=item.loop}
 const keys=isFX?item.keys:clip.tracks?.[item.id]||[];
 $('addKey').disabled=false;$('removeKey').disabled=!keys.some(k=>k.f===state.frame);
}
function refresh(){renderHierarchy();renderFX();renderTimeline();inspector();render();updateHistoryButtons()}
function setFrame(f){if(!state.rig)return;state.frame=core.clamp(Math.round(f),0,currentClip().frames-1);state.elapsed=0;refresh()}
function stop(){state.playing=false;$('play').textContent='▶ Play'}
function tick(time){
 if(state.playing&&state.rig){
  const delta=Math.min(250,Math.max(0,time-state.last));state.elapsed+=delta;
  const step=1000/currentClip().fps;
  while(state.elapsed>=step){state.elapsed-=step;if(state.frame>=currentClip().frames-1){
   if($('loop').checked)state.frame=0;else{stop();break}
  }else state.frame++;render();renderTimeline();inspector()}
 }
 state.last=time;requestAnimationFrame(tick);
}
function editableSnapshot(){
 return {clipTracks:clone(currentClip().tracks||{}),
  tracks:state.tracks.map(t=>({...t,keys:clone(t.keys)})),
  frame:state.frame,tool:state.tool,selectedBone:state.selectedBone,selectedFX:state.selectedFX};
}
function restore(snapshot){
 currentClip().tracks=clone(snapshot.clipTracks);
 state.tracks=snapshot.tracks.map(t=>({...t,keys:clone(t.keys)}));
 state.frame=snapshot.frame;state.tool=snapshot.tool;
 state.selectedBone=snapshot.selectedBone;state.selectedFX=snapshot.selectedFX;refresh();
}
function remember(before){
 const after=editableSnapshot();
 if(JSON.stringify(before)===JSON.stringify(after))return;
 state.history.push({before,after});if(state.history.length>40)state.history.shift();
 state.future.length=0;state.dirty=true;updateHistoryButtons();
}
function updateHistoryButtons(){$('undo').disabled=state.history.length===0;$('redo').disabled=state.future.length===0}
function undo(){if(!state.history.length)return status('ไม่มี Undo');stop();const e=state.history.pop();state.future.push(e);restore(e.before);status('Undo สำเร็จ')}
function redo(){if(!state.future.length)return status('ไม่มี Redo');stop();const e=state.future.pop();state.history.push(e);restore(e.after);status('Redo สำเร็จ')}
function writeKey(f=state.frame,pose){
 const clip=currentClip();
 if(state.tool==='fx'){
  const track=chosenTrack();if(!track)return;
  const p=pose||trackPose(track,f),at=track.keys.find(k=>k.f===f);
  if(at)at.pose=clone(p);else track.keys.push({f,pose:clone(p)});
  track.keys.sort((a,b)=>a.f-b.f);
 }else{
  const part=state.rig.parts.find(p=>p.id===state.selectedBone);if(!part)return;
  clip.tracks??={};clip.tracks[part.id]??=[];
  const p=pose||core.sample(clip.tracks[part.id],f,part.base,clip.easing==='smooth');
  const at=clip.tracks[part.id].find(k=>k.f===f);
  if(at)at.pose=clone(p);else clip.tracks[part.id].push({f,pose:clone(p)});
  clip.tracks[part.id].sort((a,b)=>a.f-b.f);
 }
}
function screenPoint(event){
 const rect=canvas.getBoundingClientRect();
 return {x:(event.clientX-rect.left)*W/rect.width-origin.x,
  y:(event.clientY-rect.top)*H/rect.height-origin.y};
}
function inverse(m){
 const d=m[0]*m[3]-m[1]*m[2];if(Math.abs(d)<1e-8)return null;
 return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,
 (m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];
}
function hitFX(x,y){
 for(const track of [...state.tracks].reverse()){
  if(!activeTrack(track,state.frame))continue;
  const source=state.fxSources.find(s=>s.id===track.sourceId);
  const img=source?.frames[sourceIndex(source,state.frame,track)]?.img;if(!img)continue;
  const inv=inverse(matrixForTrack(track));if(!inv)continue;const p=core.point(inv,x,y);
  if(p.x>=-img.width/2&&p.x<img.width/2&&p.y>=-img.height/2&&p.y<img.height/2)return track;
 }
 return null;
}
// Hit-test the actual transformed sprite, not only the small Bone anchor.
// Prefer an explicitly selected Bone when several sprites overlap.
const hitCanvas=document.createElement('canvas');hitCanvas.width=hitCanvas.height=1;
const hitCtx=hitCanvas.getContext('2d',{willReadFrequently:true});
function hitBone(x,y,matrices){
 const selected=state.rig.parts.find(part=>part.id===state.selectedBone);
 const ordered=[selected,...[...state.rig.parts].reverse()].filter(Boolean),seen=new Set();
 for(const part of ordered){
  if(seen.has(part.id)||part.visible===false)continue;seen.add(part.id);
  const img=state.images.get(part.id),matrix=matrices.get(part.id),inv=matrix&&inverse(matrix);
  if(!img||!inv)continue;
  const local=core.point(inv,x,y),sx=Math.floor(local.x+part.pivot.x),sy=Math.floor(local.y+part.pivot.y);
  if(sx>=0&&sy>=0&&sx<img.width&&sy<img.height){
   hitCtx.clearRect(0,0,1,1);hitCtx.drawImage(img,sx,sy,1,1,0,0,1,1);
   if(hitCtx.getImageData(0,0,1,1).data[3]>16)return part;
  }
  const anchor=core.point(matrix);
  if(Math.hypot(anchor.x-x,anchor.y-y)<11)return part;
 }
 return null;
}
function rotationAngle(point,pivot){
 return Math.atan2(point.y-pivot.y,point.x-pivot.x)*180/Math.PI;
}
function down(event){
 if(event.button!==0||!state.rig)return;
 const p=screenPoint(event),matrices=boneMatrices();
 stop();
 const gizmo=selectedGizmo();
 const onRotateRing=state.transformTool==='rotate'&&gizmo&&
  Math.abs(Math.hypot(p.x-gizmo.center.x,p.y-gizmo.center.y)-gizmo.radius)<=12;
 if(state.tool==='fx'){
  const track=onRotateRing?chosenTrack():hitFX(p.x,p.y);
  if(!track){state.selectedFX=null;refresh();status('เลือก FX จากรายการด้านซ้ายหรือคลิกบนภาพแสง',true);return}
  const before=editableSnapshot(),parent=matrices.get(track.boneId)||core.identity();
  const inv=inverse(parent);if(!inv)return;
  state.selectedFX=track.id;
  const pivot=core.point(matrixForTrack(track)),pose=trackPose(track);
  state.drag={kind:'fx',before,trackId:track.id,pose,mode:state.transformTool,changed:false,
   pivot,startAngle:rotationAngle(p,pivot),start:core.point(inv,p.x,p.y)};
 }else{
  const part=onRotateRing?state.rig.parts.find(b=>b.id===state.selectedBone):hitBone(p.x,p.y,matrices);
  if(!part){state.selectedBone=null;refresh();status('คลิกตรงภาพกระบอง หรือเลือก Staff ใน Hierarchy',true);return}
  const before=editableSnapshot(),parent=matrices.get(part.parent)||core.identity();
  const inv=inverse(parent);if(!inv)return;
  state.selectedBone=part.id;
  const pivot=core.point(matrices.get(part.id));
  const pose=core.sample(currentClip().tracks?.[part.id],state.frame,part.base,currentClip().easing==='smooth');
  state.drag={kind:'bone',before,boneId:part.id,pose,mode:state.transformTool,changed:false,
   pivot,startAngle:rotationAngle(p,pivot),start:core.point(inv,p.x,p.y)};
 }
 canvas.setPointerCapture(event.pointerId);refresh();event.preventDefault();
}
function move(event){
 const d=state.drag;if(!d)return;
 const p=screenPoint(event);
 let nextPose;
 if(d.mode==='rotate'){
  const delta=((rotationAngle(p,d.pivot)-d.startAngle+540)%360)-180;
  if(Math.abs(delta)<.15&&!d.changed)return;
  nextPose={...d.pose,r:boundedAngle(d.pose.r+delta)};
 }else{
  const matrices=boneMatrices();
  const parent=d.kind==='fx'?(matrices.get(state.tracks.find(t=>t.id===d.trackId)?.boneId)||core.identity()):
   (matrices.get(state.rig.parts.find(b=>b.id===d.boneId)?.parent)||core.identity());
  const inv=inverse(parent);if(!inv)return;
  const next=core.point(inv,p.x,p.y),dx=next.x-d.start.x,dy=next.y-d.start.y;
  if(Math.hypot(dx,dy)<.2&&!d.changed)return;
  nextPose={...d.pose,x:d.pose.x+dx,y:d.pose.y+dy};
 }
 d.changed=true;
 writeKey(state.frame,nextPose);render();event.preventDefault();
}
function up(event){
 if(!state.drag)return;const {before,changed,mode}=state.drag;
 if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
 state.drag=null;if(changed)remember(before);refresh();
 status(changed?(mode==='rotate'?'หมุนเรียบร้อย':'ย้ายตำแหน่งเรียบร้อย')+' • สร้าง Keyframe แล้ว • Ctrl+Z ย้อนกลับได้':'เลือกวัตถุแล้ว • เลื่อนเมาส์เพื่อย้ายหรือหมุน');
}
async function addRig(rig,{resetTracks=true}={}){
 core.validateRig(rig);
 const images=new Map();
 for(const p of rig.parts)images.set(p.id,await loadImage(p.src));
 state.rig=rig;state.images=images;state.clipIndex=Math.max(0,rig.clips.findIndex(c=>c.id===rig.activeClipId));
 if(resetTracks){state.fxSources=[];state.tracks=[];state.selectedFX=null}
 state.frame=0;state.selectedBone=rig.parts.at(-1)?.id||null;stop();state.history=[];state.future=[];
 renderClips();refresh();status('Rig พร้อมใช้งาน: '+rig.name);
}
async function addFX(fx){
 core.validateFx(fx);
 const entries=Array.isArray(fx.layers)&&fx.layers.length?
 fx.layers.filter(l=>l.visible!==false).map(l=>({
  name:l.name||fx.name||'FX Layer',frames:l.frames,settings:l.effects||null,opacity:l.opacity??1})):
 [{name:fx.name||'FX Main',frames:fx.frames,settings:null,opacity:1}];
 if(!entries.length)throw Error('FX JSON ไม่มี Layer ที่แสดงผล');
 if(entries.length+state.tracks.length>12)throw Error('Unified Studio รองรับสูงสุด 12 FX Tracks');
 const sources=[];
 for(const entry of entries){
  if(!Array.isArray(entry.frames)||!entry.frames.length||entry.frames.length>64)throw Error('FX Layer ไม่มีเฟรม');
  const decoded=[];
  for(const f of entry.frames){
   const img=await loadImage(f.src);
   let src=f.src;
   if(entry.settings||entry.opacity!==1){
    const c=tempCanvas(img.width,img.height);c.getContext('2d').drawImage(img,0,0);
    const filtered=entry.settings?fxCore.effectCanvas(c,entry.settings,fx.style||'pixel'):c;
    const output=tempCanvas(img.width,img.height),g=output.getContext('2d');
    g.globalAlpha=core.clamp(Number(entry.opacity),0,1);g.drawImage(filtered,0,0);
    src=output.toDataURL('image/png');
   }
   decoded.push({src,hold:Number(f.hold)||1,img:src===f.src?img:await loadImage(src)});
  }
  sources.push({id:'fx_'+Math.random().toString(36).slice(2,10),name:entry.name,
   fps:core.clamp(Number(fx.fps)||8,1,30),frames:decoded,holds:decoded.map(x=>x.hold)});
 }
 const part=state.rig.parts.find(p=>/staff|weapon|กระบอง|ดาบ/i.test(p.name+' '+p.id))||
 state.rig.parts.at(-1);
 for(const s of sources){
  state.fxSources.push(s);
  const id='track_'+Math.random().toString(36).slice(2,10);
  state.tracks.push({id,sourceId:s.id,name:s.name,boneId:part.id,visible:true,
   first:0,last:currentClip().frames-1,loop:true,keys:[{f:0,pose:defaultPose()}]});
  state.selectedFX=id;
 }
 state.tool='fx';state.history=[];state.future=[];refresh();
 status('Imported '+sources.length+' FX Layer(s) • Attached to '+part.name);
}
function renderClips(){
 const list=$('clipSelect');list.replaceChildren();
 for(const [index,c] of state.rig.clips.entries()){
  const opt=document.createElement('option');opt.value=index;opt.textContent=c.name+' ('+c.frames+'F @ '+c.fps+'FPS)';
  list.append(opt);
 }
 list.value=String(state.clipIndex);
}
function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function renderExport(frame,size){
 const out=tempCanvas(size,size),g=out.getContext('2d');g.translate(size/2,size*.58);
 const sc=size/512;g.scale(sc,sc); // 512 canvas coordinates to target cell size
 drawParts(g,frame,false,1);drawFX(g,frame,false);return out;
}
async function exportSheet(){
 const cols=Math.round(validNumber('columns',1,16)),size=Number($('cellSize').value),frames=currentClip().frames;
 if(frames*size*size>16000000)throw Error('Export มากเกิน 16 ล้านพิกเซล โปรดใช้ 256px หรือลดจำนวนเฟรม');
 const rows=Math.ceil(frames/cols),out=tempCanvas(cols*size,rows*size),g=out.getContext('2d');
 for(let f=0;f<frames;f++){
  const cell=renderExport(f,size);g.drawImage(cell,(f%cols)*size,Math.floor(f/cols)*size);
 }
 const blob=await new Promise((resolve,reject)=>out.toBlob(x=>x?resolve(x):reject(Error('Export PNG ไม่สำเร็จ')),'image/png'));
 downloadBlob(blob,filename()+'-rig-fx-sheet.png');
 status('Export Combined PNG '+frames+' เฟรม × '+size+'px');
}
function projectData(){
 return {format:'bunny-unified-studio',version:1,rig:state.rig,fxSources:state.fxSources.map(s=>({
  id:s.id,name:s.name,fps:s.fps,frames:s.frames.map(f=>({src:f.src,hold:f.hold}))})),
 tracks:state.tracks.map(t=>({...t,keys:clone(t.keys)}))};
}
async function openUnified(data){
 if(data?.format!=='bunny-unified-studio'||!Array.isArray(data.fxSources)||!Array.isArray(data.tracks)||
 data.fxSources.length>12||data.tracks.length>12)throw Error('ไม่ใช่ Unified Studio Project');
 const rig=core.validateRig(data.rig),images=new Map();
 for(const p of rig.parts)images.set(p.id,await loadImage(p.src));
 const sources=[];
 for(const source of data.fxSources){
  if(!Array.isArray(source.frames)||!source.frames.length||source.frames.length>64)throw Error('FX Source ผิดรูปแบบ');
  const frames=[];for(const f of source.frames)frames.push({src:f.src,hold:Number(f.hold)||1,img:await loadImage(f.src)});
  sources.push({...source,frames,holds:frames.map(f=>f.hold)});
 }
 // Apply only after every image has been decoded.
 state.rig=rig;state.images=images;state.fxSources=sources;state.tracks=clone(data.tracks);
 state.clipIndex=Math.max(0,rig.clips.findIndex(c=>c.id===rig.activeClipId));
 state.selectedFX=state.tracks[0]?.id||null;state.selectedBone=rig.parts.at(-1)?.id||null;
 state.tool=state.tracks.length?'fx':'bone';state.frame=0;state.history=[];state.future=[];stop();
 renderClips();refresh();status('Opened Unified JSON • '+state.tracks.length+' FX Tracks');
}
async function perform(fn){try{await fn()}catch(e){console.error('[Unified Studio]',e);status(e.message||String(e),true)}}
function wire(){
 $('rigImport').onclick=()=>$('rigFile').click();
 $('fxImport').onclick=()=>$('fxFile').click();
 $('rigFile').onchange=e=>{const f=e.target.files?.[0];if(f)perform(async()=>addRig(await parseFile(f)));e.target.value=''};
 $('fxFile').onchange=e=>{const f=e.target.files?.[0];if(f)perform(async()=>addFX(await parseFile(f)));e.target.value=''};
 $('clipSelect').onchange=e=>{
  state.clipIndex=Number(e.target.value);state.rig.activeClipId=currentClip().id;state.frame=0;stop();
  for(const track of state.tracks)track.last=Math.min(track.last,currentClip().frames-1);
  refresh();
 };
 $('showBones').onchange=render;$('onion').onchange=render;
 $('selectFX').onclick=()=>{state.tool='fx';refresh()};
 $('selectBone').onclick=()=>{state.tool='bone';refresh()};
 $('moveTool').onclick=()=>setTransformTool('move');
 $('rotateTool').onclick=()=>setTransformTool('rotate');
 $('rotateLeft').onclick=()=>rotateBy(-15);
 $('rotateRight').onclick=()=>rotateBy(15);
 $('fxDemo').onclick=()=>perform(()=>addFX(demoFX()));
 $('prev').onclick=()=>{stop();setFrame(state.frame-1)};
 $('next').onclick=()=>{stop();setFrame(state.frame+1)};
 $('play').onclick=()=>{state.playing=!state.playing;state.last=performance.now();state.elapsed=0;
  $('play').textContent=state.playing?'⏸ Pause':'▶ Play'};
 $('attachBone').onchange=()=>{const track=chosenTrack();if(!track)return;
  const before=editableSnapshot();track.boneId=$('attachBone').value;remember(before);refresh()};
 for(const id of ['poseX','poseY','poseR','poseS','opacity']){
  $(id).onchange=()=>perform(async()=>{
   const item=state.tool==='fx'?chosenTrack():state.rig.parts.find(p=>p.id===state.selectedBone);
   if(!item)return;const before=editableSnapshot();
   const prev=state.tool==='fx'?trackPose(item):core.sample(currentClip().tracks?.[item.id],state.frame,item.base,currentClip().easing==='smooth');
   const next={...prev,x:validNumber('poseX',-512,512),y:validNumber('poseY',-512,512),
    r:validNumber('poseR',-360,360),sx:validNumber('poseS',.05,8),sy:validNumber('poseS',.05,8),
    opacity:validNumber('opacity',0,100)/100};
   writeKey(state.frame,next);remember(before);refresh();
  });
 }
 for(const id of ['firstFrame','lastFrame','fxLoop']){
  $(id).onchange=()=>perform(async()=>{
   const track=chosenTrack();if(!track)return;const before=editableSnapshot();
   track.first=Math.round(validNumber('firstFrame',1,currentClip().frames))-1;
   track.last=Math.round(validNumber('lastFrame',track.first+1,currentClip().frames))-1;
   track.loop=$('fxLoop').checked;remember(before);refresh();
  });
 }
 $('addKey').onclick=()=>{const before=editableSnapshot();writeKey();remember(before);refresh()};
 $('removeKey').onclick=()=>{
  const item=state.tool==='fx'?chosenTrack():state.rig.parts.find(p=>p.id===state.selectedBone);
  if(!item)return;const before=editableSnapshot();
  if(state.tool==='fx')item.keys=item.keys.filter(k=>k.f!==state.frame);
  else currentClip().tracks[item.id]=(currentClip().tracks[item.id]||[]).filter(k=>k.f!==state.frame);
  remember(before);refresh();
 };
 $('undo').onclick=undo;$('redo').onclick=redo;
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);
 canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
 window.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey){
   const key=event.key.toLowerCase();
   if(key==='z'){event.preventDefault();if(event.shiftKey)redo();else undo()}
   else if(key==='y'){event.preventDefault();redo()}
   else if(key==='s'){event.preventDefault();perform(async()=>downloadBlob(
    new Blob([JSON.stringify(projectData())],{type:'application/json'}),filename()+'.unified.json'))}
   return;
  }
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(event.key.toLowerCase()==='r'){event.preventDefault();setTransformTool('rotate');return}
  if(event.key.toLowerCase()==='v'){event.preventDefault();setTransformTool('move');return}
  if(event.code==='Space'){event.preventDefault();$('play').click()}
  if(event.key==='ArrowLeft'){event.preventDefault();stop();setFrame(state.frame-1)}
  if(event.key==='ArrowRight'){event.preventDefault();stop();setFrame(state.frame+1)}
 });
 $('exportSheet').onclick=()=>perform(exportSheet);
 $('saveProject').onclick=()=>perform(async()=>downloadBlob(new Blob([JSON.stringify(projectData())],
  {type:'application/json'}),filename()+'.unified.json'));
 $('loadProject').onclick=()=>$('projectFile').click();
 $('projectFile').onchange=e=>{const f=e.target.files?.[0];if(f)perform(async()=>openUnified(await parseFile(f)));e.target.value=''};
}
window.__unifiedTest={get state(){return state},demoRig,demoFX,addRig,addFX,openUnified,projectData,render,setFrame,
 chooseTrack:id=>{state.selectedFX=id;state.tool='fx';refresh()},exportSheet,undo,redo,
 boneMatrices,selectedGizmo,setTransformTool,hitBone};
wire();
perform(async()=>{await addRig(demoRig());await addFX(demoFX());$('rigInfo').textContent='Training Bunny: Staff Spin 360° • Load Bone Rig JSON เพื่อใช้ตัวละครจริง';});
requestAnimationFrame(tick);
})();