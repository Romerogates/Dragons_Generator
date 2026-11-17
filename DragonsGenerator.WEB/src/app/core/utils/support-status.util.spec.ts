import {
  supportStatusBadgeClass,
  supportStatusLabel,
  supportWaitingLabel,
  supportWaitingOn,
} from './support-status.util';

describe('supportStatusLabel', () => {
  it('maps statuses to short labels for player and staff', () => {
    expect(supportStatusLabel('open')).toBe('Ouvert');
    expect(supportStatusLabel('closed')).toBe('Fermé');
    expect(supportStatusLabel('in_progress', 'player')).toBe('En cours');
    expect(supportStatusLabel('in_progress', 'staff')).toBe('En cours');
  });
});

describe('supportStatusBadgeClass', () => {
  it('uses the same chip family for every status', () => {
    const open = supportStatusBadgeClass('open');
    const progress = supportStatusBadgeClass('in_progress');
    const closed = supportStatusBadgeClass('closed');
    expect(open).toContain('rounded-full');
    expect(progress).toContain('rounded-full');
    expect(closed).toContain('rounded-full');
    expect(open).toContain('amber');
    expect(progress).toContain('sky');
    expect(closed).toContain('slate');
  });
});

describe('supportWaitingOn', () => {
  it('marks closed tickets', () => {
    expect(supportWaitingOn('closed', false)).toBe('closed');
  });

  it('waits on the player after a staff reply', () => {
    expect(supportWaitingOn('in_progress', true)).toBe('player');
    expect(supportWaitingLabel('player', 'staff')).toBe('En attente du joueur');
  });

  it('waits on support when the player wrote last', () => {
    expect(supportWaitingOn('open', false)).toBe('support');
    expect(supportWaitingLabel('support', 'staff')).toBe('À traiter');
    expect(supportWaitingLabel('support', 'player')).toBe('En attente du support');
    expect(supportWaitingLabel('player', 'player')).toBe('À toi de répondre');
    expect(supportWaitingLabel('closed', 'player')).toBe('Fermé');
  });
});
