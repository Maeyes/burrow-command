// Bunny FX Lab: real-browser pixel drawing, animated timeline, alpha exports,
// JSON round-trip, character reference isolation, mobile and offline file mode.
import {createServer} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
import {PNG} from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:0}});
await server.listen();
const url=new URL('art-test/bunny-rig-studio/fx-lab.html',server.resolvedUrls.local[0]).href;
const browser=await chromium.launch({headless:true}),errors=[];
function check(label,truth){if(!truth)throw Error('FAIL '+label);console.log('PASS '+label)}
const pixel=(img,x,y)=>Array.from(img.data.subarray((y*img.width+x)*4,(y*img.width+x)*4+4));
function character(color=[230,60,30,255]){
 const png=new PNG({width:16,height:16});png.data.fill(0);
 for(let y=6;y<12;y++)for(let x=4;x<12;x++)png.data.set(color,(y*16+x)*4);
 return PNG.sync.write(png);
}
const body=character(),bodySrc='data:image/png;base64,'+body.toString('base64');
function reference(count=3){return {format:'bunny-frame-animator',version:1,name:'test-wukong',
 fps:12,cell:{width:128,height:128},frames:Array.from({length:count},(_,i)=>({
  src:bodySrc,name:'wukong_'+(i+1),hold:1,offsetX:0,offsetY:0
 }))}}
function wideSheet(cols=4,rows=1,cellW=600,cellH=700){
 const p=new PNG({width:cols*cellW,height:rows*cellH});p.data.fill(0);
 for(let i=0;i<cols*rows;i++){
  const dx=i%cols*cellW,dy=Math.floor(i/cols)*cellH;
  for(let y=120;y<cellH-90;y++)for(let x=120;x<cellW-120;x++){
   const k=((dy+y)*p.width+dx+x)*4;
   p.data[k]=220;p.data[k+1]=30+i*10;p.data[k+2]=60;p.data[k+3]=255;
  }
 }
 return PNG.sync.write(p);
}
async function ready(page){await page.waitForFunction(()=>Boolean(window.__fxLabTest?.state),null,{timeout:15000})}
async function canvasPoint(page,x,y){
 return page.evaluate(({x,y})=>{
  const el=document.getElementById('fxCanvas'),v=window.__fxLabTest.state.viewport,b=el.getBoundingClientRect();
  return {x:b.left+(v.x+(x+.5)*v.scale)*b.width/el.width,
          y:b.top+(v.y+(y+.5)*v.scale)*b.height/el.height};
 },{x,y});
}
async function draw(page,x,y,x1=x,y1=y){
 const a=await canvasPoint(page,x,y),b=await canvasPoint(page,x1,y1);
 await page.mouse.move(a.x,a.y);await page.mouse.down();
 if(x1!==x||y1!==y)await page.mouse.move(b.x,b.y,{steps:5});
 await page.mouse.up();
}
async function alphaAt(page,x,y,frame=0){
 return page.evaluate(({x,y,frame})=>{
  const s=window.__fxLabTest.state;
  return s.frames[frame].pixels[(y*s.width+x)*4+3];
 },{x,y,frame});
}
try{
 const page=await browser.newPage({viewport:{width:1450,height:960},acceptDownloads:true});
 page.on('pageerror',e=>errors.push('desktop: '+e.message));
 await page.goto(url);await ready(page);
 check('FX Lab opens in same Studio navigation',await page.locator('nav a.active[href="./fx-lab.html"]').isVisible());
 check('defaults to editable transparent 128×128 single frame',await page.evaluate(()=>{
  const s=window.__fxLabTest.state;return s.width===128&&s.height===128&&s.frames.length===1&&s.frames[0].pixels.every(v=>v===0);
 }));
 await draw(page,10,10);
 check('pencil draws one opaque pixel on isolated VFX layer',(await alphaAt(page,10,10))===255&&(await alphaAt(page,11,10))===0);
 await page.locator('[data-tool="line"]').click();await draw(page,20,20,40,20);
 check('Line tool renders continuous pixel line',(await alphaAt(page,20,20))===255&&(await alphaAt(page,30,20))===255&&(await alphaAt(page,40,20))===255);
 await page.locator('[data-tool="circle"]').click();await draw(page,60,60,80,80);
 check('Circle tool draws an outline and keeps center empty',(await alphaAt(page,80,70))===255&&(await alphaAt(page,70,70))===0);
 await page.locator('[data-tool="fill"]').click();await draw(page,70,70);
 check('Fill tool colors only inside closed circle',(await alphaAt(page,70,70))===255&&(await alphaAt(page,100,100))===0);
 await page.locator('#undo').click();
 check('Undo removes flood fill without damaging outline',(await alphaAt(page,70,70))===0&&(await alphaAt(page,80,70))===255);
 await page.locator('#redo').click();
 check('Redo restores flood fill',(await alphaAt(page,70,70))===255);
 await page.locator('#fxColor').fill('#ff0033');
 await page.locator('[data-tool="picker"]').click();await draw(page,10,10);
 check('Color picker samples original FX color',await page.locator('#fxColor').inputValue()==='#ffd16b');
 await page.locator('[data-tool="eraser"]').click();await draw(page,10,10);
 check('Eraser removes alpha without affecting other FX pixels',(await alphaAt(page,10,10))===0&&(await alphaAt(page,30,20))===255);
 await page.locator('#undo').click();
 check('Eraser stroke undo restores the original pixel',(await alphaAt(page,10,10))===255);
 await page.locator('#duplicateFrame').click();
 check('Duplicate Frame keeps art exactly on next timeline frame',await page.evaluate(()=>{
  const s=__fxLabTest.state;return s.frames.length===2&&s.current===1&&
   s.frames[0].pixels.every((v,i)=>v===s.frames[1].pixels[i]);
 }));
 await page.locator('#addFrame').click();
 check('Blank Frame is transparent and appended after selection',await page.evaluate(()=>{
  const s=__fxLabTest.state;return s.frames.length===3&&s.frames[2].pixels.every(v=>v===0);
 }));
 await page.locator('#hold').fill('2');await page.locator('#hold').press('Tab');
 check('per-frame Hold duration is editable',await page.evaluate(()=>__fxLabTest.state.frames[2].hold===2));
 await page.locator('#moveLeft').click();await page.locator('#moveRight').click();
 check('frame reorder buttons preserve frame count and selection',await page.evaluate(()=>__fxLabTest.state.frames.length===3&&__fxLabTest.state.current===2));
 await page.locator('#fps').fill('12');await page.locator('#fps').press('Tab');
 await page.locator('#play').click();
 await page.waitForFunction(()=>__fxLabTest.state.playing&&__fxLabTest.state.current!==2,null,{timeout:5000});
 await page.locator('#play').click();
 check('timeline Play/Pause advances at configured FPS',await page.evaluate(()=>!__fxLabTest.state.playing));
 const exportPromise=page.waitForEvent('download');await page.locator('#exportPNG').click();
 const exported=PNG.sync.read(await fs.readFile(await (await exportPromise).path()));
 check('FX-only sprite sheet export is transparent and correctly ordered',
  exported.width===384&&exported.height===128&&pixel(exported,0,0)[3]===0&&
  pixel(exported,10,10)[3]===255&&pixel(exported,138,10)[3]===255&&pixel(exported,266,10)[3]===0);
 await page.locator('#timeline .frame').nth(0).click();
 const singlePromise=page.waitForEvent('download');await page.locator('#exportCurrent').click();
 const single=PNG.sync.read(await fs.readFile(await (await singlePromise).path()));
 check('individual frame PNG keeps true alpha',single.width===128&&single.height===128&&pixel(single,0,0)[3]===0&&pixel(single,10,10)[3]===255);
 await page.locator('#refJSONFile').setInputFiles({
  name:'wukong.bunny-frames.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(reference()))
 });
 await page.waitForFunction(()=>__fxLabTest.state.reference.length===3);
 check('Frame Animator JSON imports without changing existing FX pixels',await page.evaluate(()=>{
  const s=__fxLabTest.state;return s.reference.length===3&&s.width===128&&s.frames.length===3&&s.frames[0].pixels[(10*128+10)*4+3]===255;
 }));
 await page.locator('#combineExport').check();
 const combinedPromise=page.waitForEvent('download');await page.locator('#exportPNG').click();
 const composite=PNG.sync.read(await fs.readFile(await (await combinedPromise).path()));
 check('optional combined export renders character UNDER the separate FX layer',
  pixel(composite,64,120)[0]===230&&pixel(composite,64,120)[3]===255&&pixel(composite,10,10)[3]===255);
 await page.locator('#combineExport').uncheck();
 const purePromise=page.waitForEvent('download');await page.locator('#exportPNG').click();
 const pure=PNG.sync.read(await fs.readFile(await (await purePromise).path()));
 check('FX-only export leaves character source out when combined export is off',
  pixel(pure,64,120)[3]===0&&pixel(pure,10,10)[3]===255);
 await page.locator('#loop').selectOption('0');
 const gifPromise=page.waitForEvent('download');await page.locator('#exportGIF').click();
 const gifPath=await (await gifPromise).path(),gif=await fs.readFile(gifPath);
 const decoded=spawnSync('python',['-c','from PIL import Image;import sys;im=Image.open(sys.argv[1]);print("FRAMES",im.n_frames);assert im.n_frames==3 and im.size==(128,128)',gifPath],{encoding:'utf8',timeout:10000});
 check('GIF decoder accepts timed FX animation and respects non-loop setting',
  decoded.status===0&&gif.subarray(0,6).toString()==='GIF89a'&&!gif.includes(Buffer.from('NETSCAPE2.0')));
 const jsonPromise=page.waitForEvent('download');await page.locator('#saveJSON').click();
 const saved=JSON.parse(await fs.readFile(await (await jsonPromise).path(),'utf8'));
 check('editable FX JSON stores frames, hold and independent character reference',
  saved.format==='bunny-fx-lab'&&saved.frames.length===3&&saved.frames[2].hold===2&&saved.reference.frames.length===3);
 check('desktop FX workflow produces no browser exceptions',errors.length===0);
 await page.close();
 const reload=await browser.newPage({acceptDownloads:true});
 reload.on('pageerror',e=>errors.push('reload: '+e.message));
 await reload.goto(url);await ready(reload);
 await reload.locator('#fxProjectFile').setInputFiles({name:'round-trip.bunny-fx.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await reload.waitForFunction(()=>__fxLabTest.state.frames.length===3&&__fxLabTest.state.reference.length===3);
 check('saved JSON reopens complete editable FX project without flattening character art',
  await reload.evaluate(()=>__fxLabTest.state.frames[0].pixels[(10*128+10)*4+3]===255&&
    __fxLabTest.state.frames[2].hold===2&&__fxLabTest.state.reference.length===3));
 await reload.close();

 // Regression: the actual Wukong workflow imports one high-resolution 4x1
 // sheet, not four files, and creates editable FX frames at display resolution.
 const large=await browser.newPage({viewport:{width:1450,height:960},acceptDownloads:true});
 large.on('pageerror',e=>errors.push('large-reference: '+e.message));
 await large.goto(url);await ready(large);
 await large.locator('#referenceGrid').selectOption('4x1');
 await large.locator('#refSheetFile').setInputFiles({name:'wukong-hit-4x1.png',mimeType:'image/png',buffer:wideSheet()});
 await large.waitForFunction(()=>__fxLabTest.state.reference.length===4);
 check('large 2400x700 4x1 sheet imports all four Wukong-like frames without rejection',
  await large.evaluate(()=>__fxLabTest.state.reference.length===4&&__fxLabTest.state.reference[0].img.width===600&&
  __fxLabTest.state.referenceCell.width===600&&__fxLabTest.state.width===439&&__fxLabTest.state.height===512));
 check('import success is clearly visible next to Reference controls',
  (await large.locator('#refFeedback').innerText()).includes('โหลด 4 เฟรม')&&
  await large.locator('#timeline .frame').count()===4);
 check('large imported character actually appears in canvas and timeline preview',
  await large.evaluate(()=>{
   const cv=__fxLabTest.outputCanvas(0,true),g=cv.getContext('2d');
   const rgba=g.getImageData(220,260,1,1).data;
   const thumb=document.querySelector('#timeline .frame img');
   return rgba[3]===255&&rgba[0]===220&&thumb?.src.startsWith('data:image/png;');
  }));
 const largeJSONPromise=large.waitForEvent('download');await large.locator('#saveJSON').click();
 const largeJSON=JSON.parse(await fs.readFile(await (await largeJSONPromise).path(),'utf8'));
 check('FX project persists original high-resolution reference and source-cell alignment',
  largeJSON.reference.cell.width===600&&largeJSON.reference.cell.height===700&&
  largeJSON.reference.frames.length===4);
 await large.locator('#refJSONFile').setInputFiles({name:'wrong-type.json',mimeType:'application/json',buffer:Buffer.from('{"format":"wrong"}')});
 await large.waitForFunction(()=>document.getElementById('refFeedback').textContent.includes('นำเข้าไม่ได้'));
 check('incorrect file displays import error beside buttons, preserving previously loaded frames',
  await large.evaluate(()=>__fxLabTest.state.reference.length===4&&
   document.getElementById('refFeedback').textContent.includes('นำเข้าไม่ได้')));
 await large.close();
 const dirty=await browser.newPage({viewport:{width:1450,height:960},acceptDownloads:true});
 dirty.on('pageerror',e=>errors.push('existing-art: '+e.message));
 await dirty.goto(url);await ready(dirty);
 await draw(dirty,10,10);
 await dirty.locator('#refSheetFile').setInputFiles({name:'wukong-walk-4x1.png',mimeType:'image/png',buffer:wideSheet()});
 await dirty.waitForFunction(()=>__fxLabTest.state.reference.length===4);
 check('importing oversized reference into existing FX auto-fits without clearing painted art',
  await dirty.evaluate(()=>{
   const s=__fxLabTest.state,c=__fxLabTest.outputCanvas(0,true),rgba=c.getContext('2d').getImageData(64,64,1,1).data;
   return s.width===128&&s.height===128&&s.frames.length===4&&
    s.frames[0].pixels[(10*128+10)*4+3]===255&&rgba[0]===220&&rgba[3]===255;
  }));
 await dirty.close();
 const standalone=await browser.newPage({viewport:{width:1450,height:960}});
 standalone.on('pageerror',e=>errors.push('large-PNG: '+e.message));
 await standalone.goto(url);await ready(standalone);
 await standalone.locator('#refPNGFiles').setInputFiles([{name:'single-large.png',mimeType:'image/png',buffer:wideSheet(1,1,1200,700)}]);
 await standalone.waitForFunction(()=>__fxLabTest.state.reference.length===1);
 check('single separate PNG over 1024px is resized for preview without losing source pixels',
  await standalone.evaluate(()=>__fxLabTest.state.reference[0].img.width===1200&&
   __fxLabTest.state.width===512&&__fxLabTest.state.referenceCell.width===1200));
 await standalone.close();
 const autodetect=await browser.newPage({viewport:{width:1450,height:960}});
 autodetect.on('pageerror',e=>errors.push('sheet-autodetect: '+e.message));
 await autodetect.goto(url);await ready(autodetect);
 autodetect.once('dialog',d=>d.accept());
 await autodetect.locator('#refPNGFiles').setInputFiles([{name:'wukong-single-wide.png',mimeType:'image/png',buffer:wideSheet()}]);
 await autodetect.waitForFunction(()=>__fxLabTest.state.reference.length===4);
 check('the existing PNG button offers 4×1 auto-slicing for a single wide sheet',
  await autodetect.evaluate(()=>__fxLabTest.state.reference.length===4&&
   __fxLabTest.state.reference[0].img.width===600));
 await autodetect.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mobile.goto(url);await ready(mobile);
 check('FX Lab has a usable responsive editor and toolbar',await mobile.locator('#fxCanvas').isVisible()&&await mobile.locator('[data-tool="pencil"]').isVisible());
 await mobile.locator('#refPNGFiles').setInputFiles([
  {name:'wukong_2.png',mimeType:'image/png',buffer:character([220,80,30,255])},
  {name:'wukong_1.png',mimeType:'image/png',buffer:body}
 ]);
 await mobile.waitForFunction(()=>__fxLabTest.state.reference.length===2);
 check('PNG frame reference import initializes two blank frames at correct native size',
  await mobile.evaluate(()=>__fxLabTest.state.width===16&&__fxLabTest.state.frames.length===2&&__fxLabTest.state.reference.length===2));
 const tap=await canvasPoint(mobile,4,4);
 await mobile.touchscreen.tap(tap.x,tap.y);
 check('mobile touch can paint a pixel directly on FX canvas',await alphaAt(mobile,4,4)===255);
 await mobile.locator('#addFrame').click();
 check('touch-sized layout supports timeline operations',await mobile.evaluate(()=>__fxLabTest.state.frames.length===3));
 await mobile.close();
 const offline=await browser.newPage({acceptDownloads:true});
 offline.on('pageerror',e=>errors.push('offline: '+e.message));
 await offline.goto(pathToFileURL(path.join(root,'art-test/bunny-rig-studio/fx-lab.html')).href);
 await ready(offline);
 await offline.locator('#refPNGFiles').setInputFiles([{name:'wukong_1.png',mimeType:'image/png',buffer:body}]);
 await offline.waitForFunction(()=>__fxLabTest.state.reference.length===1);
 const offlineDownload=offline.waitForEvent('download');await offline.locator('#exportCurrent').click();
 const offlinePNG=PNG.sync.read(await fs.readFile(await (await offlineDownload).path()));
 check('file:// FX Lab imports artwork and exports transparent PNG fully offline',
  errors.length===0&&offlinePNG.width===16&&offlinePNG.height===16&&pixel(offlinePNG,0,0)[3]===0);
 await offline.close();
}catch(e){console.error(e.stack||e,errors);process.exitCode=1}
finally{await browser.close();await server.close()}
