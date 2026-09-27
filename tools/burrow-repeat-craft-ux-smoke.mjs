// Regression: crafting again must never auto-jump to the Batch Results above the craft button.
// Runs against the built game in isolated desktop/mobile browser contexts; no real saves touched.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const srv=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4347,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[];
const check=(name,ok,detail)=>{if(!ok)throw Error('FAIL '+name+' '+JSON.stringify(detail));console.log('PASS '+name)};
try {
 for(const [width,height] of [[1440,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<500,isMobile:width<500});
  const p=await context.newPage();
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(srv.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
  await p.waitForFunction(()=>window.__warrenDev&&window.__warren?.units?.length>=2,null,{timeout:55000});
  await p.evaluate(()=>{
    const s=window.__warren;
    s.warren=11;s.gold=100000;s.night=false;s.modal='hero';
    s.forgeClass='archer';s.armorySlot='weapon';s.armoryTab='craft';s.armoryRecipe='mosswoodBow';
    s.batchReport=null;s.batchQty=1;s.autoDismantle.archer.enabled=false;
    Object.assign(s.inventory,{tier1Blueprint:15,copperOre:80,livingMoss:100,brutalSpore:100});
    window.__warrenDev.renderUi();
  });
  const craft=p.locator('#heroPanel [data-forge-craft=mosswoodBow]');
  await craft.scrollIntoViewIfNeeded();
  const before=await p.evaluate(()=>{
    const body=document.querySelector('#heroPanel .bc-armory-body'),button=body.querySelector('[data-forge-craft]');
    return {top:button.getBoundingClientRect().top,scroll:body.scrollTop};
  });
  check(width+' craft fixture ready',await craft.isEnabled(),before);
  await craft.click();
  const first=await p.evaluate(()=>{
    const s=window.__warren,body=document.querySelector('#heroPanel .bc-armory-body');
    const button=body.querySelector('[data-forge-craft]'),work=body.querySelector('.bc-armory-work'),results=body.querySelector('.bc-armory-results');
    return {made:s.batchReport?.made?.length,top:button?.getBoundingClientRect().top,
      resultsBelow:!!(work&&results&&(work.compareDocumentPosition(results)&Node.DOCUMENT_POSITION_FOLLOWING)),
      scroll:body.scrollTop,link:!!body.querySelector('[data-armory-show-results]')};
  });
  check(width+' results appended after craft controls',first.resultsBelow,first);
  check(width+' craft button stays at same screen position after first craft',Math.abs(first.top-before.top)<18, {before,first});
  check(width+' retains one-tap craft and offers an explicit results link',first.made===1&&first.link,first);
  await craft.click();
  const second=await p.evaluate(()=>{
    const s=window.__warren,body=document.querySelector('#heroPanel .bc-armory-body');
    return {made:s.batchReport?.made?.length,top:body.querySelector('[data-forge-craft]')?.getBoundingClientRect().top,
      reportCount:body.querySelectorAll('.bc-armory-results').length,scroll:body.scrollTop};
  });
  check(width+' second craft works without scrolling back',second.made===1&&second.reportCount===1&&Math.abs(second.top-before.top)<18,{before,second});
  await p.locator('#heroPanel [data-armory-show-results]').click();
  const jumped=await p.evaluate(()=>{
    const body=document.querySelector('#heroPanel .bc-armory-body');
    const results=body.querySelector('.bc-armory-results');
    const bounds=body.getBoundingClientRect();
    return {scroll:body.scrollTop,top:results.getBoundingClientRect().top,bodyTop:bounds.top,bodyBottom:bounds.bottom};
  });
  // If the results section is shorter than the viewport, scroll clamps at the
  // bottom of the sheet instead of aligning the results header to its very top.
  check(width+' results link scrolls down only when requested',jumped.scroll>second.scroll&&jumped.top>=jumped.bodyTop&&jumped.top<jumped.bodyBottom-50,{jumped,second});
  await context.close();
 }
 check('no browser page exceptions',errors.length===0,errors);
}catch(e){console.error(e.stack||e,'PAGE ERRORS',JSON.stringify(errors));process.exitCode=1;}
finally{await browser.close();await new Promise(r=>srv.httpServer.close(r));}
