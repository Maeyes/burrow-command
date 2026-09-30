// End-of-night report: snapshot at dusk, compare at dawn. Pure; warren.js owns display.
const wallHp=fences=>(fences||[]).reduce((n,f)=>n+Math.max(0,f.hp||0),0);

export function snapshotNight(s,mats){
 return {day:s.day,kills:s.kills||0,gold:Math.floor(s.gold||0),mats:mats||0,wallHp:wallHp(s.fences),
  broken:(s.fences||[]).filter(f=>f.hp<=0).length,burrow:s.burrow||0};
}
export function summarizeNight(before,s,mats,won){
 if(!before)return null;
 const downed=(s.units||[]).filter(u=>u.down).length;
 return {won:!!won,day:before.day,
  kills:Math.max(0,(s.kills||0)-before.kills),
  gold:Math.floor(s.gold||0)-before.gold,
  mats:(mats||0)-before.mats,
  wallLost:Math.max(0,Math.round(before.wallHp-wallHp(s.fences))),
  wallBroken:Math.max(0,(s.fences||[]).filter(f=>f.hp<=0).length-before.broken),
  hallLost:Math.max(0,Math.round(before.burrow-(s.burrow||0))),
  downed,units:(s.units||[]).length};
}
const sign=n=>(n>0?'+':'')+n;
export function renderNightSummaryHtml(r,esc=String){
 if(!r)return '';
 const rows=[
  ['⚔️','ปราบมอนสเตอร์',r.kills+' ตัว'],
  ['💰','Gold',sign(r.gold)],
  ['🪨','วัตถุดิบ',sign(r.mats)],
  ['🧱','กำแพง',r.wallLost?`-${r.wallLost} HP${r.wallBroken?` · พัง ${r.wallBroken} ส่วน`:''}`:'สมบูรณ์'],
  ['🏠','โพรงกระต่าย',r.hallLost?`-${r.hallLost} HP`:'สมบูรณ์'],
  ['🐰','กระต่ายล้ม',`${r.downed}/${r.units}`]
 ];
 const tip=!r.won?'ฟาร์มกลางวันแล้วสู้เวฟเดิมอีกครั้ง':r.wallBroken?'ซ่อมกำแพงก่อนค่ำ':r.downed>r.units/2?'อัปอาวุธหรือจ้างกระต่ายเพิ่ม':'';
 return `<header><strong>${r.won?'🌅 รอดคืนที่ ':'💥 แพ้คืนที่ '}${esc(r.day)}</strong><button type="button" data-night-summary-close aria-label="ปิดสรุป">✕</button></header>
 <ul>${rows.map(([i,l,v])=>`<li><span>${i} ${l}</span><b>${esc(v)}</b></li>`).join('')}</ul>${tip?`<p>💡 ${tip}</p>`:''}`;
}
