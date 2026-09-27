import {describe,it,expect} from 'vitest';
import {CLASS_IDS,FIELD_SQUAD_GATES,MAX_FIELD_PER_CLASS,fieldSquadCap,fieldClassCap,migrateSave} from './warren-progression.js';

const unit=(cls,name=cls)=>({cls,name,level:8,exp:27});
const raw=(warren,units)=>({v:3,warren,day:12,wave:3,gold:250,
  units,towers:[{x:200,y:200,hp:400,level:2,garrison:{cls:'archer',name:'Tower Archer',level:6}}],
  reserve:[unit('scout','Previously Reserved')]});

describe('Burrow Command field recruitment',()=>{
 it('opens seven classes, grows to fourteen, then unlocks seven slots and removes the class cap at Lv 15',()=>{
  expect(CLASS_IDS).toHaveLength(7);
  expect(FIELD_SQUAD_GATES).toEqual([{level:1,slots:7},{level:5,slots:9},{level:7,slots:11},{level:9,slots:14},{level:15,slots:21}]);
  for(const [level,slots,perClass] of [
   [1,7,1],[4,7,1],[5,9,2],[6,9,2],[7,11,2],[8,11,2],[9,14,2],[14,14,2],[15,21,21],[20,21,21]
  ]) {
   expect(fieldSquadCap(level)).toBe(slots);
   expect(fieldClassCap(level)).toBe(perClass);
  }
  expect(MAX_FIELD_PER_CLASS).toBe(2);
 });
 it('Lv 15 accepts a full twenty-one-rabbit team from one class',()=>{
  const guards=Array.from({length:24},(_,i)=>unit('guard','Guard '+(i+1)));
  const s=migrateSave(raw(15,guards));
  expect(s.units).toHaveLength(21);
  expect(s.units.every(u=>u.cls==='guard')).toBe(true);
  expect(s.reserve.map(u=>u.name)).toEqual(['Previously Reserved','Guard 22','Guard 23','Guard 24']);
 });
 it('preserves all seven distinct early field recruits; early same-class extras go to reserve',()=>{
  const original=[unit('guard','Pip'),unit('guard','Maple'),...CLASS_IDS.filter(cls=>cls!=='guard').map(cls=>unit(cls))];
  const result=migrateSave(raw(3,original));
  expect(result.units.map(u=>u.cls)).toEqual(CLASS_IDS);
  expect(result.units[0].name).toBe('Pip');
  expect(result.reserve.map(u=>u.name)).toEqual(['Previously Reserved','Maple']);
  expect(result.towers[0].garrison).toMatchObject({cls:'archer',name:'Tower Archer'});
  expect(migrateSave(result).units).toEqual(result.units);
  expect(migrateSave(result).reserve).toEqual(result.reserve);
 });
 it('at Lv 5 and 7 accepts two duplicates when slots permit; Lv 9 allows two of every class',()=>{
  const fourteen=[...CLASS_IDS.map(cls=>unit(cls)),...CLASS_IDS.map(cls=>unit(cls,'Second '+cls))];
  const expected={5:[...CLASS_IDS,'guard','archer'],
    7:[...CLASS_IDS,'guard','archer','scout','brute'],
    9:[...CLASS_IDS,...CLASS_IDS]};
  for(const level of [5,7,9]){
   const s=migrateSave(raw(level,fourteen));
   expect(s.units.map(u=>u.cls)).toEqual(expected[level]);
   expect(s.units).toHaveLength(fieldSquadCap(level));
   for(const cls of CLASS_IDS)expect(s.units.filter(u=>u.cls===cls).length).toBeLessThanOrEqual(2);
   expect(s.reserve).toHaveLength(fourteen.length-fieldSquadCap(level)+1);
   expect(s.towers[0].garrison.name).toBe('Tower Archer');
  }
  const excess=migrateSave(raw(9,[unit('guard','One'),unit('guard','Two'),unit('guard','Three')]));
  expect(excess.units.map(u=>u.name)).toEqual(['One','Two']);
  expect(excess.reserve.map(u=>u.name)).toContain('Three');
 });
});
