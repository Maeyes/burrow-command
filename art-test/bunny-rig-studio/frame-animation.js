(function(){
'use strict';
const core=window.BunnyFrameCore,{LIMIT,sheetRects,naturalSort,fitRect,spriteSheetLayout,buildGif}=core;
const $=id=>document.getElementById(id),canvas=$('preview'),ctx=canvas.getContext('2d',{willReadFrequently:false});
const state={frames:[],sheet:null,selected:0,current:0,playing:false,last:0,accum:0,renderCount:0};
let statusTimer=null;
const HISTORY_LIMIT=40,history=[],future=[];
const EDITOR_FIELDS=['fps','loop','cellWidth','cellHeight','exportColumns','projectName'];
let committedFields={};
function captureState(){
 return {frames:state.frames.map(f=>({...f})),sheet:state.sheet,current:state.current,selected:state.selected,
  fields:{...committedFields}};
}
function commitFields(){committedFields=Object.fromEntries(EDITOR_FIELDS.map(id=>[id,$(id).value]))}
function saveHistory(){
 history.push(captureState());if(history.length>HISTORY_LIMIT)history.shift();
 future.length=0;updateUndoButtons();
}
function updateUndoButtons(){$('frameUndo').disabled=!history.length;$('frameRedo').disabled=!future.length}
function restoreState(saved){
 stop();state.frames=saved.frames.map(f=>({...f}));state.sheet=saved.sheet;
 state.selected=Math.min(saved.selected,Math.max(0,state.frames.length-1));
 state.current=Math.min(saved.current,Math.max(0,state.frames.length-1));
 for(const id of EDITOR_FIELDS)$(id).value=saved.fields[id];
 commitFields();$('sheetOptions').hidden=!state.sheet;$('sheetPreview').hidden=!state.sheet;
 if(state.sheet)$('sheetPreview').src=state.sheet.src;
 syncInspector();renderAll();updateGridHint();updateUndoButtons();
}
function undo(){
 if(!history.length)return status('ไม่มีรายการให้ Undo');
 const previous=history.pop();future.push(captureState());restoreState(previous);
 status('Undo แล้ว • Ctrl+Y หรือ Ctrl+Shift+Z เพื่อ Redo');
}
function redo(){
 if(!future.length)return status('ไม่มีรายการให้ Redo');
 const next=future.pop();history.push(captureState());restoreState(next);
 status('Redo แล้ว • Ctrl+Z ย้อนกลับได้');
}

function status(message,error=false){
 $('status').textContent=(error?'⚠ ':'● ')+message;
 $('status').style.color=error?'#ffbcae':'#aaddbf';
}
function number(id,low,high){
 const input=$(id),n=Number(input.value);
 if(!Number.isInteger(n)||n<low||n>high)throw Error(id+' ต้องอยู่ระหว่าง '+low+' ถึง '+high);
 return n;
}
function getFPS(){return number('fps',1,30)}
function getCell(){return {width:number('cellWidth',1,1024),height:number('cellHeight',1,1024)}}
function getSelected(){return state.frames[state.selected]||null}
function safeName(text){return String(text||'animation').trim().replace(/[^a-z0-9ก-๙_-]+/ig,'_').slice(0,60)||'animation'}
function escapeHTML(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function canvas2D(width,height){const c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;return [c,g]}
function loadImage(src){
 return new Promise((resolve,reject)=>{
  const im=new Image();
  im.onload=()=>im.width&&im.height?resolve(im):reject(Error('ไฟล์ภาพมีขนาดไม่ถูกต้อง'));
  im.onerror=()=>reject(Error('ไม่สามารถอ่านไฟล์ภาพได้'));
  im.src=src;
 });
}
function fileData(file){
 return new Promise((resolve,reject)=>{
  if(!/^image\/(png|webp|jpeg)$/.test(file.type))return reject(Error(file.name+': รองรับเฉพาะ PNG / WebP / JPEG'));
  if(file.size>16*1024*1024)return reject(Error(file.name+': ภาพใหญ่เกิน 16 MB'));
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(Error('ไม่สามารถอ่าน '+file.name));
  reader.readAsDataURL(file);
 });
}
function imageWarning(img){
 const [c,g]=canvas2D(1,1);
 g.drawImage(img,0,0,1,1);
 // The warning is advisory; alpha checks are performed on imported pixel data.
 const sampled=img.width*img.height<=1000000?(()=>{const [c2,g2]=canvas2D(img.width,img.height);g2.drawImage(img,0,0);const a=g2.getImageData(0,0,c2.width,c2.height).data;for(let k=3;k<a.length;k+=4)if(a[k]<255)return false;return true})():null;
 return sampled===true?'หมายเหตุ: ภาพนี้ไม่มีบริเวณโปร่งใส ตรวจสอบก่อน Export':null;
}
function stop(){state.playing=false;$('play').textContent='▶ Play'}
function setCurrent(index,fromPlayback=false){
 if(!state.frames.length)return;
 state.current=(index+state.frames.length)%state.frames.length;
 if(!fromPlayback){stop();state.selected=state.current;syncInspector()}
 state.accum=0;renderPreview();renderTimeline();
}
function select(index){state.selected=index;setCurrent(index);syncInspector();renderFrameList()}
function updateDimensions(width,height){
 $('cellWidth').value=String(Math.min(1024,Math.max(number('cellWidth',1,1024),width)));
 $('cellHeight').value=String(Math.min(1024,Math.max(number('cellHeight',1,1024),height)));
}
async function appendFrames(entries,{replace=false}={}){
 if(!entries.length)throw Error('ไม่มีเฟรมให้นำเข้า');
 if(entries.length+(replace?0:state.frames.length)>LIMIT)throw Error('สูงสุด '+LIMIT+' เฟรมต่อคลิป');
 const prepared=[];
 for(const entry of entries){
  const image=entry.image||await loadImage(entry.src);
  if(image.width>1024||image.height>1024)throw Error(entry.name+': เฟรมเกิน 1024×1024px');
  prepared.push({src:entry.src,img:image,name:String(entry.name||'frame').slice(0,80),
   offsetX:Number(entry.offsetX)||0,offsetY:Number(entry.offsetY)||0,hold:Number(entry.hold)||1,
   anchorX:Number.isFinite(entry.anchorX)?entry.anchorX:undefined,
   footY:Number.isFinite(entry.footY)?entry.footY:undefined});
 }
 saveHistory();stop();
 if(replace){state.frames=[];state.current=0;state.selected=0}
 const start=state.frames.length;
 state.frames.push(...prepared);
 updateDimensions(Math.max(...state.frames.map(f=>f.img.width)),Math.max(...state.frames.map(f=>f.img.height)));
 state.current=start;state.selected=start;
 syncInspector();renderAll();commitFields();
 status('นำเข้า '+prepared.length+' เฟรมเรียบร้อยแล้ว • กด Play เพื่อดูอนิเมชั่น');
 return prepared.length;
}
async function importSheet(file){
 const src=await fileData(file),img=await loadImage(src);
 if(img.width>4096||img.height>4096)throw Error('Sprite Sheet ต้องไม่เกิน 4096px ต่อด้าน');
 saveHistory();state.sheet={src,img,name:file.name};
 $('sheetOptions').hidden=false;$('sheetPreview').hidden=false;$('sheetPreview').src=src;
 updateGridHint();
 status('โหลด Sprite Sheet '+img.width+'×'+img.height+' • ตรวจ Columns/Rows แล้วกดตัดเฟรม');
}
function updateGridHint(){
 if(!state.sheet)return;
 try{
  const rects=sheetRects(state.sheet.img.width,state.sheet.img.height,{
   columns:number('cols',1,64),rows:number('rows',1,64),
   margin:number('margin',0,128),spacing:number('spacing',0,128),limit:LIMIT});
  const widths=rects.map(r=>r.w),heights=rects.map(r=>r.h);
  const minW=Math.min(...widths),maxW=Math.max(...widths),minH=Math.min(...heights),maxH=Math.max(...heights);
  const sizes=(minW===maxW?minW:minW+'–'+maxW)+'×'+(minH===maxH?minH:minH+'–'+maxH);
  const uneven=minW!==maxW||minH!==maxH;
  $('gridHint').textContent='ได้ '+rects.length+' เฟรม · '+sizes+' px ต่อเฟรม'+(uneven?' · ภาพหารไม่ลงตัว ระบบจะกระจายส่วนต่าง 1px โดยไม่ยืดรูป':'');
  $('gridHint').style.color=uneven?'#ffe0a5':'#afdcc4';
 }catch(err){$('gridHint').textContent=err.message;$('gridHint').style.color='#ffac9c'}
}
async function sliceCurrentSheet(){
 if(!state.sheet)throw Error('กรุณาเลือก Sprite Sheet ก่อน');
 const {img}=state.sheet;
 const rects=sheetRects(img.width,img.height,{
   columns:number('cols',1,64),rows:number('rows',1,64),
   margin:number('margin',0,128),spacing:number('spacing',0,128),limit:LIMIT});
 const prepared=rects.map((r,i)=>{
  const [c,g]=canvas2D(r.w,r.h);g.clearRect(0,0,r.w,r.h);
  g.drawImage(img,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
  return {src:c.toDataURL('image/png'),name:'frame_'+String(i+1).padStart(2,'0')};
 });
 await appendFrames(prepared);
 const warning=imageWarning(img);if(warning)status(warning,true);
}
async function importFiles(files){
 const sorted=[...files].sort((a,b)=>naturalSort([a.name,b.name])[0]===a.name?-1:1);
 if(!sorted.length)return;
 const entries=[];
 for(const file of sorted){
  const src=await fileData(file),image=await loadImage(src);
  entries.push({name:file.name.replace(/\.[^.]+$/,'').slice(0,80),src,image});
 }
 await appendFrames(entries);
 if(entries.some(x=>imageWarning(x.image)))status('บางเฟรมไม่มีความโปร่งใส โปรดตรวจภาพต้นฉบับ',true);
}
function drawCell(g,frame,{width,height},alpha=1){
 if(!frame)return;
 const p=fitRect(frame.img.width,frame.img.height,width,height,frame);
 g.save();g.globalAlpha=alpha;g.imageSmoothingEnabled=false;g.drawImage(frame.img,p.x,p.y,p.w,p.h);g.restore();
}
function renderCell(frame,width,height){
 const [c,g]=canvas2D(width,height);drawCell(g,frame,{width,height});return c;
}
function checkerboard(){
 const size=24;
 for(let y=0;y<512;y+=size)for(let x=0;x<512;x+=size){
  ctx.fillStyle=((x+y)/size)%2===0?'#314257':'#243346';
  ctx.fillRect(x,y,size,size);
 }
}
function renderPreview(){
 ctx.clearRect(0,0,512,512);
 if($('checker').checked)checkerboard();
 const frame=state.frames[state.current];
 if(!frame){ctx.fillStyle='#acc5db';ctx.textAlign='center';ctx.font='17px Tahoma,sans-serif';ctx.fillText('นำเข้า PNG / Sprite Sheet เพื่อเริ่มทำอนิเมชั่น',256,255);return}
 let cell;try{cell=getCell()}catch{return}
 const scale=Math.max(.25,Math.min(8,Math.floor(Math.min(460/cell.width,460/cell.height))||.5));
 const posX=(512-cell.width*scale)/2,posY=(512-cell.height*scale)/2;
 const [off,g]=canvas2D(cell.width,cell.height);
 if($('onion').checked&&state.frames.length>1)drawCell(g,state.frames[(state.current+state.frames.length-1)%state.frames.length],cell,.23);
 drawCell(g,frame,cell);
 ctx.imageSmoothingEnabled=false;ctx.drawImage(off,posX,posY,cell.width*scale,cell.height*scale);
 $('counter').textContent='F '+String(state.current+1).padStart(2,'0')+' / '+String(state.frames.length).padStart(2,'0');
 $('sizeLabel').textContent=cell.width+'×'+cell.height+' • '+getFPS()+' FPS';
 state.renderCount++;
}
function renderFrameList(){
 const list=$('framesList');list.replaceChildren();
 $('frameCount').textContent=state.frames.length+' เฟรม';
 if(!state.frames.length){const p=document.createElement('p');p.className='muted';p.textContent='นำเข้าภาพก่อน แล้วเฟรมจะปรากฏที่นี่';list.append(p);return}
 state.frames.forEach((f,i)=>{
  const row=document.createElement('div');row.className='frameRow'+(i===state.selected?' active':'');
  row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-label','เลือก '+f.name);
  row.innerHTML='<img alt="" src="'+f.src+'"><div class="frameName"><strong>'+escapeHTML(f.name)+'</strong><small>#'+(i+1)+' · '+f.img.width+'×'+f.img.height+' • '+f.hold+'×</small></div><div class="rowbuttons"><button type="button" title="ย้ายขึ้น" data-up="'+i+'">↑</button><button type="button" title="ย้ายลง" data-down="'+i+'">↓</button><button type="button" title="ลบ" data-remove="'+i+'">✕</button></div>';
  row.addEventListener('click',e=>{
   const up=e.target.closest('[data-up]'),down=e.target.closest('[data-down]'),del=e.target.closest('[data-remove]');
   if(up)return reorder(i,i-1);if(down)return reorder(i,i+1);if(del)return removeFrame(i);select(i);
  });
  row.addEventListener('keydown',e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();select(i)}});
  list.append(row);
 });
}
function renderTimeline(){
 const area=$('timeline');area.replaceChildren();
 state.frames.forEach((f,i)=>{
  const cell=document.createElement('button');cell.type='button';cell.className='timelineCell'+(i===state.current?' active':'');
  const img=document.createElement('img');img.src=f.src;img.alt='';
  const tag=document.createElement('small');tag.textContent='F'+String(i+1).padStart(2,'0')+(f.hold>1?' · '+f.hold+'×':'');
  cell.append(img,tag);cell.title=f.name;cell.onclick=()=>select(i);area.append(cell);
 });
}
function syncInspector(){
 const f=getSelected();
 for(const id of ['offsetX','offsetY','hold','selectedLabel','applyFrame'])$(id).disabled=!f;
 $('offsetX').value=f?.offsetX??0;$('offsetY').value=f?.offsetY??0;
 $('hold').value=f?.hold??1;$('selectedLabel').value=f?.name??'';
}
function renderAll(){renderFrameList();renderTimeline();renderPreview()}
function reorder(from,to){
 if(to<0||to>=state.frames.length)return;
 saveHistory();stop();const [f]=state.frames.splice(from,1);state.frames.splice(to,0,f);
 state.selected=to;state.current=to;syncInspector();renderAll();
}
function removeFrame(i){
 saveHistory();stop();state.frames.splice(i,1);
 state.current=Math.min(state.current,Math.max(0,state.frames.length-1));
 state.selected=Math.min(state.selected,Math.max(0,state.frames.length-1));
 syncInspector();renderAll();status('ลบเฟรมแล้ว');
}
function step(delta){
 if(!state.frames.length)return;stop();setCurrent(state.current+delta);
}
function tick(now){
 if(state.playing&&state.frames.length){
  state.accum+=Math.min(500,now-state.last);
  let hops=0;
  while(hops<LIMIT){
   const duration=state.frames[state.current].hold*1000/getFPS();
   if(state.accum<duration)break;
   state.accum-=duration;hops++;
   if(state.current===state.frames.length-1&&!Number($('loop').value)){stop();break}
   state.current=(state.current+1)%state.frames.length;
   if(state.selected!==state.current)state.selected=state.current;
   syncInspector();renderPreview();renderTimeline();renderFrameList();
  }
 }
 state.last=now;requestAnimationFrame(tick);
}
function play(){
 if(!state.frames.length){status('กรุณานำเข้าเฟรมก่อน',true);return}
 state.playing=!state.playing;state.last=performance.now();state.accum=0;
 $('play').textContent=state.playing?'⏸ Pause':'▶ Play';
}
function exportCanvas(){
 if(!state.frames.length)throw Error('ไม่มีเฟรมสำหรับ Export');
 const {width,height}=getCell(),layout=spriteSheetLayout(state.frames.length,number('exportColumns',1,64),width,height);
 const [out,g]=canvas2D(layout.width,layout.height);
 state.frames.forEach((frame,i)=>{
  const x=i%layout.cols*width,y=Math.floor(i/layout.cols)*height;
  g.save();g.translate(x,y);drawCell(g,frame,{width,height});g.restore();
 });
 return out;
}
function downloadBlob(blob,filename){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function downloadPNG(){
 const out=exportCanvas();
 const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('สร้าง PNG ไม่สำเร็จ')),'image/png'));
 downloadBlob(blob,safeName($('projectName').value)+'-sheet.png');
 status('Export Sprite Sheet PNG '+out.width+'×'+out.height+' • พื้นหลังโปร่งใส');
}
async function downloadFramePNG(){
 const frame=getSelected();
 if(!frame)throw Error('กรุณาเลือกเฟรมก่อน Export');
 stop();
 const {width,height}=getCell(),out=renderCell(frame,width,height);
 const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('สร้าง PNG ไม่สำเร็จ')),'image/png'));
 downloadBlob(blob,safeName($('projectName').value)+'-'+safeName(frame.name)+'.png');
 status('Export PNG เฟรม '+(state.selected+1)+' • โปร่งใส • ใช้ Anchor/Offset ปัจจุบัน');
}
async function downloadFramePNG(){
 const frame=getSelected();if(!frame)throw Error('กรุณาเลือกเฟรมก่อน Export');
 stop();const {width,height}=getCell(),out=renderCell(frame,width,height);
 const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('สร้าง PNG ไม่สำเร็จ')),'image/png'));
 downloadBlob(blob,safeName($('projectName').value)+'-'+safeName(frame.name)+'.png');
 status('Export PNG เฟรม '+(state.selected+1)+' • โปร่งใส • ใช้ Anchor/Offset ปัจจุบัน');
}
function downloadGIF(){
 if(!state.frames.length)throw Error('ไม่มีเฟรมสำหรับ GIF');
 const {width,height}=getCell();
 if(width*height*state.frames.length>3000000)throw Error('GIF ใหญ่เกินไป กรุณาลดขนาดเฟรมหรือจำนวนเฟรม');
 const rendered=state.frames.map(frame=>{
  const [c,g]=canvas2D(width,height);drawCell(g,frame,{width,height});
  return {hold:frame.hold,pixels:g.getImageData(0,0,width,height).data};
 });
 const data=buildGif({width,height,frames:rendered,fps:getFPS(),loop:$('loop').value==='1'});
 downloadBlob(new Blob([data],{type:'image/gif'}),safeName($('projectName').value)+'.gif');
 status('Export Animated GIF '+state.frames.length+' เฟรม • โปร่งใส • Loop ตามการตั้งค่า');
}
function projectData(){
 if(!state.frames.length)throw Error('ไม่มีข้อมูลเฟรมสำหรับบันทึก');
 return {format:'bunny-frame-animator',version:1,name:$('projectName').value,
  fps:getFPS(),loop:Boolean(Number($('loop').value)),cell:getCell(),
  frames:state.frames.map(({src,name,hold,offsetX,offsetY,anchorX,footY})=>({src,name,hold,offsetX,offsetY,anchorX,footY}))};
}
function saveJSON(){
 const content=JSON.stringify(projectData()),blob=new Blob([content],{type:'application/json'});
 downloadBlob(blob,safeName($('projectName').value)+'.bunny-frames.json');
 status('บันทึกโปรเจกต์ JSON (รวมภาพต้นฉบับทุกเฟรม) แล้ว');
}
async function openProject(file){
 if(file.size>35*1024*1024)throw Error('ไฟล์ JSON ใหญ่เกิน 35 MB');
 const input=JSON.parse(await file.text());
 if(input?.format!=='bunny-frame-animator'||!Array.isArray(input.frames)||!input.frames.length||input.frames.length>LIMIT)throw Error('ไฟล์ไม่ใช่โปรเจกต์ Frame Animator');
 if(!input.cell||input.cell.width<1||input.cell.width>1024||input.cell.height<1||input.cell.height>1024)throw Error('ขนาดเฟรมไม่ถูกต้อง');
 const entries=input.frames.map((f,i)=>{
  if(typeof f.src!=='string'||!/^data:image\/(png|webp|jpeg);base64,/i.test(f.src))throw Error('เฟรมที่ '+(i+1)+' ไม่มีรูป PNG/JPEG/WebP ที่ถูกต้อง');
  return {src:f.src,name:String(f.name||'frame_'+(i+1)).slice(0,80),
   hold:Number(f.hold)||1,offsetX:Number(f.offsetX)||0,offsetY:Number(f.offsetY)||0,
   anchorX:Number.isFinite(f.anchorX)?f.anchorX:undefined,footY:Number.isFinite(f.footY)?f.footY:undefined};
 });
 const images=await Promise.all(entries.map(e=>loadImage(e.src)));
 entries.forEach((e,i)=>e.image=images[i]);
 // Only touch the existing project after ALL new image data has decoded.
 await appendFrames(entries,{replace:true});
 $('cellWidth').value=input.cell.width;$('cellHeight').value=input.cell.height;
 $('fps').value=Math.min(30,Math.max(1,Number(input.fps)||8));
 $('loop').value=input.loop===false?'0':'1';
 $('projectName').value=String(input.name||'animation').slice(0,60);
 commitFields();renderAll();status('เปิดโปรเจกต์ '+$('projectName').value+' เรียบร้อยแล้ว');
}
async function loadDemo(){
 const frames=[];
 for(let k=0;k<4;k++){
  const [c,g]=canvas2D(64,64),hop=[0,3,8,3][k];
  // Simple original pixel-art test silhouette, NOT a production Bunny World asset.
  const rect=(color,x,y,w,h)=>{g.fillStyle=color;g.fillRect(x,y,w,h)};
  rect('#e8dbe5',19,13-hop,7,22);rect('#f7b4bd',21,16-hop,3,14);
  rect('#e8dbe5',38,13-hop,7,22);rect('#f7b4bd',40,16-hop,3,14);
  rect('#e8dbe5',15,29-hop,35,26);rect('#fff2e7',23,33-hop,24,19);
  rect('#283147',26,39-hop,4,6);rect('#283147',40,39-hop,4,6);rect('#e5aab4',35,49-hop,4,3);
  rect('#d8edf1',17+[0,-4,-2,0][k],53-hop,12,6);
  rect('#d8edf1',39+[0,4,2,0][k],53-hop,12,6);
  frames.push({name:'bunny_'+(k+1),src:c.toDataURL('image/png')});
 }
 await appendFrames(frames,{replace:true});
 $('projectName').value='demo-bunny-hop';$('cellWidth').value=64;$('cellHeight').value=64;$('fps').value=8;$('exportColumns').value=4;
 commitFields();renderAll();status('ตัวอย่างกระต่าย 4 เฟรมพร้อมใช้งาน • กด Play');
}
async function perform(action){
 try{await action()}catch(err){console.error('[Frame Animator]',err);status(err.message||String(err),true)}
}
$('pickSheet').onclick=()=>$('sheetInput').click();
$('pickFrames').onclick=()=>$('framesInput').click();
$('sheetInput').onchange=e=>{const file=e.target.files?.[0];if(file)perform(()=>importSheet(file));e.target.value=''};
$('framesInput').onchange=e=>{const files=[...e.target.files||[]];if(files.length)perform(()=>importFiles(files));e.target.value=''};
$('demoFrames').onclick=()=>perform(loadDemo);
$('dropZone').onclick=()=>$('sheetInput').click();
$('dropZone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('sheetInput').click()}};
for(const event of ['dragenter','dragover'])$('dropZone').addEventListener(event,e=>{e.preventDefault();$('dropZone').classList.add('dragover')});
for(const event of ['dragleave','drop'])$('dropZone').addEventListener(event,e=>{e.preventDefault();$('dropZone').classList.remove('dragover')});
$('dropZone').addEventListener('drop',e=>{const files=[...e.dataTransfer.files];if(files.length)perform(()=>files.length===1?importSheet(files[0]):importFiles(files))});
document.querySelectorAll('[data-grid]').forEach(btn=>btn.onclick=()=>{const [c,r]=btn.dataset.grid.split('x');$('cols').value=c;$('rows').value=r;updateGridHint()});
for(const id of ['cols','rows','margin','spacing'])$(id).oninput=updateGridHint;
$('sliceBtn').onclick=()=>perform(sliceCurrentSheet);
$('frameUndo').onclick=undo;$('frameRedo').onclick=redo;
$('previous').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('play').onclick=play;
$('fps').onchange=()=>perform(async()=>{getFPS();if($('fps').value!==committedFields.fps)saveHistory();commitFields();state.accum=0;renderPreview()});
for(const id of ['loop','exportColumns','projectName'])$(id).onchange=()=>{
 if($(id).value!==committedFields[id]){saveHistory();commitFields()}
};
$('onion').onchange=renderPreview;$('checker').onchange=renderPreview;
$('applyFrame').onclick=()=>perform(async()=>{
 const f=getSelected();if(!f)throw Error('กรุณาเลือกเฟรม');
 const offsetX=number('offsetX',-512,512),offsetY=number('offsetY',-512,512),hold=number('hold',1,16);
 const name=$('selectedLabel').value.trim().slice(0,80)||f.name;
 if(f.offsetX!==offsetX||f.offsetY!==offsetY||f.hold!==hold||f.name!==name)saveHistory();
 f.offsetX=offsetX;f.offsetY=offsetY;f.hold=hold;f.name=name;
 renderAll();status('ปรับเฟรม '+f.name+' เรียบร้อย');
});
for(const id of ['cellWidth','cellHeight'])$(id).onchange=()=>perform(async()=>{
 getCell();if($(id).value!==committedFields[id])saveHistory();commitFields();renderPreview()});
$('clearFrames').onclick=()=>{if(state.frames.length&&confirm('ล้างเฟรมทั้งหมด? กด Ctrl+Z เพื่อคืนได้')){saveHistory();stop();state.frames=[];state.current=0;state.selected=0;syncInspector();renderAll();status('ล้างเฟรมเรียบร้อย')}};
$('exportPNG').onclick=()=>perform(downloadPNG);
$('exportFramePNG').onclick=()=>perform(downloadFramePNG);
$('exportGIF').onclick=()=>perform(async()=>downloadGIF());
$('saveJSON').onclick=()=>perform(async()=>saveJSON());
$('loadJSON').onclick=()=>$('projectInput').click();
$('projectInput').onchange=e=>{const f=e.target.files?.[0];if(f)perform(()=>openProject(f));e.target.value=''};
document.addEventListener('keydown',e=>{
 if(!$('extractStudio').hidden)return; // Auto Extract owns Undo while its review dialog is open.
 if(e.ctrlKey||e.metaKey){const k=e.key.toLowerCase();
  if(k==='z'||k==='y'){e.preventDefault();if(k==='y'||e.shiftKey)redo();else undo()}return;
 }
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if(e.key===' '){e.preventDefault();play()}
 else if(e.key==='ArrowRight')step(1);else if(e.key==='ArrowLeft')step(-1);
});
const extract=window.BunnyAutoExtract.init({getSheet:()=>state.sheet,getGrid:sheet=>sheetRects(sheet.img.width,sheet.img.height,{columns:number('cols',1,64),rows:number('rows',1,64),margin:number('margin',0,128),spacing:number('spacing',0,128),limit:LIMIT}),appendFrames,perform,status,downloadBlob,safeName});
window.__frameAnimTest={get extract(){return extract.session},get extractor(){return extract},get state(){return state},importSheet,importFiles,sliceCurrentSheet,appendFrames,
 renderCell,exportCanvas,downloadGIF,projectData,openProject,loadDemo,setCurrent,step,stop,tick,undo,redo,get history(){return history},get future(){return future}};
commitFields();syncInspector();renderAll();updateUndoButtons();requestAnimationFrame(tick);
})();
