import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1')), '..');
const output = path.join(root, 'art-test', 'monster-generation', 'canonical-reference-frames');
const tightOutput = path.join(output, 'tight-24');
const sources = [
  ['goblin', path.join(root, 'Sunnyside_World_Assets', 'Characters', 'Goblin', 'PNG', 'spr_walk_strip8.png')],
  ['skeleton', path.join(root, 'Sunnyside_World_Assets', 'Characters', 'Skeleton', 'PNG', 'skeleton_walk_strip8.png')]
];
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(tightOutput, { recursive: true });
for (const [id, source] of sources) {
  const strip = PNG.sync.read(fs.readFileSync(source));
  if (strip.width !== 768 || strip.height !== 64) throw new Error(`${id}: canonical strip geometry changed.`);
  for (const frameIndex of [0, 2, 4, 6]) {
    const frame = new PNG({ width: 96, height: 64, colorType: 6 });
    PNG.bitblt(strip, frame, frameIndex * 96, 0, 96, 64, 0, 0);
    fs.writeFileSync(path.join(output, `${id}_${frameIndex}.png`), PNG.sync.write(frame, { colorType: 6, inputColorType: 6 }));
    let minX = 96; let maxX = -1; let minY = 64; let maxY = -1;
    for (let y = 0; y < 64; y += 1) for (let x = 0; x < 96; x += 1) {
      if (frame.data[(y * 96 + x) * 4 + 3] > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    if (width > 24 || height > 24) throw new Error(`${id}_${frameIndex}: cannot fit canonical pixels into 24x24 reference.`);
    const tight = new PNG({ width: 24, height: 24, colorType: 6 });
    PNG.bitblt(frame, tight, minX, minY, width, height, Math.floor((24 - width) / 2), 24 - height);
    fs.writeFileSync(path.join(tightOutput, `${id}_${frameIndex}.png`), PNG.sync.write(tight, { colorType: 6, inputColorType: 6 }));
  }
}
console.log(`Extracted exact canonical reference cells and tight 24x24 copies to ${output}.`);
