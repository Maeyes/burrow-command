(function(){
'use strict';
const $=id=>document.getElementById(id),maker=window.BunnyRigProof,math=window.BunnyUnifiedCore,
 ORIGIN=maker.ORIGIN,SIZE=maker.SIZE;
const scene=$('scene'),sceneCtx=scene.getContext('2d',{willReadFrequently:true});
const master=$('master'),masterCtx=master.getContext('2d',{willReadFrequently:true});
const project=maker.createSimpleProject(),baseline=maker.createSimpleProject();
const state={step:'master',clipIndex:0,frame:0,selected:'arm_front',tool:'move',
 images:new Map(),master:null,playing:false,last:0,elapsed:0,drag:null,
 history:[],future:[],pendingSlider:null,difference:null,renders:0};
const deep=x=>JSON.parse(JSON.stringify(x)),clip=()=>project.clips[state.clipIndex],
 part=id=>project.parts.find(p=>p.id===id),active=()=>part(state.selected);
const pose=(id,frame=state.frame)=>math.sample(clip().tracks?.[id],frame,part(id).base,clip().easing==='smooth');
const matrices=(frame=state.frame)=>math.worldMatrices(project,clip(),frame);
const world=(m,x=0,y=0)=>math.point(m,x,y);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
function status(message,fail=false){$('status').textContent=(fail?'⚠ ':'● ')+message;$('status').style.color=fail?'#ffb1a6':'#baf3d1'}
function img(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('PNG โหลดไม่สำเร็จ'));im.src=src})}
function stop(){state.playing=false;$('play').textContent='▶ Play'}
function snapshot(){return {clips:deep(project.clips),visible:project.parts.map(p=>p.visible),frame:state.frame,clipIndex:state.clipIndex,selected:state.selected}}
function restore(s){
 project.clips=deep(s.clips);project.parts.forEach((p,i)=>p.visible=s.visible[i]);
 state.frame=s.frame;state.clipIndex=s.clipIndex;state.selected=s.selected;stop();refresh();
}
function history(before){
 const after=snapshot();if(JSON.stringify(before)===JSON.stringify(after))return;
 state.history.push({before,after});if(state.history.length>40)state.history.shift();state.future.length=0;
 $('undo').disabled=false;$('redo').disabled=true;
}
function undo(){
 const item=state.history.pop();if(!item)return status('ไม่มีรายการ Undo');
 state.future.push(item);restore(item.before);status('Undo กลับไปแก้ไขก่อนหน้าแล้ว');
}
function redo(){
 const item=state.future.pop();if(!item)return status('ไม่มีรายการ Redo');
 state.history.push(item);restore(item.after);status('Redo ทำซ้ำการแก้ไขแล้ว');
}
function keyPose(id,newPose,frame=state.frame){
 clip().tracks??={};clip().tracks[id]??=[];const keys=clip().tracks[id];
 const existing=keys.find(k=>k.f===frame),entry={f:frame,pose:{...newPose}};
 if(existing)existing.pose=entry.pose;else keys.push(entry);
 keys.sort((a,b)=>a.f-b.f);
}
function setStep(step){
 if(!['master','layers','animate','export'].includes(step))return;
 stop();state.step=step;document.body.className='step-'+step;
 const labels={
  master:['1. วาด Master ตัวเดียวก่อน','ภาพนี้เป็นภาพทดสอบที่วาดจากพิกัดเดียวกันทั้งตัว เสื้อและเข็มขัดเป็นส่วนเดียวกับลำตัว',
   'ถ้าประกอบกลับมาเหมือน Master ทุกพิกเซล แสดงว่าตัดและตั้ง Pivot ถูกแล้ว'],
  layers:['2. เลือกชิ้น → ลากย้าย หรือหมุน','คลิกตรงภาพหรือเลือกจาก Layer List; ตอนนี้แขนแต่ละข้างเป็นชิ้นเดียว ไม่ต้องแยกข้อศอกหรือทำ Mesh',
   'ลองเลือกแขนหน้า แล้วกด ⟳ +15° หรือ Rotate และลาก • กด Undo ได้'],
  animate:['3. เลือกคลิปแล้วทดลองขยับทีละชิ้น','Idle, Walk และ Attack คือการเลื่อน/หมุน Cutout เดิม ไม่มีวาดภาพใหม่ทุกเฟรม',
   'คลิกเฟรม → เลือกชิ้น → ลากหรือหมุน ระบบบันทึก Keyframe ในเฟรมนั้นให้อัตโนมัติ'],
  export:['4. Export งานไปใช้ต่อ','เก็บ JSON ที่ยังแก้ไขแยก Layer ได้ หรือ Export ภาพตัวละครที่เล่นแล้วเป็น Sprite Sheet',
   'เมื่อพอใจกับรูปแบบแล้วค่อยแทนชิ้นส่วนตัวอย่างด้วย Master Artwork จริง']
 };
 const info=labels[step];$('stageTitle').textContent=info[0];$('stageHelp').textContent=info[1];$('nextTip').textContent=info[2];
 const title={master:'เข้าใจสัดส่วนก่อน',layers:'เลือก Layer ที่ต้องขยับ',animate:'แก้ Keyframe',export:'บันทึกและส่งต่อ'};
 $('sideTitle').textContent=title[step];
 $('sideHelp').textContent=step==='master'?'11 Layers นี้มาจาก Master เดียวกันจริง ๆ; เครื่องแต่งกายไม่ต้องแยกจากลำตัว':info[1];
 for(const name of ['Master','Layers','Animate','Export']){
  const el=$('step'+name),selected=name.toLowerCase()===step;el.classList.toggle('active',selected);
  el.setAttribute('aria-selected',String(selected));
 }
 if(step==='master'){state.clipIndex=0;state.frame=0}
 if(step==='layers'){state.clipIndex=0;state.frame=0}
 if(step==='animate'&&state.clipIndex===0){state.clipIndex=1;state.frame=0}
 refresh();status(info[2]);
}
function select(id){
 if(!part(id))return;state.selected=id;
 if(state.step==='master')setStep('layers');
 refresh();
 status('เลือก '+part(id).name+' — '+(state.tool==='move'?'คลิกค้างบนชิ้นแล้วลาก':'คลิกค้างและลากหมุนรอบจุด Pivot'));
}
function setTool(tool){
 state.tool=tool;
 $('moveTool').classList.toggle('active',tool==='move');
 $('rotateTool').classList.toggle('active',tool==='rotate');
 refresh();status(tool==='move'?'Move: คลิกชิ้นส่วนแล้วลากย้าย':'Rotate: ลากชิ้นส่วนหรือวงสีทองเพื่อหมุนรอบ Pivot');
}
function drawActor(ctx,frame,showGuide=false){
 const mats=matrices(frame);
 ctx.save();ctx.translate(ORIGIN.x,ORIGIN.y);ctx.imageSmoothingEnabled=false;
 for(const p of project.parts){
  if(!p.visible)continue;const im=state.images.get(p.id),m=mats.get(p.id);
  if(!im||!m)continue;
  ctx.save();ctx.transform(...m);ctx.drawImage(im,-p.pivot.x,-p.pivot.y);ctx.restore();
 }
 if(showGuide&&state.step!=='master'&&!state.playing&&active()?.visible){
  const p=active(),m=mats.get(p.id),im=state.images.get(p.id);
  if(m&&im){
   ctx.save();ctx.transform(...m);ctx.lineWidth=1.5;
   ctx.setLineDash([4,3]);ctx.strokeStyle='#ffd886';
   ctx.strokeRect(-p.pivot.x,-p.pivot.y,im.width,im.height);ctx.setLineDash([]);ctx.restore();
   const center=world(m);ctx.strokeStyle='#f7d283';ctx.lineWidth=1.4;
   ctx.beginPath();ctx.arc(center.x,center.y,4,0,Math.PI*2);ctx.stroke();
   ctx.beginPath();ctx.moveTo(center.x-8,center.y);ctx.lineTo(center.x+8,center.y);
   ctx.moveTo(center.x,center.y-8);ctx.lineTo(center.x,center.y+8);ctx.stroke();
   if(state.tool==='rotate'){
    const radius=clamp(Math.max(im.width,im.height)*.64+12,30,98);
    ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(center.x,center.y,radius,0,Math.PI*2);
    ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#ffe1a3';ctx.beginPath();ctx.arc(center.x,center.y-radius,7,0,Math.PI*2);ctx.fill();
   }
  }
 }
 ctx.restore();
}
function render(){
 sceneCtx.clearRect(0,0,SIZE,SIZE);if(!state.images.size)return;
 drawActor(sceneCtx,state.frame,true);
 $('frameLabel').textContent='F'+(state.frame+1)+'/'+clip().frames;
 state.renders++;
}
function renderParts(){
 const host=$('parts');host.replaceChildren();
 for(const p of project.parts){
  const el=document.createElement('button');el.className=state.selected===p.id?'active':'';
  el.title='คลิกเลือก '+p.name+' แล้วลากบน Canvas';
  const im=new Image();im.src=p.src;im.alt='';im.setAttribute('aria-hidden','true');
  const desc=document.createElement('span');desc.textContent=p.name;
  const subt=document.createElement('small');subt.textContent='↳ '+(p.parent?part(p.parent).name:'Root')+(p.visible?'':' • ซ่อน');
  desc.append(subt);el.append(im,desc);el.onclick=()=>select(p.id);host.append(el);
 }
}
function renderInspector(){
 const p=active();if(!p)return;
 const v=pose(p.id);
 $('inspectorName').textContent=p.name;$('inspectorParent').textContent='Pivot: '+p.pivot.x+','+p.pivot.y+
  ' • Parent: '+(p.parent?part(p.parent).name:'Root');
 $('posX').value=Math.round(v.x*100)/100;$('posY').value=Math.round(v.y*100)/100;
 $('rotation').value=Math.max(-180,Math.min(180,Math.round(v.r)));
 $('rotationLabel').textContent=(Math.round(v.r*10)/10)+'°';
 $('hideLayer').textContent=p.visible?'◉ ซ่อน Layer':'○ แสดง Layer';
 $('undo').disabled=state.history.length===0;$('redo').disabled=state.future.length===0;
}
function renderTimeline(){
 const el=$('timeline');el.replaceChildren();$('clip').value=String(state.clipIndex);
 const p=active();
 for(let i=0;i<clip().frames;i++){
  const b=document.createElement('button');b.className='frame'+(state.frame===i?' active':'')+
   ((clip().tracks?.[p?.id]||[]).some(k=>k.f===i)?' key':'');
  b.textContent='F'+String(i+1).padStart(2,'0');b.title='เลือกเฟรม '+(i+1);
  b.onclick=()=>{stop();state.frame=i;refresh()};el.append(b);
 }
 $('play').disabled=clip().frames===1;
}
function refresh(){renderParts();renderInspector();renderTimeline();render()}
function handleStepClick(){for(const name of ['Master','Layers','Animate','Export'])
 $('step'+name).onclick=()=>setStep(name.toLowerCase())}
function inverse(m){
 const d=m[0]*m[3]-m[1]*m[2];if(Math.abs(d)<1e-8)return null;
 return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,
  (m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];
}
function canvasPoint(e){
 const b=scene.getBoundingClientRect();return{x:(e.clientX-b.left)*SIZE/b.width-ORIGIN.x,
  y:(e.clientY-b.top)*SIZE/b.height-ORIGIN.y};
}
const hitCanvas=document.createElement('canvas');hitCanvas.width=hitCanvas.height=1;
const hitCtx=hitCanvas.getContext('2d',{willReadFrequently:true});
function hitPart(x,y){
 const mats=matrices(),selected=active();
 const search=[selected,...[...project.parts].reverse()].filter(Boolean),tested=new Set();
 for(const p of search){
  if(tested.has(p.id)||!p.visible)continue;tested.add(p.id);
  const im=state.images.get(p.id),inv=inverse(mats.get(p.id));if(!im||!inv)continue;
  const local=world(inv,x,y),sx=Math.floor(local.x+p.pivot.x),sy=Math.floor(local.y+p.pivot.y);
  if(sx>=0&&sx<im.width&&sy>=0&&sy<im.height){
   hitCtx.clearRect(0,0,1,1);hitCtx.drawImage(im,sx,sy,1,1,0,0,1,1);
   if(hitCtx.getImageData(0,0,1,1).data[3]>10)return p;
  }
 }
 return null;
}
function pointAngle(p,center){return Math.atan2(p.y-center.y,p.x-center.x)*180/Math.PI}
function pointerDown(e){
 if(state.step==='master'||e.button!==0||state.playing||!state.images.size)return;
 const p=canvasPoint(e),mats=matrices();
 let hit=hitPart(p.x,p.y),ring=false;
 if(state.tool==='rotate'&&active()?.visible){
  const currentM=mats.get(active().id),im=state.images.get(active().id),center=world(currentM),
   radius=clamp(Math.max(im.width,im.height)*.64+12,30,98);
  ring=Math.abs(Math.hypot(p.x-center.x,p.y-center.y)-radius)<11;
  if(ring)hit=active();
 }
 if(!hit)return;
 state.selected=hit.id;
 const matrix=mats.get(hit.id),pivot=world(matrix),
  pm=hit.parent?mats.get(hit.parent):math.identity(),inv=inverse(pm);
 if(!inv)return;
 state.drag={id:hit.id,before:snapshot(),original:pose(hit.id),tool:state.tool,
  start:world(inv,p.x,p.y),parentInv:inv,startAngle:pointAngle(p,pivot),
  pivot,lastX:p.x,lastY:p.y,changed:false};
 scene.setPointerCapture(e.pointerId);refresh();e.preventDefault();
}
function pointerMove(e){
 if(!state.drag)return;
 const d=state.drag,p=canvasPoint(e);
 const old=d.original,next={...old};
 if(d.tool==='move'){
  const local=world(d.parentInv,p.x,p.y);
  next.x=old.x+(local.x-d.start.x);next.y=old.y+(local.y-d.start.y);
 }else{
  const a=pointAngle(p,d.pivot);
  let delta=((a-d.startAngle+540)%360)-180;
  next.r=old.r+delta;
 }
 if(Math.abs(next.x-old.x)+Math.abs(next.y-old.y)+Math.abs(next.r-old.r)>.1)d.changed=true;
 keyPose(d.id,next);render();
 const v=pose(d.id);$('posX').value=Math.round(v.x);$('posY').value=Math.round(v.y);
 $('rotationLabel').textContent=Math.round(v.r)+'°';$('rotation').value=clamp(Math.round(v.r),-180,180);
 e.preventDefault();
}
function pointerUp(e){
 const d=state.drag;if(!d)return;
 state.drag=null;if(scene.hasPointerCapture(e.pointerId))scene.releasePointerCapture(e.pointerId);
 if(!d.changed)restore(d.before);else history(d.before);
 refresh();if(d.changed)status('บันทึก '+part(d.id).name+' ที่เฟรม '+(state.frame+1)+' • Ctrl+Z ย้อนกลับได้');
}
function changeSelected(update){
 const p=active();if(!p||state.step==='master')return;
 const before=snapshot(),next={...pose(p.id),...update};
 if(Object.values(next).some(v=>typeof v==='number'&&!Number.isFinite(v)))return;
 keyPose(p.id,next);history(before);refresh();
 status('บันทึก '+p.name+' ใน '+clip().name+' เฟรม '+(state.frame+1));
}
function rotateBy(deg){
 const p=active();if(!p)return;changeSelected({r:pose(p.id).r+deg});
}
function resetPart(){
 const p=active();if(!p)return;changeSelected({...p.base});
}
function resetAll(){
 if(!confirm('Reset Keyframes และการแก้ไขทุกคลิปกลับเป็นตัวอย่างเริ่มต้น? สามารถ Ctrl+Z ย้อนกลับได้'))return;
 const before=snapshot();project.clips=deep(baseline.clips);
 project.parts.forEach(p=>p.visible=true);state.frame=0;state.clipIndex=0;
 history(before);setStep('master');status('Reset ทุก Layer และ Keyframe เป็น Master เริ่มต้นแล้ว');
}
function showFile(blob,name){
 const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),20000);
}
function exportJSON(){
 showFile(new Blob([JSON.stringify(project)],{type:'application/json'}),
  'blessed-bunny-simple-cutout-v1.bunny-rig.json');
 status('บันทึก JSON ที่แก้ไขทุก Layer และ Keyframe ได้แล้ว');
}
async function exportSheet(){
 stop();const count=clip().frames,cols=Math.min(4,count),size=256,
 out=document.createElement('canvas');out.width=cols*size;out.height=Math.ceil(count/cols)*size;
 const g=out.getContext('2d');g.imageSmoothingEnabled=false;
 for(let f=0;f<count;f++){g.save();g.translate(f%cols*size,Math.floor(f/cols)*size);
  drawActor(g,f,false);g.restore()}
 const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('Export PNG ไม่สำเร็จ')),'image/png'));
 showFile(blob,'blessed-bunny-'+clip().id+'-sheet.png');status('Export '+count+' เฟรม PNG 256×256 โปร่งใสแล้ว');
}
function refreshClips(){
 const sel=$('clip');sel.replaceChildren();
 for(const [i,c] of project.clips.entries()){
  const o=document.createElement('option');o.value=i;o.textContent=c.name+' · '+c.frames+'F';sel.append(o)
 }
 sel.value=String(state.clipIndex);
}
async function checkMaster(){
 const out=document.createElement('canvas');out.width=out.height=SIZE;
 const g=out.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;
 drawActor(g,0,false);
 const a=masterCtx.getImageData(0,0,SIZE,SIZE).data,b=g.getImageData(0,0,SIZE,SIZE).data;
 let diff=0;for(let i=0;i<a.length;i+=4)
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])diff++;
 state.difference=diff;
 $('qcStatus').innerHTML=diff===0?
  '<span class="badge">✓ PASS • 11 Layers กลับมาเป็น Master ตรงกัน 100% (0 pixel mismatch)</span>':
  '<span class="badge warn">ภาพยังไม่ตรง Master: ต่างกัน '+diff+' พิกเซล</span>';
 return diff;
}
function tick(time){
 if(state.playing){state.elapsed+=Math.min(250,Math.max(0,time-state.last));
  const step=1000/(clip().fps||8);
  while(state.elapsed>=step){state.elapsed-=step;
   state.frame=state.frame===clip().frames-1?0:state.frame+1;
   render();renderTimeline();}
 }
 state.last=time;requestAnimationFrame(tick);
}
function wire(){
 handleStepClick();$('moveTool').onclick=()=>setTool('move');$('rotateTool').onclick=()=>setTool('rotate');
 $('minus15').onclick=()=>rotateBy(-15);$('plus15').onclick=()=>rotateBy(15);
 $('undo').onclick=undo;$('redo').onclick=redo;$('resetPart').onclick=resetPart;$('resetAll').onclick=resetAll;
 $('hideLayer').onclick=()=>{
  const p=active();if(!p)return;const before=snapshot();p.visible=!p.visible;history(before);refresh();
 };
 for(const [id,field] of [['posX','x'],['posY','y']])$(id).onchange=e=>{
  const v=Number(e.target.value);if(!Number.isFinite(v)||v<-300||v>300)return refresh();
  changeSelected({[field]:v});
 };
 $('rotation').addEventListener('pointerdown',()=>{state.pendingSlider=snapshot()});
 $('rotation').oninput=e=>{
  const r=Number(e.target.value);if(!Number.isFinite(r)||!active()||state.step==='master')return;
  if(!state.pendingSlider)state.pendingSlider=snapshot();
  keyPose(state.selected,{...pose(state.selected),r});$('rotationLabel').textContent=r+'°';render();
 };
 $('rotation').onchange=()=>{
  if(state.pendingSlider){history(state.pendingSlider);state.pendingSlider=null;refresh()}
 };
 $('clip').onchange=e=>{
  state.clipIndex=Number(e.target.value);state.frame=0;stop();refresh();
 };
 $('play').onclick=()=>{
  if(clip().frames<2)return;state.playing=!state.playing;state.elapsed=0;state.last=performance.now();
  $('play').textContent=state.playing?'⏸ Pause':'▶ Play';render();
 };
 $('prev').onclick=()=>{stop();state.frame=Math.max(0,state.frame-1);refresh()};
 $('next').onclick=()=>{stop();state.frame=Math.min(clip().frames-1,state.frame+1);refresh()};
 scene.addEventListener('pointerdown',pointerDown);
 scene.addEventListener('pointermove',pointerMove);
 scene.addEventListener('pointerup',pointerUp);
 scene.addEventListener('pointercancel',pointerUp);
 $('exportJSON').onclick=exportJSON;
 $('exportSheet').onclick=()=>exportSheet().catch(e=>status(e.message,true));
 $('exportMaster').onclick=()=>{
  const a=document.createElement('a');a.href=maker.simpleMasterImage();a.download='blessed-bunny-master.png';
  document.body.append(a);a.click();a.remove();
 };
 document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey){
   const k=e.key.toLowerCase();if(k==='z'){e.preventDefault();e.shiftKey?redo():undo()}
   else if(k==='y'){e.preventDefault();redo()}
   else if(k==='s'){e.preventDefault();exportJSON()}
   return;
  }
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if(e.key.toLowerCase()==='v')setTool('move');
  else if(e.key.toLowerCase()==='r')setTool('rotate');
  else if(e.code==='Space'&&state.step==='animate'){e.preventDefault();$('play').click()}
  else if(e.key==='ArrowRight'&&state.step==='animate'){$('next').click()}
  else if(e.key==='ArrowLeft'&&state.step==='animate'){$('prev').click()}
 });
}
window.__cutoutTest={state,project,baseline,checkMaster,render,pose,setStep,select,rotateBy,
 snapshot,history,undo,redo,exportJSON,exportSheet,part};
wire();
Promise.all([img(maker.simpleMasterImage()),...project.parts.map(p=>img(p.src))]).then(images=>{
 state.master=images[0];masterCtx.clearRect(0,0,SIZE,SIZE);masterCtx.drawImage(images[0],0,0);
 project.parts.forEach((p,i)=>state.images.set(p.id,images[i+1]));
 refreshClips();setStep('master');return checkMaster();
}).then(diff=>{
 status(diff===0?'พร้อมแล้ว — 11 Cutout Layers ตรงกับ Master ทุกพิกเซล • เริ่มที่ขั้นตอน 2 ได้เลย':
  'ภาพประกอบไม่ตรง Master ('+diff+' พิกเซล) ให้ตรวจ Layer',diff!==0);
}).catch(e=>{console.error('[Cutout Lab]',e);status('เริ่ม Cutout ไม่สำเร็จ: '+e.message,true)});
requestAnimationFrame(tick);
})();