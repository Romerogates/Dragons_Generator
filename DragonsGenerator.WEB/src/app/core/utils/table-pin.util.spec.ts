import { applyTablePin, clearTablePinState } from './table-pin.util';

describe('table-pin.util', () => {
  it('pins a message and archives the previous pin', () => {
    const next = applyTablePin({ tablePin: 'Ancien', tablePinHistory: [] }, 'Nouveau');
    expect(next.tablePin).toBe('Nouveau');
    expect(next.tablePinHistory?.[0].body).toBe('Ancien');
  });

  it('unpins to null and archives current', () => {
    const next = clearTablePinState({
      tablePin: 'Objectif',
      tablePinHistory: [],
    });
    expect(next.tablePin).toBeNull();
    expect(next.tablePinHistory?.[0].body).toBe('Objectif');
  });

  it('ignores empty pin body', () => {
    const next = applyTablePin({ tablePin: 'Keep', tablePinHistory: [] }, '   ');
    expect(next.tablePin).toBe('Keep');
  });

  it('pins when there is no previous pin and keeps existing history', () => {
    const history = [{ at: '2026-01-01T00:00:00.000Z', body: 'Old' }];
    const next = applyTablePin({ tablePin: null, tablePinHistory: history }, 'Premier');
    expect(next.tablePin).toBe('Premier');
    expect(next.tablePinHistory).toEqual(history);
  });

  it('pins with undefined history when no previous pin', () => {
    const next = applyTablePin({ tablePin: '   ', tablePinHistory: undefined }, 'Hello');
    expect(next.tablePin).toBe('Hello');
    expect(next.tablePinHistory).toEqual([]);
  });

  it('attaches messageId to archived previous pin when bodies match', () => {
    const next = applyTablePin(
      { tablePin: 'Ancien', tablePinHistory: [] },
      'Nouveau',
      'msg-42',
    );
    expect(next.tablePinHistory?.[0].body).toBe('Ancien');
    expect(next.tablePinHistory?.[0].messageId).toBe('msg-42');
  });

  it('does not attach messageId when archived body differs', () => {
    const next = applyTablePin(
      {
        tablePin: 'Ancien',
        tablePinHistory: [{ at: '2026-01-01T00:00:00.000Z', body: 'Autre' }],
      },
      'Nouveau',
      'msg-99',
    );
    // history[0] is the newly archived "Ancien" — messageId attached
    expect(next.tablePinHistory?.[0].messageId).toBe('msg-99');
    expect(next.tablePinHistory?.[0].body).toBe('Ancien');
  });

  it('truncates pin body to 280 chars', () => {
    const long = 'x'.repeat(300);
    const next = applyTablePin({ tablePin: null, tablePinHistory: [] }, long);
    expect(next.tablePin?.length).toBe(280);
  });

  it('caps pin history at 10 entries', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      at: `2026-01-0${(i % 9) + 1}T00:00:00.000Z`,
      body: `h${i}`,
    }));
    const next = applyTablePin(
      { tablePin: 'Prev', tablePinHistory: history },
      'Fresh',
    );
    expect(next.tablePinHistory?.length).toBe(10);
    expect(next.tablePinHistory?.[0].body).toBe('Prev');
  });

  it('clearTablePinState with no pin leaves history unchanged', () => {
    const history = [{ at: '2026-01-01T00:00:00.000Z', body: 'Keep' }];
    const next = clearTablePinState({ tablePin: null, tablePinHistory: history });
    expect(next.tablePin).toBeNull();
    expect(next.tablePinHistory).toEqual(history);
  });

  it('clearTablePinState with whitespace-only pin and undefined history', () => {
    const next = clearTablePinState({ tablePin: '   ', tablePinHistory: undefined });
    expect(next.tablePin).toBeNull();
    expect(next.tablePinHistory).toEqual([]);
  });

  it('clearTablePinState archives trimmed previous pin into undefined history', () => {
    const next = clearTablePinState({ tablePin: '  Focus  ', tablePinHistory: undefined });
    expect(next.tablePinHistory?.[0].body).toBe('Focus');
  });
});
