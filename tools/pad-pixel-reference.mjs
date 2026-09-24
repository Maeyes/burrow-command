import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, item, index, all) => {
  if (item.startsWith('--')) pairs.push([item.slice(2), all[index + 1]]);
  return pairs;
}, []));

if (!args.source || !args.output || !args.size) {
  throw new Error('Usage: node tools/pad-pixel-reference.mjs --source <png> --output <png> --size <pixels>');
}

const sourcePath = path.resolve(args.source);
const outputPath = path.resolve(args.output);
const size = Number.parseInt(args.size, 10);
const source = PNG.sync.read(fs.readFileSync(sourcePath));

if (!Number.isInteger(size) || size < source.width || size < source.height) {
  throw new Error(`Target size ${args.size} must be an integer at least ${source.width}x${source.height}.`);
}

const output = new PNG({ width: size, height: size, colorType: 6 });
const x = Math.floor((size - source.width) / 2);
const y = size - source.height;
PNG.bitblt(source, output, 0, 0, source.width, source.height, x, y);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, PNG.sync.write(output, { colorType: 6, inputColorType: 6 }));
console.log(`Padded ${source.width}x${source.height} to ${size}x${size} at (${x}, ${y}) without resampling.`);
