// End-to-end review: 8-frame AI-style sheet with an overhanging staff,
// disconnected tail/cape, cross-cell contamination and variable trim bounds.
// Also covers 4x2, undo, mask editing, PNG export and offline file:// mode.
import {createServer} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
import {PNG} from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:0}});
await server.listen();
const url=new URL('art-test/bunny-rig-studio/frame-animation.html',server.resolvedUrls.local[0]).href;
const browser=await chromium.launch({headless:true}),errors=[];
function check(label,ok){if(!ok)throw Error('FAIL '+label);console.log('PASS '+label)}
function strip(cols=8,rows=1){
 const w=cols*24,h=rows*32,p=new PNG({width:w,height:h});p.data.fill(0);
 function rect(x,y,width,height,rgba){
  for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+width;xx++){
   const k=(yy*w+xx)*4;for(let z=0;z<4;z++)p.data[k+z]=rgba[z];
  }
 }
 for(let i=0;i<cols*rows;i++){
  const col=i%cols,row=Math.floor(i/cols),x=col*24,y=row*32;
  rect(x+7,y+12,8,14,[200,i*25,60,255]); // main body
  rect(x+3,y+18,2,4,[70,200,40,255]);   // disconnected tail
 }
 // Staff of F1 extends four pixels into the neighboring frame:
 rect(19,8,9,4,[251,215,15,255]);
 // A cape island detached from the main sprite is deliberately retained.
 rect(1,26,3,3,[75,85,220,255]);
 return PNG.sync.write(p);
}
async function waitReady(page){await page.waitForFunction(()=>Boolean(window.__frameAnimTest?.extractor),null,{timeout:15000})}
async function openSheet(page,cols,rows){
 await page.locator('#sheetInput').setInputFiles({name:'staff-tail-cape.png',mimeType:'image/png',buffer:strip(cols,rows)});
 await page.locator('#sheetOptions:not([hidden])').waitFor();
 await page.locator('[data-grid="'+cols+'x'+rows+'"]').click();
 await page.locator('#autoExtractBtn').click();
 await page.locator('#extractStudio:not([hidden])').waitFor();
}
async function clickPixel(page,x,y){
 const coords=await page.evaluate(({x,y})=>{
  const s=__frameAnimTest.extract,r=s.frames[s.selected].rect;
  const z=Math.max(.07,Math.min(32,Math.min((640-100)/(r.w*1.45),(480-90)/(r.h*1.45))*s.zoom));
  const left=320-(r.x+r.w/2)*z,top=240-(r.y+r.h/2)*z;
  const box=document.getElementById('extractCanvas').getBoundingClientRect();
  return {x:box.left+(left+x*z)*box.width/640,y:box.top+(top+y*z)*box.height/480};
 },{x,y});
 await page.mouse.click(coords.x,coords.y);
}
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},acceptDownloads:true});
 page.on('pageerror',e=>errors.push('desktop: '+e.message));
 await page.goto(url);await waitReady(page);await openSheet(page,8,1);
 check('Auto Extract opens an independent eight-frame review workspace',await page.evaluate(()=>
  __frameAnimTest.extract.frames.length===8&&
  __frameAnimTest.state.frames.length===0&&document.querySelectorAll('#extractFrames button').length===8));
 const sheetPixel=await page.evaluate(()=>{
  const im=__frameAnimTest.state.sheet.img,c=document.createElement('canvas');c.width=im.width;c.height=im.height;
  const ctx=c.getContext('2d');ctx.drawImage(im,0,0);
  return [...ctx.getImageData(25,9,1,1).data];
 });
 // Increasing the first crop preserves newly exposed original staff pixels.
 await page.locator('#extractW').fill('28');await page.locator('#extractW').press('Tab');
 check('per-frame crop can extend over a grid boundary without scaling',await page.evaluate(()=>
  __frameAnimTest.extract.frames[0].rect.w===28&&__frameAnimTest.extract.frames[0].mask.length===28*32));
 await page.keyboard.press('Control+z');
 check('Auto Extract Ctrl+Z restores previous crop',await page.evaluate(()=>__frameAnimTest.extract.frames[0].rect.w===24));
 await page.keyboard.press('Control+y');
 check('Auto Extract Ctrl+Y redoes the crop',await page.evaluate(()=>__frameAnimTest.extract.frames[0].rect.w===28));
 await page.locator('#extractDetect').click();
 check('connected component proposals preserve the staff, tail, cape and main body',await page.evaluate(()=>{
  const f=__frameAnimTest.extract.frames[0];
  return f.regions.regions.length>=4&&f.mask.every(v=>v===1)&&
   __frameAnimTest.extractor.frameEntry(f,0).src.startsWith('data:image/png;');
 }));
 // The destructive-looking shortcut must require confirmation and be reversible.
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#extractMain').click();
 check('Only Main is an explicitly confirmed, reversible mask operation',await page.evaluate(()=>{
  const f=__frameAnimTest.extract.frames[0],ids=f.regions.idMap;
  return f.mask.some((v,i)=>ids[i]!==f.regions.largestId&&ids[i]>=0&&v===0);
 }));
 await page.locator('#extractUndo').click();
 check('Undo restores ALL disconnected artwork, not just the largest region',await page.evaluate(()=>
  __frameAnimTest.extract.frames[0].mask.every(x=>x===1)));
 await page.locator('#extractRedo').click();await page.locator('#extractUndo').click();
 // Align feet to body base instead of the sheet cell bottom.
 await page.locator('#extractFootY').fill('26');await page.locator('#extractFootY').press('Tab');
 await page.locator('#eyePrevious').check();await page.locator('#eyeNext').check();
 await page.locator('#extractOpacity').fill('45');
 check('reference eyes, opacity and editable foot anchor are wired',await page.evaluate(()=>
  document.getElementById('eyePrevious').checked&&document.getElementById('eyeNext').checked&&
  __frameAnimTest.extract.frames[0].footY===26));
 const singlePromise=page.waitForEvent('download');
 await page.locator('#extractSelectedPNG').click();
 const single=PNG.sync.read(await fs.readFile(await (await singlePromise).path()));
 check('selected frame PNG preserves long staff and disconnected cape after trim',
   single.width===27&&single.height===21&&single.data[((9-8)*27+(25-1))*4+3]===255);
 // Hide staff contamination inside F2 with a manual eraser; F2 body survives.
 await page.locator('#extractFrames button').nth(1).click();
 await page.locator('#extractTool').selectOption('exclude');
 await page.locator('#extractBrush').fill('4');
 await clickPixel(page,25,9);
 check('manual mask can hide the overlapping staff without removing the next character',await page.evaluate(()=>{
  const f=__frameAnimTest.extract.frames[1],p=__frameAnimTest.extractor.trimmed(f);
  return f.mask[(9-f.rect.y)*f.rect.w+(25-f.rect.x)]===0&&p?.canvas.width>=8;
 }));
 await page.locator('#extractFrames button').nth(0).click();
 await page.locator('#extractUndo').click();
 check('manual brush stroke undo restores neighboring shared pixels',await page.evaluate(()=>{
  const f=__frameAnimTest.extract.frames[1];return f.mask[(9-f.rect.y)*f.rect.w+(25-f.rect.x)]===1;
 }));
 await page.locator('#extractRedo').click();
 // Add all reviewed frames in one operation; original source stays immutable.
 await page.locator('#extractCommit').click();
 await page.waitForFunction(()=>__frameAnimTest.state.frames.length===8);
 check('reviewed variable-size frames appear in existing timeline with anchors',await page.evaluate(()=>{
  const f=__frameAnimTest.state.frames;
  return f.length===8&&f[0].img.width===27&&f[0].footY===18&&f[1].img.width<24;
 }));
 check('original source sheet remains unchanged after crop, mask and commit',await page.evaluate(orig=>{
  const im=__frameAnimTest.state.sheet.img,c=document.createElement('canvas');
  c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);
  return [...x.getImageData(25,9,1,1).data].join(',')===orig.join(',');
 },sheetPixel));
 const sheetDownload=page.waitForEvent('download');
 await page.locator('#exportPNG').click();
 const exported=PNG.sync.read(await fs.readFile(await (await sheetDownload).path()));
 check('existing sprite-sheet export accepts variable frame sizes',exported.width>=1024&&exported.height>=32);
 const onePromise=page.waitForEvent('download');
 await page.locator('#exportFramePNG').click();
 const one=PNG.sync.read(await fs.readFile(await (await onePromise).path()));
 check('individual transparent PNG export works from existing timeline',one.width>=27&&one.height>=21);
 const projectPromise=page.waitForEvent('download');
 await page.locator('#saveJSON').click();
 const project=JSON.parse(await fs.readFile(await (await projectPromise).path(),'utf8'));
 check('JSON project saves independently editable anchor coordinates',project.frames.length===8&&project.frames[0].footY===18);
 check('desktop extraction runs without uncaught errors',errors.length===0);
 await page.close();
 const four=await browser.newPage({acceptDownloads:true});
 four.on('pageerror',e=>errors.push('4x1: '+e.message));
 await four.goto(url);await waitReady(four);await openSheet(four,4,1);
 await four.locator('#extractCommit').click();
 await four.waitForFunction(()=>__frameAnimTest.state.frames.length===4);
 check('4×1 Auto Extract preserves original four-frame workflow',await four.evaluate(()=>__frameAnimTest.state.frames.length===4));
 await four.close();
 const grid=await browser.newPage({acceptDownloads:true});
 grid.on('pageerror',e=>errors.push('4x2: '+e.message));
 await grid.goto(url);await waitReady(grid);await openSheet(grid,4,2);
 check('4×2 sheet retains eight independent editable crop rectangles',await grid.evaluate(()=>
  __frameAnimTest.extract.frames.length===8&&__frameAnimTest.extract.frames[7].rect.y===32));
 await grid.locator('#extractCommit').click();
 await grid.waitForFunction(()=>__frameAnimTest.state.frames.length===8);
 check('4×2 Auto Extract can add eight complete frames',await grid.evaluate(()=>
  __frameAnimTest.state.frames.length===8));
 await grid.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mobile.goto(url);await waitReady(mobile);await openSheet(mobile,4,1);
 check('mobile Auto Extract panel displays Crop and touch-compatible canvas',await mobile.locator('#extractCanvas').isVisible()&&await mobile.locator('#extractW').isVisible());
 await mobile.locator('#extractCommit').click();await mobile.waitForFunction(()=>__frameAnimTest.state.frames.length===4);
 check('mobile review commits four frames successfully',await mobile.evaluate(()=>__frameAnimTest.state.frames.length===4));
 await mobile.close();
 const offline=await browser.newPage();
 offline.on('pageerror',e=>errors.push('offline: '+e.message));
 await offline.goto(pathToFileURL(path.join(root,'art-test/bunny-rig-studio/frame-animation.html')).href);
 await waitReady(offline);await openSheet(offline,8,1);
 await offline.locator('#extractCommit').click();
 await offline.waitForFunction(()=>__frameAnimTest.state.frames.length===8);
 check('review workshop and extraction work fully offline',errors.length===0);
 await offline.close();
}catch(e){console.error(e.stack||e,errors);process.exitCode=1}
finally{await browser.close();await server.close()}
