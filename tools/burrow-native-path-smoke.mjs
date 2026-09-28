// Native Map Editor roads replace floating Home Builder path decals.
// All tests run in an isolated browser context, never the player's actual save.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4230,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[];
const check=(label,ok)=>{if(!ok)throw Error('FAIL '+label);console.log('PASS '+label);};
let page;
const ready=()=>page.waitForFunction(()=>window.__warrenDev&&window.__slice?.WS?.ground&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:60000});
const ground=()=>page.evaluate(()=>{
 const s=__warren,scene=__slice.WS.scene,n=scene.pavedField?.n||scene.trailField?.n||160;
 const sample=(field,i,j)=>field?.d[(j*4)*n+i*4]??null;
 return {placed:s.homeBuilder.placedObjects.map(o=>({id:o.id,prefab:o.prefab,x:o.x,y:o.y,spent:o.spent})),
  overlays:__slice.WS.objects.filter(o=>o.homePrefab==='dirtPath'||o.homePrefab==='stonePath').length,
  dirt:sample(scene.trailField,15,25),
  dirtMoved:sample(scene.trailField,15,26),
  stone:sample(scene.pavedField,16,25),
  editorFields:!!scene.trailField&&!!scene.pavedField,rendererReady:!!__slice.WS.ground?.canvas};
});
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await ready();
 const setup=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;s.gold=99999;s.inventory.livingMoss=99999;
  d.setHomeOpen(true);s.homeSelected='dirtPath';s.homeCategory='paths';
  return {goodDirt:d.checkHome('dirtPath',15*64,25*64).ok,goodStone:d.checkHome('stonePath',16*64,25*64).ok};
 });
 check('path locations are valid on a clean settlement',setup.goodDirt&&setup.goodStone);
 const dirtStart=await page.evaluate(()=>__warrenDev.placeHome(15*64,25*64));
 check('placing dirt saves a paid native-ground path',dirtStart);
 await page.evaluate(()=>__warrenDev.waitHomeGround());
 let snap=await ground();
 check('dirt is painted in the actual Map Editor trail distance field',snap.dirt>0&&snap.overlays===0&&snap.rendererReady);
 const stoneStart=await page.evaluate(()=>{__warren.homeSelected='stonePath';return __warrenDev.placeHome(16*64,25*64);});
 check('stone path can be placed next to dirt path',stoneStart);
 await page.evaluate(()=>__warrenDev.waitHomeGround());
 snap=await ground();
 check('stone is painted in the native paved field, without overlay sprites',snap.editorFields&&snap.dirt>0&&snap.stone>0&&snap.overlays===0);
 const ids=snap.placed.map(o=>o.id);
 check('native-road conversion retains both path records and original receipts',snap.placed.length===2&&snap.placed.every(o=>Object.values(o.spent).length>0));
 await page.evaluate(()=>__warrenDev.save());
 await page.reload();await ready();
 snap=await ground();
 check('both native paths survive save/load and stay sprite-free',snap.dirt>0&&snap.stone>0&&snap.overlays===0&&snap.placed.length===2);
 await page.locator('#homeOpen').click();
 const moved=await page.evaluate(id=>__warrenDev.moveHome(id,15*64,26*64),ids[0]);
 check('an old saved dirt path can be moved for free',moved);
 await page.evaluate(()=>__warrenDev.waitHomeGround());
 snap=await ground();
 check('moving dirt re-bakes its old and new Map Editor road cells',snap.dirt<0&&snap.dirtMoved>0&&snap.stone>0&&snap.overlays===0);
 const undoneMove=await page.evaluate(()=>__warrenDev.undoHome());
 check('one-step Undo is still available after native repaint',undoneMove);
 await page.evaluate(()=>__warrenDev.waitHomeGround());
 snap=await ground();
 check('Undo restores the original dirt ground, not a floating decal',snap.dirt>0&&snap.dirtMoved<0&&snap.overlays===0);
 const removed=await page.evaluate(id=>__warrenDev.demolishHome(id),ids[1]);
 check('an old paid stone path can still be dismantled',removed);
 await page.evaluate(()=>__warrenDev.waitHomeGround());
 snap=await ground();
 check('dismantling removes the baked stone field without disturbing dirt',snap.stone<0&&snap.dirt>0&&snap.overlays===0);
 const restored=await page.evaluate(()=>__warrenDev.undoHome());
 await page.evaluate(()=>__warrenDev.waitHomeGround());
 snap=await ground();
 check('Undo restores stone and records without double-spending',restored&&snap.stone>0&&snap.placed.length===2);
 check('new path rendering causes no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await page?.close();await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
