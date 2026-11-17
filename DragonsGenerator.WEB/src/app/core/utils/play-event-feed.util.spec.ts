import { buildPlayStageEvents, isWaitingPlayKind } from './play-event-feed.util';

describe('play-event-feed.util', () => {
  it('puts the scene pin first then combat then chat', () => {
    const events = buildPlayStageEvents({
      pin: 'L’auberge tremble',
      combatLog: ['Kael rate', 'Le loup mord'],
      chat: [{ id: 'c1', body: 'j’ouvre la porte', authorName: 'Léna' }],
    });
    expect(events[0]?.kind).toBe('scene');
    expect(events[0]?.text).toContain('auberge');
    expect(events.some((e) => e.kind === 'combat' && e.text.includes('loup'))).toBeTrue();
    expect(events.some((e) => e.text.startsWith('Léna'))).toBeTrue();
  });

  it('flags waiting kinds for the hourglass', () => {
    expect(isWaitingPlayKind('wait_turn')).toBeTrue();
    expect(isWaitingPlayKind('wait_approval')).toBeTrue();
    expect(isWaitingPlayKind('wait_table')).toBeTrue();
    expect(isWaitingPlayKind('wait_initiative')).toBeTrue();
    expect(isWaitingPlayKind('wait_session')).toBeTrue();
    expect(isWaitingPlayKind('your_turn')).toBeFalse();
    expect(isWaitingPlayKind(null)).toBeFalse();
  });

  it('skips blanks and caps the feed', () => {
    expect(buildPlayStageEvents({ pin: '  ', combatLog: ['', 'Hit'], chat: [{ body: '' }] }).map((e) => e.kind)).toEqual([
      'combat',
    ]);
    const many = buildPlayStageEvents(
      {
        pin: 'Scène',
        combatLog: Array.from({ length: 20 }, (_, i) => `L${i}`),
        chat: [{ body: 'ok', authorName: 'A' }],
      },
      3,
    );
    expect(many.length).toBe(3);
    expect(buildPlayStageEvents({ pin: null, combatLog: null, chat: null })).toEqual([]);
  });
});
