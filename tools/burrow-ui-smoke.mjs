// Burrow Command: recruit panel and theme-wide scrollbar browser smoke test.
// Uses a temporary Vite preview and browser context; does not touch saves, deploy or push.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4182,strictPort:false}});
const browser=await chromium.launch({headless:true});
const check=(label,value)=>{if(!value)throw Error('FAIL '+label);console.log('PASS '+label);};
const page=await browser.newPage({viewport:{width:1365,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
  await page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
  const items=page.locator('#recruitDetails #shop > button.buy');
  check('seven classes render as compact single-column rows',await items.count()===7&&await page.evaluate(()=>{
    const boxes=[...document.querySelectorAll('#shop > button.buy')].map(b=>b.getBoundingClientRect());
    return boxes.every((b,i)=>b.width>180&&(i===0||b.y>boxes[i-1].bottom-1));
  }));
  check('recruit summary reports unlocked field capacity',await page.locator('#recruitSummary').innerText()==='2/7');
  check('recruit starts expanded',await page.locator('#recruitDetails').evaluate(el=>el.open===true));
  await page.locator('#recruitDetails > summary').click();
  check('recruit collapses to a small header',await page.locator('#recruitDetails').evaluate(el=>!el.open)&&!(await items.first().isVisible()));
  await page.locator('#recruitDetails > summary').click();
  check('recruit can reopen without losing classes',await items.first().isVisible()&&await items.count()===7);
  check('squad cards expand into equal two-column grid without a blank strip before the scrollbar',await page.evaluate(()=>{
    const grid=document.querySelector('#squad'),[a,b]=grid.querySelectorAll('.bc-mini-hero');
    const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect(),rg=grid.getBoundingClientRect();
    return getComputedStyle(grid).display==='grid'&&Math.abs(ra.width-rb.width)<2&&
      ra.y===rb.y&&rb.right>rg.right-16&&ra.width>100;
  }));
  await page.locator('#heroOpen').click();
  check('Armory still opens after UI cleanup',await page.locator('#heroPanel').isVisible());
  const scroll=await page.evaluate(()=>{
    const body=getComputedStyle(document.querySelector('#side'));
    const modal=getComputedStyle(document.querySelector('#heroPanel .bc-modal-body'));
    return [body.scrollbarWidth,body.scrollbarColor,modal.scrollbarWidth,modal.scrollbarColor];
  });
  check('sidebar and modal scrollbars use the shared thin forest theme',scroll[0]==='thin'&&scroll[1].includes('rgb(100, 123, 89)')&&scroll[2]==='thin'&&scroll[3].includes('rgb(100, 123, 89)'));
  check('no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
