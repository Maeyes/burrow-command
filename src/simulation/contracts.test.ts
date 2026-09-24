import { describe, expect, it } from 'vitest';
import type { SimulationCommand } from './contracts';

describe('V2 authoritative simulation contracts', () => {
  it('models player intent rather than client-authored damage', () => {
    const command: SimulationCommand = {
      type: 'basicAttack',
      playerId: 'p1',
      targetId: 'm1',
      clientSequence: 1,
    };
    expect(command.type).toBe('basicAttack');
    expect('damage' in command).toBe(false);
  });
});
