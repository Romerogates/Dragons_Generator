import {
  spellcastingDisplayLines,
  spellcastingFocusLabel,
} from './character-spellcasting-display.util';
import type { CharacterSpellcasting } from '@core/models/Character/character';

function base(kind: CharacterSpellcasting['kind'], extra: Partial<CharacterSpellcasting> = {}) {
  return {
    kind,
    ability: 'Charisme',
    spellSaveDC: 13,
    spellAttackBonus: 5,
    focus: null,
    spellSlots: [],
    cantrips: { max: 2, used: 0 },
    ...extra,
  } as CharacterSpellcasting;
}

describe('character-spellcasting-display.util', () => {
  it('returns empty for missing spellcasting', () => {
    expect(spellcastingDisplayLines(null)).toEqual([]);
    expect(spellcastingDisplayLines(undefined)).toEqual([]);
  });

  it('formats warlock arcanum and invocations', () => {
    const lines = spellcastingDisplayLines(
      base('warlock', {
        patron: 'Fiélon',
        pact: 'Pacte de la chaîne',
        eldritchInvocations: ['Agrippe-sorcier'],
        mysticArcanum: [{ spellLevel: 6, spellId: 'spl-x', spellName: 'Cercle de mort' }],
      }),
    );
    expect(lines.some((l) => l.includes('Suzerain'))).toBeTrue();
    expect(lines.some((l) => l.includes('Arcanes') && l.includes('Cercle de mort'))).toBeTrue();
    expect(lines.some((l) => l.includes('Invocations'))).toBeTrue();
  });

  it('formats sorcerer metamagic and paladin oath spells', () => {
    expect(
      spellcastingDisplayLines(
        base('sorcerer', {
          atavism: 'Draconique',
          sorceryPoints: { max: 3, current: 3 },
          metamagic: ['Sort jumeau'],
        }),
      ),
    ).toContain('Métamagie : Sort jumeau');

    expect(
      spellcastingDisplayLines(
        base('paladin', {
          oath: 'Dévotion',
          oathSpells: [{ characterLevel: 3, spells: ['Protection contre le Mal'] }],
        }),
      ).some((l) => l.includes('Sorts de serment')),
    ).toBeTrue();
  });

  it('formats wizard mastery, cleric, druid, bard, ranger and eldritch knight', () => {
    expect(
      spellcastingDisplayLines(
        base('wizard', {
          arcaneTradition: 'Évocation',
          spellMastery: [
            { spellLevel: 1, spellId: 'a', spellName: 'Bouclier' },
            { spellLevel: 2, spellId: 'b', spellName: 'Invisibilité' },
          ],
          signatureSpells: [{ spellId: 'c', spellName: 'Boule de feu' }],
        }),
      ).join('|'),
    ).toContain('Maîtrise des sorts');

    expect(
      spellcastingDisplayLines(
        base('cleric', {
          deity: 'Lune',
          domain: 'Vie',
          divineChannels: [{ id: 'ch1', name: 'Préservation', desc: '', uses: { max: 1, current: 1 } }],
        }),
      ).join('|'),
    ).toContain('Conduits');

    expect(
      spellcastingDisplayLines(
        base('druid', {
          druidCircle: 'Lune',
          circleSpells: ['Éclat'],
          mysticTranceAvailable: true,
        }),
      ),
    ).toContain('Transe mystique disponible');

    expect(spellcastingDisplayLines(base('bard', { bardicCollege: 'Lore' }))).toContain(
      'Collège : Lore',
    );
    expect(spellcastingDisplayLines(base('ranger', { knownSpellsCount: 4 }))).toContain(
      'Sorts connus : 4',
    );
    expect(
      spellcastingDisplayLines(
        base('fighter_eldritch_knight', {
          soulWeapon: {
            name: 'Lame liée',
            bondedAbilityModifiers: { intelligence: 1, sagesse: 0, charisme: 0 },
          },
        }),
      ),
    ).toContain('Arme liée : Lame liée');
    expect(spellcastingDisplayLines(base('wizard'))).toEqual([]);
  });

  it('labels focus ids', () => {
    expect(spellcastingFocusLabel('category-arcane-focus')).toBe('Focaliseur arcanique');
    expect(spellcastingFocusLabel('')).toBe('');
    expect(spellcastingFocusLabel(null)).toBe('');
  });
});
