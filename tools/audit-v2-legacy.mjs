import fs from 'node:fs';import path from 'node:path';
const roots=['src/simulation'];const forbidden=[/data\/weave/,/systems\/weave/,/equipmentBattlePower/,/battlePower\s*[+*]/,/localStorage/];
const files=[];for(const root of roots){const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx|js|mjs)$/.test(e.name))files.push(p)}};walk(root)}
const violations=[];for(const file of files){const source=fs.readFileSync(file,'utf8');for(const pattern of forbidden)if(pattern.test(source))violations.push(`${file}: ${pattern}`)}
for(const removed of ['src/bunny','src/core','src/data','src/config','src/economy'])if(fs.existsSync(removed))violations.push(`legacy tree still exists: ${removed}`);
const systems=fs.readdirSync('src/systems');for(const f of systems)if(!['combatMath.ts','combatMath.test.ts'].includes(f))violations.push(`legacy system remains: src/systems/${f}`);
for(const entry of ['index.html','bunny.html']){const source=fs.readFileSync(entry,'utf8');if(source.includes('/src/bunny/main.ts'))violations.push(`${entry}: legacy main entry`);if(!source.includes('/art-test/iso-arena-draft/poc.js'))violations.push(`${entry}: V2 arena entry missing`)}
const arena=fs.readFileSync('art-test/iso-arena-draft/poc.js','utf8');
for(const pattern of [/applyMonsterDamage\s*\(/,/state\.gold\s*\+=/,/state\.loot\s*\+=/,/damageAmount/,/enemy\.hp\s*=/,/target\.hp\s*=/])if(pattern.test(arena))violations.push(`arena legacy writer: ${pattern}`);
if(violations.length){console.error(violations.join('\n'));process.exit(1)}console.log(`V2 legacy audit passed: ${files.length} simulation files; legacy source trees absent; V2 entrypoints active`);
