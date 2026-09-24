import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { inspectCell, validateMaster } from './import-isometric-terrain.mjs';

const contract = {
  sheet: { columns: 1, rows: 1, cellWidth: 2, cellHeight: 2, width: 2, height: 2 },
  cells: [{ index: 0, id: 'sample' }]
};

describe('terrain master-sheet validation', () => {
  it('accepts a visible binary-alpha cell with transparent canvas', () => {
    const image = new PNG({ width: 2, height: 2 });
    image.data.fill(0);
    image.data.set([20, 40, 30, 255], 0);
    expect(validateMaster(image, contract).errors).toEqual([]);
  });

  it('rejects partial alpha instead of silently repairing it', () => {
    const image = new PNG({ width: 2, height: 2 });
    image.data.fill(0);
    image.data.set([20, 40, 30, 128], 0);
    const result = inspectCell(image, contract.cells[0], contract);
    expect(result.errors.join(' ')).toContain('partial-alpha');
  });

  it('rejects incorrect master dimensions', () => {
    const image = new PNG({ width: 3, height: 2 });
    expect(validateMaster(image, contract).errors.join(' ')).toContain('Expected 2x2');
  });
});
