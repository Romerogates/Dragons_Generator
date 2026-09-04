import { extractSpellSlotsFromResources, extractPactSlotsFromResources, maxSpellLevelFromSlots } from './feature-uses.util';
import {
  classBonusLanguageCount,
  classRootRequiredExoticLanguageCount,
  classRootRequiredBaseLanguageCount,
  extractWeaponProficiencyChoices,
  extractToolProficiencyChoices,
  countAsiSlots,
  spellProgressionMilestones,
} from './progression-choices.util';
import { normalizeCharacterClass } from './class-data.adapter';

/** Prêtre niv. 10 — emplacements JSON non-SRD. */
const PRETRE_L10_SLOTS = { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 };

describe('High-level progression (6–20)', () => {
  it('extracts spell slots from class JSON resources', () => {
    const slots = extractSpellSlotsFromResources({ spell_slots: PRETRE_L10_SLOTS });
    expect(slots).toEqual([
      { level: 1, max: 4 },
      { level: 2, max: 3 },
      { level: 3, max: 3 },
      { level: 4, max: 3 },
      { level: 5, max: 2 },
    ]);
    expect(maxSpellLevelFromSlots(slots)).toBe(5);
  });

  it('counts ASI slots at level 5 vs 20 from progression features', () => {
    const cls = normalizeCharacterClass({
      id: 'cls-test',
      name: 'Test',
      data: {
        progression: [
          { level: 4, features: ['feat-asi-niv4'] },
          { level: 8, features: ['feat-asi-niv8'] },
          { level: 12, features: ['feat-asi-niv12'] },
          { level: 16, features: ['feat-asi-niv16'] },
          { level: 19, features: ['feat-asi-niv19'] },
        ],
      },
    } as any);
    expect(countAsiSlots(cls, 5)).toBe(1);
    expect(countAsiSlots(cls, 20)).toBe(5);
  });

  it('defers Lettré weapon and tool proficiency pools to skills step', () => {
    const lettre = normalizeCharacterClass({
      id: 'cls-lettre',
      name: 'Lettré',
      data: {
        choice_pools: [
          {
            id: 'choice-weapons-cls-lettre',
            type: 'weapon_proficiency',
            quantity: 2,
            pool: ['wp-any'],
            constraint_max_price_po: 25,
            unlocked_at_level: 1,
          },
          {
            id: 'choice-tools-cls-lettre',
            type: 'tool_proficiency',
            quantity: 3,
            pool: ['tl-any'],
            unlocked_at_level: 1,
          },
          {
            id: 'choice-languages-cls-lettre',
            type: 'language_proficiency',
            quantity: 3,
            pool: ['lang-any'],
            unlocked_at_level: 1,
          },
        ],
        progression: [{ level: 1, features: [] }],
      },
    } as any);

    const weapons = extractWeaponProficiencyChoices(lettre, 1);
    const tools = extractToolProficiencyChoices(lettre, 1);
    expect(weapons.length).toBe(1);
    expect(weapons[0].count).toBe(2);
    expect(weapons[0].meta?.['maxPricePo']).toBe(25);
    expect(tools.length).toBe(1);
    expect(tools[0].count).toBe(3);
    expect(classBonusLanguageCount(lettre, 1)).toBe(3);
    // Pool "lang-any" : pas de contrainte exotique (choix libre parmi toutes les langues).
    expect(classRootRequiredExoticLanguageCount(lettre, 1)).toBe(0);
  });

  it('flags class-root language pools restricted to exotic-only tokens (Prêtre/Magicien/Sorcier)', () => {
    const pretre = normalizeCharacterClass({
      id: 'cls-pretre',
      name: 'Prêtre',
      data: {
        choice_pools: [
          {
            id: 'choice-language-cls-pretre',
            type: 'language_proficiency',
            quantity: 1,
            pool: ['category-exotic-languages'],
            unlocked_at_level: 1,
          },
        ],
        progression: [{ level: 1, features: [] }],
      },
    } as any);
    expect(classBonusLanguageCount(pretre, 1)).toBe(1);
    expect(classRootRequiredExoticLanguageCount(pretre, 1)).toBe(1);

    const magicien = normalizeCharacterClass({
      id: 'cls-magicien',
      name: 'Magicien',
      data: {
        choice_pools: [
          {
            id: 'choice-language-cls-magicien',
            type: 'language_proficiency',
            quantity: 1,
            pool: ['lang-category-exotique'],
            unlocked_at_level: 1,
          },
        ],
        progression: [{ level: 1, features: [] }],
      },
    } as any);
    expect(classRootRequiredExoticLanguageCount(magicien, 1)).toBe(1);
  });

  it('flags class-root language pools restricted to common-only tokens (Barde "Langues communes")', () => {
    const barde = normalizeCharacterClass({
      id: 'cls-barde',
      name: 'Barde',
      data: {
        choice_pools: [
          {
            id: 'choice-languages-cls-barde',
            type: 'language_proficiency',
            quantity: 2,
            pool: ['category-common-languages'],
            unlocked_at_level: 1,
          },
        ],
        progression: [{ level: 1, features: [] }],
      },
    } as any);
    expect(classBonusLanguageCount(barde, 1)).toBe(2);
    expect(classRootRequiredBaseLanguageCount(barde, 1)).toBe(2);
    expect(classRootRequiredExoticLanguageCount(barde, 1)).toBe(0);
  });

  it('extracts warlock pact slots from JSON resources', () => {
    const slots = extractPactSlotsFromResources({ pact_slots_count: 3, pact_slot_level: 5 });
    expect(slots).toEqual([{ level: 5, max: 3 }]);
  });

  it('lists spell progression milestones up to target level', () => {
    const cls = {
      id: 'cls-sorcier',
      name: 'Sorcier',
      data: {
        progression: [
          { level: 6, spell_choices: [{ count: 1, label: 'Sort occulte' }] },
          { level: 11, choice_pools_active: [{ type: 'spell_known', quantity: 1, label: 'Arcane' }] },
        ],
      },
    } as unknown as import('@core/models/CharacterClasses/character-class').CharacterClass;
    expect(spellProgressionMilestones(cls, 10)).toEqual([
      { level: 6, count: 1, label: 'Sort occulte' },
    ]);
    expect(spellProgressionMilestones(cls, 20).length).toBe(2);
  });
});
