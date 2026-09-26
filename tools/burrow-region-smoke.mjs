import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4188,strictPort:false}});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:70000});
const test=(name,yes)=>{if(!yes)throw Error('FAIL '+name);console.log('PASS '+name)};
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');await ready();
 for(const [level,biome,zone] of [[6,'forest','Forest II'],[11,'desert','Desert I'],[16,'desert','Desert II']]){
  await page.evaluate(level=>{__warren.warren=level;__warrenDev.save()},level);
  await page.reload();await ready();
  test('level '+level+' renders correct biome and stage',await page.evaluate(([n,b])=>__warren.warren===n&&__slice.WS.scene.biome===b,[level,biome]));
  await page.click('#lureOpen');
  test('level '+level+' exposes correct regional roster', (await page.locator('#lurePanel').innerText()).includes(zone));
  await page.click('#lurePanel [data-modal-close]');
 }
 await page.evaluate(()=>{__warren.warren=20;__warren.cleared=true;__warrenDev.renderUi()});
 test('Phase 1 ends at Warren Lv 20',await page.locator('#upgrade').isDisabled());
 test('no regional load browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
