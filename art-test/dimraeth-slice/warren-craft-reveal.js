// Pop-up shown right after a craft: every piece in craft order, its rarity, and what happened to it
// (kept / waiting for review / auto-dismantled), revealed one card at a time.
import {armoryGearIcon,esc,itemLabel} from './warren-ui.js';

const RARITY_NAMES={normal:'Normal',good:'Good',rare:'Rare',epic:'Epic',legend:'Legend',mythic:'Mythic',whiteAscended:'White Ascended'};
const RANK=['normal','good','rare','epic','legend','mythic','whiteAscended'];
export const REVEAL_STEP_MS=110;

// Pure: turns a settleBatchCraft result into ordered cards.
export function craftRevealCards(result){
 if(!result?.made?.length)return [];
 const kept=new Set(result.retained.map(p=>p.id)),review=new Set(result.review.map(p=>p.id)),gone=new Set(result.dismantled.map(p=>p.id));
 return result.made.map(p=>({piece:p,status:gone.has(p.id)?'dismantled':review.has(p.id)?'review':kept.has(p.id)?'kept':'kept',
  reviewFor:result.reviewFor?.[p.id]||null}));
}
export function rarityCounts(cards){
 const out={};for(const c of cards)out[c.piece.rarity]=(out[c.piece.rarity]||0)+1;
 return RANK.filter(r=>out[r]).map(r=>({rarity:r,count:out[r]}));
}

export function renderCraftRevealHtml(result,classes={}){
 const cards=craftRevealCards(result);if(!cards.length)return '';
 const best=cards.reduce((b,c)=>RANK.indexOf(c.piece.rarity)>RANK.indexOf(b)?c.piece.rarity:b,'normal');
 const name=itemLabel(cards[0].piece.templateId);
 const tags={kept:'<span class="bc-reveal-tag kept">เก็บแล้ว</span>',review:'<span class="bc-reveal-tag review">รอพิจารณา</span>',dismantled:'<span class="bc-reveal-tag gone">ย่อยแล้ว</span>'};
 const grid=cards.map((c,i)=>`<div class="bc-reveal-card rarity-${esc(c.piece.rarity)} ${c.status}" style="--d:${i*REVEAL_STEP_MS}ms">
  ${armoryGearIcon(c.piece)}<b class="bc-rarity rarity-${esc(c.piece.rarity)}">${RARITY_NAMES[c.piece.rarity]||esc(c.piece.rarity)}</b>${tags[c.status]}
  ${c.reviewFor?`<small>เหมาะกับ ${esc(classes[c.reviewFor]?.name||c.reviewFor)}</small>`:''}</div>`).join('');
 const counts=rarityCounts(cards).map(x=>`<span class="bc-rarity rarity-${x.rarity}">${RARITY_NAMES[x.rarity]} ×${x.count}</span>`).join('');
 const gone=cards.filter(c=>c.status==='dismantled').length;
 return `<header class="bc-modal-header"><div><span>⚒</span><span><h2>ผลคราฟต์ ${esc(name)} ×${cards.length}</h2><small>ดีที่สุด: ${RARITY_NAMES[best]}</small></span></div><button data-craft-reveal-close aria-label="ปิด">✕</button></header>
 <div class="bc-modal-body bc-reveal-body">
  <div class="bc-reveal-grid">${grid}</div>
  <div class="bc-reveal-summary">${counts}</div>
  <p class="bc-reveal-note">${gone?`ย่อยอัตโนมัติ ${gone} ชิ้นตามเงื่อนไข Auto Dismantle · Stone Fragments +${result.fragments}`:'ไม่มีชิ้นที่ถูกย่อย'}${result.review.length?` · ${result.review.length} ชิ้นรอพิจารณา (เหมาะกับคลาสอื่น)`:''}</p>
  <div class="bc-reveal-actions"><button type="button" data-craft-reveal-skip>แสดงทั้งหมด</button><button type="button" class="bc-primary" data-craft-reveal-close>ตกลง</button></div>
 </div>`;
}
