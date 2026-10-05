// First-time coach: walks a new player through the core loop one step at a time,
// pointing at the real HUD button. Pure step logic (tutorialStep) + a tiny DOM controller.
export const TUTORIAL_KEY='burrow-tutorial-v1';

// done(s) auto-advances; steps without done wait for "ถัดไป".
// target: selectors tried in order, the first one on screen is highlighted (real button first, then what opens it).
// mobile: fallback when nothing in target is on screen on a phone (usually a dock button).
const DOCK=k=>`[data-mobile-open="${k}"]`;
export const TUTORIAL_STEPS=[
 {id:'welcome',title:'ยินดีต้อนรับสู่ Burrow Command!',text:'☀️ กลางวัน กระต่ายออกล่ามอนเองอัตโนมัติ เก็บ Gold และวัตถุดิบ<br>🌙 กลางคืน มอนบุกหมู่บ้าน ต้องป้องกันโพรงให้รอด<br>เราจะพาทำทีละขั้น ปุ่มที่ต้องกดจะกระพริบสีทอง'},
 {id:'speed',title:'เร่งเวลา',text:'กด ⏩ เพื่อเร่งเกมเป็น x2 กดอีกครั้งกลับ x1 ข้าง ๆ คือ “🌙 เข้าคืนเลย” ใช้ข้ามไปกลางคืนทันทีเมื่อพร้อม',target:['#speed'],mobile:DOCK('village'),done:s=>s.speed>1},
 {id:'recruit',title:'จ้างกระต่าย',text:'ยิ่งกระต่ายเยอะ ยิ่งล่าเร็วและป้องกันได้ดี แต่ละคลาสมีหน้าที่ต่างกัน เช่น โล่รับดาเมจ ธนู/เวทยิงไกล กดจ้างสักตัว',target:['#shopbox'],mobile:DOCK('recruit'),done:s=>s.units>=3},
 {id:'farm',title:'กระต่ายฟาร์มเอง',text:'ไม่ต้องบังคับ กระต่ายจะออกล่าเอง ดู Gold กับวัตถุดิบด้านบนเพิ่มขึ้น เมื่อวัตถุดิบครบ ${wallCost} ชิ้นจะไปขั้นต่อไป',target:['#top .res'],done:s=>s.wallLevel>0||s.mats>=s.wallCost},
 {id:'wall',title:'สร้างรั้วรอบหมู่บ้าน',text:'รั้วกันมอนไม่ให้วิ่งเข้าโพรงตรง ๆ มอนจะบุกจากประตูใต้/ตะวันออก/ตะวันตก',target:['#fenceBuild'],mobile:DOCK('village'),done:s=>s.wallLevel>0},
 {id:'tower',title:'สร้างป้อมธนู',text:'กดปุ่มป้อม แล้วคลิกพื้นในหมู่บ้านเพื่อวาง (เงาสีเขียว = วางได้) ใกล้ประตูจะดีที่สุด',target:['#build'],mobile:DOCK('village'),done:s=>s.towers>0},
 {id:'garrison',title:'จ้างทหารประจำป้อม',text:'ป้อมว่างจะไม่ยิง! คลิกป้ายป้อมบนแผนที่ แล้วเลือกนักธนูหรือนักเวทประจำป้อม',target:['[data-tower-hire]','[data-world-tower]'],done:s=>s.garrisons>0,closeAfter:true},
 {id:'craft',title:'คราฟต์อุปกรณ์',text:'เปิด Class Armory → กดปุ่ม “⚒ คราฟต์” ใต้การ์ด เลือกสูตร แล้วกดคราฟต์ ใช้วัตถุดิบจากมอน (×10 คราฟต์ทีละหลายชิ้นได้)<br>ถ้าปุ่มเป็นสีเทา ดูกล่อง “วัตถุดิบที่ต้องใช้” ว่าขาดอะไร แล้วรอกระต่ายฟาร์มเพิ่ม หรือกดข้ามขั้นนี้ไปก่อนแล้วกลับมาทีหลังได้',target:['[data-forge-craft]','[data-armory-tab="craft"]','#heroOpen'],mobile:DOCK('craft'),done:s=>s.gear>0},
 {id:'equip',title:'ใส่อุปกรณ์',text:'ของที่คราฟต์อยู่ในคลัง กด “🎒 เปลี่ยนชิ้น” แล้วเลือกชิ้นที่ดีที่สุดใส่ ของแชร์กันทั้งคลาส ใส่ครั้งเดียวทุกตัวในคลาสได้หมด',target:['[data-armory-tab="inventory"]','#heroOpen'],mobile:DOCK('craft'),done:s=>s.equipped>0},
 {id:'enhance',title:'Enhance และ Refine',text:'กด “⬆ อัปเกรด” ใช้ Gold/วัตถุดิบตีบวกช่องอุปกรณ์ ค่าบวกติดที่ช่อง ไม่หายเมื่อเปลี่ยนของ ปุ่ม “Enhance All Max” ตีทุกช่องให้สุดในกดเดียว',target:['#enhanceAll','[data-armory-tab="upgrade"]','#heroOpen'],mobile:DOCK('craft'),done:s=>s.enhanced>0},
 {id:'options',title:'ออปชันอุปกรณ์',text:'ของเกรด Rare ขึ้นไปมีช่องออปชัน (Rare 1 ถึง Mythic 4) กด “🔮 ออปชัน” เพื่อเพิ่มด้วย Option Stone หรือสุ่มใหม่ด้วย Re-option Stone ล็อกช่องที่ชอบไว้ได้ (เสียเพิ่ม) หลอดสีบอกว่าค่าดีแค่ไหน: ทอง ≥80% ของสูงสุด<br>หินได้จากศึก World Boss',target:['[data-armory-tab="options"]','#heroOpen'],mobile:DOCK('craft')},
 {id:'night',title:'ป้องกันคืนแรก',text:'พอนาฬิกาหมดจะเข้ากลางคืน ป้องกันโพรงให้รอดจนมอนหมด แพ้ก็ไม่เสียความก้าวหน้า แค่เสียค่าซ่อมแล้วสู้ใหม่',target:['#clock'],done:s=>s.day>=2},
 {id:'repair',title:'ซ่อมหลังศึก',text:'กลางวันใช้ Gold ซ่อมกำแพง ป้อม และอาคารที่โดนทุบ กด “ซ่อมทั้งหมด” ทีเดียวจบ',target:['#repairAll'],mobile:DOCK('village')},
 {id:'mastery',title:'Class Mastery',text:'ความชำนาญอาวุธของแต่ละคลาส ปลดสกิลอาวุธเมื่อถึง Milestone ลองเปิดดู',target:['#masteryOpen'],mobile:DOCK('skills'),done:s=>s.modal==='mastery'||s.modal==='bunnyMenu'},
 {id:'core',title:'Skill Core',text:'ชุดสกิลพิเศษของกระต่ายภาคพื้นดิน ปลดชุดแรกเมื่อบ้าน Lv10 เก็บไว้เป็นเป้าระยะยาว',target:['#skillCoreOpen'],mobile:DOCK('skills')},
 {id:'sell',title:'Quick Sell หาเงินเร็ว',text:'วัตถุดิบเหลือเยอะ? กดรถเข็นขายของบนแผนที่ ตั้งจำนวนสำรองไว้ แล้วขายส่วนเกินเป็น Gold',target:['[data-world="sell"]'],mobile:DOCK('sell'),done:s=>s.modal==='sell'},
 {id:'hall',title:'โพรงกระต่าย: Auto Heal',text:'โพรงฮีลกระต่ายให้อัตโนมัติเมื่อตัวไหน HP ต่ำกว่า 50% ได้กลางวัน 1 ครั้ง และกลางคืน 1 ครั้ง ไม่ต้องกดเอง คลิกโพรงเพื่อดูสถานะหรืออัปเกรดบ้าน',target:['[data-world="hall"]']},
 {id:'buildings',title:'โรงตีเหล็ก & โรงผลิต',text:'โรงตีเหล็กเพิ่มโอกาสได้ของเกรดสูง โรงผลิตเพิ่ม Gold/วัตถุดิบจากมอน อัปได้เมื่อบ้านเลเวลสูงขึ้น',target:['#forgeOpen'],mobile:DOCK('village')},
 {id:'lure',title:'ล่อมอนพิเศษ',text:'วันละครั้ง ใช้วัตถุดิบล่อมอนพิเศษที่ดรอปของดีกว่ามาให้กระต่ายล่า',target:['#lureOpen'],mobile:DOCK('village')},
 {id:'home',title:'Home Builder',text:'ตกแต่งหมู่บ้าน วางทางเดิน ซื้อที่ดิน ขยายกำแพง บ้านแต่ละแบบให้โบนัส เช่น วัตถุดิบ +3% หรือ EXP +10%',target:['#homeOpen'],mobile:DOCK('village')},
 {id:'loop',title:'วนลูปเพื่อโต',text:'ผ่าน 5 เวฟ (เวฟ 5 คือบอส) แล้วกด “🏠 อัป Warren” เพื่อปลดกระต่าย ป้อม และระบบใหม่ ๆ<br>ดูแถบ <b>เป้าหมายถัดไป</b> ใต้ HUD ได้ตลอด สงสัยอะไรเปิด 📖 คู่มือ หรือ 🎓 สอนเล่นเพื่อดูซ้ำ',target:['#upgrade','#nextGoal'],mobile:DOCK('village')},
];

// Returns the index of the step to show, skipping any already satisfied.
export function tutorialStep(index,s){
 let i=Math.max(0,index|0);
 while(i<TUTORIAL_STEPS.length&&TUTORIAL_STEPS[i].done?.(s))i++;
 return i;
}

export function loadTutorial(isNewVillage){
 try{const raw=JSON.parse(localStorage.getItem(TUTORIAL_KEY)||'null');if(raw)return {step:raw.step|0,off:!!raw.off};}catch{}
 return {step:0,off:!isNewVillage}; // returning players are not ambushed by a tutorial; they can open it from 🎓
}

export function createTutorial({isNewVillage,isMobile=()=>matchMedia('(max-width:760px)').matches,onCloseModal=null}){
 const state=loadTutorial(isNewVillage);
 const persist=()=>{try{localStorage.setItem(TUTORIAL_KEY,JSON.stringify(state));}catch{}};
 const card=document.createElement('section');
 card.id='tutorialCard';card.className='bc-tutorial panel';card.setAttribute('role','dialog');card.setAttribute('aria-label','สอนเล่น');card.hidden=true;
 document.body.appendChild(card);
 let shownKey='',marked=null,focusedStep='';
 const unmark=()=>{marked?.classList.remove('bc-tut-target');marked=null;};
 card.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.tut==='next'){state.step++;}
  else if(b.dataset.tut==='close'){state.off=true;}
  persist();shownKey='';
 });
 // Shown and inside the viewport (closed mobile drawers slide off-screen rather than hide).
 const onScreen=el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;};
 const visible=el=>!!el&&el.getClientRects().length>0&&!el.closest('[hidden]')&&onScreen(el.closest('.panel')||el);
 // Prefer the real button; fall back to whatever opens it (mobile dock, collapsed panel).
 function pickTarget(step){
  const els=step.target.map(q=>document.querySelector(q)).filter(Boolean);
  const shown=els.find(visible);
  if(shown)return shown;
  if(isMobile()&&step.mobile)return document.querySelector(step.mobile);
  if(els[0]?.closest('#side.is-collapsed'))return document.getElementById('sideToggle');
  return els[0]||null;
 }
 // A pop-up window covering the screen: anything outside it can't be clicked, so point at its close button instead.
 const openModal=()=>[...document.querySelectorAll('.bc-modal:not([hidden])')].filter(m=>m.getClientRects().length).pop()||null;
 const CLOSE_BTN='[data-craft-reveal-close],[data-item-close],[data-modal-close],.modal-close';
 function resolveTarget(step){
  const t=pickTarget(step),m=openModal();
  if(m&&(!t||!m.contains(t)))return {el:m.querySelector(CLOSE_BTN),behind:true};
  return {el:t,behind:false};
 }
 // Bring the target on screen once per step: expand panels and scroll it into view.
 function reveal(step,target){
  const real=step.target.map(q=>document.querySelector(q)).find(Boolean);
  const details=real?.closest('details')||real?.querySelector?.('details');
  if(details&&!details.open)details.open=true;
  if(!isMobile()&&real?.closest('#side.is-collapsed'))document.getElementById('sideToggle')?.click();
  requestAnimationFrame(()=>{const t=pickTarget(step);if(t&&!t.closest('#worldLabels'))t.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});});
 }
 // Park the card right next to the target with an arrow pointing at it.
 function place(target){
  const vw=innerWidth,vh=innerHeight,cw=card.offsetWidth,ch=card.offsetHeight,gap=isMobile()?34:14;
  if(!target){card.dataset.side='';card.style.left='50%';card.style.top='';card.style.bottom='';card.style.transform='';return;}
  const r=target.getBoundingClientRect();let side,x,y;
  if(isMobile()){side=r.top>ch+gap+8?'top':'bottom';}
  else if(r.left>cw+gap+8)side='left';
  else if(vw-r.right>cw+gap+8)side='right';
  else side=r.top>ch+gap+8?'top':'bottom';
  if(side==='left'||side==='right'){x=side==='left'?r.left-cw-gap:r.right+gap;y=r.top+r.height/2-ch/2;}
  else{x=r.left+r.width/2-cw/2;y=side==='top'?r.top-ch-gap:r.bottom+gap;}
  x=Math.max(8,Math.min(vw-cw-8,x));y=Math.max(8,Math.min(vh-ch-8,y));
  card.dataset.side=side;card.style.transform='none';card.style.bottom='auto';
  card.style.left=Math.round(x)+'px';card.style.top=Math.round(y)+'px';
  const ax=side==='top'||side==='bottom'?Math.max(16,Math.min(cw-16,r.left+r.width/2-x)):0,ay=side==='left'||side==='right'?Math.max(16,Math.min(ch-16,r.top+r.height/2-y)):0;
  card.style.setProperty('--arrow-x',ax+'px');card.style.setProperty('--arrow-y',ay+'px');
 }
 function sync(s){
  if(!state.off&&!s.blocked){const next=tutorialStep(state.step,s);if(next!==state.step){const done=TUTORIAL_STEPS[state.step];state.step=next;persist();if(done?.closeAfter)onCloseModal?.();}}
  if(state.step>=TUTORIAL_STEPS.length&&!state.off){state.off=true;persist();}
  const step=TUTORIAL_STEPS[state.step];
  if(state.off||s.blocked||!step){card.hidden=true;unmark();shownKey='';focusedStep='';return;}
  const behind=step.target?resolveTarget(step).behind:false;
  const key=step.id+'|'+s.wallCost+'|'+behind;
  if(key!==shownKey){
   shownKey=key;
   const n=TUTORIAL_STEPS.length,last=state.step===n-1;
   card.innerHTML=`<div class="bc-tut-head"><b>🎓 ${step.title}</b><small>${state.step+1}/${n}</small></div><p>${step.text.replace('${wallCost}',s.wallCost)}</p>`+(behind?'<p class="bc-tut-behind">↩ ปิดหน้าต่างนี้ก่อน (ปุ่ม ✕ ที่กระพริบ) แล้วไปต่อ</p>':'')+
    `<div class="bc-tut-dots">${TUTORIAL_STEPS.map((_,i)=>`<i class="${i<state.step?'done':i===state.step?'on':''}"></i>`).join('')}</div>`+
    `<div class="bc-tut-actions"><button type="button" data-tut="close">ข้ามการสอน</button><button type="button" data-tut="next" class="${step.done?'ghost':''}">${last?'เริ่มเล่นเลย!':step.done?'ข้ามขั้นนี้':'ถัดไป ▶'}</button></div>`;
   if(last)card.querySelector('[data-tut="close"]').remove();
  }
  card.hidden=false;
  if(focusedStep!==step.id&&step.target){focusedStep=step.id;reveal(step);}
  const res=step.target?resolveTarget(step):{el:null,behind:false},target=res.el;
  if(target!==marked){unmark();if(target){target.classList.add('bc-tut-target');marked=target;if(!target.closest('#worldLabels'))target.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});}}
  place(target);
 }
 function restart(){state.step=0;state.off=false;persist();shownKey='';}
 return {sync,restart};
}
