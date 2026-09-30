// Unified Rig + FX Lab editor: shared timeline, bone attachment, drag-to-key,
// non-destructive JSON roundtrip, transparent PNG sheet and offline use.
import {createServer} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
import {PNG} from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:0}});
await server.listen();
const url=new URL('art-test/bunny-rig-studio/unified-studio.html',server.resolvedUrls.local[0]).href;
const browser=await chromium.launch({headless:true}),errors=[];
const check=(name,result)=>{if(!result)throw Error('FAIL '+name);console.log('PASS '+name)};
async function ready(page){await page.waitForFunction(()=>__unifiedTest?.state?.rig&&__unifiedTest.state.tracks.length>0,null,{timeout:15000})}
async function pt(page,x,y){
 return page.evaluate(([x,y])=>{
  const r=document.querySelector('#stage').getBoundingClientRect();
  return {x:r.left+(256+x)*r.width/512,y:r.top+(512*.58+y)*r.height/512};
 },[x,y]);
}
async function drag(page,x,y,dx,dy){
 const a=await pt(page,x,y),b=await pt(page,x+dx,y+dy);
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up();
}
try{
 const page=await browser.newPage({viewport:{width:1450,height:1050},acceptDownloads:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await ready(page);
 check('Unified editor boots with demo staff rig and FX in shared 8-frame scene',
  await page.evaluate(()=>{
   const s=__unifiedTest.state;
   return s.rig.clips[0].frames===8&&s.tracks.length===1&&s.tracks[0].boneId==='staff'&&s.fxSources[0].frames.length===8&&
    document.querySelectorAll('#tracks .track').length===5&&s.renderCount>0;
  }));
 check('Rig and FX render in same stage with non-transparent pixels',
  await page.evaluate(()=>{
   const ctx=document.querySelector('#stage').getContext('2d');
   return ctx.getImageData(260,304,1,1).data[3]===255;
  }));
 const original=await page.evaluate(()=>__unifiedTest.state.tracks[0].keys[0].pose.x);
 await drag(page,5,5,20,12);
 check('click+drag FX creates a keyframe at current frame automatically',
  await page.evaluate(orig=>__unifiedTest.state.tracks[0].keys[0].pose.x>orig+10,original));
 await page.keyboard.press('Control+z');
 check('Ctrl+Z restores attached FX transform',await page.evaluate(orig=>__unifiedTest.state.tracks[0].keys[0].pose.x===orig,original));
 await page.keyboard.press('Control+y');
 check('Ctrl+Y redoes the FX move',await page.evaluate(orig=>__unifiedTest.state.tracks[0].keys[0].pose.x>orig+10,original));
 await page.locator('#next').click();
 await page.locator('#poseR').fill('45');await page.locator('#poseR').press('Tab');
 check('Inspector edits create tweenable FX rotation keyframe at F2',
  await page.evaluate(()=>__unifiedTest.state.frame===1&&__unifiedTest.state.tracks[0].keys.some(k=>k.f===1&&k.pose.r===45)));
 await page.locator('#attachBone').selectOption('head');
 check('FX can reattach from staff to head bone without changing source PNG',
  await page.evaluate(()=>__unifiedTest.state.tracks[0].boneId==='head'));
 await page.locator('#selectBone').click();await page.locator('#hierarchy button').last().click();
 await page.locator('#addKey').click();
 check('Rig and FX have independent keyframe tracks on the same timeline',
  await page.evaluate(()=>__unifiedTest.state.rig.clips[0].tracks.staff.some(k=>k.f===1)&&
   document.querySelectorAll('#tracks .track').length===5));
 const boneBefore=await page.evaluate(()=>__unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===1).pose.x);
 await drag(page,5,5,12,8);
 check('dragging selected Staff Bone authors an independent Rig pose keyframe',
  await page.evaluate(before=>__unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===1).pose.x>before+6,boneBefore));
 await page.keyboard.press('Control+z');
 check('Ctrl+Z restores prior Staff Bone pose',await page.evaluate(before=>
  __unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===1).pose.x===before,boneBefore));
 await page.keyboard.press('Control+Shift+z');
 check('Ctrl+Shift+Z redoes the Staff Bone drag',await page.evaluate(before=>
  __unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===1).pose.x>before+6,boneBefore));
 await page.locator('#play').click();
 await page.waitForFunction(()=>__unifiedTest.state.playing&&__unifiedTest.state.frame!==1);
 await page.locator('#play').click();
 check('Rig and FX playback is synchronized in a single transport',await page.evaluate(()=>!__unifiedTest.state.playing));
 await page.locator('#rigImport').click();
 const demoRig=await page.evaluate(()=>__unifiedTest.demoRig());
 await page.locator('#rigFile').setInputFiles({name:'my-rig.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(demoRig))});
 await page.waitForFunction(()=>__unifiedTest.state.rig.parts.length===4&&__unifiedTest.state.tracks.length===0);
 check('Bone Rig JSON import opens editable clips and clears incompatible FX links',
  await page.evaluate(()=>__unifiedTest.state.rig.parts.length===4&&__unifiedTest.state.tracks.length===0));
 const demoFX=await page.evaluate(()=>__unifiedTest.demoFX());
 await page.locator('#fxFile').setInputFiles({name:'trail.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(demoFX))});
 await page.waitForFunction(()=>__unifiedTest.state.tracks.length===1);
 check('FX Lab JSON imports as a separate staff-attached source',
  await page.evaluate(()=>__unifiedTest.state.tracks.length===1&&__unifiedTest.state.tracks[0].boneId==='staff'));
 const saveEvent=page.waitForEvent('download');await page.locator('#saveProject').click();
 const saved=JSON.parse(await fs.readFile(await (await saveEvent).path(),'utf8'));
 check('Unified JSON preserves source rig, FX frames and bone-link keys',
  saved.format==='bunny-unified-studio'&&saved.rig.parts.length===4&&saved.fxSources[0].frames.length===8&&
  saved.tracks[0].boneId==='staff');
 const imageEvent=page.waitForEvent('download');await page.locator('#exportSheet').click();
 const sheet=PNG.sync.read(await fs.readFile(await (await imageEvent).path()));
 check('combined transparent PNG exports 8 rig+FX frames in 4 columns',
  sheet.width===1024&&sheet.height===512&&sheet.data[3]===0&&sheet.data.some((v,i)=>i%4===3&&v>0));
 await page.close();
 const fresh=await browser.newPage({acceptDownloads:true});
 fresh.on('pageerror',e=>errors.push(e.message));
 await fresh.goto(url);await ready(fresh);
 await fresh.locator('#projectFile').setInputFiles({name:'saved.unified.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await fresh.waitForFunction(()=>__unifiedTest.state.fxSources.length===1&&__unifiedTest.state.tracks.length===1);
 check('Unified JSON roundtrip restores editable staff link and FX PNG data',await fresh.evaluate(()=>
  __unifiedTest.state.tracks[0].boneId==='staff'&&__unifiedTest.state.fxSources[0].frames.length===8));
 await fresh.close();
 const layered=await browser.newPage({acceptDownloads:true});
 layered.on('pageerror',e=>errors.push(e.message));
 await layered.goto(url);await ready(layered);
 const fxV2={format:'bunny-fx-lab',version:2,width:152,height:152,fps:8,style:'smooth',
  frames:saved.fxSources[0].frames,layers:[
   {id:'gold',name:'Gold glow',visible:true,opacity:.5,
    effects:{glow:{enabled:true,color:'#ffd166',blur:7}},
    frames:saved.fxSources[0].frames},
   {id:'hidden',name:'Hidden draft',visible:false,frames:saved.fxSources[0].frames}
  ]};
 await layered.locator('#fxFile').setInputFiles({name:'wukong-multilayer.fx.json',
  mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fxV2))});
 await layered.waitForFunction(()=>__unifiedTest.state.tracks.length===2);
 check('FX Lab v2 imports visible layers only and bakes glow + opacity',
  await layered.evaluate(()=>{
   const s=__unifiedTest.state,a=s.fxSources[0].frames[0],b=s.fxSources[1].frames[0];
   return s.tracks.length===2&&s.tracks[1].name==='Gold glow'&&
    a.src!==b.src&&b.img.width===a.img.width&&b.img.height===a.img.height;
  }));
 await layered.close();
 const usability=await browser.newPage({viewport:{width:1450,height:1050},acceptDownloads:true});
 usability.on('pageerror',e=>errors.push('usability: '+e.message));
 await usability.goto(url);await ready(usability);
 await usability.locator('#selectBone').click();
 const edits=[];
 for(let frame=0;frame<8;frame++){
  const pos=await usability.evaluate(i=>{
   __unifiedTest.setFrame(i);
   const m=__unifiedTest.boneMatrices(i).get('staff');
   return {x:m[4],clickX:m[4]+m[0]*22,clickY:m[5]+m[1]*22};
  },frame);
  await drag(usability,pos.clickX,pos.clickY,12,0);
  edits.push(await usability.evaluate(({i,base})=>{
   const keys=__unifiedTest.state.rig.clips[0].tracks.staff;
   const key=keys.find(k=>k.f===i);
   return Boolean(key&&key.pose.x>base+8);
  },{i:frame,base:pos.x}));
 }
 check('clicking the visible staff sprite moves it on ALL 8 frames, including interpolated ones',
  edits.every(Boolean)&&await usability.evaluate(()=>__unifiedTest.state.rig.clips[0].tracks.staff.length===8));
 await usability.evaluate(()=>__unifiedTest.setFrame(3));
 await usability.keyboard.press('r');
 check('R selects a visible on-canvas rotation tool',
  await usability.evaluate(()=>__unifiedTest.state.transformTool==='rotate'&&
   document.getElementById('rotateTool').classList.contains('active')));
 const beforeAngle=await usability.evaluate(()=>__unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===3).pose.r);
 const ring=await usability.evaluate(()=>__unifiedTest.selectedGizmo());
 await drag(usability,ring.center.x,ring.center.y-ring.radius,ring.radius,ring.radius);
 check('dragging the gold rotation ring rotates Staff Bone on an interpolated frame',
  await usability.evaluate(before=>{
   const value=__unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===3).pose.r;
   return Math.abs(value-before-90)<4;
  },beforeAngle));
 await usability.keyboard.press('Control+z');
 check('Ctrl+Z reverses direct rotation',await usability.evaluate(before=>
  __unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===3).pose.r===before,beforeAngle));
 await usability.keyboard.press('Control+y');
 check('Ctrl+Y restores direct rotation',await usability.evaluate(before=>
  Math.abs(__unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===3).pose.r-before-90)<4,beforeAngle));
 const angle90=await usability.evaluate(()=>__unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===3).pose.r);
 await usability.locator('#rotateLeft').click();
 check('visible −15° button rotates selected Bone immediately',
  await usability.evaluate(before=>Math.abs(__unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===3).pose.r-before+15)<.01,angle90));
 await usability.locator('#rotateRight').click();
 check('visible +15° button restores the selected Bone angle',
  await usability.evaluate(before=>Math.abs(__unifiedTest.state.rig.clips[0].tracks.staff.find(k=>k.f===3).pose.r-before)<.01,angle90));
 await usability.keyboard.press('v');
 check('V switches back to Move without losing staff selection',
  await usability.evaluate(()=>__unifiedTest.state.transformTool==='move'&&
    __unifiedTest.state.selectedBone==='staff'));
 await usability.locator('#selectFX').click();await usability.locator('#rotateTool').click();
 const fxRing=await usability.evaluate(()=>__unifiedTest.selectedGizmo());
 await drag(usability,fxRing.center.x,fxRing.center.y-fxRing.radius,fxRing.radius,fxRing.radius);
 check('the same Rotate tool works for bone-attached FX',
  await usability.evaluate(()=>__unifiedTest.state.tracks[0].keys.some(k=>k.f===3&&Math.abs(k.pose.r-90)<4)));
 await usability.close();
 const offline=await browser.newPage({acceptDownloads:true});
 offline.on('pageerror',e=>errors.push('offline:'+e.message));
 await offline.goto(pathToFileURL(path.join(root,'art-test/bunny-rig-studio/unified-studio.html')).href);
 await ready(offline);
 const offlineEvent=offline.waitForEvent('download');await offline.locator('#exportSheet').click();
 const png=PNG.sync.read(await fs.readFile(await (await offlineEvent).path()));
 check('Unified demo and PNG export work fully offline',png.width===1024&&png.height===512);
 await offline.close();
 check('all desktop/offline contexts have zero browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1}
finally{await browser.close();await server.close()}
