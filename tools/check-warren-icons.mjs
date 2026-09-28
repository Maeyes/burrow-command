// Regression guard for runtime-generated Mastery and Skill image URLs.
// Vite cannot discover string-built icon paths in warren-ui.js; each
// manifest entry must exist in the original icon set AND in dist-warren.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ICON_MANIFEST} from '../art-test/iso-arena-draft/iconManifest.generated.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist-warren');
const kinds=['family','mastery','skills'];
const missing=[];
let audited=0;
for(const kind of kinds){
 const ids=ICON_MANIFEST[kind]??[];
 if(!ids.length)missing.push('Manifest folder is empty: '+kind);
 for(const id of ids){
  const rel=path.join('assets','icons',kind,id+'.png');
  for(const [label,base] of [['source',path.join(root,'public')],['build',dist]]){
   const filename=path.join(base,rel);
   if(!fs.existsSync(filename)||fs.statSync(filename).size===0)missing.push(label+': '+rel);
  }
  audited++;
 }
 console.log(kind+': '+ids.length+' referenced icon files checked');
}
const html=path.join(dist,'art-test','dimraeth-slice','warren.html');
if(!fs.existsSync(html)||!fs.readFileSync(html,'utf8').includes('/burrow-command/assets/')){
 missing.push('Warren production HTML lacks the GitHub Pages /burrow-command/ asset base');
}
if(missing.length){
 console.error('Warren icon build validation FAILED:\n'+missing.join('\n'));
 process.exitCode=1;
}else console.log('PASS: '+audited+' runtime class/mastery/skill icons are present in source and GitHub Pages build');
