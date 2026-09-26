import {quoteQuickSell,NPC_COMMON_PRICES,SELL_RESERVES} from './warren-quick-sell.js';
import {itemLabel,gameIcon,esc} from './warren-ui.js';
export function renderQuickSellHtml(s){
 const reserve=s.sellReserve??300,chosen=s.sellSelected||Object.keys(NPC_COMMON_PRICES);
 const quote=quoteQuickSell(s.inventory,reserve,chosen);
 const rows=Object.entries(NPC_COMMON_PRICES).map(([id,price])=>{
  const n=Math.max(0,Math.floor(s.inventory[id]||0)),checked=chosen.includes(id),line=quote.rows.find(r=>r.id===id);
  return '<label class="bc-sale-row"><input type="checkbox" data-sell-item="'+id+'" '+(checked?'checked':'')+' '+(s.night?'disabled':'')+'>'+
   gameIcon(id,'item','▧','bc-sale-icon')+'<span><b>'+esc(itemLabel(id))+'</b><small>มี '+n+' · เก็บ '+Math.min(n,reserve)+' · ราคา '+price+' G/ชิ้น</small></span>'+
   '<strong>'+(checked&&line?'ขาย '+line.qty+' · '+line.gold+'G':'—')+'</strong></label>';
 }).join('');
 return '<header class="bc-modal-header"><div>🪙 <span><h2>Quick Sell · ขายของส่วนเกิน</h2><small>ขายให้ NPC ทันที · ไม่ใช่ตลาดผู้เล่น</small></span></div><button data-modal-close aria-label="ปิดหน้าต่าง">✕</button></header>'+
 '<div class="bc-modal-body"><div class="bc-sell-bar"><label>เก็บสำรองต่อชนิด '+
 '<select id="sellReserve" '+(s.night?'disabled':'')+'>'+SELL_RESERVES.map(n=>'<option value="'+n+'" '+(reserve===n?'selected':'')+'>'+n+' ชิ้น</option>').join('')+'</select></label>'+
 '<p>ขายเฉพาะวัตถุดิบทั่วไปที่เลือก · Blueprint หินอัปเกรด และอุปกรณ์ทุกชนิดไม่อยู่ในรายการ</p></div>'+
 '<div class="bc-sale-list">'+rows+'</div>'+
 '<div class="bc-sale-footer"><div><b>ขาย '+quote.quantity+' ชิ้น</b><span>รับ '+quote.gold.toLocaleString()+' Gold · สำรองชนิดละ '+reserve+' ชิ้น</span></div>'+
 '<button id="sellPreview" '+(s.night||!quote.quantity?'disabled':'')+'>ตรวจรายการขาย</button></div>'+
 (s.sellConfirm?'<section class="bc-sale-confirm"><h3>ยืนยันขาย '+quote.quantity+' ชิ้น รับ '+quote.gold+' Gold</h3>'+
 '<p>'+quote.rows.map(r=>esc(itemLabel(r.id))+' ×'+r.qty+' = '+r.gold+'G').join(' · ')+'</p>'+
 '<button id="sellConfirm" '+(s.night||!quote.quantity?'disabled':'')+'>ยืนยันขายให้ NPC</button><button id="sellCancel">ยกเลิก</button></section>':'')+'</div>';
}
