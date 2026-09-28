// Check every Guide and Patch Notes entry uses a padded card INSIDE the
// scrollable modal body, both on desktop and in the narrow mobile viewport.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4258,strictPort:false}});
const browser=await chromium.launch({headless:true});
const checks=(name,ok)=>{if(!ok)throw Error('FAIL: '+name);console.log('PASS '+name);};
const errors=[];
try{
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:name==='mobile',hasTouch:name==='mobile'});
  page.on('pageerror',e=>errors.push(name+': '+e.message));
  await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
  await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
  if(await page.locator('#waterfallGuidePanel').isVisible())await page.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().click();
  if(name==='mobile'){await page.locator('[data-mobile-open="village"]').click();await page.locator('.mobile-village-shortcuts [data-open-guide]').click();}
  else await page.locator('#help [data-open-guide]').click();
  const guide=await page.locator('#guidePanel').evaluate(el=>{
    const body=el.querySelector('.bc-guide-body'),cards=[...el.querySelectorAll('.bc-guide-card')],first=cards[0];
    const b=el.getBoundingClientRect(),inner=body.getBoundingClientRect(),firstBox=first.getBoundingClientRect();
    return {
      count:cards.length,
      firstTitle:first.querySelector('h3')?.textContent,
      everyInside:cards.every(card=>card.parentElement===body),
      firstPadded:parseFloat(getComputedStyle(first).paddingLeft)>=10,
      firstFramed:getComputedStyle(first).borderTopStyle==='solid',
      cardGap:getComputedStyle(body).gap,
      scrollable:body.scrollHeight>body.clientHeight,
      withinModal:firstBox.top>=inner.top-1&&firstBox.left>=inner.left-1,
      modalFits:b.left>=-1&&b.right<=innerWidth+1&&b.top>=-1&&b.bottom<=innerHeight+1,
      noHorizontalOverflow:body.scrollWidth<=body.clientWidth+2
    };
  });
  checks(name+' every Guide section (including Ancient Dragon) is an in-scroll card',guide.count>=10&&guide.everyInside&&/Ancient Dragon/.test(guide.firstTitle));
  checks(name+' first Guide card framed and padded',guide.firstFramed&&guide.firstPadded&&guide.withinModal);
  checks(name+' Guide scrolls without horizontal clipping and modal fits viewport',guide.scrollable&&guide.noHorizontalOverflow&&guide.modalFits);
  await page.locator('#guidePanel [data-modal-close]').click();
  if(name==='mobile'){await page.locator('[data-mobile-open="village"]').click();await page.locator('.mobile-village-shortcuts [data-open-patch-notes]').click();}
  else await page.locator('#help [data-open-patch-notes]').click();
  const patch=await page.locator('#patchNotesPanel').evaluate(el=>{
    const body=el.querySelector('.bc-patch-notes'),cards=[...el.querySelectorAll('.bc-patch-card')],first=cards[0];
    const box=el.getBoundingClientRect();
    return {count:cards.length,everyInside:cards.every(c=>c.parentElement===body),
     firstPadded:parseFloat(getComputedStyle(first).paddingLeft)>=10,
     scrollable:body.scrollHeight>body.clientHeight,
     modalFits:box.left>=-1&&box.right<=innerWidth+1&&box.top>=-1&&box.bottom<=innerHeight+1,
     noHorizontalOverflow:body.scrollWidth<=body.clientWidth+2};
  });
  checks(name+' all Patch Notes remain inside matching framed cards',patch.count>=10&&patch.everyInside&&patch.firstPadded);
  checks(name+' Patch Notes scroll without overflow',patch.scrollable&&patch.modalFits&&patch.noHorizontalOverflow);
  await page.close();
 }
 checks('no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
