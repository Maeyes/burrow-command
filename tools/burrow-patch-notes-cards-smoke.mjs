import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4266,strictPort:false}});
const browser=await chromium.launch({headless:true}),errors=[];
const check=(name,ok)=>{if(!ok)throw Error('FAIL '+name);console.log('PASS '+name);};
async function start(viewport,mobile=false){
 const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:55000});
 if(await page.locator('#waterfallGuidePanel').isVisible())await page.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().click();
 return page;
}
try{
 for(const [label,viewport,mobile] of [['desktop',{width:1440,height:900},false],['mobile',{width:390,height:844},true]]){
  const page=await start(viewport,mobile);
  if(mobile){await page.locator('[data-mobile-open="village"]').click();await page.locator('.mobile-village-shortcuts [data-open-patch-notes]').click();}
  else await page.locator('#help [data-open-patch-notes]').click();
  const panel=page.locator('#patchNotesPanel'),body=panel.locator('.bc-patch-notes');
  check(label+' Patch Notes modal opens',await panel.isVisible());
  const layout=await panel.evaluate(el=>{
   const body=el.querySelector('.bc-patch-notes'),cards=[...body.querySelectorAll(':scope > section.bc-patch-card')];
   const box=body.getBoundingClientRect(),last=cards.at(-1)?.getBoundingClientRect(),first=cards[0]?.getBoundingClientRect();
   return {cards:cards.length,otherSections:el.querySelectorAll(':scope > section').length,
    firstText:cards[0]?.querySelector('h3')?.textContent,
    lastText:cards.at(-1)?.querySelector('h3')?.textContent,
    bodyScrollable:body.scrollHeight>body.clientHeight,firstInset:first.left-box.left,
    lastInset:last.left-box.left,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,
    top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,
    width:innerWidth,height:innerHeight};
  });
  check(label+' ALL patch versions use boxed cards inside one scrolling body',layout.cards>=15&&layout.otherSections===0&&layout.firstText.includes('v0.6.9')&&layout.lastText==='หมายเหตุ');
  check(label+' cards have the same consistent padding and no edge clipping',layout.firstInset>=8&&layout.lastInset>=8&&layout.bodyScrollable);
  check(label+' modal fits the current viewport',layout.left>=-1&&layout.right<=layout.width+1&&layout.top>=-1&&layout.bottom<=layout.height+1);
  await body.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  check(label+' old updates at the bottom remain accessible',await panel.locator('.bc-patch-card').last().evaluate(el=>{const body=el.closest('.bc-patch-notes').getBoundingClientRect(),r=el.getBoundingClientRect();return r.top<body.bottom&&r.bottom>body.top;}));
  await page.close();
 }
 check('no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
