(function(){
'use strict';
const paint=window.BunnyFXCore,animation=window.BunnyFrameCore,$=id=>document.getElementById(id);
const display=$('fxCanvas'),dc=display.getContext('2d',{willReadFrequently:false});
const CHECK=20,MAX_FRAMES=animation.LIMIT;
const palette=['#ffefb0','#ffd16b','#fa934a','#e64c45','#a01e40','#5e173b',
 '#e9f7ff','#83e5ff','#329bfa','#6857d5','#bd6ced','#91f4bd'];
const state={width:128,height:128,frames:[],current:0,tool:'pencil',playing:false,last:0,accum:0,
 zoom:1,viewport:null,brush:1,color:'#ffd16b',alpha:1,previewPixels:null,drag:null,
 reference:[],referenceName:'',referenceCell:null,history:[],future:[],dirty:false,renderCount:0,
 layers:[],activeLayerId:'main',style:'pixel',selection:null};
function blank(){return {pixels:new Uint8ClampedArray(state.width*state.height*4),hold:1}}
state.frames=[blank()];
const fxEnhance=window.BunnyFXEnhanceCore;
const emptyEffects=()=>({shadow:{enabled:false,x:3,y:3,blur:3,color:'#30152d'},glow:{enabled:false,blur:8,color:'#ffd166'},gradient:{enabled:false,type:'linear',from:'#fff6b2',to:'#ff382d'}});
const makeLayer=(name,frames,id='layer_'+Math.random().toString(36).slice(2))=>({id,name,visible:true,locked:false,opacity:1,effects:emptyEffects(),frames});
state.layers=[makeLayer('FX Main',[state.frames[0].pixels],'main')];
const FX_FIELDS=['fps','loop','sheetColumns','projectName'];
let committedFxSettings={};
function commitFxSettings(){committedFxSettings=Object.fromEntries(FX_FIELDS.map(id=>[id,$(id).value]))}
function status(message,error=false){$('status').textContent=(error?'⚠ ':'● ')+message;$('status').style.color=error?'#ffb0a5':'#b9eccc'}
function requireInt(id,min,max){
 const n=Number($(id).value);if(!Number.isInteger(n)||n<min||n>max)throw Error(id+' ต้องเป็นจำนวนเต็ม '+min+'–'+max);return n;
}
function safeName(name){return String(name||'bunny-fx').trim().replace(/[^a-z0-9ก-๙_-]/ig,'_').slice(0,60)||'bunny-fx'}
function ctxCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;return [c,g]}
function selected(){return state.frames[state.current]}
function activeLayer(){return state.layers.find(l=>l.id===state.activeLayerId)}
function syncActiveLayer(){const layer=activeLayer();if(layer)state.frames.forEach((f,i)=>{layer.frames[i]=f.pixels})}
function bindLayer(layer){syncActiveLayer();state.activeLayerId=layer.id;state.frames.forEach((f,i)=>{f.pixels=layer.frames[i]});state.selection=null;sync();status('เลือก Layer '+layer.name)}
function resetLayers(){state.layers=[makeLayer('FX Main',state.frames.map(f=>f.pixels),'main')];state.activeLayerId='main';state.selection=null}
function layerCanvas(index,preview=null){
 syncActiveLayer();const [out,g]=ctxCanvas(state.width,state.height);
 for(const layer of state.layers){if(!layer.visible)continue;
  const image=layer.id===state.activeLayerId&&preview?preview:layer.frames[index];
  if(!image)continue;
  const filtered=fxEnhance.effectCanvas(asCanvas(image),layer.effects,state.style);
  g.globalAlpha=layer.opacity;g.drawImage(filtered,0,0);
 }
 g.globalAlpha=1;return out;
}
function activePreview(){return state.selection?fxEnhance.transform(selected().pixels,state.width,state.height,state.selection,{duplicate:state.selection.duplicate,smoothing:state.style!=='pixel'}):state.previewPixels||selected().pixels}
function asCanvas(pixels,width=state.width,height=state.height){
 const [c,g]=ctxCanvas(width,height);
 g.putImageData(new ImageData(new Uint8ClampedArray(pixels),width,height),0,0);
 return c;
}
function renderReference(g,index){
 const r=state.reference[index];if(!r)return;
 const space=state.referenceCell||{width:r.img.width,height:r.img.height};
 const rect=animation.fitRect(r.img.width,r.img.height,space.width,space.height,r);
 const scale=Math.min(state.width/space.width,state.height/space.height);
 const ox=(state.width-space.width*scale)/2,oy=(state.height-space.height*scale)/2;
 g.imageSmoothingEnabled=false;
 g.drawImage(r.img,ox+rect.x*scale,oy+rect.y*scale,rect.w*scale,rect.h*scale);
}
function outputCanvas(index,combined=false){
 const [c,g]=ctxCanvas(state.width,state.height);
 if(combined)renderReference(g,index);
 g.drawImage(layerCanvas(index),0,0);
 return c;
}
function applyChecker(){
 dc.clearRect(0,0,display.width,display.height);
 if(!$('checker').checked)return;
 for(let y=0;y<display.height;y+=CHECK)for(let x=0;x<display.width;x+=CHECK){
  dc.fillStyle=((x+y)/CHECK)%2?'#273b50':'#354c62';
  dc.fillRect(x,y,CHECK,CHECK);
 }
}
function view(){
 // The source is always drawn at its original resolution, pixelated only in
 // the display. Never scale image data before saving/exporting.
 const scale=Math.min(8,Math.min(474/state.width,474/state.height));
 const w=state.width*scale,h=state.height*scale;
 return {scale,x:(display.width-w)/2,y:(display.height-h)/2,w,h};
}
function render(){
 applyChecker();
 const v=view();state.viewport=v;dc.imageSmoothingEnabled=false;
 const current=state.current;
 dc.save();dc.beginPath();dc.rect(v.x,v.y,v.w,v.h);dc.clip();
 if($('showReference').checked&&state.reference.length){
  const [ref,g]=ctxCanvas(state.width,state.height);renderReference(g,current);
  dc.drawImage(ref,v.x,v.y,v.w,v.h);
 }
 if(!state.playing){
  dc.globalAlpha=Number($('onionAlpha').value)/100;
  if($('onionPrevious').checked&&current>0)
   dc.drawImage(layerCanvas(current-1),v.x,v.y,v.w,v.h);
  if($('onionNext').checked&&current+1<state.frames.length)
   dc.drawImage(layerCanvas(current+1),v.x,v.y,v.w,v.h);
 }
 dc.globalAlpha=1;
 dc.drawImage(layerCanvas(current,activePreview()),v.x,v.y,v.w,v.h);
 dc.restore();
 if(state.selection&&!state.playing){const s=state.selection,b=s.bounds;
  dc.strokeStyle='#fff1a0';dc.lineWidth=1.5;dc.setLineDash([5,3]);
  dc.save();dc.translate(v.x+(b.x+b.w/2+s.dx)*v.scale,v.y+(b.y+b.h/2+s.dy)*v.scale);
  dc.rotate(s.angle*Math.PI/180);dc.scale(s.flipH?-1:1,s.flipV?-1:1);
  dc.strokeRect(-b.w*s.scale*v.scale/2,-b.h*s.scale*v.scale/2,b.w*s.scale*v.scale,b.h*s.scale*v.scale);dc.restore();dc.setLineDash([]);
 }
 if(state.drag?.mode==='marquee'){const a=state.drag.start,b=state.drag.last;
  dc.strokeStyle='#83eff5';dc.lineWidth=1;dc.setLineDash([4,3]);
  dc.strokeRect(v.x+Math.min(a.x,b.x)*v.scale,v.y+Math.min(a.y,b.y)*v.scale,(Math.abs(a.x-b.x)+1)*v.scale,(Math.abs(a.y-b.y)+1)*v.scale);dc.setLineDash([]);
 }
 dc.strokeStyle='#9abbd6';dc.lineWidth=1;dc.strokeRect(v.x+.5,v.y+.5,v.w,v.h);
 $('canvasLabel').textContent=state.width+' × '+state.height+'px';
 $('counter').textContent='F '+String(current+1).padStart(2,'0')+' / '+String(state.frames.length).padStart(2,'0');
 state.renderCount++;
}
function renderTimeline(){
 const area=$('timeline');area.replaceChildren();
 state.frames.forEach((frame,i)=>{
  const cell=document.createElement('button');cell.className='frame'+(i===state.current?' active':'');
  cell.type='button';cell.title='เลือกเฟรม '+(i+1);
  const img=document.createElement('img');img.alt='';img.src=outputCanvas(i,state.reference.length>0).toDataURL('image/png');
  const caption=document.createElement('small');caption.textContent='F'+String(i+1).padStart(2,'0')+(frame.hold>1?' • '+frame.hold+'×':'');
  cell.append(img,caption);cell.onclick=()=>setFrame(i);area.append(cell);
 });
 $('addFrame').disabled=$('duplicateFrame').disabled=state.frames.length>=MAX_FRAMES;
 $('deleteFrame').disabled=state.frames.length<=1;
 $('moveLeft').disabled=state.current===0;$('moveRight').disabled=state.current===state.frames.length-1;
}
function sync(){
 $('frameWidth').value=state.width;$('frameHeight').value=state.height;
 $('hold').value=selected().hold;$('play').textContent=state.playing?'⏸ Pause':'▶ Play';
 $('clearReference').disabled=!state.reference.length;
 $('combineExport').disabled=!state.reference.length;
 $('refDetails').textContent=state.reference.length?
  state.referenceName+' • '+state.reference.length+' เฟรม (Reference ไม่ถูก Brush แก้ไข)':'ยังไม่มี Reference';
 $('drawState').textContent=state.selection?'TRANSFORM':state.previewPixels?'Shape Preview':state.tool.toUpperCase();
 renderLayers();syncEffects();syncSelection();render();renderTimeline();
}
function renderLayers(){
 const host=$('fxLayers');host.replaceChildren();
 for(let i=state.layers.length-1;i>=0;i--){
  const layer=state.layers[i],row=document.createElement('div');
  row.className='fxLayerRow'+(layer.id===state.activeLayerId?' active':'');
  const show=document.createElement('button');show.textContent=layer.visible?'👁':'○';
  show.title=layer.visible?'Hide layer':'Show layer';show.setAttribute('aria-label',(layer.visible?'Hide ':'Show ')+layer.name);
  show.onclick=()=>{const before=captureProject();layer.visible=!layer.visible;rememberProject(before);renderLayers();render();renderTimeline()};
  const lock=document.createElement('button');lock.textContent=layer.locked?'🔒':'🔓';lock.title=layer.locked?'Unlock':'Lock';
  lock.onclick=()=>{const before=captureProject();layer.locked=!layer.locked;rememberProject(before);renderLayers()};
  const name=document.createElement('button');name.className='layerName';name.textContent=layer.name;name.title='Select; double-click to rename';
  name.onclick=()=>bindLayer(layer);
  name.ondblclick=()=>{const rename=prompt('Layer name',layer.name);if(rename?.trim()&&rename.trim()!==layer.name){const before=captureProject();layer.name=rename.trim().slice(0,40);rememberProject(before);renderLayers()}};
  row.append(show,lock,name);host.append(row);
 }
 if(state.reference.length){const ref=document.createElement('div');ref.className='fxLayerRow';ref.textContent='🔒 Character Reference (below FX)';host.append(ref)}
 const active=activeLayer(),i=state.layers.indexOf(active);
 $('duplicateLayer').disabled=state.layers.length>=12;
 $('addLayer').disabled=state.layers.length>=12;
 $('layerUp').disabled=i===state.layers.length-1;$('layerDown').disabled=i===0;
 $('deleteLayer').disabled=state.layers.length===1;
 $('mergeLayer').disabled=i===0||active.locked||state.layers[i-1]?.locked;
}
function syncEffects(){
 const layer=activeLayer();if(!layer)return;
 $('layerOpacity').value=Math.round(layer.opacity*100);
 $('layerOpacityLabel').textContent=Math.round(layer.opacity*100)+'%';
 const settings=layer.effects;
 for(const [id,key] of [['shadowOn','shadow'],['glowOn','glow'],['gradientOn','gradient']])$(id).checked=!!settings[key].enabled;
 for(const [id,val] of [['shadowX',settings.shadow.x],['shadowY',settings.shadow.y],
  ['shadowBlur',settings.shadow.blur],['shadowColor',settings.shadow.color],
  ['glowBlur',settings.glow.blur],['glowColor',settings.glow.color],
  ['gradientType',settings.gradient.type],['gradientFrom',settings.gradient.from],
  ['gradientTo',settings.gradient.to]])$(id).value=val;
}
function addLayer(duplicate=false,skipHistory=false){
 if(state.layers.length>=12)return status('สูงสุด 12 FX Layers',true);
 syncActiveLayer();const before=captureProject(),source=activeLayer();
 const layer=makeLayer(duplicate?source.name+' Copy':'FX Layer '+(state.layers.length+1),
  state.frames.map((f,i)=>duplicate?source.frames[i].slice():new Uint8ClampedArray(state.width*state.height*4)));
 if(duplicate){layer.opacity=source.opacity;layer.effects=JSON.parse(JSON.stringify(source.effects))}
 state.layers.push(layer);bindLayer(layer);if(!skipHistory)rememberProject(before);status('สร้าง Layer ใหม่ '+layer.name);
}
function reorderLayer(direction){
 const layer=activeLayer(),index=state.layers.indexOf(layer),next=index+direction;
 if(next<0||next>=state.layers.length)return;
 const before=captureProject();syncActiveLayer();[state.layers[index],state.layers[next]]=[state.layers[next],state.layers[index]];
 rememberProject(before);sync();
}
function deleteLayer(){
 if(state.layers.length<=1)return status('ต้องเหลืออย่างน้อย 1 FX Layer',true);
 const layer=activeLayer();
 if(!confirm('ลบ FX Layer '+layer.name+' ทุกเฟรม? กด Ctrl+Z เพื่อคืนได้'))return;
 const before=captureProject();syncActiveLayer();state.layers=state.layers.filter(item=>item!==layer);
 state.activeLayerId='';state.activeLayerId=state.layers.at(-1).id;
 state.frames.forEach((f,i)=>{f.pixels=activeLayer().frames[i]});
 state.selection=null;rememberProject(before);sync();
}
function mergeLayer(){
 syncActiveLayer();const layer=activeLayer(),index=state.layers.indexOf(layer),below=state.layers[index-1];
 if(!below)return status('ไม่มี Layer ด้านล่างสำหรับ Merge',true);
 if(layer.locked||below.locked)return status('ปลดล็อกทั้งสอง Layer ก่อน Merge',true);
 if(!layer.visible||!below.visible)return status('แสดงทั้งสอง Layers ก่อน Merge เพื่อรักษาภาพที่เห็น',true);
 if(!confirm('Merge '+layer.name+' ลง '+below.name+' ทุกเฟรม? เอฟเฟกต์จะถูก Bake และ Ctrl+Z ย้อนกลับได้'))return;
 const before=captureProject();
 for(let i=0;i<state.frames.length;i++){
  const [canvas,g]=ctxCanvas(state.width,state.height);
  g.globalAlpha=below.opacity;
  g.drawImage(fxEnhance.effectCanvas(asCanvas(below.frames[i]),below.effects,state.style),0,0);
  g.globalAlpha=layer.opacity;
  g.drawImage(fxEnhance.effectCanvas(asCanvas(layer.frames[i]),layer.effects,state.style),0,0);
  below.frames[i]=new Uint8ClampedArray(g.getImageData(0,0,state.width,state.height).data);
 }
 below.opacity=1;below.effects=emptyEffects();
 state.layers.splice(index,1);state.activeLayerId=below.id;
 state.frames.forEach((frame,i)=>frame.pixels=below.frames[i]);
 state.selection=null;rememberProject(before);sync();
 status('Merge Layer ลง '+below.name+' แล้ว • Ctrl+Z ย้อนกลับได้');
}
function syncSelection(){
 const sel=state.selection;for(const id of ['selectRotation','selectScale','selectX','selectY','selectFlipH','selectFlipV','applySelection','copySelection','cancelSelection'])$(id).disabled=!sel;
 if(sel){
  $('selectRotation').value=sel.angle;$('selectScale').value=Math.round(sel.scale*100);
  $('selectX').value=sel.dx;$('selectY').value=sel.dy;
 }else{
  $('selectRotation').value=0;$('selectScale').value=100;$('selectX').value=0;$('selectY').value=0;
 }
}
function cancelSelection(silent=false){state.selection=null;syncSelection();render();if(!silent)status('Selection ยกเลิกแล้ว')}
function applySelection(duplicate=false){
 if(!state.selection)return;
 if(activeLayer().locked)return status('Layer ถูกล็อกอยู่',true);
 const before=selected().pixels.slice();
 const selection={...state.selection,duplicate};
 selected().pixels=fxEnhance.transform(before,state.width,state.height,selection,{duplicate,smoothing:state.style!=='pixel'});
 remember(state.current,before,selected().pixels.slice());state.selection=null;syncSelection();render();renderTimeline();
 status(duplicate?'Duplicate Selection แล้ว':'Apply Transform แล้ว • Undo ย้อนกลับได้');
}
function updateSelection(){
 if(!state.selection)return;
 const s=state.selection;
 const angle=Number($('selectRotation').value),scale=Number($('selectScale').value),
  dx=Number($('selectX').value),dy=Number($('selectY').value);
 if(![angle,scale,dx,dy].every(Number.isFinite)||scale<10||scale>400||Math.abs(angle)>360||
   Math.abs(dx)>512||Math.abs(dy)>512)return;
 Object.assign(s,{angle,scale:scale/100,dx,dy});render();
}
function changeEffect(target,key,property,converter){
 const layer=activeLayer();if(!layer)return;
 const raw=$(target).type==='checkbox'?$(target).checked:$(target).value;
 const value=converter?converter(raw):raw;
 if(typeof value==='number'&&!Number.isFinite(value))return status('ค่าต้องเป็นตัวเลข',true);
 if(key==='opacity'?layer.opacity===value:layer.effects[key][property]===value)return;
 const before=captureProject();
 if(key==='opacity')layer.opacity=value;
 else layer.effects[key][property]=value;
 rememberProject(before);render();renderTimeline();
}
function stop(){state.playing=false;$('play').textContent='▶ Play'}
function setFrame(index,fromPlayback=false){
 if(!fromPlayback)stop();
 state.previewPixels=null;state.drag=null;state.selection=null;
 syncSelection();state.current=(index+state.frames.length)%state.frames.length;
 $('hold').value=selected().hold;state.accum=0;
 render();renderTimeline();
}
function play(){
 if(state.drag)return;
 try{requireInt('fps',1,30)}catch(err){return status(err.message,true)}
 state.playing=!state.playing;state.last=performance.now();state.accum=0;
 $('play').textContent=state.playing?'⏸ Pause':'▶ Play';render();
}
function tick(now){
 if(state.playing){
  state.accum+=Math.min(500,Math.max(0,now-state.last));
  const fps=Math.min(30,Math.max(1,Number($('fps').value)||8));
  for(let i=0;i<MAX_FRAMES;i++){
   const duration=selected().hold*1000/fps;if(state.accum<duration)break;
   state.accum-=duration;
   if(state.current===state.frames.length-1&&$('loop').value==='0'){stop();break}
   state.current=(state.current+1)%state.frames.length;
   $('hold').value=selected().hold;render();renderTimeline();
  }
 }
 state.last=now;requestAnimationFrame(tick);
}
function tool(next){
 if(next!=='select'&&next!=='marquee')state.selection=null;
 state.tool=next;state.previewPixels=null;state.drag=null;
 syncSelection();
 document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active',el.dataset.tool===next));
 $('drawState').textContent=next.toUpperCase();render();
}
function pickSwatch(value){
 state.color=value.toLowerCase();$('fxColor').value=state.color;
 document.querySelectorAll('.swatch').forEach(el=>el.classList.toggle('active',el.dataset.color===state.color));
}
function makePalette(){
 for(const value of palette){
  const btn=document.createElement('button');btn.type='button';btn.className='swatch';btn.title=value;
  btn.style.backgroundColor=value;btn.dataset.color=value;btn.setAttribute('aria-label','Color '+value);
  btn.onclick=()=>pickSwatch(value);$('fxPalette').append(btn);
 }
 pickSwatch(state.color);
}
function ink(){const rgb=paint.color(state.color);rgb[3]=Math.round(state.alpha*255);return rgb}
function pointerAt(event){
 const v=state.viewport||view(),box=display.getBoundingClientRect();
 const cx=(event.clientX-box.left)*display.width/box.width,cy=(event.clientY-box.top)*display.height/box.height;
 const x=Math.floor((cx-v.x)/v.scale),y=Math.floor((cy-v.y)/v.scale);
 return {x,y,inside:x>=0&&y>=0&&x<state.width&&y<state.height};
}
function captureProject(){
 syncActiveLayer();
 return {width:state.width,height:state.height,current:state.current,activeLayerId:state.activeLayerId,
  holds:state.frames.map(f=>f.hold),style:state.style,settings:{...committedFxSettings},
  layers:state.layers.map(l=>({...l,effects:JSON.parse(JSON.stringify(l.effects)),frames:l.frames.map(p=>p.slice())})),
  reference:[...state.reference],referenceCell:state.referenceCell,referenceName:state.referenceName};
}
function restoreProject(snapshot){
 stop();state.width=snapshot.width;state.height=snapshot.height;state.current=snapshot.current;
 state.style=snapshot.style;$('artStyle').value=state.style;
 for(const id of FX_FIELDS)if(snapshot.settings?.[id]!==undefined)$(id).value=snapshot.settings[id];
 commitFxSettings();
 state.layers=snapshot.layers.map(l=>({...l,effects:JSON.parse(JSON.stringify(l.effects)),frames:l.frames.map(p=>p.slice())}));
 state.activeLayerId=state.layers.some(l=>l.id===snapshot.activeLayerId)?snapshot.activeLayerId:state.layers[0].id;
 state.frames=snapshot.holds.map((hold,i)=>({hold,pixels:activeLayer().frames[i]}));
 state.reference=[...snapshot.reference];state.referenceCell=snapshot.referenceCell;state.referenceName=snapshot.referenceName;
 state.selection=null;state.drag=null;state.previewPixels=null;sync();
}
function rememberProject(before){
 const after=captureProject();
 state.history.push({type:'project',before,after});
 if(state.history.length>25)state.history.shift();
 state.future.length=0;state.dirty=true;
}
function remember(index,before,after){
 if(before.every((v,i)=>v===after[i]))return false;
 state.history.push({index,layerId:state.activeLayerId,before,after});if(state.history.length>25)state.history.shift();
 state.future.length=0;state.dirty=true;return true;
}
function undo(){
 const entry=state.history.pop();if(!entry)return status('ไม่มีรายการ Undo');
 state.future.push(entry);
 if(entry.type==='project'){restoreProject(entry.before);return status('Undo การแก้ไขโปรเจกต์แล้ว')}
 if(state.activeLayerId!==entry.layerId){const layer=state.layers.find(l=>l.id===entry.layerId);if(layer){syncActiveLayer();state.activeLayerId=layer.id;state.frames.forEach((f,i)=>f.pixels=layer.frames[i])}}
 state.current=entry.index;state.frames[entry.index].pixels=entry.before.slice();
 state.previewPixels=null;state.drag=null;sync();status('Undo เฟรม '+(entry.index+1));
}
function redo(){
 const entry=state.future.pop();if(!entry)return status('ไม่มีรายการ Redo');
 state.history.push(entry);
 if(entry.type==='project'){restoreProject(entry.after);return status('Redo การแก้ไขโปรเจกต์แล้ว')}
 if(state.activeLayerId!==entry.layerId){const layer=state.layers.find(l=>l.id===entry.layerId);if(layer){syncActiveLayer();state.activeLayerId=layer.id;state.frames.forEach((f,i)=>f.pixels=layer.frames[i])}}
 state.current=entry.index;state.frames[entry.index].pixels=entry.after.slice();
 state.previewPixels=null;state.drag=null;sync();status('Redo เฟรม '+(entry.index+1));
}
function smoothStroke(data,a,b,erase=false){
 const [c,g]=ctxCanvas(state.width,state.height);
 g.putImageData(new ImageData(new Uint8ClampedArray(data),state.width,state.height),0,0);
 g.globalCompositeOperation=erase?'destination-out':'source-over';
 g.strokeStyle=erase?'#000':state.color;
 g.globalAlpha=erase?1:state.alpha;
 g.lineCap='round';g.lineJoin='round';g.lineWidth=state.brush;
 g.beginPath();g.moveTo(a.x+.5,a.y+.5);
 if(a.x===b.x&&a.y===b.y)g.lineTo(b.x+.51,b.y+.5);
 else g.lineTo(b.x+.5,b.y+.5);
 g.stroke();
 data.set(g.getImageData(0,0,state.width,state.height).data);
}
function drawPoint(data,p,eraser=false){
 if(state.style==='smooth'){smoothStroke(data,p,p,eraser);return}
 return paint.brush(data,state.width,state.height,p.x,p.y,state.brush,eraser?[0,0,0,0]:ink());
}
function shape(data,start,end,mode){
 if(state.style==='smooth'){
  const [c,g]=ctxCanvas(state.width,state.height);
  g.putImageData(new ImageData(new Uint8ClampedArray(data),state.width,state.height),0,0);
  g.strokeStyle=state.color;g.globalAlpha=state.alpha;g.lineWidth=state.brush;g.lineJoin='round';g.lineCap='round';
  g.beginPath();
  if(mode==='line'){g.moveTo(start.x+.5,start.y+.5);g.lineTo(end.x+.5,end.y+.5)}
  else g.ellipse((start.x+end.x+1)/2,(start.y+end.y+1)/2,Math.max(.5,Math.abs(end.x-start.x)/2),Math.max(.5,Math.abs(end.y-start.y)/2),0,0,Math.PI*2);
  g.stroke();data.set(g.getImageData(0,0,state.width,state.height).data);return;
 }
 if(mode==='line')return paint.line(data,state.width,state.height,start.x,start.y,end.x,end.y,ink(),state.brush);
 return paint.ellipse(data,state.width,state.height,start.x,start.y,end.x,end.y,ink(),state.brush);
}
function down(event){
 if(event.button!==0)return;const p=pointerAt(event);if(!p.inside)return;
 if(state.playing)stop();
 const frame=selected(),which=state.tool;
 if(activeLayer().locked&&which!=='picker')return status('Layer นี้ถูกล็อกอยู่ กรุณาปลดล็อกก่อนแก้ไข',true);
 if(!activeLayer().visible&&which!=='picker')return status('Layer นี้ถูกซ่อนอยู่ กรุณาแสดงก่อนแก้ไข',true);
 if(which==='select'||which==='marquee'){
  const s=state.selection,b=s?.bounds;
  if(which==='marquee'){state.selection=null;state.drag={mode:'marquee',start:p,last:p};}
  else if(s&&p.x>=b.x+s.dx&&p.x<b.x+b.w+s.dx&&p.y>=b.y+s.dy&&p.y<b.y+b.h+s.dy){
   state.drag={mode:'move-selection',start:p,last:p,dx:s.dx,dy:s.dy};
  }else{
   // Photoshop-style auto-select: find the frontmost editable, visible FX
   // pixel, not merely the layer currently highlighted in the sidebar.
   state.selection=null;
   for(let i=state.layers.length-1;i>=0;i--){
    const layer=state.layers[i];if(!layer.visible||layer.locked)continue;
    const hit=fxEnhance.getRegion(layer.id===state.activeLayerId?frame.pixels:layer.frames[state.current],
      state.width,state.height,p.x,p.y);
    if(!hit)continue;
    if(layer.id!==state.activeLayerId)bindLayer(layer);
    state.selection=hit;break;
   }
   state.drag=state.selection?{mode:'move-selection',start:p,last:p,dx:0,dy:0}:
      {mode:'marquee',start:p,last:p};
   status(state.selection?'เลือก FX แล้ว • ลากเพื่อย้ายได้ทันที':'ลากกรอบเพื่อเลือกพื้นที่ FX');
  }
  syncSelection();render();if(state.drag)display.setPointerCapture(event.pointerId);event.preventDefault();return;
 }
 if(which==='picker'){
  const rgba=paint.pick(frame.pixels,state.width,state.height,p.x,p.y);
  if(rgba&&rgba[3]>0){pickSwatch(paint.toHex(rgba));state.alpha=rgba[3]/255;
   $('alpha').value=Math.round(state.alpha*100);$('alphaLabel').textContent=$('alpha').value+'%';
   status('เลือกสี '+state.color+' จาก FX Layer');}
  else status('พิกเซลนี้โปร่งใส; Picker เลือกจาก FX Layer เท่านั้น');
  return;
 }
 const before=frame.pixels.slice(),index=state.current;
 if(which==='fill'){
  const changed=paint.fill(frame.pixels,state.width,state.height,p.x,p.y,ink());
  if(changed)remember(index,before,frame.pixels.slice());
  render();renderTimeline();status(changed?'Fill '+changed+' pixels':'สีเดิมอยู่แล้ว');return;
 }
 state.drag={index,before,start:p,last:p,mode:which};
 if(which==='pencil'||which==='eraser')drawPoint(frame.pixels,p,which==='eraser');
 else {state.previewPixels=before.slice();shape(state.previewPixels,p,p,which)}
 display.setPointerCapture(event.pointerId);render();event.preventDefault();
}
function move(event){
 const p=pointerAt(event);
 $('cursor').textContent=p.inside?'x '+p.x+' · y '+p.y:'x – · y –';
 const drag=state.drag;if(!drag)return;
 if(drag.mode==='marquee'){drag.last={x:Math.max(0,Math.min(state.width-1,p.x)),y:Math.max(0,Math.min(state.height-1,p.y))};render();return}
 if(drag.mode==='move-selection'){
  if(state.selection){state.selection.dx=drag.dx+p.x-drag.start.x;state.selection.dy=drag.dy+p.y-drag.start.y;syncSelection();render()}
  return;
 }
 const frame=state.frames[drag.index];
 if(drag.mode==='pencil'||drag.mode==='eraser'){
  // Clamp strokes dragged past the canvas edge: never write outside the frame.
  const b={x:Math.max(0,Math.min(state.width-1,p.x)),y:Math.max(0,Math.min(state.height-1,p.y))};
  if(state.style==='smooth')smoothStroke(frame.pixels,drag.last,b,drag.mode==='eraser');
  else paint.line(frame.pixels,state.width,state.height,drag.last.x,drag.last.y,b.x,b.y,
   drag.mode==='eraser'?[0,0,0,0]:ink(),state.brush);
  drag.last=b;
 }else{
  state.previewPixels=drag.before.slice();
  const b={x:Math.max(0,Math.min(state.width-1,p.x)),y:Math.max(0,Math.min(state.height-1,p.y))};
  shape(state.previewPixels,drag.start,b,drag.mode);drag.last=b;
 }
 render();event.preventDefault();
}
function up(event){
 const drag=state.drag;if(!drag)return;
 if(drag.mode==='marquee'){
  state.selection=fxEnhance.getMarquee(selected().pixels,state.width,state.height,drag.start.x,drag.start.y,drag.last.x,drag.last.y);
  state.drag=null;syncSelection();if(display.hasPointerCapture(event.pointerId))display.releasePointerCapture(event.pointerId);
  render();status(state.selection?'เลือกพื้นที่แล้ว • ปรับ Transform แล้ว Apply':'ไม่พบ FX ในพื้นที่ที่เลือก');return;
 }
 if(drag.mode==='move-selection'){
  state.drag=null;if(display.hasPointerCapture(event.pointerId))display.releasePointerCapture(event.pointerId);
  if(state.selection&&(state.selection.dx!==drag.dx||state.selection.dy!==drag.dy)){
   const destination=pointerAt(event);
   applySelection(false); // drag-and-drop commits immediately; no extra Apply click.
   const p={x:Math.max(0,Math.min(state.width-1,destination.x)),y:Math.max(0,Math.min(state.height-1,destination.y))};
   state.selection=fxEnhance.getRegion(selected().pixels,state.width,state.height,p.x,p.y);
   syncSelection();render();
   status('ย้าย FX แล้ว • Ctrl+Z ย้อนกลับ หรือหมุน/ย่อขยายต่อได้');
  }else{syncSelection();render();status('เลือก FX แล้ว • ลากเพื่อย้าย หรือปรับ Rotate / Scale')}
  renderTimeline();return;
 }
 if(drag.mode==='line'||drag.mode==='circle')
  state.frames[drag.index].pixels=state.previewPixels||drag.before.slice();
 remember(drag.index,drag.before,state.frames[drag.index].pixels.slice());
 state.drag=null;state.previewPixels=null;
 if(display.hasPointerCapture(event.pointerId))display.releasePointerCapture(event.pointerId);
 render();renderTimeline();
}
function addFrame(duplicate=false){
 if(state.frames.length>=MAX_FRAMES)return status('สูงสุด '+MAX_FRAMES+' เฟรม',true);
 stop();const before=captureProject();syncActiveLayer();const from=state.current,to=from+1;
 for(const layer of state.layers)layer.frames.splice(to,0,duplicate?layer.frames[from].slice():new Uint8ClampedArray(state.width*state.height*4));
 state.frames.splice(to,0,{pixels:activeLayer().frames[to],hold:state.frames[from].hold});
 state.current=to;state.selection=null;rememberProject(before);sync();
 status((duplicate?'Duplicate':'เพิ่ม Blank')+' Frame '+(state.current+1));
}
function moveFrame(delta){
 const next=state.current+delta;if(next<0||next>=state.frames.length)return;
 const before=captureProject();syncActiveLayer();const a=state.current;[state.frames[a],state.frames[next]]=[state.frames[next],state.frames[a]];
 for(const layer of state.layers)[layer.frames[a],layer.frames[next]]=[layer.frames[next],layer.frames[a]];
 state.current=next;rememberProject(before);sync();
}
function deleteFrame(){
 if(state.frames.length<=1)return status('ต้องเหลืออย่างน้อย 1 เฟรม',true);
 if(!confirm('ลบเฟรม '+(state.current+1)+'? กด Ctrl+Z เพื่อคืนได้'))return;
 const before=captureProject();
 stop();syncActiveLayer();for(const layer of state.layers)layer.frames.splice(state.current,1);
 state.frames.splice(state.current,1);state.current=Math.min(state.current,state.frames.length-1);
 state.selection=null;rememberProject(before);sync();
}
function clearFrame(){
 if(!selected().pixels.some(v=>v!==0))return;
 if(!confirm('ลบ FX ในเฟรมนี้? (สามารถ Undo ได้)'))return;
 const before=selected().pixels.slice();selected().pixels.fill(0);
 remember(state.current,before,selected().pixels.slice());render();renderTimeline();
}
function changeSize(){
 const width=requireInt('frameWidth',8,512),height=requireInt('frameHeight',8,512);
 if(width===state.width&&height===state.height)return;
 if((state.dirty||state.reference.length)&&!confirm('เปลี่ยน Canvas จะเริ่มโปรเจกต์ใหม่และล้าง FX/Reference ที่มีอยู่ ดำเนินการหรือไม่?'))return sync();
 const before=captureProject();stop();state.width=width;state.height=height;state.frames=[blank()];state.current=0;resetLayers();
 state.reference=[];state.referenceName='';state.referenceCell=null;state.dirty=false;
 $('combineExport').checked=false;rememberProject(before);sync();status('เริ่ม Canvas ใหม่ '+width+'×'+height+' • Undo ได้');
}
function loadImage(src){
 return new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>img.width>0&&img.height>0?resolve(img):reject(Error('ภาพขนาดไม่ถูกต้อง'));
  img.onerror=()=>reject(Error('อ่าน PNG ไม่สำเร็จ'));
  img.src=src;
 });
}
function fileSrc(file){
 if(!/^image\/(png|webp)$/.test(file.type)||file.size>16*1024*1024)throw Error(file.name+': ใช้ PNG/WebP ไม่เกิน 16MB');
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(Error('อ่านไฟล์ไม่ได้'));reader.readAsDataURL(file);
 });
}
function checkRef(entries){
 if(!entries.length||entries.length>MAX_FRAMES)throw Error('Reference ต้องมี 1–64 เฟรม');
 let total=0;
 for(const r of entries){
  if(r.img.width>4096||r.img.height>4096)throw Error('ภาพรายเฟรมใหญ่เกิน 4096px กรุณาลดขนาดต้นฉบับ');
  total+=r.img.width*r.img.height;
  if(![r.offsetX,r.offsetY,r.anchorX,r.footY].every(n=>n===undefined||Number.isFinite(n)))
   throw Error('Reference มีค่า Alignment ไม่ถูกต้อง');
 }
 if(total>64000000)throw Error('ภาพต้นฉบับทั้งหมดเกิน 64 ล้านพิกเซล กรุณานำเข้าเป็นชุดเล็กลง');
}
function assignReference(entries,name,cell,fps){
 checkRef(entries);
 const maxW=Math.max(...entries.map(x=>x.img.width)),maxH=Math.max(...entries.map(x=>x.img.height));
 const sourceW=Math.max(8,Number(cell?.width)||maxW),sourceH=Math.max(8,Number(cell?.height)||maxH);
 if(!Number.isInteger(sourceW)||!Number.isInteger(sourceH)||sourceW>8192||sourceH>8192)
  throw Error('Reference Canvas ใหญ่หรือผิดรูปแบบ');
 const scale=Math.min(1,512/sourceW,512/sourceH);
 const width=Math.max(8,Math.round(sourceW*scale)),height=Math.max(8,Math.round(sourceH*scale));
 const before=captureProject();
 const fresh=!state.dirty&&state.frames.length===1&&state.frames[0].pixels.every(n=>n===0);
 if(fresh){
  state.width=width;state.height=height;
  state.frames=Array.from({length:entries.length},blank);state.current=0;resetLayers();
  if(Number.isInteger(fps)&&fps>=1&&fps<=30)$('fps').value=fps;
 }else if(entries.length>state.frames.length){
  // Imported reference is never allowed to overwrite a stroke. Extend the
  // animation with transparent FX frames instead of failing silently.
  syncActiveLayer();while(state.frames.length<entries.length){
   for(const layer of state.layers)layer.frames.push(new Uint8ClampedArray(state.width*state.height*4));
   state.frames.push({pixels:activeLayer().frames.at(-1),hold:1});
  }
 }
 stop();state.reference=entries;state.referenceName=name;
 state.referenceCell={width:sourceW,height:sourceH};
 $('showReference').checked=true;$('combineExport').checked=false;sync();
 const resized=sourceW!==state.width||sourceH!==state.height;
 $('refFeedback').style.color='#b7f0c8';
 $('refFeedback').textContent='✓ โหลด '+entries.length+' เฟรม • ต้นฉบับ '+sourceW+'×'+sourceH+
  ' • แสดงบน FX Canvas '+state.width+'×'+state.height+
  (resized?' (ย่อ Reference สำหรับวาด โดยยังเก็บภาพต้นฉบับครบ)':'');
 rememberProject(before);
 status('เปิด Character Reference '+name+' '+entries.length+' เฟรม • FX Layer ยังแยกจากตัวละคร');
}
async function importReferenceJSON(file){
 if(file.size>35*1024*1024)throw Error('JSON Reference เกิน 35MB');
 const data=JSON.parse(await file.text());
 if(data?.format!=='bunny-frame-animator'||!Array.isArray(data.frames)||!data.frames.length||data.frames.length>MAX_FRAMES)
  throw Error('ใช้ไฟล์ JSON จาก Frame Animator (หรือ Import PNG แยกเฟรม)');
 const entries=[];
 for(const f of data.frames){
  if(typeof f.src!=='string'||!/^data:image\/(png|webp|jpeg);base64,/i.test(f.src))throw Error('Reference ไม่มี PNG ที่ถูกต้อง');
  entries.push({src:f.src,img:await loadImage(f.src),anchorX:Number.isFinite(f.anchorX)?f.anchorX:undefined,
   footY:Number.isFinite(f.footY)?f.footY:undefined,
   offsetX:Number(f.offsetX)||0,offsetY:Number(f.offsetY)||0});
 }
 assignReference(entries,String(data.name||file.name).slice(0,80),data.cell,Number(data.fps));
}
async function importReferencePNGs(files){
 if(!files.length)return;
 const sorted=files.slice().sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
 const entries=[];
 for(const file of sorted){const src=await fileSrc(file);entries.push({src,img:await loadImage(src),offsetX:0,offsetY:0})}
 if(entries.length===1&&entries[0].img.width>entries[0].img.height*2&&entries[0].img.width>=512){
  if(confirm('ไฟล์นี้เป็นภาพแนวนอนยาว คล้าย Sprite Sheet 4 เฟรม ต้องการให้แยกเป็น 4×1 อัตโนมัติหรือไม่? กด Cancel เพื่อนำเข้าเป็นภาพเดี่ยว')){
   $('referenceGrid').value='4x1';return importReferenceSheet(sorted[0]);
  }
 }
 assignReference(entries,'PNG '+sorted.length+' เฟรม · '+sorted[0].name);
}
async function importReferenceSheet(file){
 const src=await fileSrc(file),img=await loadImage(src);
 if(img.width>8192||img.height>8192||img.width*img.height>64000000)
  throw Error('Sprite Sheet ใหญ่เกินไป (8192px ต่อด้าน หรือ 64 ล้านพิกเซล)');
 const [cols,rows]=$('referenceGrid').value.split('x').map(Number);
 const rects=animation.sheetRects(img.width,img.height,{columns:cols,rows,limit:MAX_FRAMES});
 const entries=[];
 for(const [i,r] of rects.entries()){
  const [c,g]=ctxCanvas(r.w,r.h);g.drawImage(img,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
  const frameSrc=c.toDataURL('image/png');
  entries.push({src:frameSrc,img:await loadImage(frameSrc),offsetX:0,offsetY:0,
   name:'frame_'+String(i+1).padStart(2,'0')});
 }
 assignReference(entries,file.name+' ('+cols+'×'+rows+')');
}
async function performReference(task){
 $('refFeedback').style.color='#ffe3a0';$('refFeedback').textContent='กำลังโหลด Reference…';
 try{return await task()}catch(err){
  console.error('[Bunny FX Lab Reference]',err);
  $('refFeedback').style.color='#ffb9ad';
  $('refFeedback').textContent='⚠ นำเข้าไม่ได้: '+(err.message||String(err));
  status(err.message||String(err),true);
 }
}
function removeReference(){
 if(!state.reference.length)return;
 const before=captureProject();
 state.reference=[];state.referenceName='';state.referenceCell=null;$('combineExport').checked=false;sync();
 $('refFeedback').style.color='#f9d59d';$('refFeedback').textContent='Reference ปิดแล้ว • FX Art ยังอยู่ครบ';
 rememberProject(before);
 status('ปิด Character Reference — FX Art ยังอยู่ครบ');
}
function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function pngBlob(canvas){
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG Export ไม่สำเร็จ')),'image/png'));
}
function combined(){return $('combineExport').checked&&state.reference.length>0}
function exportSheet(){
 const layout=animation.spriteSheetLayout(state.frames.length,requireInt('sheetColumns',1,64),state.width,state.height);
 const [out,g]=ctxCanvas(layout.width,layout.height);
 const isCombined=combined();
 state.frames.forEach((frame,i)=>{
  const x=(i%layout.cols)*state.width,y=Math.floor(i/layout.cols)*state.height;
  g.drawImage(outputCanvas(i,isCombined),x,y);
 });
 return out;
}
async function exportPNG(){
 const out=exportSheet(),blob=await pngBlob(out);
 downloadBlob(blob,safeName($('projectName').value)+(combined()?'-combined':'-fx')+'-sheet.png');
 status('Export '+state.frames.length+' เฟรม '+out.width+'×'+out.height+' PNG • '+(combined()?'Combined':'Transparent FX-only'));
}
async function exportCurrent(){
 const blob=await pngBlob(outputCanvas(state.current,combined()));
 downloadBlob(blob,safeName($('projectName').value)+'-frame-'+String(state.current+1).padStart(2,'0')+'.png');
 status('Export เฟรม '+(state.current+1)+' PNG');
}
async function exportGIF(){
 const width=state.width,height=state.height,fps=requireInt('fps',1,30);
 if(width*height*state.frames.length>3000000)throw Error('GIF ใหญ่เกินไป กรุณาลดขนาดหรือจำนวนเฟรม (ใช้ PNG แทน)');
 const frames=state.frames.map((frame,i)=>{
  const c=outputCanvas(i,combined()),data=c.getContext('2d').getImageData(0,0,width,height);
  return {pixels:data.data,hold:frame.hold};
 });
 const bytes=animation.buildGif({width,height,frames,fps,loop:$('loop').value==='1'});
 downloadBlob(new Blob([bytes],{type:'image/gif'}),safeName($('projectName').value)+'.gif');
 status('Export GIF '+frames.length+' เฟรม • 256 สี (อาจมีสีคลาดเคลื่อน)');
}
function projectData(){
 syncActiveLayer();
 return {format:'bunny-fx-lab',version:2,style:state.style,editorMode:$('editorMode').value,layers:state.layers.map(l=>({
  id:l.id,name:l.name,visible:l.visible,locked:l.locked,opacity:l.opacity,effects:l.effects,
  frames:l.frames.map(pixels=>({src:asCanvas(pixels).toDataURL('image/png')}))})),name:$('projectName').value,width:state.width,height:state.height,
  fps:requireInt('fps',1,30),loop:$('loop').value==='1',
  frames:state.frames.map(f=>({src:asCanvas(f.pixels).toDataURL('image/png'),hold:f.hold})),
  reference:state.reference.length?{name:state.referenceName,cell:state.referenceCell,frames:state.reference.map(f=>({
   src:f.src,anchorX:f.anchorX,footY:f.footY,offsetX:f.offsetX,offsetY:f.offsetY}))}:null};
}
function saveJSON(){
 downloadBlob(new Blob([JSON.stringify(projectData())],{type:'application/json'}),safeName($('projectName').value)+'.bunny-fx.json');
 status('บันทึก JSON (FX ทั้งหมด + Reference ถ้ามี) เรียบร้อย');
}
async function openProject(file){
 if(file.size>50*1024*1024)throw Error('FX Project เกิน 50MB');
 const json=JSON.parse(await file.text());
 if(json?.format!=='bunny-fx-lab'||!Array.isArray(json.frames)||json.frames.length<1||json.frames.length>MAX_FRAMES)throw Error('ไม่ใช่ Bunny FX Lab JSON');
 const {width,height}=paint.validSize(json.width,json.height);
 const frames=[];
 for(const f of json.frames){
  if(!/^data:image\/png;base64,/i.test(f.src))throw Error('ไฟล์ FX Frame ไม่มี PNG ที่ถูกต้อง');
  const img=await loadImage(f.src);
  if(img.width!==width||img.height!==height)throw Error('FX Frame ไม่ตรงกับขนาด Canvas');
  const [cv,g]=ctxCanvas(width,height);g.drawImage(img,0,0);
  frames.push({pixels:new Uint8ClampedArray(g.getImageData(0,0,width,height).data),
   hold:Number.isInteger(f.hold)&&f.hold>=1&&f.hold<=16?f.hold:1});
 }
 const layerData=[];
 if(json.layers!==undefined){
  if(!Array.isArray(json.layers)||json.layers.length<1||json.layers.length>12)throw Error('จำนวน FX Layers ไม่ถูกต้อง');
  for(const [n,item] of json.layers.entries()){
   if(!Array.isArray(item.frames)||item.frames.length!==frames.length)throw Error('Layer Frame count ไม่ตรงกับ Timeline');
   const pixels=[];
   for(const frame of item.frames){
    if(typeof frame.src!=='string'||!/^data:image\/png;base64,/i.test(frame.src))throw Error('Layer PNG ไม่ถูกต้อง');
    const img=await loadImage(frame.src);if(img.width!==width||img.height!==height)throw Error('Layer Frame ไม่ตรงกับ Canvas');
    const [c,g]=ctxCanvas(width,height);g.drawImage(img,0,0);
    pixels.push(new Uint8ClampedArray(g.getImageData(0,0,width,height).data));
   }
   const layer=makeLayer(String(item.name||'FX Layer '+(n+1)).slice(0,40),pixels,String(item.id||'layer_'+n));
   layer.visible=item.visible!==false;layer.locked=item.locked===true;
   layer.opacity=Number.isFinite(item.opacity)?Math.max(0,Math.min(1,item.opacity)):1;
   if(item.effects&&typeof item.effects==='object')for(const key of ['shadow','glow','gradient'])
    if(item.effects[key]&&typeof item.effects[key]==='object')Object.assign(layer.effects[key],item.effects[key]);
   layerData.push(layer);
  }
 }
 const reference=[];
 if(json.reference){
  for(const r of json.reference.frames||[]){
   if(!/^data:image\/(png|webp|jpeg);base64,/i.test(r.src))throw Error('Reference PNG ไม่ถูกต้อง');
   reference.push({...r,img:await loadImage(r.src)});
  }
  checkRef(reference);
 }
 // Stage and decode EVERYTHING before replacing the currently open project.
 if(state.dirty&&!confirm('เปิด Project ใหม่? งานที่ยังไม่ได้บันทึกจะหายไป'))return;
 stop();state.width=width;state.height=height;state.frames=frames;state.current=0;
 if(layerData.length){state.layers=layerData;state.activeLayerId=layerData[0].id;state.frames.forEach((f,i)=>f.pixels=layerData[0].frames[i]);}else resetLayers();
 state.style=['pixel','smooth','hybrid'].includes(json.style)?json.style:'pixel';$('artStyle').value=state.style;
 $('editorMode').value=json.editorMode==='advanced'?'advanced':'basic';setEditorMode($('editorMode').value);
 state.reference=reference;state.referenceName=String(json.reference?.name||'').slice(0,80);
 state.referenceCell=reference.length?(json.reference?.cell||{width:Math.max(...reference.map(r=>r.img.width)),height:Math.max(...reference.map(r=>r.img.height))}):null;
 $('projectName').value=String(json.name||'bunny-fx').slice(0,60);
 $('fps').value=Math.min(30,Math.max(1,Number(json.fps)||8));
 $('loop').value=json.loop===false?'0':'1';$('combineExport').checked=false;
 state.history.length=state.future.length=0;state.dirty=false;
 sync();$('refFeedback').style.color='#b7f0c8';$('refFeedback').textContent=reference.length?'✓ โปรเจกต์นี้มี Reference '+reference.length+' เฟรม':'Project นี้ยังไม่มี Reference';
 status('เปิด FX Project '+$('projectName').value+' • '+frames.length+' เฟรม');
}
async function perform(task){try{return await task()}catch(err){console.error('[Bunny FX Lab]',err);status(err.message||String(err),true)}}
function suggestPreset(){
 const name=state.referenceName.toLowerCase();
 const chosen=/hit|attack|slash|staff/.test(name)?'staff':
  /magic|heal|cast|holy/.test(name)?'aura':/run|walk/.test(name)?'lightning':
  /wukong/.test(name)?'staff':'impact';
 $('fxPreset').value=chosen;
 const desc={staff:'Gold Staff Trail: เฟรมแรกสะสมพลัง → วงแสงตามกระบอง → เศษแสง',
  impact:'Impact Burst: จุดแตกกลางวง พร้อมเส้นแสงรอบทิศ',aura:'Holy Aura: วงแหวนพลังเวทค่อย ๆ ขยาย',
  lightning:'Lightning Arc: เส้นสายฟ้าซิกแซก 4 ระยะ'};
 $('suggestionText').textContent='✦ Suggested '+desc[chosen]+
  ' • '+(state.reference.length?'อ้างอิงชื่อ '+state.referenceName:'ไม่มี Reference: ใช้ Impact/Staff ได้');
 status('Auto Suggest เลือก Preset แล้ว • กด Add FX Preset เพื่อยืนยัน');
}
function generatePreset(){
 if(state.layers.length>=12)return status('มีครบ 12 Layer แล้ว กรุณาลบ Layer ที่ไม่ใช้ก่อน',true);
 const before=captureProject();
 const name=$('fxPreset').value,title={staff:'Gold Staff Trail',impact:'Impact Burst',aura:'Holy Aura',lightning:'Lightning Arc'}[name];
 if(!title)return;
 addLayer(false,true);const layer=activeLayer();layer.name=title;
 const w=state.width,h=state.height,size=Math.min(w,h),gold=[255,220,108,230],red=[255,77,42,220],blue=[119,222,255,255];
 const plot=(data,x1,y1,x2,y2,ink,width=1)=>paint.line(data,w,h,x1,y1,x2,y2,ink,width);
 for(let i=0;i<state.frames.length;i++){
  const pixels=layer.frames[i],count=state.frames.length,t=count===1?1:i/(count-1),
   cx=Math.floor(w/2),cy=Math.floor(h/2),radius=size*(.17+.19*t);
  if(name==='staff'){
   const start=-2.65+t*.55,end=-.15+t*.45,steps=26;
   for(let s=0;s<steps;s++){
    const a=start+(end-start)*s/(steps-1),b=start+(end-start)*(s+1)/steps,
     col=s<13?gold:red;
    plot(pixels,cx+Math.cos(a)*radius,cy+Math.sin(a)*radius,
      cx+Math.cos(b)*radius,cy+Math.sin(b)*radius,col,Math.max(1,Math.round(size*.027)));
   }
  }else if(name==='impact'){
   for(let ray=0;ray<12;ray++){
    const a=ray*Math.PI*2/12+t*.3,from=size*.045+size*.08*t,to=size*(.11+.28*t);
    plot(pixels,cx+Math.cos(a)*from,cy+Math.sin(a)*from,
      cx+Math.cos(a)*to,cy+Math.sin(a)*to,ray%2===0?gold:red,Math.max(1,Math.round(size*.015)));
   }
  }else if(name==='aura'){
   const r=Math.round(radius);paint.ellipse(pixels,w,h,cx-r,cy-r*.42,cx+r,cy+r*.42,gold,Math.max(1,Math.round(size*.022)));
   paint.ellipse(pixels,w,h,cx-r*.65,cy-r*.23,cx+r*.65,cy+r*.23,blue,1);
  }else{
   const phase=Math.round(size*.1*t);
   let prev=[cx-Math.round(size*.34),cy+phase];
   for(let s=1;s<=10;s++){
    const next=[cx-Math.round(size*.34)+Math.round(size*.068*s),
      cy+phase+(s%2?-Math.round(size*.10):Math.round(size*.07))];
    plot(pixels,...prev,...next,s%3?blue:gold,Math.max(1,Math.round(size*.018)));prev=next;
   }
  }
 }
 if(name==='staff'||name==='impact'){layer.effects.glow.enabled=true;layer.effects.glow.blur=7;
  layer.effects.glow.color=name==='staff'?'#ffbc4a':'#ff6b46'}
 if(name==='aura'){layer.effects.glow.enabled=true;layer.effects.glow.color='#9adffb';layer.effects.glow.blur=9}
 state.frames.forEach((f,i)=>f.pixels=layer.frames[i]);rememberProject(before);sync();
 status('เพิ่ม '+title+' เป็น Layer ใหม่ '+state.frames.length+' เฟรม • แก้ไขต่อได้');
}
function setEditorMode(mode){
 const basic=mode==='basic';document.body.classList.toggle('basic',basic);
 if(basic&&state.tool==='marquee')tool('select');
 $('suggestionText').textContent=basic?'Basic Mode: เลือก FX Preset แล้วกด Add ได้เลย • เปลี่ยน Advanced เพื่อแก้ Layers และ Transform':'Advanced: ใช้ Layers, Selection, Effects และ Preset ได้เต็มรูปแบบ';
}
function wire(){
 makePalette();$('undo').onclick=undo;$('redo').onclick=redo;
 $('addLayer').onclick=()=>addLayer();$('duplicateLayer').onclick=()=>addLayer(true);
 $('layerUp').onclick=()=>reorderLayer(1);$('layerDown').onclick=()=>reorderLayer(-1);$('deleteLayer').onclick=deleteLayer;$('mergeLayer').onclick=mergeLayer;
 $('layerOpacity').oninput=()=>{changeEffect('layerOpacity','opacity',null,v=>Number(v)/100);$('layerOpacityLabel').textContent=$('layerOpacity').value+'%'};
 for(const [id,key,prop,convert] of [['shadowOn','shadow','enabled',Boolean],['glowOn','glow','enabled',Boolean],
  ['gradientOn','gradient','enabled',Boolean],['shadowX','shadow','x',Number],['shadowY','shadow','y',Number],
  ['shadowBlur','shadow','blur',Number],['shadowColor','shadow','color',null],['glowBlur','glow','blur',Number],
  ['glowColor','glow','color',null],['gradientType','gradient','type',null],['gradientFrom','gradient','from',null],
  ['gradientTo','gradient','to',null]])$(id).onchange=()=>changeEffect(id,key,prop,convert);
 $('artStyle').onchange=e=>{const before=captureProject();state.style=e.target.value;rememberProject(before);render();renderTimeline();status('Art Style: '+state.style)};
 $('editorMode').onchange=e=>setEditorMode(e.target.value);
 for(const id of ['selectRotation','selectScale','selectX','selectY'])$(id).oninput=updateSelection;
 $('selectFlipH').onclick=()=>{if(state.selection){state.selection.flipH=!state.selection.flipH;render()}};
 $('selectFlipV').onclick=()=>{if(state.selection){state.selection.flipV=!state.selection.flipV;render()}};
 $('applySelection').onclick=()=>applySelection(false);$('copySelection').onclick=()=>applySelection(true);
 $('cancelSelection').onclick=()=>cancelSelection();
 $('autoSuggest').onclick=suggestPreset;$('applyPreset').onclick=generatePreset;
 for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>tool(b.dataset.tool);
 $('fxColor').oninput=e=>pickSwatch(e.target.value);
 $('brushSize').oninput=e=>{state.brush=Number(e.target.value);$('brushLabel').textContent=state.brush+' px'};
 $('alpha').oninput=e=>{state.alpha=Number(e.target.value)/100;$('alphaLabel').textContent=e.target.value+'%'};
 for(const id of ['onionPrevious','onionNext','onionAlpha','checker','showReference'])$(id).oninput=render;
 $('resizeCanvas').onclick=()=>perform(async()=>changeSize());
 $('hold').onchange=()=>perform(async()=>{const hold=requireInt('hold',1,16);if(hold===selected().hold)return;
  const before=captureProject();selected().hold=hold;rememberProject(before);renderTimeline()});
 $('fps').onchange=()=>perform(async()=>{requireInt('fps',1,30);
  if($('fps').value!==committedFxSettings.fps){const before=captureProject();commitFxSettings();rememberProject(before)}render()});
 for(const id of ['loop','sheetColumns','projectName'])$(id).onchange=()=>{
  if($(id).value!==committedFxSettings[id]){const before=captureProject();commitFxSettings();rememberProject(before)}
 };
 $('play').onclick=play;$('previous').onclick=()=>setFrame(state.current-1);$('next').onclick=()=>setFrame(state.current+1);
 $('addFrame').onclick=()=>addFrame();$('duplicateFrame').onclick=()=>addFrame(true);
 $('moveLeft').onclick=()=>moveFrame(-1);$('moveRight').onclick=()=>moveFrame(1);
 $('deleteFrame').onclick=deleteFrame;$('clearFrame').onclick=clearFrame;
 $('importReferenceJSON').onclick=()=>$('refJSONFile').click();
 $('importReferencePNGs').onclick=()=>$('refPNGFiles').click();
 $('importReferenceSheet').onclick=()=>$('refSheetFile').click();
 $('refJSONFile').onchange=e=>{const f=e.target.files?.[0];if(f)performReference(()=>importReferenceJSON(f));e.target.value=''};
 $('refPNGFiles').onchange=e=>{const files=[...e.target.files||[]];if(files.length)performReference(()=>importReferencePNGs(files));e.target.value=''};
 $('refSheetFile').onchange=e=>{const f=e.target.files?.[0];if(f)performReference(()=>importReferenceSheet(f));e.target.value=''};
 $('clearReference').onclick=removeReference;
 $('exportPNG').onclick=()=>perform(exportPNG);
 $('exportCurrent').onclick=()=>perform(exportCurrent);
 $('exportGIF').onclick=()=>perform(exportGIF);
 $('saveJSON').onclick=()=>perform(async()=>saveJSON());
 $('openJSON').onclick=()=>$('fxProjectFile').click();
 $('fxProjectFile').onchange=e=>{const file=e.target.files?.[0];if(file)perform(()=>openProject(file));e.target.value=''};
 display.addEventListener('pointerdown',down);display.addEventListener('pointermove',move);
 display.addEventListener('pointerup',up);display.addEventListener('pointercancel',up);
 window.addEventListener('keydown',e=>{
  const target=document.activeElement?.tagName;
  if(e.ctrlKey||e.metaKey){
   if(e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo()}
   else if(e.key.toLowerCase()==='y'){e.preventDefault();redo()}
   else if(e.key.toLowerCase()==='s'){e.preventDefault();saveJSON()}
   return;
  }
  if(['INPUT','TEXTAREA','SELECT'].includes(target))return;
  if(e.key===' '){e.preventDefault();play();return}
  if(e.key==='ArrowLeft'){e.preventDefault();setFrame(state.current-1);return}
  if(e.key==='ArrowRight'){e.preventDefault();setFrame(state.current+1);return}
  const keys={b:'pencil',e:'eraser',l:'line',c:'circle',g:'fill',i:'picker',s:'select',m:'marquee'};
  if(keys[e.key.toLowerCase()])tool(keys[e.key.toLowerCase()]);
 });
 setEditorMode($('editorMode').value);commitFxSettings();sync();requestAnimationFrame(tick);
}
window.__fxLabTest={get state(){return state},draw:render,outputCanvas,exportSheet,projectData,openProject,
 importReferenceJSON,importReferencePNGs,importReferenceSheet,setFrame,tool,undo,redo,addFrame,exportPNG,exportGIF,
 get layer(){return activeLayer()},addLayer,bindLayer,deleteLayer,applySelection,generatePreset,suggestPreset};
wire();
})();
