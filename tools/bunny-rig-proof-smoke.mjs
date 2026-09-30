import {createServer} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
import {PNG} from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:0}});
await server.listen();
const proofUrl=new URL('art-test/bunny-rig-studio/rig-proof.html',server.resolvedUrls.local[0]).href;
const browser=await chromium.launch({headless:true}),errors=[];
const check=(name,condition)=>{if(!condition)throw Error('FAIL '+name);console.log('PASS '+name)};
try{
 const qc=await browser.newPage({viewport:{width:1450,height:970},acceptDownloads:true});
 qc.on('pageerror',e=>errors.push('QC '+e.message));
 await qc.goto(proofUrl);
 await qc.waitForFunction(()=>window.__rigProof&&Number.isInteger(__rigProof.difference));
 const initial=await qc.evaluate(()=>{
  const {project,manifest,difference,occupied}=__rigProof;
  return {parts:project.parts.length,manifest:manifest.length,difference,occupied,
   pixels:manifest.map(m=>[m.id,m.width,m.height,m.pivot.x,m.pivot.y]),
   clips:project.clips.map(c=>c.name),
   transparency:[...document.querySelector('#master').getContext('2d').getImageData(0,0,1,1).data][3]===0};
 });
 check('19 rigorously aligned transparent parts derived from one 256px Master image',
   initial.parts===19&&initial.manifest===19&&initial.transparency&&initial.occupied>5000);
 check('pixel-perfect reconstruction matches Master 100%, zero RGBA mismatches',initial.difference===0);
 check('every pivot is inside its own cropped image',initial.pixels.every(p=>p[3]>=0&&p[4]>=0&&p[3]<p[1]&&p[4]<p[2]));
 check('contains static Assembly then animated Idle/Raise Arm/Walk',initial.clips.join(',')===
   'Proof Assembly,Proof Idle,Proof Raise Arm,Proof Walk');
 const jsonEvent=qc.waitForEvent('download');await qc.locator('#downloadJSON').click();
 const data=JSON.parse(await fs.readFile(await (await jsonEvent).path(),'utf8'));
 check('downloaded rig JSON embeds all PNGs and explicit Parent/Pivot metadata',
   data.parts.length===19&&data.parts.every(p=>p.src.startsWith('data:image/png;base64,')&&p.pivot&&p.base&&
      (p.parent===null||data.parts.some(x=>x.id===p.parent))));
 const pngEvent=qc.waitForEvent('download');await qc.locator('#downloadMaster').click();
 const master=PNG.sync.read(await fs.readFile(await (await pngEvent).path()));
 check('downloaded Master PNG is 256x256 with real transparent exterior',master.width===256&&master.height===256&&master.data[3]===0);
 await qc.locator('a[href="./index.html?proof=1"]').click();
 await qc.waitForURL('**/index.html?proof=1');
 await qc.waitForFunction(()=>window.__rigTest?.project?.parts?.length===19);
 check('one-click opens exactly the same geometry-proof Bunny in the existing Rig Studio',
  await qc.evaluate(()=>__rigTest.project.name==='Blessed Bunny | Geometry Proof V1'&&
    __rigTest.project.clips.length===4&&__rigTest.images.size===19));
 const rigCheck=await qc.evaluate(async()=>{
  const {project,images,matrices}=__rigTest;
  const expected=await new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.src=BunnyRigProof.masterImage()});
  const master=document.createElement('canvas');master.width=master.height=256;
  master.getContext('2d',{willReadFrequently:true}).drawImage(expected,0,0);
  const out=document.createElement('canvas');out.width=out.height=256;
  const g=out.getContext('2d',{willReadFrequently:true});g.translate(128,140);g.imageSmoothingEnabled=false;
  const m=matrices(0);
  for(const p of project.parts){const mat=m.get(p.id);g.save();
   g.transform(mat.a,mat.b,mat.c,mat.d,mat.e,mat.f);
   g.drawImage(images.get(p.id),-p.pivot.x,-p.pivot.y);g.restore();}
  const a=master.getContext('2d').getImageData(0,0,256,256).data;
  const b=g.getImageData(0,0,256,256).data;
  let dif=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])dif++;
  return dif;
 });
 check('Rig Studio native transform hierarchy reconstructs Master with zero channel mismatches',rigCheck===0);
 // Confirm actual keyframes deform arm and animate walk, without editing the geometry proof baseline.
 await qc.locator('#clipList .list-row').nth(2).click();
 await qc.evaluate(()=>__rigTest.setFrame(5));
 const raised=await qc.evaluate(()=>{
  const p=__rigTest.project.parts.find(p=>p.id==='arm_front_upper');
  const mat=__rigTest.matrices(5).get(p.id);
  return {r:__rigTest.evaluatePose(p.id).r,x:mat.e,y:mat.f};
 });
 check('Raise Arm clip rotates the front upper arm and keeps it connected to torso',raised.r<-70&&Number.isFinite(raised.x));
 await qc.locator('#clipList .list-row').nth(3).click();
 await qc.evaluate(()=>__rigTest.setFrame(4));
 check('Walk clip alternates upper leg rotation with distinct phases',
  await qc.evaluate(()=>{
   const f=__rigTest.evaluatePose('leg_front_upper');
   const b=__rigTest.evaluatePose('leg_back_upper');
   return f.r>10&&b.r<-10;
  }));
 // Native export is still transparent and includes all parts.
 const exportEvent=qc.waitForEvent('download');await qc.locator('#exportSheet').click();
 const sheet=PNG.sync.read(await fs.readFile(await (await exportEvent).path()));
 check('Rig Studio exports animated 8-frame proof as transparent PNG sprite sheet',sheet.width>=256&&
  sheet.height>=256&&sheet.data[3]===0&&sheet.data.some((v,i)=>i%4===3&&v>0));
 await qc.close();
 const offline=await browser.newPage({viewport:{width:1330,height:910}});
 offline.on('pageerror',e=>errors.push('Offline '+e.message));
 await offline.goto(pathToFileURL(path.join(root,'art-test/bunny-rig-studio/rig-proof.html')).href);
 await offline.waitForFunction(()=>window.__rigProof?.difference===0);
 check('QC proof works without a server, fully offline',
  await offline.evaluate(()=>__rigProof.difference===0&&__rigProof.project.parts.length===19));
 await offline.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',e=>errors.push('Mobile '+e.message));
 await mobile.goto(proofUrl);
 await mobile.waitForFunction(()=>window.__rigProof?.difference===0);
 check('mobile QC shows both 256px canvases without horizontal page overflow',
  await mobile.evaluate(()=>document.querySelectorAll('canvas').length===2&&
   document.documentElement.scrollWidth<=window.innerWidth+1));
 await mobile.close();
 check('no uncaught browser exceptions in QC or Rig Editor',errors.length===0);
}catch(error){console.error(error.stack||error,errors);process.exitCode=1}
finally{await browser.close();await server.close()}
