import {describe,it,expect} from 'vitest';
import {auditEconomy,expectedLoot,refineExpectations,DROP_MULTIPLIER} from '../../tools/burrow-economy-model.js';
import {monsterLoot,burrowMonsterGold,BURROW_GOLD_BY_STAGE} from './warren-progression.js';
import {PHASE1_STAGES} from './warren-phase1.js';
import {getRoster} from './combat/rosters.js';

describe('economy audit matches live reward tables',()=>{
 it('covers every playable roster member, every wave and all unlocked recipes',()=>{
  const audit=auditEconomy();
  const ids=PHASE1_STAGES.flatMap(s=>getRoster(s.roster,s.mapId).monsterIds);
  expect(audit.monsters.map(m=>m.id).sort()).toEqual(ids.sort());
  expect(audit.levels).toHaveLength(20);
  expect(audit.levels.every(l=>l.nights.length===5)).toBe(true);
  expect(audit.recipes.length).toBeGreaterThan(20);
  expect(audit.levels[0].nights.map(n=>n.count)).toEqual([5,7,9,11,14]);
  // Wave 3 with unchanged spawn mix: Lv5 Forest I → Lv6 Forest II.
  expect(audit.levels[4].nights[2].gold).toBeCloseTo(205.8);
  expect(audit.levels[5].nights[2].gold).toBeCloseTo(293.76);
  for(const stage of ['forest1','forest2','desert1','desert2'])for(const rank of ['normal','elite','boss'])
   expect(audit.monsters.filter(m=>m.map===stage&&m.rank===rank).every(m=>m.gold===BURROW_GOLD_BY_STAGE[stage][rank])).toBe(true);
 });
 it('analytical gold and every item expectation agree with seeded actual loot rolls for every monster',()=>{
  let seed=73621;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const row of auditEconomy().monsters){
   const expected=expectedLoot(row.id,row.warren),n=30000,items={};let gold=0;
   for(let i=0;i<n;i++){const loot=monsterLoot(row.id,rng,DROP_MULTIPLIER);gold+=burrowMonsterGold(row.id);for(const [id,q] of Object.entries(loot.items))items[id]=(items[id]??0)+q;}
   expect(Math.abs(gold/n-expected.gold),row.id).toBeLessThan(Math.max(.05,expected.gold*.006));
   expect(Object.keys(items).every(id=>id in expected.items)).toBe(true);
   for(const [id,p] of Object.entries(expected.items))expect(Math.abs((items[id]??0)/n-p),row.id+'/'+id).toBeLessThan(6*Math.sqrt(p*(1-p)/n)+.001);
  }
 },15000);
 it('keeps guaranteed +1 and includes repeat spending in higher refine targets',()=>{
  const rows=refineExpectations();expect(rows[0]).toEqual({target:1,attempts:1,gold:78,stones:1});
  expect(rows[1].attempts).toBeCloseTo(1+(1+.05*.20)/.95); // one failed +2 attempt downgrades 20% of 5% failures
  expect(rows.every((r,i)=>!i||r.gold>rows[i-1].gold)).toBe(true);
 });
});
