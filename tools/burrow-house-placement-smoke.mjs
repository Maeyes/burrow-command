// House sprite smoke: each house is actually bought/placed and then removed,
// with a reload check of the wizard house. Uses an isolated browser profile.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4292,strictPort:false}});
const browser=await chromium.launch({headless:true}),errors=[];
const check=(label,ok)=>{if(!ok)throw Error('FAIL '+label);console.log('PASS '+label);};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push('desktop '+e.message));
 const url=server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html';
 const ready=()=>page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 await page.goto(url,{waitUntil:'domcontentloaded'});await ready();
 if(await page.locator('#waterfallGuidePanel').isVisible())await page.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().click();
 const setup=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;
  s.gold=999999;s.inventory.livingMoss=999999;d.setHomeOpen(true);
  const deeds=['south1','south2','south3','east1','east2','east3','west1','west2','west3'].map(id=>d.buyHomePlot(id));
  s.homeCategory='houses';d.renderUi();
  return {deeds,n:s.homeBuilder.ownedPlots.length};
 });
 check('test settlement purchases legal house plots',setup.deeds.every(Boolean)&&setup.n===10);
 await page.locator('#homePanel [data-home-category="houses"]').click();
 await page.locator('#homePanel [data-home-type="smithHouse"]').click();
 check('blacksmith house is selectable from the real build UI',await page.evaluate(()=>__warren.homeSelected==='smithHouse'));
 const homes=['farmerHouse','smithHouse','storeHouse','barnHouse','pavilion','mageHouse'];
 for(const prefab of homes){
  const result=await page.evaluate(prefab=>{
   const s=__warren,d=__warrenDev;s.homeSelected=prefab;s.homeAction='place';s.homeRotation=prefab==='mageHouse'?1:0;s.homeVariant=prefab==='mageHouse'?2:0;
   let spot=null;
   for(let j=8;j<=32&&!spot;j++)for(let i=8;i<=32&&!spot;i++){
    if(d.checkHome(prefab,i*64,j*64,s.homeRotation).ok)spot={x:i*64,y:j*64};
   }
   if(!spot)return {ok:false,reason:'no legal spot for '+prefab};
   const before=s.gold;
   const placed=d.placeHome(spot.x,spot.y);
   const house=s.homeBuilder.placedObjects.find(o=>o.prefab===prefab);
   const object=house&&__slice.WS.objects.find(o=>o.homeId===house.id);
   s.homeHover=spot;
   return {ok:placed&&!!house&&!!object,spot,charged:s.gold<before,
    img:object?{w:object.img.width,h:object.img.height}:null,
    id:house?.id,prefab:house?.prefab,variant:house?.variant};
  },prefab);
  check('place '+prefab+' through the real Home Builder',result.ok&&result.charged&&result.img.w>80&&result.img.h>80);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  check('hover preview does not crash '+prefab,errors.length===0);
  if(prefab!=='mageHouse'){
   const removed=await page.evaluate(id=>{const d=__warrenDev;__warren.homeHover=null;return d.demolishHome(id);},result.id);
   check('demolish '+prefab+' after rendering',removed);
  }
 }
 await page.evaluate(()=>{__warren.homeHover=null;__warrenDev.save();});
 await page.reload({waitUntil:'domcontentloaded'});await ready();
 const saved=await page.evaluate(()=>{
  const h=__warren.homeBuilder.placedObjects.find(o=>o.prefab==='mageHouse');
  return {saved:!!h,variant:h?.variant,rot:h?.rotation,
   rendered:!!(h&&__slice.WS.objects.find(o=>o.homeId===h.id)),recovered:__warren.homeBuilder.recovery.some(o=>o.prefab==='mageHouse')};
 });
 check('wizard house with rotated roof survives save/reload without recovery',saved.saved&&saved.rendered&&saved.variant===2&&saved.rot===1&&!saved.recovered);
 check('no desktop browser exceptions when placing six modular homes',errors.length===0);
 await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',e=>errors.push('mobile '+e.message));
 await mobile.goto(url,{waitUntil:'domcontentloaded'});
 await mobile.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 if(await mobile.locator('#waterfallGuidePanel').isVisible())await mobile.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().click();
 await mobile.evaluate(()=>{__warrenDev.setHomeOpen(true);__warren.homeCategory='houses';__warrenDev.renderUi();});
 const mobileTarget=mobile.locator('#homePanel [data-home-type="mageHouse"]');
 const mobilePlacement=await mobileTarget.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('#homePanel')?.getBoundingClientRect();return {visible:getComputedStyle(el).display,rect:{x:r.x,y:r.y,w:r.width,h:r.height},panel:{x:p?.x,y:p?.y,w:p?.width,h:p?.height}};});
 console.log('mobile house button',JSON.stringify(mobilePlacement));
 await mobileTarget.evaluate(el=>el.click());
 await mobile.evaluate(()=>{__warren.homeHover={x:20*64,y:29*64};});
 await mobile.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 check('mobile house-selection and preview do not freeze rendering',await mobile.evaluate(()=>__warren.homeSelected==='mageHouse')&&errors.length===0);
 await mobile.close();
}catch(error){console.error(error.stack||error,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
