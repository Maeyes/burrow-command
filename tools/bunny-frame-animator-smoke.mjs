// Real browser smoke: a user-provided 4-frame transparent strip → playable
// animation → transparent sprite-sheet PNG, animated GIF, JSON round-trip.
// Also checks a 2x2 grid, separate PNG files, touch UI and offline file mode.
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
const url=new URL('art-test/bunny-rig-studio/frame-animation.html',server.resolvedUrls.local[0]).href;
const browser=await chromium.launch({headless:true}),errors=[];
const check=(label,value)=>{if(!value)throw Error('FAIL '+label);console.log('PASS '+label)};
const makeFrame=(r,g,b)=>{
 const p=new PNG({width:16,height:16});p.data.fill(0);
 for(let y=3;y<14;y++)for(let x=3;x<13;x++){
  const n=(y*16+x)*4;p.data[n]=r;p.data[n+1]=g;p.data[n+2]=b;p.data[n+3]=255;
 }
 return PNG.sync.write(p);
};
const palette=[[255,60,60],[60,250,90],[40,140,255],[255,200,50]];
const frames=palette.map(([r,g,b])=>makeFrame(r,g,b));
const palette8=[...palette,[220,60,240],[30,230,225],[250,110,160],[155,180,70]];
const frames8=palette8.map(([r,g,b])=>makeFrame(r,g,b));
const strip=(cols,rows,images=frames)=>{
 const p=new PNG({width:16*cols,height:16*rows});p.data.fill(0);
 images.forEach((frame,index)=>{
  const decoded=PNG.sync.read(frame),dx=index%cols*16,dy=Math.floor(index/cols)*16;
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
   const src=(y*16+x)*4,dst=((dy+y)*p.width+dx+x)*4;
   decoded.data.copy(p.data,dst,src,src+4);
  }
 });
 return PNG.sync.write(p);
};
async function waitReady(page){await page.waitForFunction(()=>Boolean(window.__frameAnimTest?.state),null,{timeout:30000})}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 page.on('pageerror',e=>errors.push('desktop: '+e.message));
 await page.goto(url);await waitReady(page);
 check('Rig and Frame Animation are both reachable from navigation',await page.locator('nav a[href="./index.html"]').isVisible()&&await page.locator('nav a.active').isVisible());
 await page.locator('#sheetInput').setInputFiles({name:'bunny_walk_4.png',mimeType:'image/png',buffer:strip(4,1)});
 await page.locator('#sheetOptions:not([hidden])').waitFor();
 check('single 4-column transparent PNG strip detected as four equal cells',(await page.locator('#gridHint').innerText()).includes('4 เฟรม'));
 await page.locator('#sliceBtn').click();
 await page.waitForFunction(()=>__frameAnimTest.state.frames.length===4,null,{timeout:15000});
 const slices=await page.evaluate(()=>{
  const test=__frameAnimTest.state.frames;
  return test.map(f=>{const c=document.createElement('canvas');c.width=c.height=16;
   const g=c.getContext('2d');g.drawImage(f.img,0,0);
   return {w:f.img.width,h:f.img.height,center:[...g.getImageData(8,8,1,1).data],clear:g.getImageData(0,0,1,1).data[3]===0};
  });
 });
 check('each of four imported frames contains the expected pixels and true transparency',slices.every((f,i)=>f.w===16&&f.h===16&&f.clear&&f.center[0]===palette[i][0]&&f.center[1]===palette[i][1]&&f.center[2]===palette[i][2]&&f.center[3]===255));
 await page.locator('#cellWidth').fill('16');await page.locator('#cellHeight').fill('16');
 await page.locator('#fps').fill('8');
 await page.locator('#play').click();
 await page.waitForFunction(()=>__frameAnimTest.state.playing&&__frameAnimTest.state.current>0,null,{timeout:5000});
 await page.locator('#play').click();
 check('four-frame preview loops and Play / Pause works',await page.evaluate(()=>!__frameAnimTest.state.playing&&__frameAnimTest.state.frames.length===4));
 await page.locator('#framesList .frameRow').nth(1).locator('[data-up]').click();
 check('frame order buttons reorder without losing art',await page.evaluate(()=>__frameAnimTest.state.frames[0].name==='frame_02'&&__frameAnimTest.state.frames[1].name==='frame_01'));
 await page.locator('#framesList .frameRow').nth(0).locator('[data-down]').click();
 check('frame order can be restored',await page.evaluate(()=>__frameAnimTest.state.frames[0].name==='frame_01'));
 await page.locator('#framesList .frameRow').nth(2).click();
 await page.locator('#offsetX').fill('2');await page.locator('#offsetY').fill('-1');
 await page.locator('#hold').fill('3');await page.locator('#applyFrame').click();
 check('per-frame alignment and hold duration are retained',await page.evaluate(()=>{const f=__frameAnimTest.state.frames[2];return f.offsetX===2&&f.offsetY===-1&&f.hold===3}));
 const pngPromise=page.waitForEvent('download');await page.locator('#exportPNG').click();
 const png=PNG.sync.read(await fs.readFile(await (await pngPromise).path()));
 check('exported game sprite sheet is 4×1 cells and keeps alpha transparent',png.width===64&&png.height===16&&png.data[3]===0&&png.data[(8*64+8)*4+3]===255);
 const gifPromise=page.waitForEvent('download');await page.locator('#exportGIF').click();
 const gifPath=await (await gifPromise).path(),gifBuffer=await fs.readFile(gifPath);
 check('animated GIF export uses GIF89a',gifBuffer.subarray(0,6).toString()==='GIF89a'&&gifBuffer.length>100);
 const decode=spawnSync('python',['-c','from PIL import Image;import sys;im=Image.open(sys.argv[1]);print("GIF_FRAMES",im.n_frames,"GIF_SIZE",im.size,"DURATIONS",[next((im.seek(i),im.info.get("duration"))[1] for _ in [0]) for i in range(im.n_frames)]);assert im.n_frames==4 and im.size==(16,16)',gifPath],{encoding:'utf8',timeout:10000});
 check('standard Pillow GIF decoder reads all four timed animation frames',decode.status===0&&decode.stdout.includes('GIF_FRAMES 4'));
 const savePromise=page.waitForEvent('download');await page.locator('#saveJSON').click();
 const project=JSON.parse(await fs.readFile(await (await savePromise).path(),'utf8'));
 check('animation project JSON embeds the PNG pixels and frame offsets',project.frames.length===4&&project.frames[2].offsetX===2&&project.frames[2].hold===3&&project.frames.every(f=>f.src.startsWith('data:image/png;')));
 await page.locator('#demoFrames').click();await page.waitForFunction(()=>__frameAnimTest.state.frames[0]?.name==='bunny_1');
 await page.locator('#projectInput').setInputFiles({name:'roundtrip.bunny-frames.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await page.waitForFunction(()=>__frameAnimTest.state.frames[2]?.offsetX===2);
 check('save/load reopens all four original images, FPS and individual hold settings',await page.evaluate(()=>__frameAnimTest.state.frames.length===4&&__frameAnimTest.state.frames[2].hold===3&&document.getElementById('fps').value==='8'));
 // Consistent keyboard history across frame edits, deletions, settings and imports.
 const initialCount=await page.evaluate(()=>__frameAnimTest.state.frames.length);
 await page.locator('#framesList .frameRow').first().locator('[data-remove]').click();
 check('Frame delete is undoable',await page.evaluate(n=>__frameAnimTest.state.frames.length===n-1,initialCount));
 await page.keyboard.press('Control+z');
 check('Ctrl+Z restores the deleted frame',await page.evaluate(n=>__frameAnimTest.state.frames.length===n,initialCount));
 await page.keyboard.press('Control+y');
 check('Ctrl+Y repeats deletion',await page.evaluate(n=>__frameAnimTest.state.frames.length===n-1,initialCount));
 await page.keyboard.press('Control+z');await page.keyboard.press('Control+Shift+z');
 check('Ctrl+Shift+Z is an alternative Redo',await page.evaluate(n=>__frameAnimTest.state.frames.length===n-1,initialCount));
 await page.keyboard.press('Control+z');
 const oldOffset=await page.evaluate(()=>__frameAnimTest.state.frames[0].offsetX);
 await page.locator('#framesList .frameRow').first().click();
 await page.locator('#offsetX').fill('9');await page.locator('#applyFrame').click();
 await page.keyboard.press('Control+z');
 check('Ctrl+Z restores an inspector alignment edit',await page.evaluate(v=>__frameAnimTest.state.frames[0].offsetX===v,oldOffset));
 await page.locator('#fps').fill('13');await page.locator('#fps').press('Tab');
 await page.keyboard.press('Control+z');
 check('Ctrl+Z restores animation FPS',await page.locator('#fps').inputValue()==='8');
 await page.keyboard.press('Control+y');
 check('Ctrl+Y restores animation FPS change',await page.locator('#fps').inputValue()==='13');
 await page.keyboard.press('Control+z');
 check('desktop has no uncaught browser errors',errors.length===0);
 await page.close();

 const gridPage=await browser.newPage({viewport:{width:1100,height:900},acceptDownloads:true});
 gridPage.on('pageerror',e=>errors.push('2x2: '+e.message));
 await gridPage.goto(url);await waitReady(gridPage);
 await gridPage.locator('#sheetInput').setInputFiles({name:'4-grid.png',mimeType:'image/png',buffer:strip(2,2)});
 await gridPage.locator('#sheetOptions:not([hidden])').waitFor();
 await gridPage.locator('[data-grid="2x2"]').click();await gridPage.locator('#sliceBtn').click();
 await gridPage.waitForFunction(()=>__frameAnimTest.state.frames.length===4);
 check('2×2 sprite-sheet layout cuts all four rows/columns correctly',await gridPage.evaluate(()=>__frameAnimTest.state.frames.every(f=>f.img.width===16&&f.img.height===16)));
 await gridPage.locator('#clearFrames').evaluate(el=>{window.confirm=()=>true;el.click()});
 await gridPage.waitForFunction(()=>__frameAnimTest.state.frames.length===0);
 await gridPage.locator('#sheetInput').setInputFiles({name:'bunny-8-horizontal.png',mimeType:'image/png',buffer:strip(8,1,frames8)});
 await gridPage.locator('#sheetOptions:not([hidden])').waitFor();
 await gridPage.locator('[data-grid="8x1"]').click();
 check('8×1 preset selects eight horizontal cells',(await gridPage.locator('#gridHint').innerText()).includes('8 เฟรม')&&await gridPage.locator('#cols').inputValue()==='8'&&await gridPage.locator('#rows').inputValue()==='1');
 await gridPage.locator('#sliceBtn').click();
 await gridPage.waitForFunction(()=>__frameAnimTest.state.frames.length===8);
 const eight=await gridPage.evaluate(()=>__frameAnimTest.state.frames.map(f=>{
  const c=document.createElement('canvas');c.width=c.height=16;
  const g=c.getContext('2d');g.drawImage(f.img,0,0);
  return {size:[f.img.width,f.img.height],center:[...g.getImageData(8,8,1,1).data],transparent:g.getImageData(0,0,1,1).data[3]===0};
 }));
 check('single 8-frame PNG splits into eight complete, correctly ordered transparent frames',eight.every((f,i)=>f.size[0]===16&&f.size[1]===16&&f.transparent&&f.center[0]===palette8[i][0]&&f.center[1]===palette8[i][1]&&f.center[2]===palette8[i][2]&&f.center[3]===255));
 await gridPage.locator('#cellWidth').fill('16');await gridPage.locator('#cellHeight').fill('16');
 await gridPage.locator('#exportColumns').fill('8');
 const png8Promise=gridPage.waitForEvent('download');await gridPage.locator('#exportPNG').click();
 const png8=PNG.sync.read(await fs.readFile(await (await png8Promise).path()));
 check('eight frames export as one 8×1 transparent Sprite Sheet PNG',png8.width===128&&png8.height===16&&png8.data[3]===0&&png8.data[(8*128+120)*4+3]===255);
 const gif8Promise=gridPage.waitForEvent('download');await gridPage.locator('#exportGIF').click();
 const gif8=await (await gif8Promise).path();
 const decode8=spawnSync('python',['-c','from PIL import Image;import sys;im=Image.open(sys.argv[1]);assert im.n_frames==8 and im.size==(16,16);print("GIF_FRAMES",im.n_frames)',gif8],{encoding:'utf8',timeout:10000});
 check('eight-frame Animated GIF plays in a standard image decoder',decode8.status===0&&decode8.stdout.includes('GIF_FRAMES 8'));
 const json8Promise=gridPage.waitForEvent('download');await gridPage.locator('#saveJSON').click();
 const json8=JSON.parse(await fs.readFile(await (await json8Promise).path(),'utf8'));
 check('eight imported frames save together in one editable JSON project',json8.frames.length===8&&json8.frames.every(f=>f.src.startsWith('data:image/png;')));
 await gridPage.locator('#clearFrames').evaluate(el=>{window.confirm=()=>true;el.click()});
 await gridPage.waitForFunction(()=>__frameAnimTest.state.frames.length===0);
 await gridPage.locator('#sheetInput').setInputFiles({name:'bunny-8-4x2.png',mimeType:'image/png',buffer:strip(4,2,frames8)});
 await gridPage.locator('#sheetOptions:not([hidden])').waitFor();
 await gridPage.locator('[data-grid="4x2"]').click();
 check('4×2 preset selects an eight-frame grid',await gridPage.locator('#cols').inputValue()==='4'&&await gridPage.locator('#rows').inputValue()==='2'&&(await gridPage.locator('#gridHint').innerText()).includes('8 เฟรม'));
 await gridPage.locator('#sliceBtn').click();
 await gridPage.waitForFunction(()=>__frameAnimTest.state.frames.length===8);
 check('4×2 grid exports all eight frames in row-major image order',await gridPage.evaluate(()=>{
  const colors=[[255,60,60],[60,250,90],[40,140,255],[255,200,50],[220,60,240],[30,230,225],[250,110,160],[155,180,70]];
  return __frameAnimTest.state.frames.every((f,i)=>{
   const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');g.drawImage(f.img,0,0);
   const pixel=g.getImageData(8,8,1,1).data;
   return pixel[0]===colors[i][0]&&pixel[1]===colors[i][1]&&pixel[2]===colors[i][2]&&pixel[3]===255;
  });
 }));
 // AI-generated sheets can be a pixel wider/taller than the grid: the cutter
 // must cover every original pixel once, without resampling or dropping alpha.
 const odd=new PNG({width:65,height:33});odd.data.fill(0);
 const even=PNG.sync.read(strip(4,2,frames8));
 for(let y=0;y<32;y++)even.data.copy(odd.data,y*odd.width*4,y*even.width*4,(y+1)*even.width*4);
 odd.data.set([12,225,200,255],(32*odd.width+64)*4);
 await gridPage.locator('#clearFrames').evaluate(el=>{window.confirm=()=>true;el.click()});
 await gridPage.waitForFunction(()=>__frameAnimTest.state.frames.length===0);
 await gridPage.locator('#sheetInput').setInputFiles({name:'ai-generated-65x33.png',mimeType:'image/png',buffer:PNG.sync.write(odd)});
 await gridPage.locator('#sheetOptions:not([hidden])').waitFor();
 await gridPage.locator('[data-grid="4x2"]').click();
 check('uneven 65×33 PNG shows valid eight-cell grid and 1px size warning',
  (await gridPage.locator('#gridHint').innerText()).includes('8 เฟรม')&&(await gridPage.locator('#gridHint').innerText()).includes('1px'));
 await gridPage.locator('#sliceBtn').click();
 await gridPage.waitForFunction(()=>__frameAnimTest.state.frames.length===8);
 check('uneven 65×33 PNG retains all edge pixels and alpha with no scaling',await gridPage.evaluate(()=>{
  const frames=__frameAnimTest.state.frames;
  const area=frames.reduce((sum,f)=>sum+f.img.width*f.img.height,0);
  const last=frames[7],canvas=document.createElement('canvas');canvas.width=last.img.width;canvas.height=last.img.height;
  const g=canvas.getContext('2d');g.drawImage(last.img,0,0);
  const lastPixel=[...g.getImageData(canvas.width-1,canvas.height-1,1,1).data];
  return area===65*33&&frames[0].img.width===16&&frames[0].img.height===17&&
   lastPixel.join(',')==='12,225,200,255';
 }));
 await gridPage.locator('#clearFrames').evaluate(el=>{window.confirm=()=>true;el.click()});
 await gridPage.waitForFunction(()=>__frameAnimTest.state.frames.length===0);
 await gridPage.locator('#framesInput').setInputFiles([
  {name:'walk_10.png',mimeType:'image/png',buffer:frames[3]},
  {name:'walk_2.png',mimeType:'image/png',buffer:frames[1]},
  {name:'walk_1.png',mimeType:'image/png',buffer:frames[0]},
  {name:'walk_3.png',mimeType:'image/png',buffer:frames[2]}
 ]);
 await gridPage.waitForFunction(()=>__frameAnimTest.state.frames.length===4);
 check('four separate PNG files import in natural numeric order',await gridPage.evaluate(()=>__frameAnimTest.state.frames.map(f=>f.name).join(',')==='walk_1,walk_2,walk_3,walk_10'));
 await gridPage.close();

 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mobile.goto(url);await waitReady(mobile);
 await mobile.locator('#demoFrames').click();
 await mobile.waitForFunction(()=>__frameAnimTest.state.frames.length===4);
 await mobile.locator('#play').click();
 await mobile.waitForFunction(()=>__frameAnimTest.state.playing&&__frameAnimTest.state.current!==0,null,{timeout:5000});
 check('mobile 4-frame demo plays with the same transparent preview',await mobile.locator('#preview').isVisible());
 await mobile.locator('#play').click();
 await mobile.locator('#clearFrames').evaluate(el=>{window.confirm=()=>true;el.click()});
 await mobile.waitForFunction(()=>__frameAnimTest.state.frames.length===0);
 await mobile.locator('#sheetInput').setInputFiles({name:'mobile-8.png',mimeType:'image/png',buffer:strip(8,1,frames8)});
 await mobile.locator('#sheetOptions:not([hidden])').waitFor();
 await mobile.locator('[data-grid="8x1"]').click();await mobile.locator('#sliceBtn').click();
 await mobile.waitForFunction(()=>__frameAnimTest.state.frames.length===8);
 await mobile.locator('#play').click();
 await mobile.waitForFunction(()=>__frameAnimTest.state.playing&&__frameAnimTest.state.current!==0,null,{timeout:5000});
 check('mobile single-file eight-frame import and playback work with touch controls',await mobile.locator('#preview').isVisible());
 check('all responsive tests produced zero page errors',errors.length===0);
 await mobile.close();
 const offline=await browser.newPage();
 offline.on('pageerror',e=>errors.push('offline: '+e.message));
 await offline.goto(pathToFileURL(path.join(root,'art-test/bunny-rig-studio/frame-animation.html')).href);
 await waitReady(offline);
 await offline.locator('#demoFrames').click();
 await offline.waitForFunction(()=>__frameAnimTest.state.frames.length===4);
 check('frame-animation editor loads and generates demo without a server',errors.length===0);
 await offline.locator('#clearFrames').evaluate(el=>{window.confirm=()=>true;el.click()});
 await offline.waitForFunction(()=>__frameAnimTest.state.frames.length===0);
 await offline.locator('#sheetInput').setInputFiles({name:'offline-8.png',mimeType:'image/png',buffer:strip(4,2,frames8)});
 await offline.locator('#sheetOptions:not([hidden])').waitFor();
 await offline.locator('[data-grid="4x2"]').click();await offline.locator('#sliceBtn').click();
 await offline.waitForFunction(()=>__frameAnimTest.state.frames.length===8);
 check('8-frame single-PNG import works offline without any backend',errors.length===0);
 await offline.close();
}catch(e){console.error(e.stack||e,errors);process.exitCode=1}
finally{await browser.close();await server.close()}
