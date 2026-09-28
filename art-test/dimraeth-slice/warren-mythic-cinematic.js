import dragonUrl from './assets/mythic/ancient-dragon.png?url';
import walk1 from './assets/mythic/ancient-dragon/walk-01.png?url';
import walk2 from './assets/mythic/ancient-dragon/walk-02.png?url';
import walk3 from './assets/mythic/ancient-dragon/walk-03.png?url';
import walk4 from './assets/mythic/ancient-dragon/walk-04.png?url';
import attack1 from './assets/mythic/ancient-dragon/attack-01.png?url';
import attack2 from './assets/mythic/ancient-dragon/attack-02.png?url';
import attack3 from './assets/mythic/ancient-dragon/attack-03.png?url';
import attack4 from './assets/mythic/ancient-dragon/attack-04.png?url';
import {projectRuntimePoint,runtimeWalkHeight} from './engine/runtime.js';

// Visual encounter rehearsal: no rewards, combat mutations or save changes.
export function createMythicCinematic(canvas,fx,center,{onBattle=()=>null,onStop=()=>{}}={}){
 const root=document.createElement('div');root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','ทดลอง Ancient Dragon');
 root.style.cssText='position:fixed;inset:0;z-index:100;overflow:hidden;pointer-events:auto';
 root.innerHTML=`<div data-dim style="position:absolute;inset:0;background:#000;opacity:0;pointer-events:none"></div><div data-shadow style="position:absolute;border-radius:50%;background:#080806;filter:blur(6px);opacity:.5"></div><img data-dragon alt="Ancient Dragon" style="position:absolute;image-rendering:pixelated;transform-origin:60% 93%"><div data-warning style="position:absolute;inset:0;display:none;place-items:center;background:radial-gradient(circle,#5e0909aa,#120000e8);text-align:center;padding:20px"><div style="width:min(760px,92vw);border:3px solid #ff695e;border-radius:14px;background:linear-gradient(180deg,#330707f2,#130606f2);box-shadow:0 0 36px #ff2b20, inset 0 0 50px #8e130d;padding:clamp(22px,5vw,54px) 20px"><div style="font:900 clamp(24px,5vw,62px) Georgia;color:#ffca75;text-shadow:0 3px #5a0000,0 0 18px #ff2b20">⚠ MYTHIC OMEN ⚠</div><div style="margin-top:18px;font:800 clamp(19px,3vw,38px) system-ui;color:#fff4dc">เงาของอสูรกายบินผ่าน…</div><div style="margin-top:10px;font:700 clamp(14px,2vw,24px) system-ui;color:#ff9e91">เตรียมป้องกันหมู่บ้าน · ไม่มีทางหลีกหนี</div></div></div><div data-banner style="position:absolute;left:0;right:0;top:35%;height:clamp(100px,20vh,180px);background:linear-gradient(105deg,#18071e,#7f221c 45%,#e48d29 75%,#230b29);border-block:4px solid #ffcb6c;box-shadow:0 0 32px #fa5d24;overflow:hidden;display:flex;align-items:center;padding:0 6%;gap:20px;transform:translateX(-110%)"><strong style="z-index:1;font:bold clamp(20px,5vw,58px) Georgia;color:#ffe491;text-shadow:3px 4px #5b1010;line-height:1">BOSS<br>ENCOUNTER</strong><img src="${dragonUrl}" alt="" style="position:absolute;right:0;top:-90%;width:55%;transform:rotate(-9deg)"><span style="z-index:1;margin-left:auto;align-self:flex-end;padding-bottom:10px;color:#fff2ce;font:bold clamp(12px,2.7vw,30px) Georgia">ANCIENT DRAGON</span></div><div style="position:absolute;bottom:16px;left:12px;right:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#142016ed;padding:10px;border:1px solid #99825b;border-radius:10px;color:#ffe7b1;font:14px system-ui"><span data-status style="flex:1;min-width:180px"></span><button data-slam>Ground Slam</button><button data-meteor>มMeteor</button><label><input data-flash type="checkbox"> จอมืดสลับ</label><button data-close>ถอนกำลัง (Esc)</button></div>`;
 document.body.append(root);
 const img=root.querySelector('[data-dragon]'),shade=root.querySelector('[data-dim]'),shadow=root.querySelector('[data-shadow]'),warning=root.querySelector('[data-warning]'),banner=root.querySelector('[data-banner]'),status=root.querySelector('[data-status]'),flash=root.querySelector('[data-flash]');
 warning.style.cssText='position:absolute;inset:0;display:none;place-content:center;justify-items:center;background:rgba(0,0,0,.72);backdrop-filter:grayscale(.9) blur(1px);text-align:center';
 warning.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:12px;width:min(86vw,820px)"><i style="display:block;width:100%;height:4px;background:linear-gradient(90deg,transparent,#8f171b 12%,#e1373e 50%,#8f171b 88%,transparent)"></i><strong style="font:900 clamp(34px,7vw,82px) Georgia,serif;letter-spacing:.1em;color:#e33b42;text-shadow:0 0 18px rgba(214,47,54,.55),0 4px 18px #000">MYTHIC OMEN</strong><span style="font:800 clamp(17px,2.8vw,32px) system-ui;color:#f6e8df;text-shadow:0 3px 10px #000">เงาของอสูรกายบินผ่าน…</span><i style="display:block;width:100%;height:4px;background:linear-gradient(90deg,transparent,#8f171b 12%,#e1373e 50%,#8f171b 88%,transparent)"></i></div>';
 img.src=dragonUrl;
 img.style.clipPath='polygon(3% 46%,4% 34%,13% 24%,25% 15%,43% 5%,48% 4%,47% 1%,54% 2%,58% 8%,61% 15%,60% 21%,56% 15%,52% 27%,51% 33%,62% 27%,70% 30%,78% 23%,83% 17%,78% 10%,83% 10%,91% 17%,95% 25%,93% 30%,89% 23%,98% 49%,97% 60%,94% 56%,93% 69%,89% 74%,86% 70%,83% 71%,87% 82%,89% 89%,84% 91%,81% 87%,80% 91%,77% 87%,73% 81%,68% 81%,73% 91%,70% 98%,64% 96%,61% 98%,59% 94%,60% 88%,57% 83%,52% 78%,49% 72%,43% 79%,40% 82%,42% 88%,39% 90%,36% 86%,34% 90%,30% 87%,29% 82%,32% 76%,27% 77%,18% 79%,10% 76%,5% 71%,3% 65%,3% 56%,8% 51%,12% 48%,10% 54%,19% 53%,23% 58%,18% 56%,12% 58%,8% 64%,13% 68%,22% 69%,28% 63%,39% 56%,29% 58%,32% 49%,24% 45%,21% 52%,22% 43%,15% 34%,10% 36%,6% 40%)';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;flash.checked=!reduced;
 const point=(offset)=>({x:center.x-offset,y:center.y+offset});
 const destination=point(220),landing=point(630);
 const frameUrls=[walk1,walk2,walk3,walk4,attack1,attack2,attack3,attack4],frameImages=frameUrls.map(src=>Object.assign(new Image(),{src}));
 let active=false,time=0,mode='intro',fired=new Set(),handles=[],previousFocus,boss=null,sprites=null;
 function buildSprites(){
  return frameImages.every(x=>x.complete&&x.naturalWidth)?frameImages:null;
 }
 const once=(id,fn)=>{if(!fired.has(id)){fired.add(id);fn()}};
 const playFx=(id,p,r)=>{const h=fx.play(id,{from:p,to:p,radius:r});if(h)handles.push(h)};
 const ring=(p,r,life)=>fx.ring(p.x,p.y,r,'#ffac52',life);
 function cast(kind){mode=kind;time=0;fired.clear()}
 function stop(){onStop();boss=null;active=false;root.hidden=true;shade.style.opacity='0';handles.forEach(h=>fx.stop(h));handles=[];previousFocus?.focus()}
 root.querySelector('[data-close]').hidden=true;
 root.querySelector('[data-slam]').hidden=true;root.querySelector('[data-meteor]').hidden=true;
 root.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();if(e.key==='Tab'){const els=[...root.querySelectorAll('button:not(:disabled):not([hidden]),input')],first=els[0],last=els.at(-1);if(!first)return;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 function screen(p){const q=projectRuntimePoint(p.x,p.y,runtimeWalkHeight(p.x,p.y)??0),r=canvas.getBoundingClientRect();return{x:r.left+q.x*r.width/canvas.width,y:r.top+q.y*r.height/canvas.height}}
 function pose(p,lift=0,squash=0,frame=null){const q=screen(p),r=canvas.getBoundingClientRect(),a=screen({...p,x:p.x+350}),width=Math.max(90,Math.min(innerWidth*.25,Math.abs(a.x-q.x)*1.65));if(frame){img.src=frame.src;img.style.clipPath='none'}img.style.width=width+'px';img.style.left=q.x+'px';img.style.top=q.y+'px';img.style.opacity='1';img.style.transform=`translate(-50%,calc(-94% - ${lift*r.height/canvas.height}px)) scale(${1+squash},${1-squash})`;shadow.style.width=width*.5+'px';shadow.style.height=width*.12+'px';shadow.style.left=q.x+'px';shadow.style.top=q.y+'px';shadow.style.transform='translate(-50%,-50%)';}
 function update(dt){if(!active)return;time+=dt;shade.style.opacity='0';warning.style.display='none';banner.style.transform='translateX(-110%)';const t=time;root.querySelector('[data-slam]').disabled=mode==='intro';root.querySelector('[data-meteor]').disabled=mode==='intro';
 if(mode==='intro'){
 if(t<4.2){img.style.opacity='0';const r=canvas.getBoundingClientRect(),x=t<2.2?(-.15+1.3*t/2.2):(1.15-1.05*(t-2.2)/2);shadow.style.width='180px';shadow.style.height='60px';shadow.style.left=r.left+r.width*x+'px';shadow.style.top=r.top+r.height*.6+'px';shadow.style.transform='translate(-50%,-50%)';if(flash.checked)shade.style.opacity=String(.42*Math.sin(t*Math.PI/1.1)**2);status.textContent=t<2.2?'เงาบินผ่าน…':'เงาวกกลับ…'}
 else if(t<6.8){img.style.opacity='0';warning.style.display='grid';shade.style.opacity='.72';status.textContent='⚠ MYTHIC OMEN · เตรียมตัวให้พร้อม!'}
 else if(t<7.7){pose(landing,650*(1-((t-6.8)/.9)**2),0,frameImages[4]);status.textContent='Ancient Dragon กำลังลงพื้น!'}
 else if(t<9.7){pose(landing,0,Math.max(0,.13-(t-7.7)*.5),frameImages[Math.min(7,4+Math.floor((t-7.7)*5)%4)]);once('land',()=>playFx('groundSlam',landing,180));const b=t-7.7;banner.style.transform=b<.25?`translateX(${-110*(1-b/.25)}%)`:b<1.65?'translateX(0)':`translateX(${Math.min(110,(b-1.65)*250)}%)`;status.textContent='BOSS ENCOUNTER · Ancient Dragon'}
 else if(t<13.7){const p=(t-9.7)/4,frame=frameImages[Math.floor((t-9.7)/.14)%4];pose({x:landing.x+(destination.x-landing.x)*p,y:landing.y+(destination.y-landing.y)*p},reduced?0:Math.abs(Math.sin(p*8*Math.PI))*3,0,frame);status.textContent='มังกรเดินเข้าหาหมู่บ้าน…'}else{boss=onBattle(destination,sprites);cast('battle');}
 }else if(mode==='battle'){img.style.opacity='0';shadow.style.opacity='0';status.textContent=boss?.dead?'ชนะ Ancient Dragon! · กำลังสรุปรางวัล…':boss?.trialLost?'กองทัพพ่ายแพ้ · กำลังสรุปรางวัล…':`ANCIENT DRAGON · HP ${Math.max(0,Math.ceil(boss?.hp||0))} / ${boss?.maxHp||0}`;if(boss?.dead||boss?.trialLost)once('battle-finished',()=>setTimeout(()=>active&&stop(),1200));
 }else if(mode==='slam'){pose(destination,t<1?Math.sin(t*Math.PI/2)*25:0);status.textContent='Ground Slam · ทุบพื้น';once('warn',()=>ring(destination,180,1));if(t>=1)once('hit',()=>playFx('groundSlam',destination,180));if(t>=2.5)cast('meteor');
 }else if(mode==='meteor'){pose(destination);status.textContent='Meteor · อุกกาบาต';for(let i=0;i<5;i++){const a=t-i*.3,p={x:center.x+Math.cos(i*2.4)*180,y:center.y+Math.sin(i*2.4)*180};if(a>=0)once('warn'+i,()=>ring(p,95,1.2));if(a>=1.2)once('hit'+i,()=>playFx('meteorStorm',p,95))}if(t>=4)cast('idle');
 }else{pose(destination);status.textContent='ทดลองภาพและสกิล · เกมหยุดเวลา · ไม่มีดาเมจ/รางวัล';}
 }
 return {get active(){return active},start(){if(active)return false;sprites??=buildSprites();if(!sprites)return false;previousFocus=document.activeElement;active=true;root.hidden=false;cast('intro');fx.preload(['groundSlam','meteorStorm']);root.focus();return true},stop,update};
}
