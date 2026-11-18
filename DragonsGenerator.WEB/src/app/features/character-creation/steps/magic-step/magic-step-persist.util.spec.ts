import { persistMagicDraft } from './magic-step-persist.util';

function base(over: Partial<Parameters<typeof persistMagicDraft>[0]> = {}) {
  const spellsById = new Map([
    ['spl-light', { id: 'spl-light', name: 'Lumière', level: 0 }],
    ['spl-fire', { id: 'spl-fire', name: 'Boule de feu', level: 3 }],
    ['spl-a', { id: 'spl-a', name: 'Trait', level: 1 }],
    ['spl-dom', { id: 'spl-dom', name: 'Soin', level: 1 }],
    ['spl-arc', { id: 'spl-arc', name: 'Arcane', level: 6 }],
    ['spl-m1', { id: 'spl-m1', name: 'Maîtrise 1', level: 1 }],
    ['spl-sig', { id: 'spl-sig', name: 'Attitré', level: 1 }],
  ]);
  return persistMagicDraft({
    casterClassIds: ['cls-mage'],
    picksByClass: { 'cls-mage': { cantrips: ['spl-light'], spells: ['spl-a', 'spl-sig', 'spl-m1'], deityId: null } },
    selectedCantrips: ['spl-ignored'],
    selectedSpells: ['spl-ignored'],
    racialGrants: [{ choiceId: 'racial', label: 'Peuple' }],
    racialCantripPicks: { racial: 'spl-light' },
    domainSpellIds: ['spl-dom'],
    arcanumLevels: [6, 7],
    arcanumPicks: { 6: 'spl-arc' },
    masteryPicks: { 1: 'spl-m1' },
    signatureIds: ['spl-sig', 'extra-ignored'],
    subclassBonusSpells: [
      { level_unlocked: 3, spells: ['spl-dom'] },
      { level_unlocked: 20, spells: ['spl-fire'] },
      { spells: [] },
    ],
    targetLevel: 6,
    deity: { id: 'd1', name: 'Aéronne' },
    domainName: 'Vie',
    domainId: 'dom-vie',
    quota: { hasFullListAccess: true, preparedSpells: 4 },
    spellsById,
    effectOf: (id) => (id ? `eff-${id}` : ''),
    ...over,
  });
}

describe('magic-step-persist.util', () => {
  it('fusionne picks, domaine, arcanes, maîtrise et attitrés', () => {
    const out = base();
    expect(out.details.confirmed).toBeTrue();
    expect(out.details.deity).toBe('Aéronne');
    expect(out.details.hasFullSpellList).toBeTrue();
    expect(out.details.preparedCount).toBe(4);
    expect(out.details.cantrips!.some((c) => c.effectSummary?.startsWith('Peuple'))).toBeTrue();
    expect(out.details.spells!.find((s) => s.refId === 'spl-dom')?.alwaysPrepared).toBeTrue();
    expect(out.details.spells!.find((s) => s.refId === 'spl-arc')?.alwaysPrepared).toBeTrue();
    expect(out.details.spells!.find((s) => s.refId === 'spl-sig')?.effectSummary).toContain('attitré');
    expect(out.details.spells!.find((s) => s.refId === 'spl-m1')?.effectSummary).toContain('Maîtrise');
    expect(out.details.oathSpells).toEqual([{ characterLevel: 3, spells: ['Soin'] }]);
    expect(out.mysticArcanumPicks['6']).toBe('spl-arc');
    expect(out.spellMasteryPicks['1']).toBe('spl-m1');
    expect(out.signatureSpellIds).toEqual(['spl-sig', 'extra-ignored']);
    expect(out.speciesChoiceAnswersPatch['racial']).toEqual(['spl-light']);
  });

  it('replie sur la sélection si aucun pick de classe, sans divinité ni quota', () => {
    const out = base({
      casterClassIds: ['cls-mage'],
      picksByClass: {},
      selectedCantrips: ['spl-light'],
      selectedSpells: ['spl-a'],
      racialGrants: [{ choiceId: 'empty', label: 'X' }],
      racialCantripPicks: {},
      domainSpellIds: [],
      arcanumLevels: [6],
      arcanumPicks: {},
      masteryPicks: {},
      signatureIds: [],
      subclassBonusSpells: [{ level_unlocked: 1, spells: undefined }],
      deity: null,
      domainName: '',
      domainId: '',
      quota: null,
      spellsById: new Map(),
    });
    expect(out.details.cantrips!.map((c) => c.refId)).toEqual(['spl-light']);
    expect(out.details.spells!.map((s) => s.refId)).toEqual(['spl-a']);
    expect(out.details.deity).toBe('');
    expect(out.details.hasFullSpellList).toBeFalse();
    expect(out.details.preparedCount).toBe(0);
    expect(out.details.mysticArcanum).toEqual([]);
    expect(out.details.spellMastery).toEqual([]);
    expect(out.speciesChoiceAnswersPatch).toEqual({});
    expect(out.details.oathSpells).toEqual([]);
  });

  it('ignore attitré et maîtrise absents de la liste', () => {
    const out = base({
      picksByClass: { 'cls-mage': { cantrips: [], spells: ['spl-a'], deityId: null } },
      domainSpellIds: [],
      arcanumLevels: [],
      arcanumPicks: {},
      masteryPicks: { 1: 'spl-missing' },
      signatureIds: ['spl-missing'],
    });
    expect(out.details.spells!.map((s) => s.refId)).toEqual(['spl-a']);
    expect(out.details.spellMastery.map((m) => m.spellId)).toEqual(['spl-missing']);
    expect(out.signatureSpellIds).toEqual(['spl-missing']);
  });

  it('ne garde que deux sorts attitrés', () => {
    const out = base({
      signatureIds: ['spl-sig', 'spl-a', 'spl-light'],
      masteryPicks: { 1: 'spl-m1', 2: 'spl-a' },
    });
    expect(out.signatureSpellIds).toEqual(['spl-sig', 'spl-a']);
    expect(out.details.spellMastery.map((m) => m.spellLevel)).toEqual([1, 2]);
  });

  it('n’ajoute pas un arcane déjà dans la liste des sorts', () => {
    const out = base({
      picksByClass: {
        'cls-mage': { cantrips: [], spells: ['spl-arc'], deityId: null },
      },
      domainSpellIds: [],
      signatureIds: [],
      masteryPicks: {},
    });
    expect(out.details.spells!.filter((s) => s.refId === 'spl-arc').length).toBe(1);
  });
});
