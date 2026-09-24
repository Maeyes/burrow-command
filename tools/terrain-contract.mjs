import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const projectRoot = root;
export const contractPath = path.join(root, 'art-test', 'isometric-terrain-lab', 'generation-contract.json');
export const manifestPath = path.join(root, 'public', 'assets', 'isometric', 'greenfield', 'manifest.json');
export const assetRoot = path.join(root, 'public', 'assets', 'isometric', 'greenfield', 'terrain');

export function loadContract() {
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const { sheet, cells } = contract;
  if (sheet.columns * sheet.rows !== cells.length) throw new Error(`Contract declares ${sheet.columns * sheet.rows} cells but lists ${cells.length}.`);
  if (sheet.width !== sheet.columns * sheet.cellWidth || sheet.height !== sheet.rows * sheet.cellHeight) throw new Error('Contract sheet dimensions do not match its grid.');
  cells.forEach((cell, index) => {
    if (cell.index !== index) throw new Error(`Contract cell ${index} has non-deterministic index ${cell.index}.`);
    if (!/^[a-z0-9_]+$/.test(cell.id)) throw new Error(`Invalid asset ID: ${cell.id}`);
  });
  return contract;
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'validate-only') args.validateOnly = true;
    else args[key] = argv[++i];
  }
  return args;
}
