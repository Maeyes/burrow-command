// Browser regression for gradual economy-building caps and magic-cart progression.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4189,strictPort:false}});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1365,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{if(!ok)throw Error('FAIL '+name);console.log('PASS '+name);};
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 const caps=await page.evaluate(()=>[14,15,19,20,24,25].map(__warrenDev.magicCartCap));
 check('magic carts unlock 0/2/2/4/4/6 at Warren 14/15/19/20/24/25',JSON.stringify(caps)===JSON.stringify([0,2,2,4,4,6]));
 const building=await page.evaluate(()=>{
  __warren.gold=1e6;const out=[];
  for(const [warren,cap] of [[4,1],[5,3],[10,5],[15,8],[20,10]]){
   __warren.warren=warren;__warren.forgeLevel=1;__warren.resourceLevel=1;
   while(__warrenDev.upgradeForgeBuilding());while(__warrenDev.upgradeResourceBuilding());
   out.push([warren,__warren.forgeLevel,__warren.resourceLevel,cap]);
  }
  return out;
 });
 check('blacksmith and resource workshop respect gradual 1/3/5/8/10 caps',building.every(([,forge,resource,cap])=>forge===cap&&resource===cap));
 const made=await page.evaluate(()=>{
  __warren.warren=15;__warren.gold=1e6;__warren.inventory.livingMoss=1e6;__warren.magicCarts.length=0;
  const c={x:1280,y:1280};
  for(let ring=200;ring<=440&&__warren.magicCarts.length<3;ring+=70)for(let a=0;a<Math.PI*2&&__warren.magicCarts.length<3;a+=Math.PI/8)
   __warrenDev.placeMagicCart(c.x+Math.cos(a)*ring,c.y+Math.sin(a)*ring);
  const cappedAt15=__warren.magicCarts.length;
  const cart=__warren.magicCarts[0],hired=__warrenDev.hireMagicCartMage(cart),before={x:cart.x,y:cart.y};
  while(__warrenDev.upgradeMagicCart(cart));
  let moved=false;
  for(let ring=240;ring<=440&&!moved;ring+=40)for(let a=0;a<Math.PI*2&&!moved;a+=Math.PI/8){const x=c.x+Math.cos(a)*ring,y=c.y+Math.sin(a)*ring;if(Math.hypot(x-before.x,y-before.y)>80)moved=__warrenDev.relocateMagicCart(0,x,y);}
  __warrenDev.save();return {cappedAt15,hired,cls:cart?.garrison?.cls,level:cart.level,moved,x:cart.x,y:cart.y};
 });
 check('Warren Lv15 builds exactly two carts and accepts a Mage',made.cappedAt15===2&&made.hired&&made.cls==='mage');
 check('magic cart upgrades to Lv5 and moves without losing its Mage',made.level===5&&made.moved);
 await page.reload();await page.waitForFunction(()=>window.__warren?.magicCarts?.length===2&&window.__warrenDev,null,{timeout:45000});
 check('magic cart level, position and Mage persist after reload',await page.evaluate(p=>__warren.magicCarts.length===2&&__warren.magicCarts[0].level===5&&__warren.magicCarts[0].garrison?.cls==='mage'&&__warren.magicCarts[0].x===p.x&&__warren.magicCarts[0].y===p.y,made));
 check('no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
