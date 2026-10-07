import { supportStatusLabel } from './support-status.util';

describe('supportStatusLabel', () => {
  it('maps statuses for player and staff', () => {
    expect(supportStatusLabel('open')).toBe('Ouvert');
    expect(supportStatusLabel('closed')).toBe('Fermé');
    expect(supportStatusLabel('in_progress', 'player')).toBe('Le support consulte');
    expect(supportStatusLabel('in_progress', 'staff')).toBe('En cours');
  });
});
