import { magicAbilityToKey, restoreMagicDraft } from './magic-step-restore.util';

describe('magic-step-restore.util', () => {
  it('mappe les alias de caractéristique', () => {
    expect(magicAbilityToKey('Force')).toBe('force');
    expect(magicAbilityToKey('wis')).toBe('sagesse');
    expect(magicAbilityToKey('nope')).toBeNull();
  });

  it('restaure cantrips hors sorts raciaux et arcanes', () => {
    const restored = restoreMagicDraft({
      speciesChoiceAnswers: { racial: ['spl-light'] },
      racialChoiceIds: ['racial'],
      activeClassId: 'cls-mage',
      deities: [{ id: 'd1', name: 'Aéronne' }],
      mysticArcanumPicks: {},
      spellMasteryPicks: { '1': 'spl-m' },
      signatureSpellIds: ['spl-sig'],
      details: {
        deity: 'Aéronne',
        cantrips: [{ refId: 'spl-light' }, { refId: 'spl-fire' }],
        spells: [
          { refId: 'spl-a', alwaysPrepared: false },
          { refId: 'spl-arc', alwaysPrepared: false },
        ],
        mysticArcanum: [{ spellLevel: 6, spellId: 'spl-arc' }],
        byClass: {
          'cls-mage': { cantrips: ['spl-fire'], spells: ['spl-a'], deityId: 'd1' },
        },
      },
    });
    expect(restored.racialCantripPicks['racial']).toBe('spl-light');
    expect(restored.selectedCantrips).toEqual(['spl-fire']);
    expect(restored.selectedSpells).toEqual(['spl-a']);
    expect(restored.selectedDeityId).toBe('d1');
    expect(restored.arcanumPicks[6]).toBe('spl-arc');
    expect(restored.masteryPicks[1]).toBe('spl-m');
    expect(restored.signatureIds).toEqual(['spl-sig']);
  });

  it('restaure arcanes / maîtrise depuis le brouillon si pas dans details', () => {
    const restored = restoreMagicDraft({
      speciesChoiceAnswers: {},
      racialChoiceIds: [],
      details: undefined,
      activeClassId: null,
      deities: [],
      mysticArcanumPicks: { '6': 'spl-x' },
      spellMasteryPicks: {},
      signatureSpellIds: [],
    });
    expect(restored.arcanumPicks[6]).toBe('spl-x');
    expect(restored.selectedCantrips).toEqual([]);
  });
});
