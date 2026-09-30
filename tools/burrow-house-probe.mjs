import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4281,strictPort:false}});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}});
page.setDefaultTimeout(15000);
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 if(await page.locator('#waterfallGuidePanel').isVisible()) await page.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().click();
 let combinations=0;
 for(const prefab of ['farmerHouse','smithHouse','mageHouse','storeHouse','barnHouse','pavilion'])for(let rotation=0;rotation<4;rotation++)for(let variant=0;variant<3;variant++){
   const result=await page.evaluate(({prefab,rotation,variant})=>{
     const {homeBuilder}=window.__warren,d=window.__warrenDev;
     homeBuilder.placedObjects=[{id:'house-probe',prefab,x:20*64,y:29*64,rotation,variant,spent:{}}];
     const start=performance.now();
     try{d.rebuildHomeWorld();const obj=window.__slice.WS.objects.find(o=>o.homeId==='house-probe');return {ok:!!obj,ms:Math.round(performance.now()-start),width:obj?.img?.width,height:obj?.img?.height,error:obj?null:'missing sprite'};}
     catch(e){return {ok:false,ms:Math.round(performance.now()-start),error:e.stack||String(e)};}
   },{prefab,rotation,variant});
   if(!result.ok)throw Error(prefab+'/'+rotation+'/'+variant+': '+result.error);
   combinations++;
   if(result.ms>500) console.warn('Slow house sprite',prefab,rotation,variant,result.ms+'ms');
 }
 console.log('PASS '+combinations+' house sprite variations generated without errors');
}catch(err){console.error(err.stack||err);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
