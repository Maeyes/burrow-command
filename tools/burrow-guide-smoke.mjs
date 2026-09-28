import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4191,strictPort:false}});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{if(!ok)throw Error('FAIL '+name);console.log('PASS '+name);};
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 if(await page.locator('#waterfallGuidePanel').isVisible())await page.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().click();
 check('Guide launcher background hugs its buttons',await page.locator('#help').evaluate(el=>{
  const buttons=[...el.querySelectorAll('button')],buttonWidth=buttons.reduce((sum,button)=>sum+button.getBoundingClientRect().width,0);
  return el.getBoundingClientRect().width<=buttonWidth+24;
 }));
 await page.click('[data-mobile-open="village"]');
 await page.locator('.mobile-village-shortcuts [data-open-guide]').click();
 check('mobile Guide opens as a readable modal',await page.locator('#guidePanel').isVisible()&&/กองทัพกระต่าย/.test(await page.locator('#guidePanel').innerText()));
 await page.locator('#guidePanel [data-modal-close]').click();
 await page.click('[data-mobile-open="village"]');
 await page.locator('.mobile-village-shortcuts [data-open-patch-notes]').click();
 check('Patch Notes displays the current version and gameplay changes',await page.locator('#patchNotesPanel').isVisible()&&/v0\.4\.2/.test(await page.locator('#patchNotesPanel').innerText())&&/ทิศเหนือ/.test(await page.locator('#patchNotesPanel').innerText())&&/รถยิงเวทย์/.test(await page.locator('#patchNotesPanel').innerText()));
 check('guide and patch modals fit the mobile viewport',await page.locator('#patchNotesPanel').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
 const unlockMessage=await page.evaluate(()=>{
  __warren.modal=null;__warren.warren=4;__warren.cleared=true;__warren.night=false;__warren.inventory.livingMoss=10000;
  const upgraded=__warrenDev.upgradeWarren();return {upgraded,text:document.querySelector('#banner').innerText};
 });
 check('Warren level-up message lists newly available systems',unlockMessage.upgraded&&/โรงตีเหล็กและโรงผลิตอัปได้ถึง Lv3/.test(unlockMessage.text)&&/กองทัพสูงสุด 9/.test(unlockMessage.text));
 check('no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
