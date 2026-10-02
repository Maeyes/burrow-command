// Item options (affixes). Options live on the item itself, so they move with it between classes.
// Option Stone: add one random option to an empty line. Re-option Stone: reroll every unlocked line;
// locking a line keeps it but each lock costs extra stones and Gold.
export const OPTION_DEFS={
 atkPct:{name:'ATK',unit:'%',min:3,max:8},
 hpPct:{name:'HP',unit:'%',min:4,max:10},
 defPct:{name:'DEF',unit:'%',min:4,max:10},
 aspd:{name:'ความเร็วโจมตี',unit:'%',min:3,max:7},
 crit:{name:'โอกาสคริติคอล',unit:'%',min:2,max:5},
 lifesteal:{name:'ดูดเลือด',unit:'%',min:1,max:3},
 splash:{name:'ดาเมจกระจาย',unit:'%',min:5,max:12},
};
export const OPTION_IDS=Object.keys(OPTION_DEFS);
// Line count and roll strength per rarity. Normal/Good items have no option lines.
export const OPTION_SLOTS={normal:0,good:0,rare:1,epic:2,legend:3,mythic:4,whiteAscended:4};
export const OPTION_POWER={rare:1,epic:1.25,legend:1.5,mythic:1.8,whiteAscended:2.2};
export const ADD_COST={optionStone:1,gold:40};
export const REOPTION_BASE={reoptionStone:1,gold:60};
export const LOCK_EXTRA={reoptionStone:1,gold:120};

export const optionSlots=item=>OPTION_SLOTS[item?.rarity]??0;
export const itemOptions=item=>Array.isArray(item?.options)?item.options:[];

export function rollOption(item,rng=Math.random,exclude=[]){
 const pool=OPTION_IDS.filter(id=>!exclude.includes(id));
 const id=pool[Math.floor(rng()*pool.length)]??OPTION_IDS[0],d=OPTION_DEFS[id],power=OPTION_POWER[item.rarity]??1;
 const value=Math.round((d.min+(d.max-d.min)*rng())*power*10)/10;
 return {id,value,locked:false};
}

const stones=(s,id)=>Math.max(0,s.inventory?.[id]||0);

export function addOptionQuote(s,item){
 if(!item)return null;
 const free=optionSlots(item)-itemOptions(item).length;
 return {free,...ADD_COST,ready:free>0&&!s.night&&stones(s,'optionStone')>=ADD_COST.optionStone&&s.gold>=ADD_COST.gold};
}
export function addOption(s,itemId,rng=Math.random){
 const item=s.gear.find(p=>p.id===itemId),q=addOptionQuote(s,item);
 if(!q?.ready)return null;
 s.inventory.optionStone-=ADD_COST.optionStone;s.gold-=ADD_COST.gold;
 // No duplicate stat on one item so every line is meaningful.
 const opt=rollOption(item,rng,itemOptions(item).map(o=>o.id));
 item.options=[...itemOptions(item),opt];
 return opt;
}

export function reoptionQuote(s,item){
 const opts=itemOptions(item);if(!opts.length)return null;
 const locks=opts.filter(o=>o.locked).length,stone=REOPTION_BASE.reoptionStone+locks*LOCK_EXTRA.reoptionStone,gold=REOPTION_BASE.gold+locks*LOCK_EXTRA.gold;
 const allLocked=locks>=opts.length;
 return {locks,reoptionStone:stone,gold,allLocked,ready:!allLocked&&!s.night&&stones(s,'reoptionStone')>=stone&&s.gold>=gold};
}
export function toggleOptionLock(s,itemId,index){
 const item=s.gear.find(p=>p.id===itemId),opt=itemOptions(item)[index];
 if(!opt||s.night)return false;
 opt.locked=!opt.locked;return true;
}
export function reoption(s,itemId,rng=Math.random){
 const item=s.gear.find(p=>p.id===itemId),q=reoptionQuote(s,item);
 if(!q?.ready)return null;
 s.inventory.reoptionStone-=q.reoptionStone;s.gold-=q.gold;
 const kept=itemOptions(item).filter(o=>o.locked).map(o=>o.id),taken=[...kept];
 item.options=itemOptions(item).map(o=>{
  if(o.locked)return o;
  const n=rollOption(item,rng,taken);taken.push(n.id);return n;
 });
 return item.options;
}

// Sum of options across equipped pieces, as fractions (atkPct 5 → .05) except crit which stays in percent points.
export function optionTotals(items){
 const t=Object.fromEntries(OPTION_IDS.map(id=>[id,0]));
 for(const item of items)for(const o of itemOptions(item))if(o.id in t)t[o.id]+=o.value;
 return {atkPct:t.atkPct/100,hpPct:t.hpPct/100,defPct:t.defPct/100,aspd:Math.min(.5,t.aspd/100),crit:t.crit,lifesteal:t.lifesteal/100,splash:t.splash/100};
}

export function normalizeOptions(raw,rarity){
 if(!Array.isArray(raw))return [];
 return raw.filter(o=>o&&OPTION_DEFS[o.id]&&Number.isFinite(o.value)).slice(0,OPTION_SLOTS[rarity]??0)
  .map(o=>({id:o.id,value:Math.round(o.value*10)/10,locked:!!o.locked}));
}

export const formatOption=o=>`${OPTION_DEFS[o.id]?.name||o.id} +${o.value}${OPTION_DEFS[o.id]?.unit||''}`;
// Highest value this stat can roll on this item's rarity.
export const optionMax=(o,rarity)=>Math.round((OPTION_DEFS[o.id]?.max||0)*(OPTION_POWER[rarity]??1)*10)/10;
// Roll quality tiers by share of the max: ≥80% gold, ≥60% purple, ≥40% blue, below that plain.
export const OPTION_GRADES=[{min:.8,key:'gold',label:'ทอง'},{min:.6,key:'purple',label:'ม่วง'},{min:.4,key:'blue',label:'ฟ้า'},{min:0,key:'plain',label:'ธรรมดา'}];
export function optionGrade(o,rarity){const max=optionMax(o,rarity);const r=max?o.value/max:0;return OPTION_GRADES.find(g=>r>=g.min).key;}

export function renderOptionCard(s,item,esc=x=>x){
 const slots=optionSlots(item),opts=itemOptions(item);
 const head=`<section class="bc-upgrade-card bc-option-card"><h3>🔮 OPTIONS <strong>${opts.length}/${slots}</strong></h3>`;
 if(!slots)return head+'<p>อุปกรณ์เกรด Rare ขึ้นไปถึงจะมีช่องออปชัน (Rare 1 · Epic 2 · Legend 3 · Mythic 4)</p></section>';
 const have=`<div class="bc-option-have"><span>🔮 Option Stone ${stones(s,'optionStone')}</span><span>♻️ Re-option Stone ${stones(s,'reoptionStone')}</span></div>`;
 const lines=Array.from({length:slots},(_,i)=>{
  const o=opts[i];
  return o?`<div class="bc-option-line ${o.locked?'locked':''}"><b>${i+1}</b><span class="bc-opt-${optionGrade(o,item.rarity)}">${esc(OPTION_DEFS[o.id]?.name||o.id)} <b>+${o.value}</b><small>/${optionMax(o,item.rarity)}${OPTION_DEFS[o.id]?.unit||''}</small></span><button type="button" data-option-lock="${i}" data-option-item="${esc(item.id)}" ${s.night?'disabled':''} aria-pressed="${o.locked}" title="${o.locked?'ปลดล็อก':'ล็อกไว้ไม่ให้สุ่มใหม่'}">${o.locked?'🔒':'🔓'}</button></div>`
   :`<div class="bc-option-line empty"><b>${i+1}</b><span>ช่องว่าง</span></div>`;
 }).join('');
 const add=addOptionQuote(s,item),re=reoptionQuote(s,item);
 const addBtn=add.free>0?`<button type="button" data-option-add="${esc(item.id)}" ${add.ready?'':'disabled'}>+ เพิ่มออปชัน (🔮${ADD_COST.optionStone} · ${ADD_COST.gold}G)</button>`:'';
 const reBtn=re?`<button type="button" data-option-reroll="${esc(item.id)}" ${re.ready?'':'disabled'}>♻️ สุ่มใหม่ (♻️${re.reoptionStone} · ${re.gold}G${re.locks?` · ล็อก ${re.locks}`:''})</button>`:'';
 const note=re?.allLocked?'<small class="bc-warning">ล็อกครบทุกช่อง ปลดอย่างน้อย 1 ช่องเพื่อสุ่มใหม่</small>'
  :re?.locks?`<small>ล็อกแต่ละช่องเพิ่ม ♻️${LOCK_EXTRA.reoptionStone} + ${LOCK_EXTRA.gold}G</small>`:'<small>Option/Re-option Stone ได้จากศึก World Boss</small>';
 const legend='<small class="bc-opt-legend">ค่าที่สุ่มได้เทียบสูงสุด: <span class="bc-opt-gold">ทอง ≥80%</span> · <span class="bc-opt-purple">ม่วง ≥60%</span> · <span class="bc-opt-blue">ฟ้า ≥40%</span></small>';
 return head+have+`<div class="bc-option-lines">${lines}</div><div class="bc-option-actions">${addBtn}${reBtn}</div>${note}${opts.length?legend:''}</section>`;
}
