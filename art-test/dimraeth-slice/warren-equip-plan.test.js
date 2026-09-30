import {describe,it,expect} from 'vitest';
import {equipPlan} from './warren-equip-plan.js';
import {renderEquipPlanHtml} from './warren-extra-ui.js';
import {CLASS_IDS,EQUIPMENT_MASTER_V2,defaultBuilds,defaultProgress,defaultMastery,equipBuildItem,gearScore} from './warren-progression.js';

const classes=Object.fromEntries(CLASS_IDS.map(cls=>[cls,{icon:'🐰',name:cls}]));
let seq=0;
const piece=(templateId,rarity='rare')=>({id:'g'+(++seq),templateId,rarity,locked:false});
const state=gear=>({warren:20,night:false,gear,builds:defaultBuilds(),progress:defaultProgress(),mastery:defaultMastery(),inventory:{}});

describe('equip planner',()=>{
 it('uses real set templates',()=>{
  for(const id of ['t2TankArmor','t2DamageArmor','t2DamageAccessoryLeft','mosswoodBow'])expect(EQUIPMENT_MASTER_V2[id],id).toBeTruthy();
 });
 it('sends tank armor to a defensive class and damage gear to damage classes, one piece per class slot',()=>{
  const tank=piece('t2TankArmor','epic'),dmg=piece('t2DamageArmor','epic'),ring=piece('t2DamageAccessoryLeft','rare'),bow=piece('mosswoodBow','rare');
  const s=state([tank,dmg,ring,bow]),rows=equipPlan(s,[tank,dmg,ring,bow]);
  const pickOf=p=>rows.find(r=>r.item.id===p.id).pick;
  expect(gearScore(tank,pickOf(tank).cls)).toBeGreaterThanOrEqual(gearScore(dmg,pickOf(tank).cls));
  expect(pickOf(bow).cls).toBe('archer');
  const slots=rows.filter(r=>r.pick).map(r=>r.pick.cls+':'+r.pick.slot);
  expect(new Set(slots).size).toBe(slots.length);
 });
 it('reports what the class wears now, including its grade, and never suggests a downgrade',()=>{
  const old=piece('t2TankArmor','normal'),better=piece('t2TankArmor','legend'),worse=piece('t2TankArmor','normal');
  const s=state([old,better,worse]);CLASS_IDS.forEach((cls,i)=>{if(i===0)equipBuildItem(s,cls,null,'armor',old.id);});
  const first=CLASS_IDS[0],row=equipPlan(s,[better,worse]).find(r=>r.pick?.cls===first);
  expect(row.item.id).toBe(better.id);expect(row.pick.current.rarity).toBe('normal');expect(row.pick.delta).toBeGreaterThan(0);
 });
 it('filters by minimum rarity and skips equipped pieces',()=>{
  const a=piece('t2DamageArmor','good'),b=piece('t2DamageArmor','epic');
  expect(equipPlan(state([a,b]),[a,b],{minRarity:'rare'}).map(r=>r.item.id)).toEqual([b.id]);
 });
 it('renders item → class, the current grade and an apply-all button',()=>{
  const tank=piece('t2TankArmor','epic'),ring=piece('t2DamageAccessoryLeft','rare');
  const s={...state([tank,ring]),planMinRarity:'rare'},html=renderEquipPlanHtml(s,classes,[tank,ring]);
  expect(html).toContain('แจกของให้ทีม');expect(html).toContain('ช่องนี้ยังว่าง');
  expect(html).toContain('bc-rarity-badge rarity-epic');expect(html).toContain('data-batch-equip-all');
  expect(html).toContain('data-plan-min="epic"');
 });
});
