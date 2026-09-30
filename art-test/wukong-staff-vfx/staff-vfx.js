const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
const W = 1000, H = 650, SCALE = .72, FLOOR = 515, ROOT = 425;
const state = {time:0,playing:true,mode:'combo',speed:1,fx:true,compare:false,power:.75,once:false,ready:false};
const images = {};
// Source-sheet anchors, in source pixels. Same scale for every pose; only translation changes.
const anchors = {hit:[[300,864],[330,859],[280,875],[370,872]],walk:[[305,425],[325,420],[335,423],[330,417]]};
const tips = [[510,705],[565,733],[574,844],[80,704]];
const clamp = (n,a=0,b=1) => Math.max(a,Math.min(b,n));
const lerp = (a,b,t) => a+(b-a)*t;
const hash = n => {const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const tip = f => ({x:ROOT+(tips[f][0]-anchors.hit[f][0])*SCALE,y:FLOOR+(tips[f][1]-anchors.hit[f][1])*SCALE});
const contact = tip(2);
// Highest visible staff end in the raised first pose, in the same source coordinates.
const swingStart = {x:ROOT+(137-anchors.hit[0][0])*SCALE,y:FLOOR+(456-anchors.hit[0][1])*SCALE};
function duration(){return state.mode==='combo'?2.25:state.mode==='clones'?1.65:state.mode==='walk'?.64:1.25;}
function poseAt(t,mode=state.mode){
 if(mode==='walk'||(mode==='combo'&&t<.96)) return {kind:'walk',frame:Math.floor(t/.16)%4,attack:-1};
 const a=mode==='combo'?t-.96:mode==='clones'?t-.65:t;
 if(a<0)return {kind:'hit',frame:0,attack:-1};
 return {kind:'hit',frame:a<.23?0:a<.34?1:a<.48?2:3,attack:a};
}
function actor(g,p){
 const image=images[p.kind], cell=image.width/4, [ax,ay]=anchors[p.kind][p.frame];
 g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 g.drawImage(image,p.frame*cell,0,cell,image.height,ROOT-ax*SCALE,FLOOR-ay*SCALE,cell*SCALE,image.height*SCALE);
}
function ribbonPoint(t){
 // Full overhead sweep: raised staff end -> over the head -> lowest striking tip.
 // Intermediate path is art-directed because the source has only four poses.
 const s=swingStart,e=contact,u=1-t;
 // Push both control points outward to give the strike a broader silhouette,
 // while preserving the exact start and impact positions on the staff.
 return {x:u*u*u*s.x+3*u*u*t*625+3*u*t*t*900+t*t*t*e.x,
  y:u*u*u*s.y+3*u*u*t*62+3*u*t*t*285+t*t*t*e.y};
}
// Rasterize with integer squares only: no antialiasing, gradients, or blur.
const PIXEL=4;
function pixelLine(g,x0,y0,x1,y1,size=1){
 x0=Math.round(x0/PIXEL);y0=Math.round(y0/PIXEL);
 x1=Math.round(x1/PIXEL);y1=Math.round(y1/PIXEL);
 const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
 let err=dx+dy;
 for(;;){g.fillRect(x0*PIXEL,y0*PIXEL,size*PIXEL,size*PIXEL);if(x0===x1&&y0===y1)break;
  const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}}
}
function paintCrescentBand(g,head,color,innerScale,outerScale){
 g.fillStyle=color;
 for(let i=0;i<=220;i++){
  const t=head*i/220,p=ribbonPoint(t),q=ribbonPoint(Math.min(1,t+.002)),r=ribbonPoint(Math.max(0,t-.002));
  const dx=q.x-r.x,dy=q.y-r.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  const body=Math.pow(Math.sin(Math.PI*t),.72);
  const leading=clamp((head-t)/.075),width=96*body*leading;
  for(let offset=width*innerScale;offset<=width*outerScale;offset+=PIXEL){
   const x=Math.round((p.x+nx*offset)/PIXEL)*PIXEL,y=Math.round((p.y+ny*offset)/PIXEL)*PIXEL;
   g.fillRect(x,y,PIXEL+1,PIXEL+1);
  }
 }
}
function crescentSlash(g,progress,fade){
 const head=clamp(progress);g.globalAlpha=fade*state.power;
 // A broad, filled crescent: deep red underside, then orange, yellow and white-hot edge.
 paintCrescentBand(g,head,'#b91d0b',-.02,1);
 paintCrescentBand(g,head,'#ed4b0b',-.035,.73);
 paintCrescentBand(g,head,'#ff9d13',-.055,.52);
 paintCrescentBand(g,head,'#ffe128',-.075,.34);
 paintCrescentBand(g,head,'#fff6a0',-.095,.17);
 paintCrescentBand(g,head,'#ffffff',-.11,.035);
 // A few broken white/orange speed accents outside the main mass.
 for(let i=0;i<8;i++){
  const t=.08+i*.105;if(t>head)continue;const p=ribbonPoint(t);
  g.fillStyle=i%2?'#fff7c2':'#ff8a16';pixelLine(g,p.x+14,p.y-18,p.x+28,p.y-23,1);
 }
 g.globalAlpha=1;
}
function pixelImpactDiamond(g,x,y,fade){
 g.globalAlpha=fade*state.power;
 g.fillStyle='#ffe38a';
 for(let i=0;i<=14;i++){
  const half=(7-Math.abs(7-i))*PIXEL;
  g.fillRect(Math.round((x-half)/PIXEL)*PIXEL,Math.round((y+(i-7)*PIXEL)/PIXEL)*PIXEL,Math.max(PIXEL,half*2),PIXEL);
 }
 g.fillStyle='#ffffff';g.fillRect(x-8,y-8,16,16);
 g.globalAlpha=1;
}
function staffTipComet(g,a){
 const life=clamp(a/.13),pulse=Math.sin(life*Math.PI),x=swingStart.x,y=swingStart.y;
 g.globalAlpha=pulse*state.power;
 g.fillStyle='#b91d0b';g.fillRect(x-16,y-16,32,32);
 g.fillStyle='#ff8a10';g.fillRect(x-12,y-12,24,24);
 g.fillStyle='#ffe238';g.fillRect(x-8,y-8,16,16);
 g.fillStyle='#ffffff';g.fillRect(x-4,y-4,8,8);
 // Short, blocky tail points away from the coming swing.
 g.fillStyle='#ff9d13';pixelLine(g,x-34,y-22,x-12,y-8,2);
 g.fillStyle='#fff6a0';pixelLine(g,x-25,y-26,x-9,y-11,1);
 g.globalAlpha=1;
}
function impactStar(g,age){
 const fade=clamp(1-age/.13);if(fade<=0)return;
 const x=contact.x,y=contact.y,reach=10+fade*17;
 g.globalAlpha=fade*state.power;
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,short=i%2?.62:1;
  g.fillStyle=i%2?'#ffd62e':'#ffffff';
  pixelLine(g,x+Math.cos(angle)*6,y+Math.sin(angle)*6,x+Math.cos(angle)*reach*short,y+Math.sin(angle)*reach*short,1);
 }
 g.fillStyle='#ffffff';g.fillRect(Math.round((x-6)/PIXEL)*PIXEL,Math.round((y-6)/PIXEL)*PIXEL,12,12);
 g.globalAlpha=1;
}
function groundShockRing(g,age){
 const progress=clamp(age/.32),fade=(1-progress)*state.power;
 if(fade<=0)return;
 const cx=contact.x,cy=FLOOR+4,rx=20+progress*125,ry=4+progress*18;
 g.globalAlpha=fade;g.fillStyle=progress<.35?'#fff6a0':'#ff8a10';
 let previous=null;
 for(let i=0;i<=80;i++){
  const angle=Math.PI*2*i/80,p={x:cx+Math.cos(angle)*rx,y:cy+Math.sin(angle)*ry};
  if(previous)pixelLine(g,previous.x,previous.y,p.x,p.y,1);previous=p;
 }
 g.globalAlpha=1;
}
function effects(g,a,p){
 if(a<0||a>.8||state.power===0)return;
 g.save();g.fillStyle='#ffffff';
 if(a>.015&&a<.145)staffTipComet(g,a-.015);
 if(a>=.14&&a<.65){
  const progress=clamp((a-.14)/.20),fade=a<.42?1:1-clamp((a-.42)/.23);
  crescentSlash(g,progress,fade);
 }
 const age=a-.34;
 if(age>=0&&age<.37){
  const fade=1-age/.37;g.globalAlpha=fade*state.power;
  impactStar(g,age);
  groundShockRing(g,age);
  g.globalAlpha=fade*state.power;
  for(let i=0;i<16;i++){
   const angle=hash(i+3)*Math.PI*2,velocity=90+hash(i+18)*240,travel=age*velocity;
   const vx=Math.cos(angle),vy=Math.sin(angle)*.7;
   const x=contact.x+vx*travel,y=contact.y+vy*travel+85*age*age;
   g.fillStyle=i%3===0?'#ff6a0a':i%3===1?'#ffd62e':'#ffffff';
   pixelLine(g,x,y,x-vx*(4+fade*10),y-vy*(4+fade*10));
  }
 }
 g.restore();
}
function summonPortal(g,t){
 const life=clamp(t/.48),fade=Math.sin(life*Math.PI)*state.power,cx=ROOT,cy=FLOOR-115;
 g.globalAlpha=fade;
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6,radius=38+life*44,x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius*.72;
  g.fillStyle=i%3===0?'#ffffff':i%2?'#ffe128':'#ed4b0b';
  const outward=10+life*20;
  pixelLine(g,x,y,x+Math.cos(angle)*outward,y+Math.sin(angle)*outward*.72,1);
 }
 g.fillStyle='#fff6a0';pixelLine(g,cx-20,cy,cx+20,cy,1);pixelLine(g,cx,cy-20,cx,cy+20,1);
 g.globalAlpha=1;
}
function renderCloneFormation(g,t){
 const p=poseAt(t,'clones'),cloneAlpha=clamp((t-.06)/.3);
 const forms=[
  {x:-215,y:38,scale:.60,flip:false,clone:true},
  {x:215,y:38,scale:.60,flip:true,clone:true},
  {x:0,y:8,scale:.72,flip:false,clone:false}
 ];
 for(const form of forms){
  g.save();g.translate(ROOT+form.x,FLOOR+form.y);g.scale(form.flip?-form.scale:form.scale,form.scale);g.translate(-ROOT,-FLOOR);
  if(form.clone&&t<.57)summonPortal(g,t);
  g.globalAlpha=form.clone?cloneAlpha:1;actor(g,p);g.globalAlpha=1;
  if(state.fx&&p.attack>=0)effects(g,p.attack,p);
  g.restore();
 }
}
function background(g){
 g.fillStyle='#141b1c';g.fillRect(0,0,W,H);
 const gr=g.createRadialGradient(490,310,20,500,360,470);gr.addColorStop(0,'#26322f');gr.addColorStop(1,'#111819');g.fillStyle=gr;g.fillRect(0,0,W,H);
 g.strokeStyle='rgba(157,170,138,.065)';g.lineWidth=1;
 for(let i=-6;i<=6;i++){g.beginPath();g.moveTo(500+i*70,440);g.lineTo(500+i*190,650);g.stroke();}
 for(const y of [440,468,505,554,619]){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
 g.strokeStyle='rgba(184,168,119,.11)';g.beginPath();g.ellipse(455,523,205,44,0,0,Math.PI*2);g.stroke();
 const shadow=g.createRadialGradient(ROOT,519,1,ROOT,519,130);shadow.addColorStop(0,'rgba(0,0,0,.55)');shadow.addColorStop(1,'rgba(0,0,0,0)');
 g.save();g.translate(0,519);g.scale(1,.17);g.translate(0,-519);g.fillStyle=shadow;g.fillRect(ROOT-135,384,270,270);g.restore();
}
function render(){
 if(!state.ready)return;
 const p=poseAt(state.time);background(ctx);
 if(state.mode==='clones'){
  renderCloneFormation(ctx,state.time);
 }else if(state.compare){
  for(let side=0;side<2;side++){ctx.save();ctx.translate(side?330:-180,80);ctx.scale(.78,.78);actor(ctx,p);if(side&&state.fx)effects(ctx,p.attack,p);ctx.restore();}
  ctx.strokeStyle='#58604a';ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(500,90);ctx.lineTo(500,555);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#adb69e';ctx.font='12px sans-serif';ctx.fillText('ORIGINAL',185,125);ctx.fillStyle='#d6b576';ctx.fillText('WITH VFX',700,125);
 }else{actor(ctx,p);if(state.fx)effects(ctx,p.attack,p);}
 $('phase').textContent=state.mode==='clones'&&state.time<.65?' / SUMMON':p.kind==='walk'?' / WALK':p.attack<.23?' / WIND-UP':p.attack<.34?' / SWING':p.attack<.48?' / IMPACT':' / RECOVER';
 $('frameInfo').textContent=state.mode==='clones'?`3 FORMS · ${p.attack<0?'MATERIALIZE':'SYNCHRONIZED STRIKE'}`:`${p.kind.toUpperCase()} · POSE ${p.frame+1} / 4`;
 $('timeValue').textContent=state.time.toFixed(2)+' s';$('time').value=String(state.time/duration()*1000);
}
function playback(value){state.playing=value;$('play').textContent=value?'พัก':'เล่น';}
function save(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function exportSheet(combined){
 const buttons=[$('export'),$('combined')];buttons.forEach(b=>b.disabled=true);$('status').textContent='กำลังสร้าง PNG โปร่งใส…';
 try{
  const sheet=document.createElement('canvas');sheet.width=768*6;sheet.height=640*4;const g=sheet.getContext('2d');
  for(let f=0;f<24;f++){const p=poseAt(f/30,'hit');g.save();g.beginPath();g.rect(f%6*768,Math.floor(f/6)*640,768,640);g.clip();g.translate(f%6*768-116,Math.floor(f/6)*640);if(combined)actor(g,p);effects(g,p.attack,p);g.restore();}
  const blob=await new Promise((resolve,reject)=>sheet.toBlob(b=>b?resolve(b):reject(Error('สร้าง PNG ไม่สำเร็จ')),'image/png'));
  save(blob,combined?'wukong-staff-combined-golden-crescent-24f-6x4.png':'wukong-staff-fx-golden-crescent-24f-6x4.png');$('status').textContent='บันทึกแล้ว · 24 เฟรม · 30 FPS · 6×4 ช่อง';
 }catch(e){$('status').textContent='Export ไม่สำเร็จ: '+e.message;}finally{buttons.forEach(b=>b.disabled=false);}
}
$('mode').onchange=e=>{state.mode=e.target.value;state.time=0;state.once=false;render();};
$('speed').onchange=e=>state.speed=Number(e.target.value);
$('fx').onchange=e=>{state.fx=e.target.checked;render();};
$('compare').onchange=e=>{state.compare=e.target.checked;render();};
$('power').oninput=e=>{state.power=Number(e.target.value)/100;$('powerValue').textContent=e.target.value+'%';render();};
$('play').onclick=()=>playback(!state.playing);
$('time').oninput=e=>{playback(false);state.time=Number(e.target.value)/1000*duration();render();};
$('strike').onclick=()=>{state.mode='hit';$('mode').value='hit';state.time=0;state.once=true;playback(true);};
$('impact').onclick=()=>{state.mode='hit';$('mode').value='hit';state.time=.365;state.once=false;playback(false);render();};
$('export').onclick=()=>exportSheet(false);$('combined').onclick=()=>exportSheet(true);
let last;
function tick(now){if(last===undefined)last=now;const dt=Math.min((now-last)/1000,.05);last=now;if(state.playing&&state.ready){state.time+=dt*state.speed;if(state.time>=duration()){if(state.once){state.time=.8;state.once=false;playback(false);}else state.time%=duration();}render();}requestAnimationFrame(tick);}
Promise.all(['hit','walk'].map(kind=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[kind]=im;resolve();};im.onerror=()=>reject(Error('โหลด '+kind+'.png ไม่สำเร็จ'));im.src='./assets/'+kind+'.png';}))).then(()=>{
 state.ready=true;document.querySelectorAll('button').forEach(b=>b.disabled=false);$('status').textContent='พร้อมเล่น · ต้นฉบับและเอฟเฟกต์แยกจากกัน';render();requestAnimationFrame(tick);
}).catch(e=>{$('status').textContent=e.message;});
