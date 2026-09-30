(function(){
'use strict';
const $=id=>document.getElementById(id),maker=window.BunnyRigProof;
const project=maker.createProject(),manifest=maker.manifest(),master=$('master'),composite=$('assembled');
function load(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src})}
function save(src,name){
 const a=document.createElement('a');a.href=src;a.download=name;document.body.append(a);a.click();a.remove();
}
async function render(){
 const image=await load(maker.masterImage());
 const g=master.getContext('2d',{willReadFrequently:true});g.clearRect(0,0,256,256);g.drawImage(image,0,0);
 const imgs=new Map(await Promise.all(project.parts.map(async p=>[p.id,await load(p.src)])));
 const parent=new Map(project.parts.map(p=>[p.id,p])),matrices=new Map();
 const visit=(part)=>{
  if(matrices.has(part.id))return matrices.get(part.id);
  const v=part.base,local=new DOMMatrix().translate(v.x,v.y).rotate(v.r).scale(v.sx,v.sy);
  const m=part.parent?visit(parent.get(part.parent)).multiply(local):local;
  matrices.set(part.id,m);return m;
 };
 const out=composite.getContext('2d',{willReadFrequently:true});
 out.clearRect(0,0,256,256);out.translate(maker.ORIGIN.x,maker.ORIGIN.y);out.imageSmoothingEnabled=false;
 for(const p of project.parts){
  const m=visit(p),img=imgs.get(p.id);
  out.save();out.transform(m.a,m.b,m.c,m.d,m.e,m.f);
  out.drawImage(img,-p.pivot.x,-p.pivot.y);out.restore();
 }
 // A strict, RGBA-channel pixel comparison: every channel must match exactly.
 const a=g.getImageData(0,0,256,256).data,b=out.getImageData(0,0,256,256).data;
 let difference=0,occupied=0;
 for(let i=0;i<a.length;i+=4){
  if(a[i+3]>0)occupied++;
  if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])difference++;
 }
 $('result').innerHTML='<strong class="'+(difference===0?'pass':'fail')+'">'+(difference===0?
  '✓ PASS: ประกอบกลับตรงกับ Master 100%':'⚠ ยังไม่ตรง: '+difference+' พิกเซล')+
  '</strong><br>ชิ้นส่วน '+project.parts.length+' PNG • '+occupied+' pixels มีภาพ • ต่างกัน '+difference+' pixels';
 $('status').textContent='Ready — โปร่งใสจริง '+project.parts.length+' ชิ้น; คลิกเปิด Rig Studio หรือดาวน์โหลด JSON';
 window.__rigProof={project,manifest,difference,occupied};
}
function renderParts(){
 const root=$('parts');root.replaceChildren();
 for(const meta of manifest){
  const part=project.parts.find(p=>p.id===meta.id);
  const card=document.createElement('div');card.className='part';
  const name=document.createElement('strong');name.textContent=part.name;
  const img=new Image();img.alt=part.name+' isolated PNG';img.src=part.src;
  const info=document.createElement('small');
  info.textContent=meta.width+'×'+meta.height+'px • Parent: '+(part.parent||'Root')+
   ' • Pivot '+meta.pivot.x+','+meta.pivot.y;
  const button=document.createElement('button');button.textContent='↧ '+part.id+'.png';
  button.onclick=()=>save(part.src,part.id+'.png');
  card.append(name,img,info,button);root.append(card);
 }
}
$('downloadJSON').onclick=()=>{
 const blob=new Blob([JSON.stringify(project)],{type:'application/json'});
 const url=URL.createObjectURL(blob);save(url,'blessed-bunny-rig-proof-v1.bunny-rig.json');
 setTimeout(()=>URL.revokeObjectURL(url),15000);
};
$('downloadMaster').onclick=()=>save(maker.masterImage(),'blessed-bunny-master.png');
renderParts();
render().catch(e=>{console.error(e);$('status').textContent='Load failed: '+e.message});
})();