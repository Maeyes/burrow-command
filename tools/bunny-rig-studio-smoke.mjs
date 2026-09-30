import {createServer} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
import {PNG} from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:0}});
await server.listen();
const base=server.resolvedUrls.local[0],url=new URL('art-test/bunny-rig-studio/',base).href;
const browser=await chromium.launch({headless:true});
const errors=[];
const check=(name,pass)=>{if(!pass)throw Error('FAIL '+name);console.log('PASS '+name);};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__rigTest?.project?.clips?.length===3&&window.__rigTest?.images?.size>0,null,{timeout:30000});
 const initial=await page.evaluate(()=>({clips:__rigTest.project.clips.map(c=>c.name),parts:__rigTest.project.parts.length,
   images:__rigTest.images.size,canvas:document.getElementById('stage').getContext('2d')?.getImageData(550,350,1,1).data.length}));
 check('existing full Bunny Rig Studio demo boots with 3 clips and rigged pixel layers',initial.clips.join(',')==='Idle,Walk,Slash'&&initial.parts>=10&&initial.images===initial.parts&&initial.canvas===4);
 await page.locator('#clipList .list-row').nth(1).click();
 check('Walk tab updates the active animation',await page.evaluate(()=>__rigTest.project.clips.find(c=>c.id===__rigTest.project.activeClipId).name==='Walk'));
 await page.locator('#nextFrame').click();
 check('timeline stepping advances exactly one frame',await page.evaluate(()=>__rigTest.ui.frame===1));
 await page.locator('#playBtn').click();
 await page.waitForFunction(()=>__rigTest.ui.playing&&__rigTest.ui.frame>1,null,{timeout:5000});
 const playState=await page.evaluate(()=>({playing:__rigTest.ui.playing,frame:__rigTest.ui.frame,clip:__rigTest.project.clips.find(c=>c.id===__rigTest.project.activeClipId).name,errors:document.querySelector('#status').textContent}));
 // The 16-frame clip loops; after waitForFunction observes frame >1 the playhead
 // may wrap back to 0 before evaluate runs, which is valid playback.
 check('timeline Play advances and pauses',playState.playing&&playState.clip==='Walk');
 await page.locator('#playBtn').click();
 check('pause stops playback',await page.evaluate(()=>!__rigTest.ui.playing));

 const source=new PNG({width:16,height:16});
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const i=(y*16+x)*4;source.data[i]=235;source.data[i+1]=180;source.data[i+2]=90;source.data[i+3]=255;
 }
 await page.locator('#partsInput').setInputFiles({name:'test-hand.png',mimeType:'image/png',buffer:PNG.sync.write(source)});
 await page.waitForFunction(()=>__rigTest.project.parts.some(p=>p.name==='test-hand')&&__rigTest.images.size===__rigTest.project.parts.length,null,{timeout:10000});
 check('PNG layer importer adds an editable part with embedded image data',await page.evaluate(()=>__rigTest.project.parts.some(p=>p.name==='test-hand'&&p.src.startsWith('data:image/png;'))&&__rigTest.images.size===__rigTest.project.parts.length));
 const key=await page.evaluate(()=>{
  const p=__rigTest.project.parts.find(p=>p.name==='test-hand');
  __rigTest.ui.selected=p.id;__rigTest.setFrame(4);
  return {selected:__rigTest.ui.selected,clipId:__rigTest.project.activeClipId};
 });
 await page.locator('#addKey').click();
 check('selected imported PNG accepts a timeline keyframe',await page.evaluate(id=>{
  const c=__rigTest.project.clips.find(c=>c.id===__rigTest.project.activeClipId);
  return c.tracks[id]?.some(k=>k.f===4);
 },key.selected));
 await page.locator('#undo').click();
 await page.waitForFunction(id=>{
  const c=__rigTest.project.clips.find(c=>c.id===__rigTest.project.activeClipId);
  return !c.tracks[id]?.some(k=>k.f===4);
 },key.selected);
 check('Undo restores the previous keyframe state',true);

 const savePromise=page.waitForEvent('download');
 await page.locator('#saveProject').click();const saved=await savePromise;
 const savedData=JSON.parse(await fs.readFile(await saved.path(),'utf8'));
 check('JSON project export embeds imported art and all animation clips',savedData.format==='bunny-rig-studio'&&savedData.parts.some(p=>p.name==='test-hand')&&savedData.clips.length===3);
 await page.locator('#projectInput').setInputFiles({name:'saved.bunny-rig.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(savedData))});
 await page.waitForFunction(()=>__rigTest.project.parts.some(p=>p.name==='test-hand'));
 check('reopening saved JSON retains all PNG layers',await page.evaluate(()=>__rigTest.project.parts.length===11));

 const sheetPromise=page.waitForEvent('download');
 await page.locator('#exportSheet').click();const sheet=await sheetPromise;
 const png=PNG.sync.read(await fs.readFile(await sheet.path()));
 check('Sprite Sheet export produces transparent-background PNG',png.width>=256&&png.height>=256&&png.data.some((alpha,i)=>i%4===3&&alpha===0)&&png.data.some((alpha,i)=>i%4===3&&alpha>0));
 // Keyboard history must work while an inspector text input has focus.
 const selectedId=await page.evaluate(()=>__rigTest.ui.selected);
 const originalName=await page.evaluate(id=>__rigTest.project.parts.find(p=>p.id===id)?.name,selectedId);
 await page.locator('#partName').fill('rig-undo-keyboard');
 await page.locator('#partName').press('Tab');
 check('Rig inspector edit creates history',await page.evaluate(id=>__rigTest.project.parts.find(p=>p.id===id)?.name==='rig-undo-keyboard',selectedId));
 await page.keyboard.press('Control+z');
 await page.waitForFunction(({id,name})=>__rigTest.project.parts.find(p=>p.id===id)?.name===name,{id:selectedId,name:originalName});
 check('Rig Ctrl+Z restores selected part properties',true);
 await page.keyboard.press('Control+y');
 await page.waitForFunction(id=>__rigTest.project.parts.find(p=>p.id===id)?.name==='rig-undo-keyboard',selectedId);
 check('Rig Ctrl+Y repeats the edit',true);
 await page.keyboard.press('Control+z');
 await page.keyboard.press('Control+Shift+z');
 await page.waitForFunction(id=>__rigTest.project.parts.find(p=>p.id===id)?.name==='rig-undo-keyboard',selectedId);
 check('Rig Ctrl+Shift+Z also performs Redo',true);
 check('desktop runtime produces no uncaught errors',errors.length===0);
 await page.close();

 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.goto(url);
 await mobile.waitForFunction(()=>window.__rigTest?.project?.clips?.length===3,null,{timeout:30000});
 check('mobile renders rig canvas and transport controls',await mobile.locator('#stage').isVisible()&&await mobile.locator('#playBtn').isVisible());
 await mobile.locator('#playBtn').click();
 check('mobile Play works by touch',await mobile.evaluate(()=>__rigTest.ui.playing));
 await mobile.locator('#playBtn').click();
 check('no mobile browser exceptions',errors.length===0);
 await mobile.close();

 const offline=await browser.newPage({viewport:{width:1050,height:720}});
 offline.on('pageerror',e=>errors.push('offline: '+e.message));
 const localFile=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../art-test/bunny-rig-studio/index.html');
 await offline.goto(pathToFileURL(localFile).href);
 await offline.waitForFunction(()=>window.__rigTest?.images?.size===10,null,{timeout:15000});
 check('self-contained Editor also works offline as a local HTML file',await offline.locator('#stage').isVisible()&&await offline.locator('#exportSheet').isVisible());
 check('offline mode produces no page exceptions',errors.length===0);
 await offline.close();
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await server.close();}
