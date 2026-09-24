const canvas = document.querySelector('#terrain');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const TILE_W = 64;
const TILE_H = 32;
const ISO_X = 0.5;
const ISO_Y = 0.25;
const origin = { x: canvas.width / 2, y: 112 };
const state = { scene:'grid', debug:{ diamond:false, coordinate:false, anchor:false, id:false, transition:false }, manifest:null, images:new Map(), rawPreview:false };

function iso(x, y) {
  return { x: Math.round(origin.x + (x - y) * TILE_W * ISO_X), y: Math.round(origin.y + (x + y) * TILE_W * ISO_Y) };
}

async function loadImage(src) {
  return new Promise((resolve, reject) => { const image=new Image(); image.onload=()=>resolve(image); image.onerror=()=>reject(new Error(`Failed to load ${src}`)); image.src=src; });
}

function asset(id) { return state.manifest.assets.find((item)=>item.id===id); }
function tileForMask(mask) { return asset(`grass_dirt_mask_${String(mask).padStart(2,'0')}`); }

function debugTile(item, gx, gy, screen) {
  if (state.debug.diamond) { ctx.strokeStyle='rgba(238,213,128,.8)';ctx.beginPath();ctx.moveTo(screen.x,screen.y-16);ctx.lineTo(screen.x+32,screen.y);ctx.lineTo(screen.x,screen.y+16);ctx.lineTo(screen.x-32,screen.y);ctx.closePath();ctx.stroke(); }
  if (state.debug.anchor) { ctx.fillStyle='#ef6f67';ctx.fillRect(screen.x-2,screen.y-2,5,5); }
  const labels=[];
  if (state.debug.coordinate) labels.push(`${gx},${gy}`);
  if (state.debug.id) labels.push(item.id);
  if (state.debug.transition && item.transitionType) labels.push(item.transitionType);
  if (labels.length) { ctx.font='8px ui-monospace,monospace';ctx.textAlign='center';ctx.fillStyle='rgba(5,8,6,.86)';ctx.fillRect(screen.x-48,screen.y+18,96,11*labels.length+3);ctx.fillStyle='#f5edda';labels.forEach((label,i)=>ctx.fillText(label,screen.x,screen.y+28+i*11)); }
}

function drawTile(item, gx, gy) {
  if (!item) return;
  const screen=iso(gx,gy); const image=state.images.get(item.id);
  if (!image) return;
  // Rejected PixelLab transitions are 64x28. In RAW PREVIEW only, center them on
  // the production 64x64 canvas/anchor without resampling or modifying source files.
  const anchorX = item.anchorX ?? 32;
  const anchorY = state.rawPreview && image.height !== 64 ? image.height / 2 : (item.anchorY ?? 32);
  ctx.drawImage(image, Math.round(screen.x-anchorX), Math.round(screen.y-anchorY));
  debugTile(item,gx,gy,screen);
}

function seeded(x,y,seed=17) { const value=Math.sin(x*127.1+y*311.7+seed)*43758.5453; return value-Math.floor(value); }
function grassAt(x,y) { const n=seeded(x,y); return asset(n>.86?'grass_variant_03':n>.68?'grass_variant_02':n>.5?'grass_variant_01':'grass_base'); }

function renderGrid() {
  origin.x=150;origin.y=92;
  const cols=6;
  state.manifest.assets.forEach((item,index)=>drawTile(item,index%cols,Math.floor(index/cols)));
}

function renderSeam(variantOnly=false) {
  origin.x=canvas.width/2;origin.y=90;
  for(let sum=0;sum<18;sum+=1) for(let x=0;x<10;x+=1){const y=sum-x;if(y>=0&&y<9) drawTile(variantOnly?grassAt(x,y):grassAt(x,y),x,y);}
}

function pathMask(x,y) {
  const dirt=(px,py)=>Math.abs(px-(4+Math.round(Math.sin(py*.8)*1.4)))<=(py>=5&&py<=7?1:0);
  const grass=(px,py)=>!dirt(px,py);
  let mask=0;
  if(grass(x,y)) mask|=8;
  if(grass(x+1,y)) mask|=4;
  if(grass(x,y+1)) mask|=2;
  if(grass(x+1,y+1)) mask|=1;
  return mask;
}

function renderPath() {
  origin.x=canvas.width/2;origin.y=78;
  for(let sum=0;sum<22;sum+=1) for(let x=0;x<12;x+=1){const y=sum-x;if(y<0||y>=11)continue;const mask=pathMask(x,y);drawTile(mask===15?grassAt(x,y):tileForMask(mask),x,y);}
}

function render() {
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#17271e';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(!state.manifest?.assets.length)return;
  if(state.scene==='grid')renderGrid();else if(state.scene==='path')renderPath();else renderSeam(state.scene==='variants');
  document.querySelector('#scene-readout').textContent=state.scene.toUpperCase().replaceAll('-',' ');
}

document.querySelectorAll('input[name="scene"]').forEach((input)=>input.addEventListener('change',()=>{state.scene=input.value;render();}));
for(const key of Object.keys(state.debug)){document.querySelector(`#debug-${key}`).addEventListener('change',(event)=>{state.debug[key]=event.target.checked;render();});}

try {
  const response=await fetch('/assets/isometric/greenfield/manifest.json',{cache:'no-store'});
  if(!response.ok)throw new Error(`Manifest HTTP ${response.status}`);
  state.manifest=await response.json();

  if(!state.manifest.assets.length){
    // Visual QA escape hatch only: load PixelLab's rejected/staged cells directly.
    // Nothing is copied into production and no source PNG is resized or repaired.
    state.rawPreview=true;
    const ids=[
      'grass_base','grass_variant_01','grass_variant_02','grass_variant_03',
      'dirt_base','dirt_variant_01','dirt_variant_02',
      ...Array.from({length:16},(_,i)=>`grass_dirt_mask_${String(i).padStart(2,'0')}`)
    ];
    state.manifest.assets=ids.map((id)=>({
      id,category:'terrain',biome:'greenfield',
      sourceFile:`./pixellab-cells/${id}.png`,
      logicalTileWidth:64,logicalTileHeight:32,anchorX:32,anchorY:32,
      transitionType:id.startsWith('grass_dirt_mask_')?'RAW REJECTED TRANSITION':null,
      productionStatus:'raw-preview'
    }));
    await Promise.all(state.manifest.assets.map(async(item)=>state.images.set(item.id,await loadImage(item.sourceFile))));
    document.querySelector('#placeholder').hidden=true;
    document.querySelector('#status').textContent='PIXELLAB RAW PREVIEW · NOT PRODUCTION';
    document.querySelector('#status').className='status pending';
    render();
  } else {
    await Promise.all(state.manifest.assets.map(async(item)=>state.images.set(item.id,await loadImage(item.sourceFile))));
    document.querySelector('#status').textContent=`${state.manifest.assets.length} CANDIDATES LOADED`;
    document.querySelector('#status').className='status ready';
    render();
  }
} catch(error) {
  document.querySelector('#status').textContent=error.message;
  document.querySelector('#status').className='status error';
  document.querySelector('#placeholder').hidden=false;
}
