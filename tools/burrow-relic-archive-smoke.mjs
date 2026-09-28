// Isolated browser layout/asset check. Does not wait for the full game engine to boot.
// The Warren's startup/cinematic is verified separately from the Archive UI.
import {preview} from 'vite';
import {readFileSync} from 'node:fs';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
import {renderRelicArchiveHtml} from '../art-test/dimraeth-slice/warren-relic-ui.js';
import {defaultMythic} from '../art-test/dimraeth-slice/warren-mythic.js';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4268,strictPort:false}});
const browser=await chromium.launch({headless:true}),errors=[];
const check=(label,ok)=>{if(!ok)throw Error('FAIL '+label);console.log('PASS '+label);};
const source=readFileSync('art-test/dimraeth-slice/warren.html','utf8');
const css=source.match(/<style>([\s\S]*?)<\/style>/)[1];
const base=server.resolvedUrls.local[0]+'art-test/dimraeth-slice/';
async function start(viewport,mobile=false){
 const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/assets/relics/')&&r.status()>=400)errors.push(r.url()+': '+r.status());});
 await page.setContent('<!doctype html><html lang="th"><head><meta name="viewport" content="width=device-width,initial-scale=1"><base href="'+base+'"><style>'+css+'</style></head><body><section id="relicCollectionPanel" class="panel bc-modal" role="dialog" aria-modal="true">'+renderRelicArchiveHtml(defaultMythic())+'</section></body></html>');
 return page;
}
try{
 for(const [label,viewport,mobile] of [['desktop',{width:1440,height:900},false],['mobile',{width:390,height:844},true]]){
  const page=await start(viewport,mobile);
  check(label+' first collection: nine items and seven source tabs',await page.locator('[data-archive-boss]').count()===9&&await page.locator('[data-archive-tab]').count()===8);
  await page.locator('.bc-relic-card img').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));
  await page.waitForFunction(()=>[...document.querySelectorAll('.bc-relic-card img')].length===9&&[...document.querySelectorAll('.bc-relic-card img')].every(img=>img.complete&&img.naturalWidth>0),undefined,{timeout:12000});
  check(label+' nine icon assets load from production preview',true);
  check(label+' Archive fits viewport and scrolls correctly',await page.locator('#relicCollectionPanel').evaluate(el=>{
   const r=el.getBoundingClientRect(),body=el.querySelector('.bc-modal-body');
   return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1&&body.scrollHeight>=body.clientHeight;
  }));
  await page.locator('#relicCollectionPanel').evaluate((el,html)=>{el.innerHTML=html;},renderRelicArchiveHtml(defaultMythic(),'greek','medusa'));
  check(label+' Greek tab displays six bosses and Medusa detail',await page.locator('[data-archive-boss]').count()===6&&await page.locator('.bc-relic-detail h3').textContent()==="Gorgon's Eye");
  await page.close();
 }
 check('no script or relic asset loading errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
