import { buildAutoCivilizationSelection, CLASS_SPELLCASTING } from '../character-auto-build.util';
import { makeCivilisation } from './spec-helpers';

describe('character-auto-build civilization', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('buildAutoCivilizationSelection', () => {
    it('maps official languages and writing systems', () => {
      const sel = buildAutoCivilizationSelection(makeCivilisation());
      expect(sel).toEqual({
        civilizationId: 'civ-ajagar',
        civilizationName: 'Ajagar',
        languages: ['Commun'],
        writingSystems: ['Runique'],
      });
    });
  });
});
