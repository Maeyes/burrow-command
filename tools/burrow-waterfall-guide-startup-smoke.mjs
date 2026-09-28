import {preview} from 'vite';import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4252,strictPort:false}});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 console.log('Navigating to game');
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:44000});
 console.log('Game ready');
 const panel=page.locator('#waterfallGuidePanel'),image=panel.locator('img');
 if(!await panel.isVisible())throw Error('Guide not visible');
 await image.waitFor({state:'visible',timeout:5000});
 const info=await image.evaluate(i=>({loaded:i.complete,width:i.naturalWidth,height:i.naturalHeight,source:i.currentSrc}));
 console.log('Infographic',JSON.stringify(info));
 if(!info.loaded||info.width<1200||info.height<700)throw Error('SVG failed to load');
 await panel.locator('[data-waterfall-guide-close]').first().click();
 if(!await page.evaluate(()=>__warren.modal===null&&localStorage.getItem('burrow-command:seen:waterfall-guide-2026-09-v1')==='seen'))throw Error('Seen marker missing');
 console.log('PASS startup modal, infographic loaded, seen marker persisted');
 if(errors.length)throw Error('pageerror: '+errors.join(';'));
}catch(e){console.error(e.message,await page.evaluate(()=>({loading:document.querySelector('#loading')?.textContent,hidden:document.querySelector('#loading')?.hidden,dev:!!window.__warrenDev,panel:!!document.querySelector('#waterfallGuidePanel')})),errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
