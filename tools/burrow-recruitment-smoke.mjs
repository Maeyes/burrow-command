// Browser regression: seven distinct field classes at Lv 1; +2/+2/+3 slots at Lv 5/7/9.
// Lv15 adds seven slots and removes the per-class cap. Tower garrisons are separate.
// Temporary Vite preview; no deploy/push.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4184,strictPort:false}});
const browser=await chromium.launch({headless:true});
const check=(name,ok)=>{if(!ok)throw Error('FAIL '+name);console.log('PASS '+name);};
const page=await browser.newPage({viewport:{width:1365,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await page.waitForFunction(()=>window.__warren?.units?.length===2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 await page.evaluate(()=>{__warren.gold=10000;__warrenDev.renderUi();});
 check('day one: seven available slots, one per class',await page.locator('#recruitSummary').innerText()==='2/7'&&
   await page.locator('[data-buy="guard"]').isDisabled()&&await page.locator('[data-buy="scout"]').isEnabled());
 for(const cls of ['scout','brute','axe','vanguard','mage'])await page.locator('#shop [data-buy="'+cls+'"]').click();
 check('Lv 1: recruit all seven distinct classes, no second recruit yet',await page.evaluate(()=>
   __warren.units.length===7&&new Set(__warren.units.map(u=>u.cls)).size===7)&&
   await page.locator('#recruitSummary').innerText()==='7/7'&&await page.locator('[data-buy="guard"]').isDisabled());
 await page.evaluate(()=>{__warren.warren=5;__warrenDev.renderUi();});
 check('Warren Lv 5: two extra field slots and second recruit in any class',await page.locator('#recruitSummary').innerText()==='7/9'&&await page.locator('[data-buy="guard"]').isEnabled());
 for(const cls of ['scout','mage'])await page.locator('#shop [data-buy="'+cls+'"]').click();
 check('Lv 5: nine units, Scout and Mage have two each',await page.evaluate(()=>
   __warren.units.length===9&&['scout','mage'].every(c=>__warren.units.filter(u=>u.cls===c).length===2))&&
   await page.locator('#recruitSummary').innerText()==='9/9'&&await page.locator('[data-buy="guard"]').isDisabled());
 await page.evaluate(()=>{__warren.warren=7;__warrenDev.renderUi();});
 check('Warren Lv 7: two more field slots',await page.locator('#recruitSummary').innerText()==='9/11');
 for(const cls of ['guard','archer'])await page.locator('#shop [data-buy="'+cls+'"]').click();
 check('Lv 7: eleven units and per-class cap enforced',await page.evaluate(()=>
   __warren.units.length===11&&['guard','archer'].every(c=>__warren.units.filter(u=>u.cls===c).length===2))&&
   await page.locator('[data-buy="guard"]').isDisabled());
 await page.evaluate(()=>{__warren.warren=9;__warrenDev.renderUi();});
 check('Warren Lv 9: final three slots unlocked',await page.locator('#recruitSummary').innerText()==='11/14');
 for(const cls of ['brute','axe','vanguard'])await page.locator('#shop [data-buy="'+cls+'"]').click();
 check('Lv 9: fourteen field rabbits, two per each of seven classes',await page.evaluate(()=>
   __warren.units.length===14&&Object.values(__warren.units.reduce((m,u)=>(m[u.cls]=(m[u.cls]||0)+1,m),{})).every(n=>n===2))&&
   await page.locator('#recruitSummary').innerText()==='14/14');
 await page.reload();
 await page.waitForFunction(()=>window.__warren?.units?.length===14&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 check('full squad persists after reload',await page.evaluate(()=>__warren.warren===9&&__warren.units.length===14)&&
   await page.locator('#recruitSummary').innerText()==='14/14');
 await page.evaluate(()=>{__warren.warren=15;__warren.gold=100000;__warrenDev.renderUi();});
 check('Warren Lv 15 adds seven slots and reopens every class',await page.locator('#recruitSummary').innerText()==='14/21'&&
   await page.locator('[data-buy="guard"]').isEnabled());
 for(let i=0;i<7;i++)await page.locator('#shop [data-buy="guard"]').click();
 check('Lv 15 can fill every new slot with the same class',await page.evaluate(()=>
   __warren.units.length===21&&__warren.units.filter(u=>u.cls==='guard').length===9)&&
   await page.locator('#recruitSummary').innerText()==='21/21'&&await page.locator('[data-buy="guard"]').isDisabled());
 check('no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
