// Small daytime material sink: no boss summon, no interference with the five-wave night ladder.
import {LURE_MODES,lureQuote,stageForWarren,frontierStage} from './warren-phase1.js';
import {gameIcon} from './warren-ui.js';
export function renderLureHtml(s,materials){
 const current=stageForWarren(s.warren),next=frontierStage(s.warren);
 const descriptions={small:'เรียกฝูงมอนสเตอร์ทั่วไปจากภูมิภาคปัจจุบัน · ของดรอปตามมอนจริง',
  elite:'เพิ่มจำนวน Elite จากภูมิภาคปัจจุบัน · ศัตรูโจมตีแรงขึ้น',
  frontier:'เรียกมอนสเตอร์จากโซนถัดไปก่อนปลดล็อก · ไม่มีบอส'};
 const disabledReason=mode=>s.night?'ใช้ได้เฉพาะกลางวัน':s.lureDay===s.day?'ใช้เหยื่อล่อของวันนี้แล้ว':mode==='frontier'&&!next?'ยังไม่มี Frontier ใน Phase 1':'';
 return '<header class="bc-modal-header"><div>'+gameIcon('monster','ui','◈','bc-header-icon')+
  '<span><h2>Threat Lure · ล่อมอนสเตอร์</h2><small>ลงทุนวัตถุดิบทั่วไปเพื่อเลือกความยากของการฟาร์ม</small></span></div>'+
  '<button class="modal-close" data-modal-close aria-label="ปิดหน้าต่าง">✕</button></header>'+
  '<div class="bc-modal-body bc-lure-body"><p class="bc-help">โซน '+current.name+
  ' · วัตถุดิบพร้อมใช้ '+materials.toLocaleString()+' ชิ้น · ล่อได้วันละหนึ่งครั้ง ไม่กระทบเวฟกลางคืน</p>'+
  '<div class="bc-lure-modes">'+Object.entries(LURE_MODES).map(([mode,def])=>{
   const quote=lureQuote(s,mode),reason=disabledReason(mode),locked=!quote||!quote.canUse||materials<def.mats;
   return '<article class="bc-lure-option"><div><h3>'+def.label+'</h3><p>'+descriptions[mode]+
    (mode==='frontier'&&next?' · '+next.name:'')+'</p><small>'+def.count+
    ' ตัว · พลังโจมตีและ HP ×'+def.power.toFixed(2)+'</small></div>'+
    '<button data-lure="'+mode+'" '+(locked?'disabled':'')+'>'+def.mats+
    ' วัตถุดิบ</button>'+(reason?'<small class="bc-lure-locked">'+reason+'</small>':
    materials<def.mats?'<small class="bc-lure-locked">วัตถุดิบไม่พอ</small>':'')+'</article>';
  }).join('')+'</div></div>';
}
