import {createServer} from 'vite';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
try{
 const {auditEconomy}=await server.ssrLoadModule('/tools/burrow-economy-model.js');
 const data=auditEconomy(),f=n=>n.toFixed(2),out='docs/economy-audit';
 data.sources={};
 for(const path of ['art-test/dimraeth-slice/warren.js','art-test/dimraeth-slice/warren-progression.js','art-test/dimraeth-slice/warren-phase1.js','art-test/dimraeth-slice/warren-village-buildings.js','art-test/dimraeth-slice/warren-quick-sell.js','src/simulation/monsterDataV2.ts','src/simulation/loot.ts','src/simulation/itemMasterV2.ts','src/simulation/equipmentV2.ts','art-test/iso-arena-draft/forestRoster.js','art-test/iso-arena-draft/desertRoster.js'])data.sources[path]=createHash('sha256').update(await readFile(path)).digest('hex');
 await mkdir(out,{recursive:true});
 await writeFile(out+'/rewards.json',JSON.stringify(data,null,2));
 const lines=['# Burrow Command economy audit','', 'Generated from current source with `node tools/burrow-economy-audit.mjs`. No save data accessed.', '',
 '## Assumptions',...Object.entries(data.assumptions).map(([k,v])=>`- ${k}: ${v}`),'',
 '## All playable monsters','Gold shown at entry Warren level of each map, before Workshop bonus. Item probabilities include all source tuning and runtime ×1.35.','',
 '| Map | Monster | Rank | Gold/kill | Drops: probability per kill |','|---|---|---|---:|---|'];
 for(const m of data.monsters)lines.push(`| ${m.map} | ${m.id} | ${m.rank} | ${f(m.gold)} | ${m.drops.map(d=>`${d.id} ${f(d.chance*100)}%`).join('; ')} |`);
 lines.push('','## Weighted progression','Gold and common materials exclude Workshop bonus. Night = wave 3, all kills. Per-day examples apply 75% delivery to daytime loot only.','',
 '| Lv | Map | Day G/kill | Day common/kill | Night G | Night common | G/day: 10 / 25 / 50 day kills |','|---:|---|---:|---:|---:|---:|---|');
 for(const l of data.levels){const n=l.nights[2];lines.push(`| ${l.level} | ${l.map} | ${f(l.day.gold)} | ${f(l.day.common)} | ${f(n.gold)} | ${f(n.common)} | ${[10,25,50].map(k=>f(n.gold+k*.75*l.day.gold)).join(' / ')} |`);}
 lines.push('','## Lure at map entry','Gross rewards before delivery loss/Workshop. Common reward is much smaller than the material payment; rare drops remain probabilistic.','',
 '| Lv | Mode | Cost common | Gold | Common returned | Blueprint expected | Astralite expected |','|---:|---|---:|---:|---:|---:|---:|');
 for(const l of data.levels.filter(l=>[1,6,11,16].includes(l.level)))for(const q of l.lure)lines.push(`| ${l.level} | ${q.mode} | ${q.cost} | ${f(q.gold)} | ${f(q.common)} | ${f(Object.entries(q.items).filter(([id])=>id.endsWith('Blueprint')).reduce((n,[,v])=>n+v,0))} | ${f(q.items.astraliteStone??0)} |`);
 lines.push('','## Craft costs (all supported T1/T2 recipes)','','| Recipe | Gold | Requirements |','|---|---:|---|');
 for(const r of data.recipes)lines.push(`| ${r.id} | ${r.gold} | ${r.blueprintId} ×1; ${r.oreId} ×${r.oreQty}; ${r.materials.map(m=>`${m.itemId} ×${m.qty}`).join('; ')} |`);
 lines.push('','## Refine cumulative expected cost per slot','Unprotected, starting at +0, baseGoldCost=120. Includes failures, 20% downgrade conditional on failure, and safe floors. Expected value, not a guaranteed budget.','',
 '| Target | Attempts | Gold | Astralite |','|---:|---:|---:|---:|');
 for(const r of data.refinement)lines.push(`| +${r.target} | ${f(r.attempts)} | ${f(r.gold)} | ${f(r.stones)} |`);
 lines.push('','## Enhance cumulative guaranteed cost per slot','','| Target | Gold |','|---:|---:|');
 for(const r of data.enhancement)lines.push(`| +${r.target} | ${r.gold} |`);
 await writeFile(out+'/REWARDS.md',lines.join('\n')+'\n');
 console.log(JSON.stringify({monsters:data.monsters.length,recipes:data.recipes.length,levels:data.levels.filter(l=>[1,5,6,10,11,15,16,20].includes(l.level)).map(l=>({level:l.level,dayGold:l.day.gold,dayCommon:l.day.common,nightGold:l.nights[2].gold,lure:l.lure.map(q=>({mode:q.mode,gold:q.gold,common:q.common}))}))},null,2));
}finally{await server.close();}
