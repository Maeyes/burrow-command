// Local regression: compact recruiting, repair all and one-per-day material lure.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4187,strictPort:false}});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const test=(name,yes)=>{if(!yes)throw Error('FAIL '+name);console.log('PASS '+name)};
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 test('compact recruiter shows seven actionable rows',await page.locator('#shop .buy').count()===7);
 await page.evaluate(()=>{
  const s=window.__warren;s.gold=1000;s.inventory.livingMoss=1000;s.burrow-=130;
  window.__warrenDev.renderUi();
 });
 const price=await page.locator('#repairAll').textContent();
 test('repair all displays actual cost before purchase',price.includes('36G'));
 await page.click('#repairAll');
 test('repair all refills hall and spends correct Gold',await page.evaluate(()=>__warren.gold===964&&__warren.burrow===500));
 await page.click('#lureOpen');
 test('day one lure menu presents three options',await page.locator('#lurePanel [data-lure]').count()===3);
 await page.click('#lurePanel [data-lure="small"]');
 await page.waitForFunction(()=>__warren.lureDay===__warren.day,{timeout:15000});
 test('small lure consumes exactly 100 materials and summons eight daytime monsters',await page.evaluate(()=>__warren.inventory.livingMoss===900&&__warren.monsters.filter(m=>m.lured&&!m.dead).length===8));
 await page.reload();
 await page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 test('one-lure-per-day survives reload',await page.locator('#lureOpen').isDisabled()&&await page.evaluate(()=>__warren.inventory.livingMoss===900));
 await page.evaluate(()=>{__warren.day++;__warrenDev.save();__warrenDev.renderUi()});
 await page.click('#lureOpen');
 await page.click('#lurePanel [data-lure="frontier"]');
 await page.waitForFunction(()=>__warren.lureDay===__warren.day,{timeout:75000});
 test('frontier lure summons Forest II monsters early without unlocking the next Warren region',await page.evaluate(()=>{
  const p=['acorn1','acorn2','acorn3','twig1','twig2','twig3','thornBoar1','thornBoar2','thornBoar3'];
  return __warren.warren===1&&__warren.inventory.livingMoss===600&&__warren.monsters.filter(m=>m.lured&&!m.dead).length===5&&__warren.monsters.filter(m=>m.lured&&!m.dead).every(m=>p.includes(m.type));
 }));
 test('no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
