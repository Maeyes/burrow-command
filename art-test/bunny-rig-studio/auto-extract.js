(function(root){
'use strict';
// A non-destructive review workshop for AI-generated sprite sheets. All mask,
// crop and anchor operations happen in memory; the original imported image is
// immutable until the user explicitly exports or appends reviewed frames.
const core=root.BunnyExtractCore;
const $=id=>document.getElementById(id);
const W=640,H=480,canvas=$('extractCanvas'),g=canvas.getContext('2d',{willReadFrequently:false});
let hooks,session=null;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
function canvas2D(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingEnabled=false;return [c,x]}
function current(){return session?.frames[session.selected]}
function note(message,error=false){$('extractNote').textContent=message;$('extractNote').style.color=error?'#ffc1ae':'#bbebd0'}
function touch(frame){frame.pixels=null;frame.rendered=null;frame.regions=null;session.dirty=true}
function snapshot(f){return {rect:{...f.rect},mask:f.mask.slice(),anchorX:f.anchorX,footY:f.footY,offsetX:f.offsetX,offsetY:f.offsetY}}
function push(){const f=current();if(!f)return;session.undo.push({index:session.selected,data:snapshot(f)});if(session.undo.length>20)session.undo.shift();session.redo.length=0}
function restore(record){
 session.selected=record.index;
 const f=current();Object.assign(f,{...record.data,rect:{...record.data.rect},mask:record.data.mask.slice()});
 touch(f);refresh();
}
function undo(){if(!session?.undo.length)return;const prev=session.undo.pop();session.redo.push({index:prev.index,data:snapshot(session.frames[prev.index])});restore(prev);note('Undo • สามารถ Redo ได้')}
function redo(){if(!session?.redo.length)return;const next=session.redo.pop();session.undo.push({index:next.index,data:snapshot(session.frames[next.index])});restore(next);note('Redo')}
function cropPixels(f){
 if(f.pixels)return f.pixels;
 const [c,x]=canvas2D(f.rect.w,f.rect.h);
 x.drawImage(session.sheet.img,f.rect.x,f.rect.y,f.rect.w,f.rect.h,0,0,f.rect.w,f.rect.h);
 f.pixels=x.getImageData(0,0,c.width,c.height);return f.pixels;
}
function rawFrame(f){
 if(f.rendered)return f.rendered;
 const data=cropPixels(f),[c,x]=canvas2D(f.rect.w,f.rect.h);
 const out=new ImageData(new Uint8ClampedArray(data.data),data.width,data.height);
 for(let i=0;i<f.mask.length;i++)if(!f.mask[i])out.data[i*4+3]=0;
 x.putImageData(out,0,0);
 f.rendered=c;return c;
}
function trimmed(f){
 const raw=rawFrame(f),data=raw.getContext('2d').getImageData(0,0,raw.width,raw.height);
 const bounds=core.trimBounds(data.data,raw.width,raw.height);
 if(!bounds)return null;
 const [out,x]=canvas2D(bounds.w,bounds.h);
 x.drawImage(raw,bounds.x,bounds.y,bounds.w,bounds.h,0,0,bounds.w,bounds.h);
 return {canvas:out,bounds,anchorX:f.anchorX-bounds.x,footY:f.footY-bounds.y};
}
function viewport(){
 const r=current().rect,scale=clamp(Math.min((W-100)/(r.w*1.45),(H-90)/(r.h*1.45))*session.zoom,.07,32);
 return {scale,x:W/2-(r.x+r.w/2)*scale,y:H/2-(r.y+r.h/2)*scale};
}
function boundsPoint(event){
 const box=canvas.getBoundingClientRect(),v=viewport();
 return {x:((event.clientX-box.left)*W/box.width-v.x)/v.scale,
         y:((event.clientY-box.top)*H/box.height-v.y)/v.scale};
}
function drawAlignedOther(index,alpha,v){
 if(index<0||index>=session.frames.length)return;
 const selected=current(),other=session.frames[index],a=selected.rect;
 g.save();g.globalAlpha=alpha;g.imageSmoothingEnabled=false;
 const x=a.x+selected.anchorX-other.anchorX+other.offsetX-selected.offsetX;
 const y=a.y+selected.footY-other.footY+other.offsetY-selected.offsetY;
 const pic=rawFrame(other);
 g.drawImage(pic,v.x+x*v.scale,v.y+y*v.scale,pic.width*v.scale,pic.height*v.scale);
 g.restore();
}
function draw(){
 if(!session)return;
 const f=current(),r=f.rect,v=viewport(),opacity=Number($('extractOpacity').value)/100;
 g.clearRect(0,0,W,H);
 for(let y=0;y<H;y+=24)for(let x=0;x<W;x+=24){g.fillStyle=((x+y)/24)%2?'#233549':'#30445b';g.fillRect(x,y,24,24)}
 g.imageSmoothingEnabled=false;
 if($('eyeSource').checked){
  g.save();g.globalAlpha=opacity;const s=session.sheet.img;
  g.drawImage(s,v.x,v.y,s.width*v.scale,s.height*v.scale);g.restore();
 }
 if($('eyePrevious').checked)drawAlignedOther(session.selected-1,opacity,v);
 if($('eyeNext').checked)drawAlignedOther(session.selected+1,opacity,v);
 const pic=rawFrame(f);g.drawImage(pic,v.x+r.x*v.scale,v.y+r.y*v.scale,r.w*v.scale,r.h*v.scale);
 g.strokeStyle='#ffdd91';g.lineWidth=2;g.setLineDash([7,4]);g.strokeRect(v.x+r.x*v.scale,v.y+r.y*v.scale,r.w*v.scale,r.h*v.scale);g.setLineDash([]);
 // Crosshair indicates the actual character/feet registration point.
 const pivotX=v.x+(r.x+f.anchorX)*v.scale,pivotY=v.y+(r.y+f.footY)*v.scale;
 g.strokeStyle='#91f0c8';g.lineWidth=1;
 g.beginPath();g.moveTo(pivotX-13,pivotY);g.lineTo(pivotX+13,pivotY);
 g.moveTo(pivotX,pivotY-13);g.lineTo(pivotX,pivotY+13);g.stroke();
 if(f.regions){
  const main=f.regions.largestId;
  for(const region of f.regions.sorted.slice(0,25)){
   const b=region.bounds;
   g.lineWidth=region.id===main?2:1;g.strokeStyle=region.id===main?'#90f0a9':'#f4ae7a';
   g.strokeRect(v.x+(r.x+b.x)*v.scale,v.y+(r.y+b.y)*v.scale,b.w*v.scale,b.h*v.scale);
  }
 }
 g.fillStyle='#081422cc';g.fillRect(0,0,230,27);
 g.fillStyle='#eaf4ff';g.font='12px system-ui';g.fillText('F'+(session.selected+1)+' • '+session.tool.toUpperCase()+' • '+Math.round(v.scale*100)+'% view',10,18);
 $('extractScale').textContent='Crop '+r.w+'×'+r.h+' px • Mask '+f.mask.reduce((n,b)=>n+b,0)+' px';
}
function showRegionList(){
 const f=current(),area=$('extractRegions');area.replaceChildren();
 if(!f.regions){area.textContent='กด Detect เพื่อดูกลุ่มพิกเซล (ไม่ลบอะไรอัตโนมัติ)';return}
 const list=f.regions.sorted;
 for(const region of list.slice(0,35)){
  const label=document.createElement('label');label.className='extractRegion';
  const input=document.createElement('input');input.type='checkbox';
  const ids=f.regions.idMap;let kept=0;
  for(let i=0;i<ids.length;i++)if(ids[i]===region.id&&f.mask[i])kept++;
  input.checked=kept>0;input.indeterminate=kept>0&&kept<region.pixels;
  const b=region.bounds;
  label.append(input,document.createTextNode((region.id===f.regions.largestId?'★ Main · ':'')+'#'+(region.id+1)+' '+region.pixels+'px ('+b.w+'×'+b.h+')'));
  input.onchange=()=>{push();for(let i=0;i<ids.length;i++)if(ids[i]===region.id)f.mask[i]=Number(input.checked);
   f.rendered=null;session.dirty=true;draw();showRegionList();
   note('อัปเดต Mask แล้ว • Undo คืนส่วนที่ตัดออกได้')};
  area.append(label);
 }
 if(list.length>35){const p=document.createElement('p');p.textContent='มีกลุ่มเล็กอีก '+(list.length-35)+' กลุ่ม • ไม่ถูกลบ';area.append(p)}
}
function refresh(){
 if(!session)return;
 const f=current();
 $('extractFrames').replaceChildren();
 session.frames.forEach((item,i)=>{
  const b=document.createElement('button');b.className='extractFrameButton'+(session.selected===i?' active':'');
  b.textContent='F'+String(i+1).padStart(2,'0')+' · '+item.rect.w+'×'+item.rect.h;
  b.onclick=()=>{session.selected=i;refresh()};
  $('extractFrames').append(b);
 });
 for(const key of ['x','y','w','h'])$('extract'+key.toUpperCase()).value=f.rect[key];
 $('extractAnchorX').value=f.anchorX;$('extractFootY').value=f.footY;
 $('extractOffsetX').value=f.offsetX;$('extractOffsetY').value=f.offsetY;
 $('extractUndo').disabled=!session.undo.length;$('extractRedo').disabled=!session.redo.length;
 $('extractTool').value=session.tool;showRegionList();draw();
}
function applyRect(next,fromDrag=false){
 const f=current();next=core.validRect(next,session.sheet.img.width,session.sheet.img.height);
 const old=f.rect;
 if(next.x===old.x&&next.y===old.y&&next.w===old.w&&next.h===old.h)return;
 f.mask=core.remapMask(f.mask,old,next);
 if(!fromDrag||session.drag?.edge!=='move'){
  f.anchorX+=old.x-next.x;f.footY+=old.y-next.y;
 }
 f.rect=next;touch(f);refresh();
}
function handleRectInput(){
 try{const next={x:+$('extractX').value,y:+$('extractY').value,w:+$('extractW').value,h:+$('extractH').value};
  core.validRect(next,session.sheet.img.width,session.sheet.img.height);
  push();applyRect(next);note('ปรับ Crop สำเร็จ • พื้นที่ใหม่ยังคงพิกเซลต้นฉบับไว้');
 }catch(e){refresh();note(e.message,true)}
}
function detect(){
 const f=current(),data=cropPixels(f);
 f.regions=core.connectedRegions(data.data,data.width,data.height);
 showRegionList();draw();
 note('พบ '+f.regions.regions.length+' กลุ่ม • กรอบสีเขียวคือ Main Candidate; ทุกกลุ่มยังถูกเก็บไว้');
}
function keepMain(){
 const f=current();if(!f.regions)detect();
 if(f.regions.largestId===null)return note('ไม่มีวัตถุที่ตรวจพบ',true);
 if(!confirm('เก็บเฉพาะ Connected Component หลัก? หาง กระบอง หรือผ้าคลุมที่แยกจากตัวอาจถูกซ่อนชั่วคราว (กด Undo หรือเลือกคืนได้)'))return;
 push();const ids=f.regions.idMap,main=f.regions.largestId;
 for(let i=0;i<ids.length;i++)if(ids[i]>=0)f.mask[i]=Number(ids[i]===main);
 f.rendered=null;session.dirty=true;showRegionList();draw();
 note('เก็บเฉพาะ Main Candidate แล้ว • Undo หรือเปิด checkbox กลุ่มอื่นเพื่อคืนชิ้นส่วน');
}
function trimCrop(){
 const f=current(),raw=rawFrame(f),data=raw.getContext('2d').getImageData(0,0,raw.width,raw.height);
 const b=core.trimBounds(data.data,raw.width,raw.height);
 if(!b)return note('เฟรมว่างเปล่า ตรวจ Mask ก่อน Trim',true);
 if(b.x===0&&b.y===0&&b.w===f.rect.w&&b.h===f.rect.h)return note('ขอบโปร่งใสถูก Trim หมดแล้ว');
 push();applyRect({x:f.rect.x+b.x,y:f.rect.y+b.y,w:b.w,h:b.h});
 note('Trim Transparent สำเร็จ • ไม่เปลี่ยนขนาดพิกเซลของตัวละคร');
}
function setBrush(event){
 const f=current(),p=boundsPoint(event),x=Math.floor(p.x-f.rect.x),y=Math.floor(p.y-f.rect.y);
 const keep=session.tool==='include',radius=Number($('extractBrush').value);
 core.paintMask(f.mask,f.rect.w,f.rect.h,x,y,radius,keep,cropPixels(f).data);
 f.rendered=null;session.dirty=true;draw();
}
function startPointer(event){
 if(!session)return;
 const f=current(),p=boundsPoint(event);
 if(session.tool!=='crop'){
  if(p.x<f.rect.x||p.x>=f.rect.x+f.rect.w||p.y<f.rect.y||p.y>=f.rect.y+f.rect.h)return;
  push();session.drag={edge:'brush'};setBrush(event);
 }else{
  const v=viewport(),tol=9/v.scale,r=f.rect;
  if(p.x<r.x-tol||p.x>r.x+r.w+tol||p.y<r.y-tol||p.y>r.y+r.h+tol)return;
  let edge='';
  if(Math.abs(p.x-r.x)<=tol)edge+='l';else if(Math.abs(p.x-r.x-r.w)<=tol)edge+='r';
  if(Math.abs(p.y-r.y)<=tol)edge+='t';else if(Math.abs(p.y-r.y-r.h)<=tol)edge+='b';
  if(!edge)edge='move';
  push();session.drag={edge,start:p,rect:{...r}};
 }
 canvas.setPointerCapture(event.pointerId);event.preventDefault();
}
function movePointer(event){
 if(!session?.drag)return;
 const drag=session.drag;
 if(drag.edge==='brush'){setBrush(event);return}
 const f=current(),r=drag.rect,p=boundsPoint(event);
 const dx=Math.round(p.x-drag.start.x),dy=Math.round(p.y-drag.start.y);
 const out={...r},sheet=session.sheet.img;
 if(drag.edge==='move'){
  out.x=clamp(r.x+dx,0,sheet.width-r.w);out.y=clamp(r.y+dy,0,sheet.height-r.h);
 }else{
  if(drag.edge.includes('l')){const x=clamp(r.x+dx,0,r.x+r.w-1);out.w=r.w+r.x-x;out.x=x}
  if(drag.edge.includes('r'))out.w=clamp(r.w+dx,1,Math.min(1024,sheet.width-r.x));
  if(drag.edge.includes('t')){const y=clamp(r.y+dy,0,r.y+r.h-1);out.h=r.h+r.y-y;out.y=y}
  if(drag.edge.includes('b'))out.h=clamp(r.h+dy,1,Math.min(1024,sheet.height-r.y));
 }
 if(out.w>1024||out.h>1024)return;
 try{applyRect(out,true)}catch{/* Drag can pass outside valid sheet coordinates. */}
}
function endPointer(event){if(!session)return;session.drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId)}
function frameEntry(f,index){
 const cut=trimmed(f);
 if(!cut)throw Error('เฟรม '+(index+1)+' ว่างเปล่า ตรวจ Mask ก่อน Export');
 return {name:'extracted_'+String(index+1).padStart(2,'0'),src:cut.canvas.toDataURL('image/png'),
  anchorX:cut.anchorX,footY:cut.footY,offsetX:f.offsetX,offsetY:f.offsetY};
}
async function selectedPNG(){
 const entry=frameEntry(current(),session.selected);
 const bytes=await (await fetch(entry.src)).blob();
 hooks.downloadBlob(bytes,hooks.safeName($('projectName').value)+'-'+entry.name+'.png');
 note('Export PNG เฟรม '+(session.selected+1)+' พื้นหลังโปร่งใส');
}
async function commit(){
 const entries=session.frames.map(frameEntry);
 await hooks.appendFrames(entries);
 close(true);hooks.status('Auto Extract '+entries.length+' เฟรมเข้า Timeline แล้ว • ต้นฉบับยังอยู่ใน Sheet Import');
}
function close(force=false){
 if(!session)return;
 if(!force&&session.dirty&&!confirm('ปิด Workshop โดยไม่เพิ่มเฟรม? การแก้ Crop/Mask ที่ยังไม่ได้ Export จะหายไป'))return;
 session=null;$('extractStudio').hidden=true;$('autoExtractBtn').focus();
}
function open(){
 const sheet=hooks.getSheet();
 if(!sheet)throw Error('ต้อง Import Sprite Sheet ก่อน');
 const rects=hooks.getGrid(sheet);
 session={sheet,frames:rects.map(rect=>({
  rect:{...rect},mask:new Uint8Array(rect.w*rect.h).fill(1),
  anchorX:rect.w/2,footY:rect.h,offsetX:0,offsetY:0,
  pixels:null,rendered:null,regions:null})),
  selected:0,tool:'crop',zoom:1,undo:[],redo:[],dirty:false,drag:null};
 $('extractStudio').hidden=false;$('extractZoom').value=1;
 $('eyeSource').checked=true;$('eyePrevious').checked=false;$('eyeNext').checked=false;
 note('ทุกพิกเซลยังถูกเก็บไว้ ปรับ Crop / Mask / Anchor แล้วกดเพิ่มเข้า Timeline');
 refresh();
}
function init(config){
 hooks=config;
 $('autoExtractBtn').onclick=()=>{try{open()}catch(e){hooks.status(e.message,true)}};
 $('extractClose').onclick=()=>close();
 $('extractCommit').onclick=()=>hooks.perform(commit);
 $('extractSelectedPNG').onclick=()=>hooks.perform(selectedPNG);
 $('extractUndo').onclick=undo;$('extractRedo').onclick=redo;
 $('extractTrim').onclick=trimCrop;$('extractDetect').onclick=detect;$('extractMain').onclick=keepMain;
 $('extractResetMask').onclick=()=>{
  const f=current();push();f.mask.fill(1);f.rendered=null;session.dirty=true;showRegionList();draw();note('คืนพิกเซลต้นฉบับทั้งหมดใน Crop แล้ว')
 };
 $('extractTool').onchange=e=>{session.tool=e.target.value;draw()};
 $('extractZoom').oninput=e=>{session.zoom=Number(e.target.value);draw()};
 $('extractOpacity').oninput=draw;
 for(const id of ['eyeSource','eyePrevious','eyeNext'])$(id).onchange=draw;
 for(const id of ['extractX','extractY','extractW','extractH'])$(id).onchange=handleRectInput;
 for(const [input,key] of [['extractAnchorX','anchorX'],['extractFootY','footY'],['extractOffsetX','offsetX'],['extractOffsetY','offsetY']]){
  $(input).onchange=()=>{const n=Number($(input).value);
   if(!Number.isFinite(n)||Math.abs(n)>4096){refresh();return note('ค่า Anchor / Offset ต้องอยู่ในช่วง ±4096',true)}
   push();current()[key]=n;session.dirty=true;draw();note('อัปเดตตำแหน่งอ้างอิง '+key);
  };
 }
 canvas.addEventListener('pointerdown',startPointer);canvas.addEventListener('pointermove',movePointer);
 canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
 $('extractStudio').addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();close()}
  if((event.ctrlKey||event.metaKey)&&['z','y'].includes(event.key.toLowerCase())){
   event.preventDefault();event.stopPropagation();if(event.shiftKey||event.key.toLowerCase()==='y')redo();else undo()
  }
 });
 return Object.freeze({open,close,commit,selectedPNG,get session(){return session},frameEntry,trimmed,detect,undo,redo});
}
root.BunnyAutoExtract=Object.freeze({init});
})(window);
