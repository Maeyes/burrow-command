import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, item, index, all) => {
  if (item.startsWith('--')) pairs.push([item.slice(2), all[index + 1]]);
  return pairs;
}, []));
if (!args.frames || !args.output) throw new Error('Usage: node tools/pack-monster-walk.mjs --frames <directory> --output <strip.png>');
const frameDirectory = path.resolve(args.frames);
const output = path.resolve(args.output);
const frames = [];
let frameWidth = 0;
let frameHeight = 0;
for (let index = 0; index < 8; index += 1) {
  const source = path.join(frameDirectory, `frame_${index}.png`);
  if (!fs.existsSync(source)) throw new Error(`Missing frame: ${source}`);
  const frame = PNG.sync.read(fs.readFileSync(source));
  if (!index) { frameWidth = frame.width; frameHeight = frame.height; }
  if (frame.width !== frameWidth || frame.height !== frameHeight) throw new Error(`frame_${index}: expected ${frameWidth}x${frameHeight}, received ${frame.width}x${frame.height}; repair is forbidden.`);
  frames.push(frame);
}
const strip = new PNG({ width: frameWidth * 8, height: frameHeight, colorType: 6 });
frames.forEach((frame, index) => PNG.bitblt(frame, strip, 0, 0, frameWidth, frameHeight, index * frameWidth, 0));
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, PNG.sync.write(strip, { colorType: 6, inputColorType: 6 }));
console.log(`Packed 8 untouched ${frameWidth}x${frameHeight} frames into ${output}.`);
