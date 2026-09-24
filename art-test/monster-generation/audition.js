const canonical = [
  { id: 'goblin', displayName: 'Goblin', class: 'canonical', file: '/Sunnyside_World_Assets/Characters/Goblin/PNG/spr_walk_strip8.png', frameCount: 8, cellDimensions: { width: 96, height: 64 }, validationStatus: 'canonical' },
  { id: 'skeleton', displayName: 'Skeleton', class: 'canonical', file: '/Sunnyside_World_Assets/Characters/Skeleton/PNG/skeleton_walk_strip8.png', frameCount: 8, cellDimensions: { width: 96, height: 64 }, validationStatus: 'canonical' }
];

const manifest = await fetch('./manifest.json').then((response) => {
  if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
  return response.json();
});

const entries = [...canonical, ...manifest.monsters.filter((monster) => monster.validationStatus === 'approved')];
const views = [];
const scaleControl = document.querySelector('#scale');
const speedControl = document.querySelector('#speed');
const speedValue = document.querySelector('#speed-value');
const pauseButton = document.querySelector('#pause');
const frameReadout = document.querySelector('#frame-readout');
let paused = false;
let frame = 0;
let lastStep = performance.now();

function createCard(entry) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `<div class="stage"><canvas width="176" height="152" aria-label="${entry.displayName} walk cycle"></canvas></div>
    <div class="meta"><div class="title-row"><h3>${entry.displayName}</h3><span class="badge ${entry.class === 'canonical' ? 'canonical' : ''}">${entry.validationStatus}</span></div>
    <p class="details">8 frames · ${entry.cellDimensions.width}×${entry.cellDimensions.height}px cells<br>${entry.class === 'elite' ? 'elite visual mass' : entry.class === 'canonical' ? 'unchanged source reference' : 'normal visual mass'}</p></div>`;
  document.querySelector(entry.class === 'canonical' ? '#canonical' : '#new-monsters').append(card);
  const image = new Image();
  image.src = entry.file;
  views.push({ entry, image, canvas: card.querySelector('canvas') });
}

entries.forEach(createCard);

function frameBounds(view, frameIndex) {
  const { width, height } = view.entry.cellDimensions;
  const scan = document.createElement('canvas');
  scan.width = width; scan.height = height;
  const context = scan.getContext('2d', { willReadFrequently: true });
  context.drawImage(view.image, frameIndex * width, 0, width, height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let minX = width; let maxX = -1; let minY = height; let maxY = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (pixels[(y * width + x) * 4 + 3]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  return { minX, maxX, minY, maxY };
}

function draw(view) {
  if (!view.image.complete) return;
  const context = view.canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, view.canvas.width, view.canvas.height);
  const scale = Number(scaleControl.value);
  const { width, height } = view.entry.cellDimensions;
  const bounds = frameBounds(view, frame);
  const x = Math.round((view.canvas.width - width * scale) / 2);
  const baseline = 126;
  const y = baseline - bounds.maxY * scale;
  context.strokeStyle = '#7fa07166';
  context.setLineDash([3, 3]);
  context.beginPath(); context.moveTo(22, baseline + 0.5); context.lineTo(154, baseline + 0.5); context.stroke();
  context.setLineDash([]);
  context.drawImage(view.image, frame * width, 0, width, height, x, y, width * scale, height * scale);
}

function animate(now) {
  const delay = Number(speedControl.value);
  if (!paused && now - lastStep >= delay) { frame = (frame + 1) % 8; lastStep = now; }
  frameReadout.textContent = `Frame ${frame + 1} / 8`;
  views.forEach(draw);
  requestAnimationFrame(animate);
}

scaleControl.addEventListener('change', () => views.forEach(draw));
speedControl.addEventListener('input', () => { speedValue.textContent = `${speedControl.value} ms`; });
pauseButton.addEventListener('click', () => { paused = !paused; pauseButton.textContent = paused ? 'Play' : 'Pause'; });
requestAnimationFrame(animate);
