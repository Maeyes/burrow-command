// First-entry illustrated update guide: isolated browser contexts, no player-save changes.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4245,strictPort:false}});
const browser=await chromium.launch({headless:true});
const check=(label,ok)=>{if(!ok)throw Error('FAIL '+label);console.log('PASS '+label);};
const errors=[];
const url=server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html';
const ready=page=>page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:60000});
try{
 const desktop=await browser.newPage({viewport:{width:1440,height:900}});
 desktop.on('pageerror',e=>errors.push('desktop '+e.message));
 await desktop.goto(url);await ready(desktop);
 check('illustrated update modal appears on first game entry',await desktop.locator('#waterfallGuidePanel').isVisible()&&await desktop.locator('#modalScrim').isVisible());
 check('first-entry title describes new waterfall guide',/อัปเดตใหม่/.test(await desktop.locator('#waterfallGuideTitle').innerText()));
 check('keyboard focus starts inside the new illustrated dialog',await desktop.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().evaluate(el=>document.activeElement===el));
 const paused=await desktop.evaluate(()=>{const s=__warren,night=s.night,clock=s.clock;s.night=true;__warrenStep(.5);const result=s.clock===clock;s.night=night;return result;});
 check('reading the update does not advance a nighttime raid',paused);
 const image=desktop.locator('#waterfallGuidePanel img');
 await image.evaluate(img=>img.decode());
 check('bundled infographic PNG loads successfully',await image.evaluate(img=>img.complete&&img.naturalWidth>=1200&&img.naturalHeight>=700));
 check('infographic has an accessible and accurate source-water description',/น้ำบนช่องกลางของเนิน/.test(await image.getAttribute('alt')));
 await desktop.locator('#waterfallGuidePanel .bc-waterfall-guide-footer [data-waterfall-guide-close]').click();
 check('closing first entry stores seen marker independently of game save',await desktop.evaluate(()=>__warren.modal===null&&localStorage.getItem('burrow-command:seen:waterfall-guide-2026-09-v1')==='seen'));
 await desktop.reload();await ready(desktop);
 check('intro does not reappear on later visits for this guide revision',await desktop.locator('#waterfallGuidePanel').isHidden());
 await desktop.locator('#help [data-open-guide]').click();
 check('main in-game Guide contains permanent waterfall button',await desktop.locator('#guidePanel [data-open-waterfall-guide]').isVisible());
 await desktop.locator('#guidePanel [data-open-waterfall-guide]').click();
 check('Guide button reopens the same illustration and explanatory text',await desktop.locator('#waterfallGuidePanel').isVisible()&&/บ่อรับน้ำ/.test(await desktop.locator('#waterfallGuidePanel').innerText()));
 await desktop.keyboard.press('Escape');
 check('Escape closes the illustration and returns to the main Guide',await desktop.locator('#waterfallGuidePanel').isHidden()&&await desktop.locator('#guidePanel').isVisible());
 check('focus returns to the Guide entry after closing the illustration',await desktop.locator('#guidePanel [data-open-waterfall-guide]').evaluate(el=>document.activeElement===el));
 await desktop.locator('#guidePanel [data-open-waterfall-guide]').click();
 await desktop.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().click();
 check('the image-modal close button returns to Guide',await desktop.locator('#guidePanel').isVisible());
 await desktop.locator('#guidePanel [data-open-waterfall-guide]').click();
 await desktop.locator('#modalScrim').click({position:{x:10,y:10}});
 check('backdrop click closes the guide image without losing the Guide',await desktop.locator('#waterfallGuidePanel').isHidden()&&await desktop.locator('#guidePanel').isVisible());
 await desktop.close();

 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',e=>errors.push('mobile '+e.message));
 await mobile.goto(url);await ready(mobile);
 const mobileRect=await mobile.locator('#waterfallGuidePanel').evaluate(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,innerWidth,innerHeight,visualWidth:visualViewport?.width,visualHeight:visualViewport?.height};});
 console.log('mobile popup bounds',JSON.stringify(mobileRect));
 check('first-entry image modal fits narrow mobile screen',mobileRect.left>=-1&&mobileRect.right<=mobileRect.innerWidth+1&&mobileRect.top>=-1&&mobileRect.bottom<=mobileRect.innerHeight+1);
 check('mobile image is swipeable horizontally for readable Thai labels',await mobile.locator('.bc-waterfall-figure').evaluate(el=>el.scrollWidth>el.clientWidth));
 await mobile.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().click();
 await mobile.locator('[data-mobile-open="village"]').click();
 await mobile.locator('.mobile-village-shortcuts [data-open-guide]').click();
 await mobile.locator('#guidePanel [data-open-waterfall-guide]').click();
 check('the same illustration can be reopened from mobile Village Guide',await mobile.locator('#waterfallGuidePanel img').isVisible());
 check('no uncaught browser errors',errors.length===0);
 await mobile.close();
}catch(error){console.error(error.stack||error,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
