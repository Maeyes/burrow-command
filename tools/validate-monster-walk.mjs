import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const sourceArg = process.argv.indexOf('--source');
if (sourceArg < 0 || !process.argv[sourceArg + 1]) throw new Error('Usage: node tools/validate-monster-walk.mjs --source <strip.png>');
const source = path.resolve(process.argv[sourceArg + 1]);
const image = PNG.sync.read(fs.readFileSync(source));
const errors = [];
if (image.width % 8 !== 0) errors.push(`Width ${image.width} is not divisible into 8 equal cells.`);
const cellWidth = image.width / 8;
if (!Number.isInteger(cellWidth) || cellWidth <= 0 || image.height <= 0) errors.push('Invalid cell geometry.');

const frames = [];
if (!errors.length) {
  for (let frame = 0; frame < 8; frame += 1) {
    let opaque = 0; let transparent = 0; let partialAlpha = 0;
    let minX = cellWidth; let maxX = -1; let minY = image.height; let maxY = -1;
    for (let y = 0; y < image.height; y += 1) for (let x = 0; x < cellWidth; x += 1) {
      const alpha = image.data[(y * image.width + frame * cellWidth + x) * 4 + 3];
      if (alpha === 0) transparent += 1;
      else {
        if (alpha === 255) opaque += 1; else partialAlpha += 1;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    if (!opaque) errors.push(`Frame ${frame} has no opaque pixels.`);
    if (!transparent) errors.push(`Frame ${frame} has no transparent pixels.`);
    if (partialAlpha) errors.push(`Frame ${frame} has ${partialAlpha} partial-alpha pixels.`);
    frames.push({ frame, opaque, transparent, partialAlpha, bounds: { minX, minY, maxX, maxY }, feetY: maxY });
  }
  const feet = frames.map((frame) => frame.feetY);
  const spread = Math.max(...feet) - Math.min(...feet);
  if (spread > 2) errors.push(`Feet baseline varies by ${spread}px (${feet.join(', ')}); maximum allowed is 2px.`);
}

const report = { source, sheet: `${image.width}x${image.height}`, frameCount: 8, cell: `${cellWidth}x${image.height}`, frames, status: errors.length ? 'rejected' : 'mechanically-valid', errors };
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
