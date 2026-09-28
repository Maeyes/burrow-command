import fs from 'node:fs';
import path from 'node:path';
import {PNG} from 'pngjs';

const source=process.argv[2]||'artifacts/burrow-assets/ancient-dragon-v1/animation-draft.png';
const outDir=process.argv[3]||'art-test/dimraeth-slice/assets/mythic/ancient-dragon';
const png=PNG.sync.read(fs.readFileSync(source));
const cols=4,rows=2,cellW=Math.floor(png.width/cols),cellH=Math.floor(png.height/rows);
fs.mkdirSync(outDir,{recursive:true});

for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
 const raw=new PNG({width:cellW,height:cellH});
 for(let y=0;y<cellH;y++)for(let x=0;x<cellW;x++){
  const si=((row*cellH+y)*png.width+col*cellW+x)*4,di=(y*cellW+x)*4;
  raw.data[di]=png.data[si];raw.data[di+1]=png.data[si+1];raw.data[di+2]=png.data[si+2];raw.data[di+3]=png.data[si+3];
 }
 const name=`${row?'attack':'walk'}-${String(col+1).padStart(2,'0')}.png`;
 fs.writeFileSync(path.join(outDir,name),PNG.sync.write(raw));
}
