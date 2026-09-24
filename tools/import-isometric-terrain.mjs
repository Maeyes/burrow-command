import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { assetRoot, loadContract, manifestPath, parseArgs, projectRoot } from './terrain-contract.mjs';

export function inspectCell(image, cell, contract) {
  const column = cell.index % contract.sheet.columns;
  const row = Math.floor(cell.index / contract.sheet.columns);
  const x0 = column * contract.sheet.cellWidth;
  const y0 = row * contract.sheet.cellHeight;
  let opaque = 0;
  let transparent = 0;
  let partialAlpha = 0;
  for (let y = 0; y < contract.sheet.cellHeight; y += 1) {
    for (let x = 0; x < contract.sheet.cellWidth; x += 1) {
      const alpha = image.data[((y0 + y) * image.width + x0 + x) * 4 + 3];
      if (alpha === 0) transparent += 1;
      else if (alpha === 255) opaque += 1;
      else partialAlpha += 1;
    }
  }
  const errors = [];
  if (!opaque) errors.push('contains no visible pixels');
  if (!transparent) errors.push('contains no transparent canvas pixels');
  if (partialAlpha) errors.push(`contains ${partialAlpha} partial-alpha pixels (only 0/255 allowed)`);
  return { id: cell.id, opaque, transparent, partialAlpha, errors };
}

export function validateMaster(image, contract) {
  const errors = [];
  const { sheet } = contract;
  if (image.width !== sheet.width || image.height !== sheet.height) errors.push(`Expected ${sheet.width}x${sheet.height}; received ${image.width}x${image.height}.`);
  if (image.width % sheet.columns !== 0) errors.push(`Width ${image.width} is not divisible by ${sheet.columns} columns.`);
  if (image.height % sheet.rows !== 0) errors.push(`Height ${image.height} is not divisible by ${sheet.rows} rows.`);
  if (image.width % sheet.columns === 0 && image.width / sheet.columns !== sheet.cellWidth) errors.push(`Computed cell width is ${image.width / sheet.columns}; expected ${sheet.cellWidth}.`);
  if (image.height % sheet.rows === 0 && image.height / sheet.rows !== sheet.cellHeight) errors.push(`Computed cell height is ${image.height / sheet.rows}; expected ${sheet.cellHeight}.`);
  if (errors.length) return { errors, cells: [] };
  const cells = contract.cells.map((cell) => inspectCell(image, cell, contract));
  for (const cell of cells) for (const error of cell.errors) errors.push(`${cell.id}: ${error}.`);
  return { errors, cells };
}

export function sliceCell(image, cell, contract) {
  const result = new PNG({ width: contract.sheet.cellWidth, height: contract.sheet.cellHeight, colorType: 6 });
  const column = cell.index % contract.sheet.columns;
  const row = Math.floor(cell.index / contract.sheet.columns);
  PNG.bitblt(image, result, column * result.width, row * result.height, result.width, result.height, 0, 0);
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = loadContract();
  const source = path.resolve(projectRoot, args.source ?? 'art-test/isometric-terrain-lab/pixellab-greenfield-terrain-master.png');
  if (!fs.existsSync(source)) throw new Error(`Master sheet not found: ${source}`);
  let image;
  try { image = PNG.sync.read(fs.readFileSync(source)); }
  catch (error) { throw new Error(`Source is not a valid readable PNG: ${error.message}`); }
  const report = validateMaster(image, contract);
  if (report.errors.length) throw new Error(`Terrain import validation failed:\n- ${report.errors.join('\n- ')}\nRegenerate the PixelLab source; silent repair is forbidden.`);

  console.log(`PASS master sheet ${image.width}x${image.height}; ${report.cells.length} cells; alpha and dimensions valid.`);
  if (args.validateOnly) return;

  for (const cell of contract.cells) {
    const directory = path.join(assetRoot, cell.folder);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `${cell.id}.png`), PNG.sync.write(sliceCell(image, cell, contract), { colorType: 6, inputColorType: 6 }));
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.source.masterSheet = `/${path.relative(path.join(projectRoot, 'public'), source).replaceAll('\\', '/')}`;
  if (!source.startsWith(path.join(projectRoot, 'public'))) manifest.source.masterSheet = path.relative(projectRoot, source).replaceAll('\\', '/');
  manifest.source.generatedAt = new Date().toISOString();
  manifest.source.validation = 'mechanically-valid-pending-visual-qa';
  manifest.assets = contract.cells.map((cell) => ({
    id: cell.id,
    category: 'terrain',
    biome: 'greenfield',
    sourceFile: `/assets/isometric/greenfield/terrain/${cell.folder}/${cell.id}.png`,
    sourceCanvasWidth: contract.sheet.cellWidth,
    sourceCanvasHeight: contract.sheet.cellHeight,
    logicalTileWidth: contract.logicalTile.width,
    logicalTileHeight: contract.logicalTile.height,
    anchorX: contract.logicalTile.anchorX,
    anchorY: contract.logicalTile.anchorY,
    footprintTiles: { x: 1, y: 1 },
    collision: null,
    occlusion: false,
    variant: cell.variant,
    ...(cell.transitionType ? { transitionType: cell.transitionType, grassCornerMask: cell.grassCornerMask } : {}),
    productionStatus: 'candidate'
  }));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Imported ${manifest.assets.length} candidates and updated ${path.relative(projectRoot, manifestPath)}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
