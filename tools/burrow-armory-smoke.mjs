// Local end-to-end regression for the unified Burrow Command Class Armory.
// Runs against the standalone build; does not push, deploy or alter source/map files.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4178,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[],pass=(label,condition)=>{if(!condition)throw Error('FAIL: '+label);console.log('PASS: '+label);};
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 await page.evaluate(()=>{const s=window.__warren;s.gold=100000;Object.assign(s.inventory,
  {tier1Blueprint:80,copperOre:800,livingMoss:800,brutalSpore:800,verdantAetherstone:60,astraliteStone:60});
  window.__warrenDev.renderUi();});
 await page.click('#heroOpen');
 pass('single visible Armory, no separate Forge/Inventory controls',
  await page.locator('#heroPanel').isVisible()&&!(await page.locator('#forgeOpen').isVisible())&&
  !(await page.locator('#inventoryOpen').isVisible()));
 await page.click('#heroPanel [data-forge-class="archer"]');
 await page.locator('#heroPanel [data-auto-rarity]').selectOption('rare');
 await page.locator('#heroPanel [data-auto-enabled]').check();
 await page.click('#heroPanel [data-batch-qty="10"]');
 const before=await page.evaluate(()=>window.__warren.gear.length);
 await page.evaluate(()=>{const seq=[.95,.85,.85,.65,.65,.65,.01,.01,.01,.01];let n=0;
  window.__originalRandom=Math.random;Math.random=()=>seq[n++%seq.length];});
 await page.click('#heroPanel [data-forge-craft="mosswoodBow"]');
 pass('one explicit pre-craft approval; no pieces spent before confirmation',
  await page.locator('#heroPanel [data-auto-confirm]').isVisible()&&
  await page.evaluate(n=>window.__warren.gear.length===n,before));
 await page.click('#heroPanel [data-auto-confirm]');
 const result=await page.evaluate(()=>{const s=window.__warren;
  return {crafted:s.batchReport?.made?.length,kept:s.batchReport?.retained?.length,
   dismantled:s.batchReport?.dismantled?.length,fragments:s.batchReport?.fragments,
   storage:s.inventory.stoneFragment||0,modal:s.modal,gear:s.gear.length};});
 pass('one Batch ×10; 3 keep, 7 auto salvage, exact 10 fragments in inventory',
  result.crafted===10&&result.kept===3&&result.dismantled===7&&result.fragments===10&&result.storage===10&&result.gear===3);
 pass('results appear inside existing Armory without opening another modal',
  result.modal==='hero'&&await page.locator('#heroPanel .bc-armory-results').isVisible()&&
  !(await page.locator('#batchPanel').isVisible())&&!(await page.locator('#itemDetailPanel').isVisible()));
 const first=await page.locator('#heroPanel .bc-recommend.primary [data-batch-equip]').first().getAttribute('data-batch-equip');
 pass('Smart Recommendation asks before equipping',!!first&&
  await page.evaluate(()=>window.__warren.builds.archer[0].gear.weapon===null));
 await page.evaluate(()=>{window.__warren.progress.archer.weapon={enhance:5,refine:3};window.__warrenDev.renderUi();});
 await page.click('#heroPanel .bc-recommend.primary [data-batch-equip]');
 const oldId=await page.evaluate(()=>window.__warren.builds.archer[0].gear.weapon);
 pass('explicit recommended equip retains class-slot enhancement/refinement',!!oldId&&
  await page.evaluate(()=>{const s=window.__warren;return s.progress.archer.weapon.enhance===5&&s.progress.archer.weapon.refine===3;}));
 await page.click('#heroPanel [data-batch-expanded]');
 const second=await page.evaluate(old=>window.__warren.batchResults.find(id=>id!==old),oldId);
 await page.click('#heroPanel [data-open-item="'+second+'"]');
 pass('item detail opens INLINE, not a separate modal',await page.locator('#heroPanel .bc-armory-detail [data-item-equip]').isVisible()&&
  !(await page.locator('#itemDetailPanel').isVisible()));
 await page.click('#heroPanel .bc-armory-detail [data-item-equip]');
 pass('previous weapon returns to inventory, Armory stays open after replacement',
  await page.evaluate(([old,current])=>{const s=window.__warren;return s.builds.archer[0].gear.weapon===current&&
   s.gear.some(p=>p.id===old)&&s.armoryNotice.includes('อุปกรณ์เก่ากลับเข้าคลัง')&&
   s.progress.archer.weapon.enhance===5&&s.progress.archer.weapon.refine===3&&s.modal==='hero';},[oldId,second]));
 await page.click('#heroPanel [data-forge-class="mage"]');
 await page.locator('#heroPanel [data-auto-rarity]').selectOption('legend');
 await page.click('#heroPanel [data-forge-class="archer"]');
 pass('Rarity preference is distinct for Archer and Mage',await page.evaluate(()=>{
  const a=window.__warren.autoDismantle;return a.archer.minRarity==='rare'&&a.mage.minRarity==='legend';}));
 await page.reload();await page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 pass('saved preferences and equipped gear survive a fresh reload',await page.evaluate(()=>{
  const s=window.__warren;return s.autoDismantle.archer.minRarity==='rare'&&s.autoDismantle.mage.minRarity==='legend'&&
   s.progress.archer.weapon.enhance===5&&s.progress.archer.weapon.refine===3&&s.gear.length===3;}));
 pass('no uncaught page errors',errors.length===0);await context.close();
}catch(e){console.error(e.stack||e);console.error('PAGE ERRORS',JSON.stringify(errors));process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
