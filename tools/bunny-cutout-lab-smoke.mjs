// Beginner-facing cutout: one Master → 11 linked layers → keyframed animation → export.
import {createServer} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
import {PNG} from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:0}});await server.listen();
const url=new URL('art-test/bunny-rig-studio/cutout-lab.html',server.resolvedUrls.local[0]).href;
const browser=await chromium.launch({headless:true}),errors=[];
const check=(what,value)=>{if(!value)throw Error('FAIL '+what);console.log('PASS '+what)};
async function wait(page){await page.waitForFunction(()=>__cutoutTest.state.difference!==null,null,{timeout:15000})}
async function point(page,x,y){return page.evaluate(([x,y])=>{
 const r=document.querySelector('#scene').getBoundingClientRect();
 return{x:r.left+(x+.5)*r.width/256,y:r.top+(y+.5)*r.height/256};
},[x,y])}
async function drag(page,x,y,xx,yy){
 const a=await point(page,x,y),b=await point(page,xx,yy);
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();
}
try{
 const page=await browser.newPage({viewport:{width:1450,height:1000},acceptDownloads:true});
 page.on('pageerror',e=>errors.push('desktop '+e.message));
 await page.goto(url);await wait(page);
 const baseline=await page.evaluate(()=>{
  const s=__cutoutTest.state,p=__cutoutTest.project,m=BunnyRigProof.simpleManifest();
  return{parts:p.parts.length,metadata:m,clips:p.clips.map(c=>c.name),
   diff:s.difference,alpha:document.querySelector('#master').getContext('2d').getImageData(0,0,1,1).data[3]};
 });
 check('Master and 11-piece cutout reassembly match pixel for pixel',
  baseline.parts===11&&baseline.diff===0&&baseline.alpha===0);
 check('all parent links valid and every pivot belongs to corresponding cropped PNG',
  baseline.metadata.every(m=>m.pivot.x>=0&&m.pivot.y>=0&&m.pivot.x<m.width&&m.pivot.y<m.height&&
   (m.parent===null||baseline.metadata.some(x=>x.id===m.parent))));
 check('shirt, armor and belt are integrated in single Torso layer',
  baseline.metadata.some(m=>m.id==='body'&&m.mergedFrom.join(',')==='body'));
 check('11-piece rig exposes Assemble/Idle/Walk/Attack without Mesh Deformation',
  baseline.clips.join(',')==='01 Assemble,02 Idle,03 Walk,04 Attack');
 await page.locator('#stepLayers').click();
 check('layer mode exposes 11 clearly labeled clickable part buttons',await page.locator('#parts button').count()===11);
 await page.locator('#parts button').filter({hasText:'แขนหน้า'}).click();
 check('selecting a layer reveals its real parent and transform inspector',
  (await page.locator('#inspectorName').innerText()).includes('Front Arm')&&
  (await page.locator('#inspectorParent').innerText()).includes('Torso'));
 const baselinePose=await page.evaluate(()=>__cutoutTest.pose('arm_front').r);
 await page.locator('#plus15').click();
 check('one-click rotate writes current-frame arm key without bending clothing',
  await page.evaluate(v=>{
   const t=__cutoutTest,c=t.project.clips[0].tracks.arm_front||[];
   return c.some(k=>k.f===0&&k.pose.r===v+15)&&
    !t.project.clips[0].tracks.body;
  },baselinePose));
 await page.keyboard.press('Control+z');
 check('Ctrl+Z restores previous pose after rotating one layer',
  await page.evaluate(v=>__cutoutTest.pose('arm_front').r===v,baselinePose));
 await page.keyboard.press('Control+y');
 check('Ctrl+Y redoes one-layer rotation',
  await page.evaluate(v=>__cutoutTest.pose('arm_front').r===v+15,baselinePose));
 await page.locator('#resetPart').click();
 check('Reset Selected returns front arm to Master pivot pose',
  await page.evaluate(v=>__cutoutTest.pose('arm_front').r===v,baselinePose));
 await drag(page,102,132,120,126);
 check('click and drag on artwork creates a translated key on the selected arm',
  await page.evaluate(()=>__cutoutTest.pose('arm_front').x>-18));

 await page.locator('#rotateTool').click();
 const ring=await page.evaluate(()=>{
  const t=__cutoutTest,s=t.state,p=t.project.parts.find(p=>p.id==='arm_front'),
   m=BunnyUnifiedCore.worldMatrices(t.project,t.project.clips[s.clipIndex],s.frame).get(p.id),
   center=BunnyUnifiedCore.point(m),im=s.images.get(p.id);
  return{x:center.x+BunnyRigProof.ORIGIN.x,y:center.y+BunnyRigProof.ORIGIN.y,
   radius:Math.min(98,Math.max(30,Math.max(im.width,im.height)*.64+12))};
 });
 await drag(page,ring.x,ring.y-ring.radius,ring.x+ring.radius,ring.y);
 check('visible rotation ring lets a beginner rotate the arm directly on Canvas',
  await page.evaluate(()=>Math.abs(__cutoutTest.pose('arm_front').r-90)<3));
 await page.keyboard.press('Control+z');
 check('Ctrl+Z reverses a direct canvas rotation',
  await page.evaluate(()=>Math.abs(__cutoutTest.pose('arm_front').r)<.1));
 await page.locator('#stepAnimate').click();
 check('Animate mode defaults to Idle with 8 clickable timeline frames',
  await page.evaluate(()=>__cutoutTest.project.clips[__cutoutTest.state.clipIndex].name==='02 Idle')&&
    await page.locator('#timeline button').count()===8);
 await page.locator('#clip').selectOption('2');await page.locator('#timeline button').nth(4).click();
 check('Walk keyframes swing front and rear leg in opposite directions',
  await page.evaluate(()=>__cutoutTest.pose('leg_front').r>10&&__cutoutTest.pose('leg_back').r< -10));
 await page.locator('#clip').selectOption('3');await page.locator('#timeline button').nth(3).click();
 check('Attack arm moves on keyframe without torso mesh deformation',
  await page.evaluate(()=>__cutoutTest.pose('arm_front').r<-50&&
   __cutoutTest.project.parts.find(p=>p.id==='body').src===__cutoutTest.baseline.parts.find(p=>p.id==='body').src));
 await page.locator('#play').click();
 await page.waitForFunction(()=>__cutoutTest.state.playing&&__cutoutTest.state.frame!==3);
 await page.locator('#play').click();
 check('animation playback and pause run on one cutout rig',!await page.evaluate(()=>__cutoutTest.state.playing));
 await page.locator('#stepExport').click();
 const jsonPromise=page.waitForEvent('download');await page.locator('#exportJSON').click();
 const rig=JSON.parse(await fs.readFile(await (await jsonPromise).path(),'utf8'));
 check('downloaded Rig JSON preserves 11 editable PNG layers and four clips',
  rig.format==='bunny-rig-studio'&&rig.parts.length===11&&rig.clips.length===4&&
   rig.parts.every(p=>p.src.startsWith('data:image/png;base64,')));
 const pngPromise=page.waitForEvent('download');await page.locator('#exportSheet').click();
 const png=PNG.sync.read(await fs.readFile(await (await pngPromise).path()));
 check('cutout Attack exports 4-column 8-frame transparent sprite sheet',
  png.width===1024&&png.height===512&&png.data[3]===0&&png.data.some((v,i)=>i%4===3&&v>0));
 const masterPromise=page.waitForEvent('download');await page.locator('#exportMaster').click();
 const masterFile=PNG.sync.read(await fs.readFile(await (await masterPromise).path()));
 check('Master PNG export is 256px with true alpha transparency',
  masterFile.width===256&&masterFile.height===256&&masterFile.data[3]===0);
 const beforeReset=await page.evaluate(()=>({clipIndex:__cutoutTest.state.clipIndex,
  frame:__cutoutTest.state.frame,angle:__cutoutTest.pose('arm_front').r}));
 page.once('dialog',dialog=>dialog.accept());await page.locator('#resetAll').click();
 check('Reset All restores untouched Assembly and baseline keys',
  await page.evaluate(()=>__cutoutTest.state.clipIndex===0&&!__cutoutTest.project.clips[0].tracks.arm_front&&
   __cutoutTest.project.clips[3].tracks.arm_front.length===5));
 await page.keyboard.press('Control+z');
 check('Ctrl+Z restores the entire project including current animation after Reset All',
  await page.evaluate(before=>__cutoutTest.state.clipIndex===before.clipIndex&&
   __cutoutTest.state.frame===before.frame&&
   __cutoutTest.pose('arm_front').r===before.angle,beforeReset));
 await page.close();
 const rigPage=await browser.newPage({viewport:{width:1440,height:900}});
 rigPage.on('pageerror',e=>errors.push('rig '+e.message));
 await rigPage.goto(new URL('art-test/bunny-rig-studio/index.html?cutout=1',server.resolvedUrls.local[0]).href);
 await rigPage.waitForFunction(()=>__rigTest?.project?.parts?.length===11,null,{timeout:15000});
 check('one-click opens simplified 11-piece cutout in existing Rig Studio',
  await rigPage.evaluate(()=>__rigTest.project.clips.length===4&&__rigTest.images.size===11));
 await rigPage.close();
 const offline=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 offline.on('pageerror',e=>errors.push('offline '+e.message));
 await offline.goto(pathToFileURL(path.join(root,'art-test/bunny-rig-studio/cutout-lab.html')).href);
 await wait(offline);
 check('mobile/offline lab renders 11-piece geometry without a server',
  await offline.evaluate(()=>__cutoutTest.state.difference===0&&__cutoutTest.project.parts.length===11));
 check('mobile layout fits device width',await offline.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await offline.close();
 check('no uncaught desktop, rig or offline runtime errors',errors.length===0);
}catch(error){console.error(error.stack||error,errors);process.exitCode=1}
finally{await browser.close();await server.close()}
