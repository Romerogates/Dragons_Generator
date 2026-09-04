import type { AbilityScores, AsiChoiceSlot, FeatureInstance } from '@core/models/Character/character';
import {
  aggregateAsiChoices,
  canAffordAbilityScore,
  computeAbilityModifiersFromScores,
  computeFinalAbilities,
  computeHitPointsMax,
  computeSecondaryClassesHitPoints,
  computePassivePerception,
} from './character-abilities.util';

const base: AbilityScores = {
  force: 8,
  dexterite: 14,
  constitution: 12,
  intelligence: 10,
  sagesse: 13,
  charisme: 9,
};

describe('character-abilities.util', () => {
  it('computeFinalAbilities clamps at 20', () => {
    const final = computeFinalAbilities(base, { force: 4 }, { force: 10 });
    expect(final.force).toBe(20);
    expect(final.dexterite).toBe(14);
  });

  it('computeAbilityModifiersFromScores follows D&D tiers', () => {
    const mods = computeAbilityModifiersFromScores({ ...base, dexterite: 14, force: 8 });
    expect(mods.dexterite).toBe(2);
    expect(mods.force).toBe(-1);
  });

  it('computeHitPointsMax uses defaults for missing hp fields', () => {
    const hp = computeHitPointsMax({
      targetLevel: 1,
      hpAtLevel1: 0,
      hpPerLevelAverage: 0,
      hitDie: 8,
      constitutionMod: 0,
      classId: 'cls-guerrier',
      subclassId: null,
      classFeatures: [],
    });
    expect(hp).toBe(8);
  });

  it('computeHitPointsMax adds draconic sorcerer bonus', () => {
    const hp = computeHitPointsMax({
      targetLevel: 3,
      hpAtLevel1: 6,
      hpPerLevelAverage: 4,
      hitDie: 6,
      constitutionMod: 1,
      classId: 'cls-ensorceleur',
      subclassId: 'subcls-lignee-draconique',
      classFeatures: [],
    });
    expect(hp).toBe(6 + 1 + 2 * (4 + 1) + 3);
  });

  it('computePassivePerception adds proficiency when trained', () => {
    expect(computePassivePerception(1, true, 2)).toBe(13);
    expect(computePassivePerception(1, false, 2)).toBe(11);
  });

  it('aggregateAsiChoices sums bonuses and feat ids', () => {
    const slots: AsiChoiceSlot[] = [
      { level: 4, mode: 'plus2', primary: 'force' },
      { level: 8, mode: 'plus1plus1', primary: 'dexterite', secondary: 'constitution' },
      { level: 12, mode: 'feat', featId: 'feat-alert' },
    ];
    const { bonuses, featIds } = aggregateAsiChoices(slots);
    expect(bonuses.force).toBe(2);
    expect(bonuses.dexterite).toBe(1);
    expect(bonuses.constitution).toBe(1);
    expect(featIds).toEqual(['feat-alert']);
  });

  it('canAffordAbilityScore respects point-buy budget', () => {
    expect(canAffordAbilityScore(8, 9, 27)).toBeTrue();
    expect(canAffordAbilityScore(8, 15, 0)).toBeFalse();
    expect(canAffordAbilityScore(8, 9, 0)).toBeFalse();
  });

  it('aggregateAsiChoices ignores incomplete slots', () => {
    const { bonuses, featIds } = aggregateAsiChoices([
      { level: 4, mode: 'plus2' },
      { level: 8, mode: 'plus1plus1', primary: 'force' },
      { level: 12, mode: 'feat' },
    ]);
    expect(Object.keys(bonuses).length).toBe(0);
    expect(featIds.length).toBe(0);
  });

  it('aggregateAsiChoices applies a feat ASI with a fixed ability code', () => {
    const feats = new Map([
      ['don-ambidextre', { ability_score_increase: { ability: 'DEX', value: 1 } }],
    ]);
    const { bonuses, featIds } = aggregateAsiChoices(
      [{ level: 4, mode: 'feat', featId: 'don-ambidextre' }],
      { feats },
    );
    expect(bonuses.dexterite).toBe(1);
    expect(featIds).toEqual(['don-ambidextre']);
  });

  it('aggregateAsiChoices resolves "spellcasting" ASI via ctx.spellcastingAbility', () => {
    const feats = new Map([
      ['don-abjurateur', { ability_score_increase: { ability: 'spellcasting', value: 1 } }],
    ]);
    const { bonuses } = aggregateAsiChoices([{ level: 4, mode: 'feat', featId: 'don-abjurateur' }], {
      feats,
      spellcastingAbility: 'intelligence',
    });
    expect(bonuses.intelligence).toBe(1);
  });

  it('aggregateAsiChoices applies a flexible ASI using the player featAbilityChoice', () => {
    const feats = new Map([['don-parangon', { ability_score_increase: { ability: 'any', value: 1 } }]]);
    const { bonuses } = aggregateAsiChoices(
      [{ level: 4, mode: 'feat', featId: 'don-parangon', featAbilityChoice: 'charisme' }],
      { feats },
    );
    expect(bonuses.charisme).toBe(1);
  });

  it('aggregateAsiChoices surfaces feat darkvision and armor benefits', () => {
    const feats = new Map([
      [
        'don-pilier-de-taverne',
        {
          benefits: [
            { type: 'darkvision', range_m: 9 },
            { type: 'proficiency', proficiency_type: 'armor', value: 'bouclier' },
          ],
        },
      ],
    ]);
    const { featDarkvisionRadius, featBonusArmor } = aggregateAsiChoices(
      [{ level: 4, mode: 'feat', featId: 'don-pilier-de-taverne' }],
      { feats },
    );
    expect(featDarkvisionRadius).toBe(9);
    expect(featBonusArmor).toEqual(['ar-bouclier']);
  });

  it('aggregateAsiChoices surfaces feat tool proficiencies and a chosen resistance', () => {
    const feats = new Map([
      [
        'don-herboriste',
        {
          benefits: [{ type: 'proficiency', proficiency_type: 'tool', value: "nécessaire d'herboristerie" }],
        },
      ],
      [
        'don-gladiateur',
        { benefits: [{ type: 'damage_resistance', choose_from: ['contondants', 'tranchants', 'perforants'] }] },
      ],
    ]);
    const { featBonusTools, featResistances } = aggregateAsiChoices(
      [
        { level: 4, mode: 'feat', featId: 'don-herboriste' },
        { level: 8, mode: 'feat', featId: 'don-gladiateur', featResistanceChoice: 'damage-tranchant' },
      ],
      { feats },
    );
    expect(featBonusTools).toEqual(['tl-necessaire-dherboristerie']);
    expect(featResistances).toEqual(['damage-tranchant']);
  });

  it('aggregateAsiChoices applies every "Talent" (flexible_points) spend type', () => {
    const feats = new Map([['don-talent', { benefits: [{ type: 'flexible_points', total: 4 }] }]]);
    const spells = new Map([['spl-lueur', { id: 'spl-lueur', name: 'Lueur', level: 0, description: 'Un sort.' } as any]]);
    const result = aggregateAsiChoices(
      [
        {
          level: 4,
          mode: 'feat',
          featId: 'don-talent',
          featTalentSpends: [
            { id: '1', type: 'skill', skillId: 'skill-arcanes' },
            { id: '2', type: 'tool', toolId: 'tl-alchimiste' },
            { id: '3', type: 'weapon', weaponId: 'wp-dague' },
            { id: '4', type: 'languages_common' },
            { id: '5', type: 'saving_throw', savingThrow: 'sagesse' },
            { id: '6', type: 'language_exotic' },
            { id: '7', type: 'ability_score', abilityKey: 'force' },
            { id: '8', type: 'armor', armorTier: 'ar-light' },
            { id: '9', type: 'expertise', expertiseSkillId: 'skill-arcanes' },
            { id: '10', type: 'attack_bonus', attackCategory: 'wp-cat-simple' },
            { id: '11', type: 'cantrips', cantripIds: ['spl-lueur'] },
          ],
        },
      ],
      { feats, spells },
    );
    expect(result.bonuses.force).toBe(1);
    expect(result.talentBonusSkills).toEqual(['skill-arcanes']);
    expect(result.featBonusTools).toEqual(['tl-alchimiste']);
    expect(result.talentBonusWeapons).toEqual(['wp-dague']);
    expect(result.talentSavingThrows).toEqual(['sagesse']);
    expect(result.talentBonusLanguageCount).toBe(3); // 2 (commune) + 1 (exotique)
    expect(result.talentRequiredExoticLanguages).toBe(1);
    expect(result.featBonusArmor).toEqual(['ar-light']);
    expect(result.talentExpertiseSkills).toEqual(['skill-arcanes']);
    expect(result.talentBonusCantrips.length).toBe(1);
    expect(result.talentBonusCantrips[0].name).toBe('Lueur');
  });

  it('aggregateAsiChoices skips talent spends when the feat is not resolvable', () => {
    const result = aggregateAsiChoices([
      {
        level: 4,
        mode: 'feat',
        featId: 'don-talent',
        featTalentSpends: [{ id: '1', type: 'skill', skillId: 'skill-arcanes' }],
      },
    ]);
    // Sans map `feats` (don introuvable), les dépenses sont tout de même agrégées (elles ne
    // dépendent pas de la définition brute du don, seulement du choix du joueur).
    expect(result.talentBonusSkills).toEqual(['skill-arcanes']);
  });

  it('computeHitPointsMax applies the Nain bâtisseur HP-per-level bonus', () => {
    const hp = computeHitPointsMax({
      targetLevel: 3,
      hpAtLevel1: 10,
      hpPerLevelAverage: 6,
      hitDie: 10,
      constitutionMod: 0,
      classId: 'cls-guerrier',
      subclassId: null,
      classFeatures: [],
      subspeciesId: 'sp-nain-batisseur',
    });
    expect(hp).toBe(10 + 2 * 6 + 3);
  });

  it('computeSecondaryClassesHitPoints returns 0 for an empty list', () => {
    expect(computeSecondaryClassesHitPoints([], 2)).toBe(0);
  });

  it('computeSecondaryClassesHitPoints sums average-per-level + CON for each secondary class', () => {
    // Guerrier niv. 2 en multiclassage (d10, moyenne 6) + Magicien niv. 1 (d6, moyenne 4), CON +1.
    const hp = computeSecondaryClassesHitPoints(
      [
        { level: 2, hitDie: 10, hpPerLevelAverage: 6 },
        { level: 1, hitDie: 6, hpPerLevelAverage: 4 },
      ],
      1,
    );
    expect(hp).toBe(2 * (6 + 1) + 1 * (4 + 1));
  });

  it('computeSecondaryClassesHitPoints falls back to floor(hitDie/2)+1 when no average is given', () => {
    const hp = computeSecondaryClassesHitPoints([{ level: 1, hitDie: 8, hpPerLevelAverage: 0 }], 0);
    expect(hp).toBe(5); // floor(8/2)+1 = 5
  });
});
