/*
 * Blessed Bunny rig-fitting proof: all sprites are cropped from a single
 * 256x256 coordinate system. No independently generated body parts, no
 * background pixels. Used as a geometry test, not production character art.
 */
(function(root){
'use strict';
const SIZE=256,ORIGIN={x:128,y:140};
const P={
 ink:'#344157',fur:'#f6efe4',furShade:'#d5c8bc',furLight:'#fffaf0',pink:'#e9a2ac',
 tunic:'#e5d6b9',tunicShade:'#b8a685',blue:'#477bad',blueHi:'#719fc5',
 leather:'#745447',leatherHi:'#a47c5c',gold:'#eac17b',eye:'#24344a',blush:'#edb4ae'
};
const px=n=>Math.round(n);
function canvas(){const c=document.createElement('canvas');c.width=c.height=SIZE;return c}
function ellipse(g,x,y,rx,ry,fill=P.fur,outline=P.ink,line=2){
 g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);
 if(outline){g.lineWidth=line;g.strokeStyle=outline;g.stroke()}
 g.fillStyle=fill;g.fill();
}
function poly(g,points,fill,outline=P.ink,line=2){
 g.beginPath();g.moveTo(...points[0]);for(const point of points.slice(1))g.lineTo(...point);
 g.closePath();if(outline){g.lineJoin='round';g.lineWidth=line;g.strokeStyle=outline;g.stroke()}
 g.fillStyle=fill;g.fill();
}
function line(g,points,color,width=2){
 g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.beginPath();
 g.moveTo(...points[0]);for(const p of points.slice(1))g.lineTo(...p);g.stroke();
}
const specs=[
 {id:'tail',name:'Tail',parent:'body',anchor:[154,160],draw(g){
  ellipse(g,159,165,15,14,P.fur);ellipse(g,154,160,8,7,P.furLight,null);
 }},
 {id:'cape',name:'Cape',parent:'body',anchor:[128,123],draw(g){
  poly(g,[[110,121],[144,120],[151,141],[160,187],[146,185],[134,197],[122,190],[102,192],[111,147]],P.blue);
  poly(g,[[116,139],[110,181],[124,176],[137,190],[143,163],[146,139]],'#3b6999',null);
  line(g,[[109,185],[120,180],[135,194],[146,179]],P.gold,2);
 }},
 {id:'leg_back_upper',name:'Back Thigh',parent:'body',anchor:[143,167],draw(g){
  ellipse(g,143,177,13,18,P.tunicShade);poly(g,[[132,166],[153,168],[151,177],[135,178]],P.blue,null);
 }},
 {id:'leg_back_lower',name:'Back Shin',parent:'leg_back_upper',anchor:[145,190],draw(g){
  poly(g,[[138,184],[152,184],[156,209],[153,219],[138,215]],P.fur);
  poly(g,[[138,207],[155,209],[155,222],[138,221]],P.leather);
  line(g,[[138,210],[154,213]],P.gold,2);
 }},
 {id:'foot_back',name:'Back Foot',parent:'leg_back_lower',anchor:[149,216],draw(g){
  ellipse(g,153,224,17,9,P.leather);poly(g,[[137,217],[157,214],[168,224],[162,229],[138,228]],P.leather);
  poly(g,[[153,222],[167,223],[162,227],[151,226]],P.leatherHi,null);
 }},
 {id:'arm_back_upper',name:'Back Upper Arm',parent:'body',anchor:[150,132],draw(g){
  poly(g,[[146,125],[155,127],[167,146],[161,156],[152,149]],P.tunic);
  line(g,[[147,131],[161,139]],P.blue,6);ellipse(g,151,132,5,4,P.gold,null);
 }},
 {id:'arm_back_lower',name:'Back Forearm',parent:'arm_back_upper',anchor:[164,151],draw(g){
  poly(g,[[160,147],[170,150],[180,174],[169,179],[161,161]],P.fur);
  poly(g,[[165,159],[172,161],[179,172],[168,178]],P.leather);
  line(g,[[165,164],[174,166]],P.gold,2);
 }},
 {id:'hand_back',name:'Back Hand',parent:'arm_back_lower',anchor:[174,175],draw(g){
  ellipse(g,175,179,9,10,P.leather);
  ellipse(g,169,182,4,5,P.leatherHi,null);
  line(g,[[174,184],[179,181]],P.ink,1);
 }},
 {id:'ear_back',name:'Back Ear',parent:'head',anchor:[143,81],draw(g){
  poly(g,[[139,83],[139,57],[148,28],[156,18],[162,32],[160,52],[148,79]],P.fur);
  poly(g,[[145,73],[144,53],[154,30],[157,34],[155,53]],P.pink,null);
 }},
 {id:'leg_front_upper',name:'Front Thigh',parent:'body',anchor:[112,168],draw(g){
  ellipse(g,113,179,14,19,P.fur);poly(g,[[101,167],[124,168],[125,179],[102,179]],P.tunic);
  line(g,[[102,176],[124,176]],P.gold,2);
 }},
 {id:'leg_front_lower',name:'Front Shin',parent:'leg_front_upper',anchor:[111,190],draw(g){
  poly(g,[[105,183],[120,183],[122,215],[105,220],[100,210]],P.fur);
  poly(g,[[103,207],[122,207],[122,221],[102,220]],P.leather);
  line(g,[[103,211],[120,211]],P.gold,2);
 }},
 {id:'foot_front',name:'Front Foot',parent:'leg_front_lower',anchor:[110,216],draw(g){
  ellipse(g,105,225,17,9,P.leather);poly(g,[[100,215],[118,216],[123,227],[116,231],[88,229],[88,223]],P.leather);
  poly(g,[[89,223],[106,220],[104,227],[90,228]],P.leatherHi,null);
 }},
 {id:'body',name:'Torso',parent:null,anchor:[128,140],draw(g){
  poly(g,[[110,118],[142,118],[154,134],[151,173],[136,181],[111,176],[100,169],[103,133]],P.tunic);
  poly(g,[[110,127],[143,124],[151,136],[146,153],[110,153],[104,141]],P.fur,null);
  poly(g,[[107,148],[149,149],[150,159],[106,159]],P.leather);
  poly(g,[[124,149],[134,149],[135,161],[123,160]],P.gold);
  poly(g,[[127,152],[131,152],[131,156],[127,156]],P.leather,null);
  line(g,[[107,169],[128,173],[150,168]],P.blue,4);
 }},
 {id:'head',name:'Head',parent:'body',anchor:[128,113],draw(g){
  ellipse(g,128,100,29,28,P.fur);
  ellipse(g,116,108,12,10,P.furLight,null);
  ellipse(g,142,108,12,10,P.furLight,null);
  ellipse(g,116,99,6,9,P.eye,null);ellipse(g,141,99,6,9,P.eye,null);
  ellipse(g,117,97,2,3,'#fff',null);ellipse(g,142,97,2,3,'#fff',null);
  ellipse(g,110,108,5,3,P.blush,null);ellipse(g,147,108,5,3,P.blush,null);
  poly(g,[[124,109],[132,109],[128,114]],P.pink,null);
  line(g,[[128,115],[125,119],[122,117]],P.ink,1);
  line(g,[[128,115],[132,119],[135,117]],P.ink,1);
  ellipse(g,128,76,10,3,P.furLight,null);
 }},
 {id:'ear_front',name:'Front Ear',parent:'head',anchor:[114,81],draw(g){
  poly(g,[[108,83],[101,61],[100,36],[105,18],[113,27],[121,52],[120,80]],P.fur);
  poly(g,[[109,75],[105,54],[107,31],[111,36],[117,54],[116,73]],P.pink,null);
 }},
 {id:'scarf',name:'Scarf',parent:'head',anchor:[128,120],draw(g){
  poly(g,[[108,116],[123,121],[141,119],[151,111],[154,122],[144,131],[115,134],[103,125]],P.blue);
  poly(g,[[143,124],[152,125],[158,149],[151,153],[137,135]],P.blue);
  line(g,[[108,124],[128,128],[150,120]],P.blueHi,3);
  poly(g,[[147,141],[153,149],[151,152],[143,144]],P.gold,null);
 }},
 {id:'arm_front_upper',name:'Front Upper Arm',parent:'body',anchor:[106,132],draw(g){
  poly(g,[[105,124],[94,128],[89,143],[95,155],[110,141]],P.tunic);
  line(g,[[106,128],[94,137]],P.blue,6);ellipse(g,106,130,5,4,P.gold,null);
 }},
 {id:'arm_front_lower',name:'Front Forearm',parent:'arm_front_upper',anchor:[93,151],draw(g){
  poly(g,[[90,147],[99,153],[94,173],[83,179],[79,168]],P.fur);
  poly(g,[[83,159],[96,160],[92,177],[80,175]],P.leather);
  line(g,[[83,163],[94,164]],P.gold,2);
 }},
 {id:'hand_front',name:'Front Hand',parent:'arm_front_lower',anchor:[85,175],draw(g){
  ellipse(g,83,180,10,9,P.leather);ellipse(g,78,181,4,5,P.leatherHi,null);
  line(g,[[83,184],[87,182]],P.ink,1);
 }}
];
function getLayer(spec){
 const c=canvas(),g=c.getContext('2d');g.imageSmoothingEnabled=false;
 spec.draw(g);return c;
}
function cropLayer(c,anchor){
 const g=c.getContext('2d'),data=g.getImageData(0,0,SIZE,SIZE).data;
 let xMin=SIZE,yMin=SIZE,xMax=-1,yMax=-1;
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(data[(y*SIZE+x)*4+3]){
  xMin=Math.min(xMin,x);yMin=Math.min(yMin,y);xMax=Math.max(xMax,x);yMax=Math.max(yMax,y)}
 if(xMax<0)throw Error('Blank test part');
 const left=Math.max(0,Math.min(xMin-2,anchor[0]-2)),
 top=Math.max(0,Math.min(yMin-2,anchor[1]-2)),
 right=Math.min(SIZE,Math.max(xMax+3,anchor[0]+3)),
 bottom=Math.min(SIZE,Math.max(yMax+3,anchor[1]+3)),
 output=document.createElement('canvas');
 output.width=right-left;output.height=bottom-top;
 output.getContext('2d').drawImage(c,left,top,output.width,output.height,0,0,output.width,output.height);
 return {src:output.toDataURL('image/png'),width:output.width,height:output.height,
  pivot:{x:anchor[0]-left,y:anchor[1]-top},crop:{x:left,y:top}};
}
let cache=null;
function build(){
 if(cache)return cache;
 const anchors=new Map(specs.map(s=>[s.id,s.anchor])),assets=[];
 const master=canvas(),g=master.getContext('2d');g.imageSmoothingEnabled=false;
 for(const spec of specs){
  const full=getLayer(spec);g.drawImage(full,0,0);
  const cropped=cropLayer(full,spec.anchor);
  const parent=spec.parent&&anchors.get(spec.parent);
  const [x,y]=spec.anchor;
  assets.push({id:spec.id,name:spec.name,parent:spec.parent||null,
   src:cropped.src,pivot:cropped.pivot,base:{
    x:spec.parent?x-parent[0]:x-ORIGIN.x,
    y:spec.parent?y-parent[1]:y-ORIGIN.y,
    r:0,sx:1,sy:1
   },visible:true,proof:{crop:cropped.crop,anchor:spec.anchor,width:cropped.width,height:cropped.height}});
 }
 cache={master:master.toDataURL('image/png'),assets:assets.map(({proof,...p})=>p),
  metadata:assets.map(a=>({id:a.id,parent:a.parent,width:a.proof.width,height:a.proof.height,
   crop:a.proof.crop,pivot:a.pivot,anchor:a.proof.anchor}))};
 return cache;
}
function pose(base,extra={}){return {...base,...extra}}
function makeClip(name,frames,config){
 const tracks={};
 for(const [id,changes] of Object.entries(config)){
  const part=build().assets.find(p=>p.id===id);
  tracks[id]=changes.map(([f,change])=>({f,pose:pose(part.base,change)}));
 }
 return {id:name.toLowerCase().replace(/\s+/g,'_'),name,fps:8,frames,easing:'smooth',tracks};
}
function createProject(){
 const b=build();
 const idle=makeClip('Proof Idle',8,{
  body:[[0,{y:0}],[2,{y:-1}],[4,{y:-2}],[6,{y:-1}],[7,{y:0}]],
  head:[[0,{r:0}],[4,{r:2}],[7,{r:0}]],
  ear_front:[[0,{r:-2}],[4,{r:6}],[7,{r:-2}]],
  scarf:[[0,{r:0}],[4,{r:6}],[7,{r:0}]],
  cape:[[0,{r:-2}],[4,{r:5}],[7,{r:-2}]]
 });
 const raise=makeClip('Proof Raise Arm',8,{
  arm_front_upper:[[0,{r:0}],[2,{r:-24}],[4,{r:-70}],[5,{r:-85}],[7,{r:0}]],
  arm_front_lower:[[0,{r:0}],[3,{r:18}],[5,{r:28}],[7,{r:0}]],
  head:[[0,{r:0}],[4,{r:-5}],[7,{r:0}]]
 });
 const walk=makeClip('Proof Walk',8,{
  leg_front_upper:[[0,{r:-23}],[2,{r:0}],[4,{r:23}],[6,{r:0}],[7,{r:-23}]],
  leg_back_upper:[[0,{r:23}],[2,{r:0}],[4,{r:-23}],[6,{r:0}],[7,{r:23}]],
  arm_front_upper:[[0,{r:13}],[4,{r:-13}],[7,{r:13}]],
  arm_back_upper:[[0,{r:-13}],[4,{r:13}],[7,{r:-13}]],
  body:[[0,{y:0}],[2,{y:-2}],[4,{y:0}],[6,{y:-2}],[7,{y:0}]],
  cape:[[0,{r:-6}],[4,{r:7}],[7,{r:-6}]]
 });
 const assembly={id:'proof_assembly',name:'Proof Assembly',fps:8,frames:1,easing:'linear',tracks:{}};
 return {format:'bunny-rig-studio',version:1,name:'Blessed Bunny | Geometry Proof V1',
  parts:b.assets.map(p=>({...p,base:{...p.base},pivot:{...p.pivot}})),
  clips:[assembly,idle,raise,walk],activeClipId:assembly.id};
}
function masterImage(){return build().master}
function manifest(){return build().metadata.map(x=>({...x}))}
// Beginner cutout: group adjacent source layers that should move together.
// This produces a genuinely simpler 11-piece rig from THE SAME drawn master:
// tunic/armor/belt remain painted on the single Torso PNG, with no mesh or weights.
const simpleGroups=[
 {id:'tail',name:'หาง / Tail',parts:['tail'],parent:'body',anchor:[154,160]},
 {id:'cape',name:'ผ้าคลุม / Cape',parts:['cape'],parent:'body',anchor:[128,123]},
 {id:'leg_back',name:'ขาหลัง / Back Leg',parts:['leg_back_upper','leg_back_lower','foot_back'],parent:'body',anchor:[143,167]},
 {id:'arm_back',name:'แขนหลัง / Back Arm',parts:['arm_back_upper','arm_back_lower','hand_back'],parent:'body',anchor:[150,132]},
 {id:'ear_back',name:'หูหลัง / Back Ear',parts:['ear_back'],parent:'head',anchor:[143,81]},
 {id:'leg_front',name:'ขาหน้า / Front Leg',parts:['leg_front_upper','leg_front_lower','foot_front'],parent:'body',anchor:[112,168]},
 {id:'body',name:'ลำตัวพร้อมเสื้อ / Torso + Outfit',parts:['body'],parent:null,anchor:[128,140]},
 {id:'head',name:'หัว / Head',parts:['head'],parent:'body',anchor:[128,113]},
 {id:'ear_front',name:'หูหน้า / Front Ear',parts:['ear_front'],parent:'head',anchor:[114,81]},
 {id:'scarf',name:'ผ้าพันคอ / Scarf',parts:['scarf'],parent:'head',anchor:[128,120]},
 {id:'arm_front',name:'แขนหน้า / Front Arm',parts:['arm_front_upper','arm_front_lower','hand_front'],parent:'body',anchor:[106,132]}
];
let simpleCache=null;
function buildSimple(){
 if(simpleCache)return simpleCache;
 const anchors=new Map(simpleGroups.map(g=>[g.id,g.anchor]));
 const byId=new Map(specs.map(s=>[s.id,s])),assets=[],metadata=[];
 const fullMaster=canvas(),masterCtx=fullMaster.getContext('2d');masterCtx.imageSmoothingEnabled=false;
 for(const group of simpleGroups){
  const merged=canvas(),g=merged.getContext('2d');g.imageSmoothingEnabled=false;
  for(const id of group.parts)g.drawImage(getLayer(byId.get(id)),0,0);
  masterCtx.drawImage(merged,0,0);
  const crop=cropLayer(merged,group.anchor),[x,y]=group.anchor,parent=anchors.get(group.parent);
  const part={id:group.id,name:group.name,parent:group.parent||null,src:crop.src,
   pivot:crop.pivot,base:{
    x:parent?x-parent[0]:x-ORIGIN.x,
    y:parent?y-parent[1]:y-ORIGIN.y,r:0,sx:1,sy:1
   },visible:true};
  assets.push(part);
  metadata.push({id:group.id,name:group.name,parent:group.parent,width:crop.width,
   height:crop.height,pivot:crop.pivot,crop:crop.crop,anchor:group.anchor,
   mergedFrom:[...group.parts]});
 }
 simpleCache={assets,metadata,master:fullMaster.toDataURL('image/png')};return simpleCache;
}
function simpleClip(name,frames,config,fps=8){
 const baseById=new Map(buildSimple().assets.map(p=>[p.id,p.base])),tracks={};
 for(const [part,keys] of Object.entries(config))
  tracks[part]=keys.map(([f,delta])=>({f,pose:{...baseById.get(part),...delta}}));
 return {id:'cutout_'+name.toLowerCase().replace(/\s+/g,'_'),name,fps,frames,easing:'smooth',tracks};
}
function createSimpleProject(){
 const b=buildSimple(),assembly=simpleClip('01 Assemble',1,{});
 const idle=simpleClip('02 Idle',8,{
  body:[[0,{y:0}],[3,{y:-2}],[7,{y:0}]],
  head:[[0,{r:0}],[3,{r:2}],[7,{r:0}]],
  ear_front:[[0,{r:0}],[4,{r:7}],[7,{r:0}]],
  cape:[[0,{r:0}],[4,{r:4}],[7,{r:0}]]
 });
 const walk=simpleClip('03 Walk',8,{
  leg_front:[[0,{r:-20}],[2,{r:0}],[4,{r:20}],[6,{r:0}],[7,{r:-20}]],
  leg_back:[[0,{r:20}],[2,{r:0}],[4,{r:-20}],[6,{r:0}],[7,{r:20}]],
  arm_front:[[0,{r:12}],[4,{r:-12}],[7,{r:12}]],
  arm_back:[[0,{r:-12}],[4,{r:12}],[7,{r:-12}]],
  body:[[0,{y:0}],[2,{y:-2}],[4,{y:0}],[6,{y:-2}],[7,{y:0}]]
 });
 const attack=simpleClip('04 Attack',8,{
  arm_front:[[0,{r:0}],[2,{r:-56}],[3,{r:-78}],[5,{r:30}],[7,{r:0}]],
  arm_back:[[0,{r:0}],[3,{r:17}],[5,{r:-8}],[7,{r:0}]],
  head:[[0,{r:0}],[3,{r:-6}],[7,{r:0}]],
  body:[[0,{r:0}],[3,{r:-4}],[5,{r:5}],[7,{r:0}]]
 });
 return {format:'bunny-rig-studio',version:1,name:'Blessed Bunny | Simple 2D Cutout V1',
  parts:b.assets.map(p=>({...p,pivot:{...p.pivot},base:{...p.base}})),
  clips:[assembly,idle,walk,attack],activeClipId:assembly.id};
}
function simpleMasterImage(){return buildSimple().master}
function simpleManifest(){return buildSimple().metadata.map(p=>({...p,pivot:{...p.pivot},
  anchor:[...p.anchor],mergedFrom:[...p.mergedFrom]}))}
root.BunnyRigProof=Object.freeze({SIZE,ORIGIN,createProject,masterImage,manifest,partCount:specs.length,
 createSimpleProject,simpleManifest,simpleMasterImage,simplePartCount:simpleGroups.length});
})(window);
