import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { loadContract, parseArgs, projectRoot } from './terrain-contract.mjs';

const args = parseArgs(process.argv.slice(2));
const contract = loadContract();
const cellsDirectory = path.resolve(projectRoot, args.cells ?? 'art-test/isometric-terrain-lab/pixellab-cells');
const output = path.resolve(projectRoot, args.output ?? 'art-test/isometric-terrain-lab/pixellab-greenfield-terrain-master.png');
const sheet = new PNG({ width: contract.sheet.width, height: contract.sheet.height, colorType: 6 });

for (const cell of contract.cells) {
  const source = path.join(cellsDirectory, `${cell.id}.png`);
  if (!fs.existsSync(source)) throw new Error(`Missing PixelLab cell: ${source}`);
  const image = PNG.sync.read(fs.readFileSync(source));
  if (image.width !== contract.sheet.cellWidth || image.height !== contract.sheet.cellHeight) {
    throw new Error(`${cell.id}: expected ${contract.sheet.cellWidth}x${contract.sheet.cellHeight}, received ${image.width}x${image.height}. Regenerate; no resize or crop is permitted.`);
  }
  const column = cell.index % contract.sheet.columns;
  const row = Math.floor(cell.index / contract.sheet.columns);
  PNG.bitblt(image, sheet, 0, 0, image.width, image.height, column * image.width, row * image.height);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, PNG.sync.write(sheet, { colorType: 6, inputColorType: 6 }));
console.log(`Packed ${contract.cells.length} untouched PixelLab cells into ${path.relative(projectRoot, output)} (${sheet.width}x${sheet.height}).`);
