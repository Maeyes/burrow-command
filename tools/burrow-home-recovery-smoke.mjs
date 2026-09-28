import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4210,strictPort:false}});
const browser=await chromium.launch({headless:true}),errors=[];
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{if(!ok)throw Error('FAIL '+name);console.log('PASS '+name);};
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 const original=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;s.gold=10000;s.inventory.livingMoss=10000;d.setHomeOpen(true);
  let spot=null;for(let i=14;i<=26&&!spot;i++)for(let j=14;j<=26&&!spot;j++)if(d.checkHome('oak',i*64,j*64).ok)spot=[i*64,j*64];
  s.homeSelected='oak';d.placeHome(...spot);const obj=s.homeBuilder.placedObjects.pop();
  s.homeBuilder.recovery.push({...obj,reason:'safety-migration'});d.rebuildHomeWorld();d.renderUi();
  return {id:obj.id,spot};
 });
 await page.locator('#homePanel details.bc-home-land').last().locator('summary').click();
 await page.locator('#homePanel [data-home-recover="'+original.id+'"]').click();
 const result=await page.evaluate(spot=>{
  const s=__warren,d=__warrenDev,materials=s.inventory.livingMoss,gold=s.gold;
  const restored=d.restoreRecoveryHome(...spot),free=materials===s.inventory.livingMoss&&gold===s.gold;
  const unique=s.homeBuilder.placedObjects.length===1&&s.homeBuilder.nextId>1;
  const undone=d.undoHome(),returned=s.homeBuilder.recovery.length===1&&s.homeBuilder.placedObjects.length===0;
  return {restored,free,unique,undone,returned};
 },original.spot);
 check('Recovery Storage button selects an object for free repositioning',result.restored&&result.free&&result.unique);
 check('one-step Undo returns recovered item to storage without extra refund',result.undone&&result.returned);
 check('no browser page errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
