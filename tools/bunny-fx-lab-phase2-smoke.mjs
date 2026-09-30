// Phase 2 FX Studio: layers, reversible object transforms, styles, effects,
// novice presets, JSON round-trips and offline browser usage.
import {createServer} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
import {PNG} from 'pngjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:0}});
await server.listen();
const url=new URL('art-test/bunny-rig-studio/fx-lab.html',server.resolvedUrls.local[0]).href;
const browser=await chromium.launch({headless:true}),errors=[];
const check=(label,ok)=>{if(!ok)throw Error('FAIL '+label);console.log('PASS '+label)};
async function ready(page){await page.waitForFunction(()=>Boolean(window.__fxLabTest?.state),null,{timeout:15000})}
async function point(page,x,y){return page.evaluate(({x,y})=>{
 const el=document.querySelector('#fxCanvas'),v=__fxLabTest.state.viewport,b=el.getBoundingClientRect();
 return {x:b.left+(v.x+(x+.5)*v.scale)*b.width/el.width,
         y:b.top+(v.y+(y+.5)*v.scale)*b.height/el.height};
},{x,y})}
async function draw(page,x,y,x2=x,y2=y){
 const a=await point(page,x,y),b=await point(page,x2,y2);
 await page.mouse.move(a.x,a.y);await page.mouse.down();
 if(x!==x2||y!==y2)await page.mouse.move(b.x,b.y,{steps:12});
 await page.mouse.up();
}
function frameRGBA(frame,w,x,y){return frame[(y*w+x)*4+3]}
function png(w=32,h=32){
 const p=new PNG({width:w,height:h});p.data.fill(0);
 for(let y=7;y<23;y++)for(let x=7;x<23;x++){const i=(y*w+x)*4;p.data.set([230,80,45,255],i)}
 return PNG.sync.write(p);
}
try{
 const page=await browser.newPage({viewport:{width:1450,height:960},acceptDownloads:true});
 page.on('pageerror',e=>errors.push('desktop: '+e.message));
 await page.goto(url);await ready(page);
 check('Basic mode opens with quick presets and hides advanced controls',
   !(await page.locator('#layerPanel').isVisible())&&!(await page.locator('#selectPanel').isVisible())&&
   await page.locator('#quickPanel').isVisible());
 await page.locator('#editorMode').selectOption('advanced');
 check('Advanced mode reveals layers, transforms and Pixel/Smooth/Hybrid styles',
   await page.locator('#layerPanel').isVisible()&&await page.locator('#selectPanel').isVisible()&&
   await page.locator('#artStyle option').count()===3);
 await draw(page,20,20,36,20);
 check('baseline painted line exists on default FX layer',
  await page.evaluate(()=>__fxLabTest.state.layers.length===1&&__fxLabTest.state.frames[0].pixels[(20*128+20)*4+3]===255));
 await page.locator('#addLayer').click();
 check('new layer is editable, selected, transparent, and retains painted lower layer',
  await page.evaluate(()=>{
   const s=__fxLabTest.state;return s.layers.length===2&&s.layers[0].frames[0][(20*128+20)*4+3]===255&&
    s.frames[0].pixels.every(n=>n===0);
  }));
 await draw(page,40,40);
 check('new layer stroke does not mutate lower layer',await page.evaluate(()=>{
  const s=__fxLabTest.state;return s.layers[0].frames[0][(40*128+40)*4+3]===0&&
   s.layers[1].frames[0][(40*128+40)*4+3]===255;
 }));
 await page.locator('#fxLayers .fxLayerRow').first().locator('button[aria-label^="Hide"]').click();
 check('visibility toggle hides active layer without deleting its pixel data',
  await page.evaluate(()=>{
   const s=__fxLabTest.state,c=__fxLabTest.outputCanvas(0),g=c.getContext('2d');
   return !s.layers[1].visible&&s.layers[1].frames[0][(40*128+40)*4+3]===255&&g.getImageData(40,40,1,1).data[3]===0;
 }));
 await page.locator('#fxLayers .fxLayerRow').first().locator('button[aria-label^="Show"]').click();
 await page.locator('#layerOpacity').fill('50');await page.locator('#layerOpacity').dispatchEvent('input');
 check('layer opacity adjusts the composite without destroying original alpha',
  await page.evaluate(()=>{
   const s=__fxLabTest.state,c=__fxLabTest.outputCanvas(0),g=c.getContext('2d');
   const alpha=g.getImageData(40,40,1,1).data[3];
   return s.layers[1].opacity===.5&&alpha>=125&&alpha<=130&&s.layers[1].frames[0][(40*128+40)*4+3]===255;
 }));
 await page.locator('#layerOpacity').fill('100');await page.locator('#layerOpacity').dispatchEvent('input');
 await page.locator('#fxLayers .fxLayerRow').first().locator('button[title="Lock"]').click();
 await draw(page,45,45);
 check('locked FX layer prevents painting',await page.evaluate(()=>__fxLabTest.state.frames[0].pixels[(45*128+45)*4+3]===0));
 await page.locator('#fxLayers .fxLayerRow').first().locator('button[title="Unlock"]').click();
 await page.locator('#layerDown').click();await page.locator('#layerUp').click();
 check('layer stack can be reordered and returns to original order',
  await page.evaluate(()=>__fxLabTest.state.layers.length===2&&__fxLabTest.state.layers[1].name.includes('FX Layer')));
 await page.locator('[data-tool="select"]').click();await draw(page,40,40);
 check('click selects a connected FX object, not the character or lower layer',await page.evaluate(()=>{
  const s=__fxLabTest.state;return !!s.selection&&s.selection.bounds.x===40&&s.selection.bounds.y===40;
 }));
 await page.locator('#selectX').fill('14');await page.locator('#selectY').fill('8');
 await page.locator('#applySelection').click();
 check('Move selection commits edited layer only and can Undo',await page.evaluate(()=>{
  const s=__fxLabTest.state;return s.frames[0].pixels[(40*128+40)*4+3]===0&&
   s.frames[0].pixels[(48*128+54)*4+3]===255&&s.layers[0].frames[0][(20*128+20)*4+3]===255;
 }));
 await page.locator('#undo').click();
 check('Undo restores moved selection to original pixel',await page.evaluate(()=>{
  const s=__fxLabTest.state;return s.frames[0].pixels[(40*128+40)*4+3]===255;
 }));
 await page.locator('[data-tool="select"]').click();await draw(page,40,40,47,50);
 check('click-and-drag commits selected artwork immediately on mouse release',
  await page.evaluate(()=>__fxLabTest.state.frames[0].pixels[(50*128+47)*4+3]===255));
 check('dragged selection moves actual pixel art',
  await page.evaluate(()=>__fxLabTest.state.frames[0].pixels[(50*128+47)*4+3]===255));
 await page.locator('#undo').click();
 await page.locator('[data-tool="select"]').click();await draw(page,40,40);
 await page.locator('#selectRotation').fill('90');await page.locator('#selectScale').fill('150');
 await page.locator('#selectFlipH').click();await page.locator('#copySelection').click();
 check('rotate, scale, flip and duplicate preserve original object',await page.evaluate(()=>{
  const s=__fxLabTest.state;return s.frames[0].pixels[(40*128+40)*4+3]===255&&
   s.frames[0].pixels.some((v,i)=>i%4===3&&v>0);
 }));
 await page.locator('[data-tool="pencil"]').click();await draw(page,68,70,70,70);
 await page.locator('[data-tool="marquee"]').click();await draw(page,64,66,74,74);
 check('marquee selects editable FX only in drawn rectangle',await page.evaluate(()=>{
  const s=__fxLabTest.state;return !!s.selection&&s.selection.bounds.x===64&&s.selection.bounds.w===11;
 }));
 await page.locator('#cancelSelection').click();
 await page.locator('#shadowOn').check();await page.locator('#glowOn').check();await page.locator('#gradientOn').check();
 await page.locator('#gradientFrom').fill('#fff6b2');await page.locator('#gradientTo').fill('#ff382d');
 check('Shadow Glow and Gradient effects enable independently on selected layer',
  await page.evaluate(()=>{
   const e=__fxLabTest.state.layers[1].effects;
   return e.shadow.enabled&&e.glow.enabled&&e.gradient.enabled&&e.gradient.from==='#fff6b2';
  }));
 const effectPNG=page.waitForEvent('download');await page.locator('#exportCurrent').click();
 const exportFile=PNG.sync.read(await fs.readFile(await (await effectPNG).path()));
 check('layer effects survive PNG composition and preserve transparent outer corners',
  exportFile.width===128&&exportFile.data[3]===0);
 await page.locator('#artStyle').selectOption('smooth');
 await page.locator('#addLayer').click();
 await page.locator('[data-tool="line"]').click();await draw(page,10,10,40,29);
 check('Smooth mode generates partially transparent anti-aliased edge pixels',
  await page.evaluate(()=>{
   const s=__fxLabTest.state;return s.style==='smooth'&&
    s.frames[0].pixels.some((v,i)=>i%4===3&&v>0&&v<255);
  }));
 await page.locator('#artStyle').selectOption('hybrid');
 check('Hybrid style remains distinct and preserves editable raster layers',
  await page.evaluate(()=>__fxLabTest.state.style==='hybrid'&&__fxLabTest.state.layers.length===3));
 await page.locator('#refPNGFiles').setInputFiles([
  {name:'wukong_1.png',mimeType:'image/png',buffer:png()},
  {name:'wukong_2.png',mimeType:'image/png',buffer:png()},
  {name:'wukong_3.png',mimeType:'image/png',buffer:png()},
  {name:'wukong_4.png',mimeType:'image/png',buffer:png()}
 ]);
 await page.waitForFunction(()=>__fxLabTest.state.reference.length===4);
 check('reference import extends every layer without losing existing FX',await page.evaluate(()=>{
  const s=__fxLabTest.state;return s.frames.length===4&&s.layers.every(l=>l.frames.length===4)&&
   s.layers[0].frames[0][(20*128+20)*4+3]===255;
 }));
 await page.locator('#autoSuggest').click();
 check('rule-based Auto Suggest chooses Staff Trail for imported Wukong character',
  await page.locator('#fxPreset').inputValue()==='staff'&&
  (await page.locator('#suggestionText').innerText()).includes('Gold Staff Trail'));
 await page.locator('#applyPreset').click();
 check('one-click preset adds a new editable multi-frame FX layer',await page.evaluate(()=>{
  const s=__fxLabTest.state,l=s.layers.at(-1);
  return s.layers.length===4&&l.name==='Gold Staff Trail'&&l.frames.length===4&&
   l.frames.every(data=>data.some((v,i)=>i%4===3&&v>0))&&l.effects.glow.enabled;
 }));
 const jsonEvent=page.waitForEvent('download');await page.locator('#saveJSON').click();
 const json=JSON.parse(await fs.readFile(await (await jsonEvent).path(),'utf8'));
 check('version 2 JSON persists four layers, style, effects and character reference',
  json.version===2&&json.style==='hybrid'&&json.layers.length===4&&
  json.layers[1].effects.gradient.enabled&&json.layers[3].frames.length===4&&json.reference.frames.length===4);
 // Selecting an object should auto-switch to its layer, and dragging should
 // move it without needing an extra Apply click.
 await page.locator('[data-tool="select"]').click();await draw(page,20,20);
 check('Select FX auto-picks the frontmost visible editable layer containing the clicked pixel',
  await page.evaluate(()=>__fxLabTest.state.activeLayerId==='main'&&!!__fxLabTest.state.selection));
 await draw(page,20,20,27,27);
 check('drag and release immediately commits the move to artwork',
  await page.evaluate(()=>__fxLabTest.state.frames[0].pixels[(27*128+27)*4+3]===255&&
    __fxLabTest.state.frames[0].pixels[(20*128+20)*4+3]===0));
 await page.keyboard.press('Control+z');
 check('FX Ctrl+Z restores moved pixels',await page.evaluate(()=>__fxLabTest.state.frames[0].pixels[(20*128+20)*4+3]===255));
 await page.keyboard.press('Control+y');
 check('FX Ctrl+Y redoes the drag',await page.evaluate(()=>__fxLabTest.state.frames[0].pixels[(27*128+27)*4+3]===255));
 await page.keyboard.press('Control+z');await page.keyboard.press('Control+Shift+z');
 check('FX Ctrl+Shift+Z also redoes the drag',await page.evaluate(()=>__fxLabTest.state.frames[0].pixels[(27*128+27)*4+3]===255));
 await page.locator('#addFrame').click();
 const countAfterAdd=await page.evaluate(()=>__fxLabTest.state.frames.length);
 await page.keyboard.press('Control+z');
 check('FX Ctrl+Z reverses frame creation, including every layer',
   await page.evaluate(n=>__fxLabTest.state.frames.length===n-1&&
     __fxLabTest.state.layers.every(l=>l.frames.length===n-1),countAfterAdd));
 await page.keyboard.press('Control+y');
 check('FX Ctrl+Y restores the newly created frame across all layers',
   await page.evaluate(n=>__fxLabTest.state.frames.length===n&&
     __fxLabTest.state.layers.every(l=>l.frames.length===n),countAfterAdd));
 await page.close();
 const reopened=await browser.newPage({viewport:{width:1450,height:960},acceptDownloads:true});
 reopened.on('pageerror',e=>errors.push('reload: '+e.message));
 await reopened.goto(url);await ready(reopened);
 await reopened.locator('#fxProjectFile').setInputFiles({name:'wukong-fx-v2.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});
 await reopened.waitForFunction(()=>__fxLabTest.state.layers.length===4&&__fxLabTest.state.reference.length===4);
 check('saved Phase2 JSON reopens all editable raster layers and layer effects',
  await reopened.evaluate(()=>{
   const s=__fxLabTest.state;return s.style==='hybrid'&&s.frames.length===4&&
    s.layers[1].effects.shadow.enabled&&s.layers[3].frames.every(data=>data.some((v,i)=>i%4===3&&v>0));
  }));
 check('Phase2 desktop browser has no uncaught errors',errors.length===0);
 await reopened.locator('#fxLayers .fxLayerRow').first().locator('.layerName').click();
 reopened.once('dialog',dialog=>dialog.accept());await reopened.locator('#mergeLayer').click();
 check('Merge Down bakes the top layer into the layer below without altering others',
  await reopened.evaluate(()=>__fxLabTest.state.layers.length===3&&
   __fxLabTest.state.layers.at(-1).frames.some(f=>f.some((v,i)=>i%4===3&&v>0))));
 await reopened.keyboard.press('Control+z');
 check('Ctrl+Z restores all FX layers after Merge Down',
  await reopened.evaluate(()=>__fxLabTest.state.layers.length===4));
 await reopened.keyboard.press('Control+y');
 check('Ctrl+Y repeats FX Merge Down',
  await reopened.evaluate(()=>__fxLabTest.state.layers.length===3));
 await reopened.close();
 const offline=await browser.newPage({viewport:{width:1450,height:960}});
 offline.on('pageerror',e=>errors.push('offline: '+e.message));
 await offline.goto(pathToFileURL(path.join(root,'art-test/bunny-rig-studio/fx-lab.html')).href);await ready(offline);
 await draw(offline,8,8);await offline.locator('[data-tool="select"]').click();await draw(offline,8,8);
 check('Select FX is usable in Basic mode as a direct one-click object selector',
  await offline.evaluate(()=>!!__fxLabTest.state.selection));
 await offline.locator('#applyPreset').click();
 check('Phase2 Quick Presets also work offline with local HTML file',
  await offline.evaluate(()=>__fxLabTest.state.layers.length===2));
 await offline.close();
}catch(error){console.error(error.stack||error,errors);process.exitCode=1}
finally{await browser.close();await server.close()}
