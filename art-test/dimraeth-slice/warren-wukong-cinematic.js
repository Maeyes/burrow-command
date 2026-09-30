import wukongUrl from './assets/mythic/sun-wukong/sun-wukong-boss.png?url';
import staffUrl from '../wukong-staff-vfx/assets/wukong-staff-isolated-v1.png?url';
import wukongWalkUrl from '../wukong-staff-vfx/assets/walk.png?url';
import wukongHitUrl from '../wukong-staff-vfx/assets/hit.png?url';

export const WUKONG_INTRO_DURATION=19.5;
export function wukongIntroPhase(time){
 if(time<3.4)return 'clouds';
 if(time<6)return 'proclamation';
 if(time<7.9)return 'staffFall';
 if(time<9)return 'impact';
 if(time<10.4)return 'storm';
 if(time<13.8)return 'banner';
 if(time<WUKONG_INTRO_DURATION)return 'reveal';
 return 'done';
}

const clamp01=value=>Math.max(0,Math.min(1,value));
const easeOut=value=>1-(1-clamp01(value))**3;
const easeIn=value=>clamp01(value)**3;

// Archive preview only. It does not release the encounter, award a relic, mutate a save,
// or advance village simulation state.
export function createWukongCinematic({onBattle=()=>null,onStop=()=>{}}={}){
 const root=document.createElement('div');
 root.hidden=true;
 root.tabIndex=-1;
 root.setAttribute('role','dialog');
 root.setAttribute('aria-modal','true');
 root.setAttribute('aria-label','ตัวอย่างการปรากฏตัวของซุนหงอคง');
 root.style.cssText='position:fixed;inset:0;z-index:140;overflow:hidden;background:rgba(4,3,8,.18);pointer-events:auto;isolation:isolate';
 root.innerHTML=`<style>
  .wk-vignette{position:absolute;inset:-3%;background:radial-gradient(circle at 50% 58%,transparent 10%,rgba(2,2,7,.58) 78%,#020207 100%);pointer-events:none}
  .wk-dim{position:absolute;z-index:0;inset:0;background:#020308;opacity:0;pointer-events:none}
  .wk-cloud-flight{position:absolute;z-index:1;inset:0;overflow:hidden;opacity:0}.wk-flying-cloud{position:absolute;left:-32%;width:clamp(190px,31vw,430px);height:clamp(55px,8vw,112px);border-radius:48%;background:#05060ddd;filter:blur(8px);box-shadow:-70px 8px 0 -15px #080916cc,75px -8px 0 -21px #02030bdd;will-change:transform}.wk-flying-cloud:nth-child(1){top:24%}.wk-flying-cloud:nth-child(2){top:49%;transform:scale(.72)}.wk-flying-cloud:nth-child(3){top:68%;transform:scale(.9)}
  .wk-proclamation{position:absolute;z-index:10;inset:0;display:grid;place-content:center;justify-items:center;text-align:center;opacity:0;pointer-events:none}.wk-proclamation:before,.wk-proclamation:after{content:'';width:min(86vw,850px);height:4px;background:linear-gradient(90deg,transparent,#a46c18 12%,#ffd75a 50%,#a46c18 88%,transparent)}.wk-proclamation strong{margin:18px 0 9px;color:#ffe28a;font:900 clamp(28px,5.8vw,72px) Georgia,serif;letter-spacing:.06em;text-shadow:0 3px 0 #6b170d,0 0 22px #e99b28}.wk-proclamation span{margin-bottom:18px;color:#fff2cf;font:800 clamp(15px,2.3vw,28px) system-ui;text-shadow:0 3px 12px #000}
  .wk-staff{position:absolute;z-index:3;left:50%;top:62%;width:min(48vw,570px);height:auto;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 0 5px #fff4a8) drop-shadow(0 0 13px #f3a719) drop-shadow(7px 10px 7px #0009);transform-origin:94% 50%;will-change:transform}
  .wk-staff-mark{position:absolute;z-index:2;left:50%;top:62%;width:clamp(48px,8vw,105px);height:clamp(15px,2.7vw,35px);transform:translate(-50%,-18%);border-radius:50%;background:radial-gradient(ellipse,#120b05 0 28%,#3e2d1d 30% 48%,transparent 70%);filter:drop-shadow(0 4px 4px #0009);opacity:0;will-change:transform,opacity}.wk-staff-mark i{position:absolute;left:50%;top:45%;width:10px;height:7px;background:#66503a;clip-path:polygon(50% 0,100% 65%,72% 100%,0 78%,12% 25%);transform:translate(-50%,-50%)}
  .wk-cloud{position:absolute;left:50%;top:56%;width:clamp(150px,24vw,330px);height:clamp(48px,8vw,106px);border-radius:50%;background:rgba(5,6,13,.78);filter:blur(7px);box-shadow:-90px 5px 0 -13px rgba(8,8,18,.72),85px -6px 0 -18px rgba(4,4,12,.8);will-change:transform}
  .wk-slash{position:absolute;left:-18%;width:135%;height:3px;background:linear-gradient(90deg,transparent 0 8%,rgba(255,247,212,.95) 22%,rgba(243,181,64,.65) 45%,transparent 72%);filter:drop-shadow(0 0 5px #fff4c8);transform:rotate(-17deg);opacity:0}
  .wk-flash{position:absolute;inset:0;background:#fff5bf;opacity:0;mix-blend-mode:screen;pointer-events:none}
  .wk-banner{position:absolute;z-index:20;left:0;right:0;top:42%;height:clamp(145px,26vh,230px);transform:translate(-110%,-50%);overflow:hidden;border-block:4px solid #fff0a5;background:linear-gradient(103deg,#9a6517 0%,#e0aa35 38%,#f3cf65 72%,#c88920 100%);box-shadow:0 0 32px #f6b92e,inset 0 0 38px #80500f;display:flex;align-items:center;justify-content:flex-end;padding:0 6%;will-change:transform}
  .wk-banner:before{content:'';position:absolute;inset:7px;border:1px solid rgba(255,248,194,.82);pointer-events:none}.wk-banner:after{content:'';position:absolute;inset:0;background:repeating-radial-gradient(ellipse at 70% 118%,transparent 0 29px,rgba(113,58,9,.12) 31px 34px,transparent 36px 68px);opacity:.72;pointer-events:none}.wk-copy{position:relative;z-index:3;width:min(50%,680px);text-align:left;text-shadow:0 2px 0 #ffe99a,0 4px 10px rgba(74,18,8,.32)}.wk-kicker{display:block;color:#741512;font:900 clamp(9px,1.25vw,16px) Georgia,serif;letter-spacing:.16em}.wk-copy strong{display:block;margin:.05em 0;color:#861713;font:1000 clamp(28px,4.5vw,60px)/.8 Georgia,serif;letter-spacing:.025em}.wk-copy p{margin:.26em 0 0;color:#67110f;font:900 clamp(10px,1.55vw,20px)/1 system-ui,sans-serif;letter-spacing:.07em}.wk-portrait{position:absolute;z-index:2;left:0;bottom:-105%;height:225%;max-width:52%;object-fit:contain;object-position:left bottom;filter:drop-shadow(7px 10px 10px rgba(68,20,4,.5))}
  .wk-reveal{position:absolute;z-index:4;left:22%;top:calc(12% + 24px);width:min(25vw,310px);aspect-ratio:1.13;overflow:hidden;opacity:0;background-image:url('${wukongWalkUrl}');background-repeat:no-repeat;background-size:400% auto;background-position:0 0;image-rendering:auto;transform:translate(-50%,-100vh);transform-origin:50% 100%;filter:drop-shadow(0 5px 4px #0009);will-change:left,transform,opacity,background-position}
  .wk-reveal-shadow{position:absolute;z-index:2;left:22%;top:40%;width:clamp(64px,9vw,118px);height:clamp(13px,2vw,26px);border-radius:50%;background:rgba(8,7,4,.58);filter:blur(4px);opacity:0;transform:translateX(-50%);will-change:left,opacity,transform}
  .wk-title{display:none}
  .wk-narration{position:absolute;z-index:25;left:12px;right:12px;bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#142016ed;padding:10px;border:1px solid #99825b;border-radius:10px;color:#ffe7b1;font:14px system-ui;pointer-events:none}
  .wk-battle-status{position:absolute;z-index:25;left:12px;right:12px;bottom:16px;min-height:44px;border:1px solid #b89443;border-radius:11px;background:#142016ed;box-shadow:0 4px 18px #0009;overflow:hidden;color:#ffe7b1;font:800 clamp(12px,1.4vw,16px) system-ui;pointer-events:none}.wk-battle-status i{position:absolute;inset:0 auto 0 0;width:100%;background:linear-gradient(90deg,#70201a,#b74020 62%,#e2a132);opacity:.52;transition:width .12s linear}.wk-battle-status span{position:relative;z-index:1;display:flex;align-items:center;min-height:44px;padding:8px 12px;text-shadow:0 2px 3px #000}
  .wk-skip{position:absolute;z-index:30;right:max(12px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top));min-width:92px;min-height:44px;padding:8px 14px;border:1px solid #f4cb67;border-radius:999px;background:#1b110bdd;color:#fff0bb;font:700 14px system-ui;box-shadow:0 4px 16px #0008}
  @media (max-width:640px){.wk-banner{padding:0 12px}.wk-copy{width:55%;margin-left:auto}.wk-portrait{left:-8%;bottom:-88%;height:190%;max-width:58%}.wk-copy p{max-width:100%;letter-spacing:.02em}.wk-reveal{width:min(32vw,250px);top:calc(16% + 20px)}.wk-reveal-shadow{top:42%}}
 </style>
 <div class="wk-dim" data-dim></div><div class="wk-cloud-flight" data-cloud-flight>${Array.from({length:3},()=>'<i class="wk-flying-cloud"></i>').join('')}</div><div class="wk-cloud" data-cloud></div><div class="wk-vignette"></div><div class="wk-proclamation" data-proclamation><strong>ข้าคือซุนหงอคง</strong><span>ราชาสวรรค์ · เขาผลไม้ · ถ้ำม่านน้ำตก</span></div>
 <div data-slashes>${Array.from({length:7},(_,i)=>`<i class="wk-slash" style="top:${12+i*12}%"></i>`).join('')}</div>
 <div class="wk-staff-mark" data-staff-mark>${Array.from({length:8},(_,i)=>`<i style="transform:translate(-50%,-50%) rotate(${i*45}deg) translateX(${22+i%3*8}px)"></i>`).join('')}</div><img class="wk-staff" data-staff src="${staffUrl}" alt="" aria-hidden="true"><div class="wk-flash" data-flash></div>
 <section class="wk-banner" data-banner aria-live="polite"><img class="wk-portrait" src="${wukongUrl}" alt=""><div class="wk-copy"><span class="wk-kicker">WORLD BOSS · 齊天大聖</span><strong>BOSS<br>ENCOUNTER</strong><p>SUN WUKONG · THE GREAT SAGE</p></div></section>
 <div class="wk-reveal-shadow" data-reveal-shadow></div><div class="wk-reveal" data-reveal role="img" aria-label="ซุนหงอคงลอยลงและเดินเข้าสู่หมู่บ้าน"></div><div class="wk-title" data-title>ซุนหงอคง · SUN WUKONG</div>
 <div class="wk-narration" data-narration hidden>ก้อนเมฆเคลื่อนตัวอย่างรวดเร็วไปมา</div>
 <div class="wk-battle-status" data-battle-status hidden><i data-battle-hp></i><span data-battle-label>SUN WUKONG</span></div>
 <button type="button" class="wk-skip" data-skip aria-label="ปิดตัวอย่างบอส">ข้าม ✕</button>`;
 document.body.append(root);
 const staff=root.querySelector('[data-staff]'),staffMark=root.querySelector('[data-staff-mark]'),cloud=root.querySelector('[data-cloud]'),cloudFlight=root.querySelector('[data-cloud-flight]'),flyingClouds=[...root.querySelectorAll('.wk-flying-cloud')],proclamation=root.querySelector('[data-proclamation]'),dim=root.querySelector('[data-dim]'),flash=root.querySelector('[data-flash]'),banner=root.querySelector('[data-banner]'),reveal=root.querySelector('[data-reveal]'),revealShadow=root.querySelector('[data-reveal-shadow]'),title=root.querySelector('[data-title]'),narration=root.querySelector('[data-narration]'),battleStatus=root.querySelector('[data-battle-status]'),battleHp=root.querySelector('[data-battle-hp]'),battleLabel=root.querySelector('[data-battle-label]'),skip=root.querySelector('[data-skip]'),slashes=[...root.querySelectorAll('.wk-slash')];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const plantedStaff='translate(-94%,-50%) rotate(78deg) scale(.72)';
 let active=false,time=0,previousFocus=null,finishTimer=0,mode='intro',boss=null;
 function stop(){if(!active)return;active=false;root.hidden=true;root.style.transform='';narration.hidden=true;battleStatus.hidden=true;clearTimeout(finishTimer);onStop();previousFocus?.focus?.()}
 function enterBattle(){if(!active)return;boss=onBattle();if(!boss){active=false;root.hidden=true;previousFocus?.focus?.();return}mode='battle';root.style.pointerEvents='none';skip.hidden=true;narration.hidden=true;battleStatus.hidden=false;}
 skip.addEventListener('click',stop);
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();stop()}if(event.key==='Tab'){event.preventDefault();skip.focus()}});
 function update(dt){
  if(!active)return;
  if(mode==='battle'){
   const hp=Math.max(0,Math.ceil(boss?.hp||0)),maxHp=Math.max(1,boss?.maxHp||1),done=boss?.dead||boss?.trialLost;
   battleHp.style.width=`${100*hp/maxHp}%`;battleLabel.textContent=boss?.dead?'SUN WUKONG DEFEATED':boss?.trialLost?'MYTHIC INVASION FAILED':`SUN WUKONG · HP ${hp} / ${maxHp}`;
   if(done&&!finishTimer)finishTimer=setTimeout(()=>active&&stop(),1200);
   return;
  }
  time+=dt;
  const phase=wukongIntroPhase(time);
  narration.hidden=false;
  narration.textContent=phase==='clouds'?'ก้อนเมฆเคลื่อนตัวอย่างรวดเร็วไปมา…':phase==='proclamation'?'เสียงหนึ่งดังลงมาจากฟากฟ้า…':phase==='staffFall'?'กระบองวิเศษกำลังหมุนลงสู่หมู่บ้าน!':phase==='impact'?'แรงกระแทกสั่นสะเทือนทั่วทั้งหมู่บ้าน!':phase==='storm'?'เศษหินและกลุ่มควันฟุ้งกระจาย…':phase==='banner'?'BOSS ENCOUNTER · SUN WUKONG':'ซุนหงอคงกำลังบุกเข้าหมู่บ้าน…';
  staff.style.opacity='0';staffMark.style.opacity='0';cloud.style.opacity='0';cloudFlight.style.opacity='0';proclamation.style.opacity='0';dim.style.opacity='0';banner.style.transform='translate(-110%,-50%)';reveal.style.opacity='0';revealShadow.style.opacity='0';title.style.opacity='0';flash.style.opacity='0';root.style.transform='';
  slashes.forEach(s=>s.style.opacity='0');
  if(phase==='clouds'){
   dim.style.opacity=String(.48+.14*Math.sin(time*Math.PI*1.8)**2);cloudFlight.style.opacity='1';
   flyingClouds.forEach((item,i)=>{const direction=i===1?-1:1,travel=((time*(i===1?1.15:1.45)+i*.72)%2.1)/2.1,itemX=direction>0?-34+168*travel:134-168*travel;item.style.transform=`translateX(${itemX}vw) scale(${i===1?.72:i===2?.9:1})`;});
  }else if(phase==='proclamation'){
   const p=clamp01((time-3.4)/.42),out=clamp01((time-5.55)/.45);dim.style.opacity=String(.68*(1-out));proclamation.style.opacity=String(p*(1-out));
  }else if(phase==='staffFall'){
   const p=easeIn((time-6)/1.9),rotation=reduced?78:78+p*1080;staff.style.opacity='1';dim.style.opacity=String(.42*(1-p));
   staff.style.transform=`translate(-94%,calc(-50% - ${(1-p)*92}vh)) rotate(${rotation}deg) scale(.72)`;
  }else if(phase==='impact'){
   const p=(time-7.9)/1.1,bounce=Math.abs(Math.sin(p*Math.PI*3))*(1-p)*42;staff.style.opacity='1';
   staff.style.transform=`translate(-94%,calc(-50% - ${bounce/7}vh)) rotate(${78+(reduced?0:(1-p)*9)}deg) scale(${.72+(1-p)*.035},${.72-(1-p)*.04})`;
   staffMark.style.opacity=String(clamp01(p*5));staffMark.style.transform=`translate(-50%,-18%) scale(${1+(1-p)*.7})`;
   flash.style.opacity=String(Math.max(0,1-p*4));
   if(!reduced)root.style.transform=`translate(${Math.sin(p*55)*(1-p)*9}px,${Math.cos(p*47)*(1-p)*7}px)`;
  }else if(phase==='storm'){
   const p=(time-9)/1.4;staff.style.opacity='1';staff.style.transform=plantedStaff;staffMark.style.opacity='1';
   cloud.style.opacity=String(.45+.35*Math.sin(p*Math.PI));
   cloud.style.transform=`translate(-50%,-50%) rotate(${reduced?0:p*1080}deg) scale(${1+p*.7})`;
   slashes.forEach((slash,i)=>{slash.style.opacity=reduced?'0':String(.28+.6*Math.abs(Math.sin(time*11+i)));slash.style.transform=`translateX(${((time*170+i*28)%150)-15}%) rotate(-17deg)`});
   if(!reduced)root.style.transform=`translate(${Math.sin(time*42)*3}px,${Math.cos(time*34)*2}px)`;
  }else if(phase==='banner'){
   const p=time-10.4,enter=easeOut(p/.45),leave=easeIn((p-2.82)/.58),x=p<2.82?-110+110*enter:110*leave;
   staff.style.opacity='1';staff.style.transform=plantedStaff;staffMark.style.opacity='1';banner.style.transform=`translate(${x}%,-50%)`;
  }else if(phase==='reveal'){
   const landing=easeOut((time-13.8)/1.15),walking=clamp01((time-14.95)/2.65),attacking=time>=17.6,attackAge=time-17.6,left=22+walking*13;
   let frame=walking>0?Math.floor((time-14.95)/.14)%4:0,bob=walking>0&&!attacking&&!reduced?Math.abs(Math.sin((time-14.95)*Math.PI/.14))*4:0;
   reveal.style.backgroundImage=`url('${attacking?wukongHitUrl:wukongWalkUrl}')`;
   if(attacking){frame=attackAge<.23?0:attackAge<.34?1:attackAge<.48?2:3;bob=28;}
   staff.style.opacity='1';staff.style.transform=plantedStaff;staffMark.style.opacity='1';reveal.style.opacity=String(clamp01((time-13.8)/.22));reveal.style.left=`${left}%`;reveal.style.backgroundPosition=`${frame*33.333}% ${attacking?'100%':'0'}`;reveal.style.transform=`translate(-50%,${-100*(1-landing)-bob}px)`;revealShadow.style.left=`${left}%`;revealShadow.style.opacity=String(clamp01((landing-.72)*3.6));revealShadow.style.transform=`translateX(-50%) scale(${.7+walking*.3})`;
  }else enterBattle();
 }
 return {get active(){return active},start(){if(active)return false;previousFocus=document.activeElement;time=0;mode='intro';boss=null;active=true;root.hidden=false;root.style.pointerEvents='auto';skip.hidden=false;narration.hidden=false;battleStatus.hidden=true;skip.focus();return true},stop,update};
}
