// Local browser regression for material-funded base reinforcement. No deploy/push.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4180,strictPort:false}});
const browser=await chromium.launch({headless:true});
const assert=(name,ok)=>{if(!ok)throw Error('FAIL '+name);console.log('PASS '+name);};
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 const initial=await page.evaluate(()=>({day:__warren.day,warren:__warren.warren,fortification:__warren.fortification}));
 assert('new village starts with fortification zero',initial.day===1&&initial.warren===1&&initial.fortification===0);
 await page.evaluate(()=>{Object.assign(__warren.inventory,{livingMoss:30,brutalSpore:20,copperOre:10,tier1Blueprint:15,verdantAetherstone:20});__warrenDev.renderUi()});
 const before=await page.evaluate(()=>({gold:__warren.gold,mats:__warren.inventory.livingMoss,burrow:__warren.burrow}));
 assert('day-one material-only fortify button enabled',await page.locator('#fortify').isEnabled());
 assert('boss still gates warren level',await page.locator('#upgrade').isDisabled());
 await page.click('#fortify');
 const after=await page.evaluate(()=>({gold:__warren.gold,mats:__warren.inventory.livingMoss,burrow:__warren.burrow,fortification:__warren.fortification,
  blueprint:__warren.inventory.tier1Blueprint,aether:__warren.inventory.verdantAetherstone,warren:__warren.warren}));
 assert('reinforcement consumes 12 common materials, 0 Gold, gives 35 Hall HP',after.gold===before.gold&&after.mats===before.mats-12&&after.burrow===before.burrow+35&&after.fortification===1);
 assert('blueprints and aetherstones are preserved',after.blueprint===15&&after.aether===20);
 assert('reinforcement does not bypass boss gate',after.warren===1&&await page.locator('#upgrade').isDisabled());
 await page.reload();await page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 assert('fortification and materials persist across reload',await page.evaluate(()=>__warren.fortification===1&&__warren.inventory.livingMoss===18));
 assert('no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
