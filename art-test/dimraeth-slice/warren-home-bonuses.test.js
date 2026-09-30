import {describe,it,expect} from 'vitest';
import {homeBonuses,activeHomeBonusLabels,HOME_HOUSE_BONUSES,NO_HOME_BONUS} from './warren-home-bonuses.js';
import {applyMonsterResourceBonus} from './warren-village-buildings.js';
import {HOME_ITEMS} from './warren-home-builder.js';
import {renderHomeBuilderHtml} from './warren-home-ui.js';

const home=prefabs=>({placedObjects:prefabs.map((prefab,i)=>({id:'decor-'+i,prefab}))});
describe('home house bonuses',()=>{
 it('every bonus belongs to a real house prefab',()=>{
  for(const id of Object.keys(HOME_HOUSE_BONUSES))expect(HOME_ITEMS[id]?.group).toBe('houses');
 });
 it('is zero without houses and ignores decor',()=>{
  expect(homeBonuses(home([]))).toEqual(NO_HOME_BONUS);
  expect(homeBonuses(home(['oak','bench','lantern']))).toEqual(NO_HOME_BONUS);
 });
 it('each house type counts once',()=>{
  const b=homeBonuses(home(['smithHouse','smithHouse','smithHouse','mageHouse']));
  expect(b.wallHp).toBeCloseTo(.10);expect(b.cartDamage).toBeCloseTo(.10);
 });
 it('lists active bonuses in catalog order',()=>{
  expect(activeHomeBonusLabels(home(['pavilion','farmerHouse']))).toEqual([HOME_HOUSE_BONUSES.farmerHouse.label,HOME_HOUSE_BONUSES.pavilion.label]);
 });
 it('adds house rates on top of the workshop rate',()=>{
  const s={resourceLevel:1,resourceGoldBank:0,resourceMatBank:0};
  const loot={gold:100,items:{livingMoss:100}};
  applyMonsterResourceBonus(s,loot,['livingMoss'],{gold:.03,mats:.03});
  expect(loot.gold).toBe(104);expect(loot.items.livingMoss).toBe(104);
 });
 it('shows the perk on house cards and the active summary',()=>{
  const html=renderHomeBuilderHtml({night:false,homeCategory:'houses',homeSelected:'smithHouse',homeAction:'place',homeRotation:0,gold:0,homeMats:0,
   homeBuilder:{placedObjects:[{id:'decor-1',prefab:'smithHouse',x:0,y:0}],recovery:[]}});
  expect(html).toContain('bc-home-perk on');
  expect(html).toContain('โบนัสหมู่บ้าน');
  expect(html).toContain(HOME_HOUSE_BONUSES.mageHouse.label);
 });
});
