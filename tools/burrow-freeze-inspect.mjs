import {readdirSync,readFileSync} from 'node:fs';
const p='./dist-warren/assets/'+readdirSync('./dist-warren/assets').find(n=>/^warren-.*\.js$/.test(n));
const lines=readFileSync(p,'utf8').split('\n');
console.log('FILE',p,'LINES',lines.length);
for(const [line,col] of [[83,57123],[83,60826],[83,67442],[83,101270]]) console.log('\nAT',line,col,'\n',lines[line-1]?.slice(col-600,col+850));
