import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4251,strictPort:false}});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1400,height:900}});
page.setDefaultTimeout(6500);page.setDefaultNavigationTimeout(12000);
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{if(!ok)throw Error('FAIL '+name);console.log('PASS '+name);};
try{
 console.log('desktop navigate');
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html',{waitUntil:'domcontentloaded'});
 try{await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});}
 catch(err){console.log('boot state',await page.evaluate(()=>({ready:document.readyState,loading:document.querySelector('#loading')?.textContent,hidden:document.querySelector('#loading')?.hidden,dev:!!window.__warrenDev,guide:!!document.querySelector('#waterfallGuidePanel')})));throw err;}
 console.log('game booted');
 check('first-time waterfall modal visible',await page.locator('#waterfallGuidePanel').isVisible());
 const img=page.locator('#waterfallGuidePanel img');
 await img.waitFor({state:'visible',timeout:5000});
 check('infographic bundle loaded',await img.evaluate(i=>i.complete&&i.naturalWidth>=1200&&i.naturalHeight>=700));
 await page.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().click();
 check('intro marked seen without save change',await page.evaluate(()=>__warren.modal===null&&localStorage.getItem('burrow-command:seen:waterfall-guide-2026-09-v1')==='seen'));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:20000});
 check('intro suppressed on later entry',await page.locator('#waterfallGuidePanel').isHidden());
 await page.locator('#help [data-open-guide]').click();
 await page.locator('#guidePanel [data-open-waterfall-guide]').click();
 check('Guide button reopens same image',await page.locator('#waterfallGuidePanel img').isVisible());
 await page.keyboard.press('Escape');
 check('escape goes back to main Guide',await page.locator('#guidePanel').isVisible());
 check('no browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
