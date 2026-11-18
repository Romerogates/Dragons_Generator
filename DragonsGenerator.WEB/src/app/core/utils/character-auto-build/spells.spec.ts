import { buildAutoSpellcastingDetails, CLASS_SPELLCASTING } from '../character-auto-build.util';
import { makeGuerrierCls, makeMagicienCls, evaluatePreparedFormula, resolveSpellQuota, spellPickCount, extractSubclassBonusSpells, featAsiAbilityOptions, featAsiNeedsAbilityChoice, featBonusArmorProficiencies, featBonusToolProficiencies, featDarkvisionRadius, featFlexiblePointsTotal, featIsFlexiblePoints, featNeedsResistanceChoice, featResistanceOptions, isTalentSpendComplete, resolveFeatAsiAbilityKey, talentSpendsTotalCost } from './spec-helpers';
import type { CharacterClass, Spell } from './spec-helpers';
describe('character-auto-build spells', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('buildAutoSpellcastingDetails', () => {
    it('returns null for a non-caster class', () => {
      expect(buildAutoSpellcastingDetails(makeGuerrierCls(), [], [], {})).toBeNull();
    });

    it('returns an empty shell when the resolved kind has no quota configured', () => {
      (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'] = {
        kind: 'no-quota-kind',
        ability: 'Force',
      };
      const cls: CharacterClass = {
        id: 'cls-test-inconnu',
        name: 'Test',
        data: {} as any,
      } as unknown as CharacterClass;
      expect(buildAutoSpellcastingDetails(cls, [], [], {})).toEqual({ cantrips: [], spells: [] });
    });

    it('builds cantrips/spells for a wizard-like class, merging racial cantrip grants', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const spells: Spell[] = [
        { id: 'spl-lueur', name: 'Lueur', level: 0, description: 'Lumière.', classes: ['cls-magicien'] } as unknown as Spell,
        {
          id: 'spl-tour-de-magie-2',
          name: 'Tour de magie 2',
          level: 0,
          description: '...',
          classes: ['cls-magicien'],
        } as unknown as Spell,
        {
          id: 'spl-tour-de-magie-3',
          name: 'Tour de magie 3',
          level: 0,
          description: '...',
          classes: ['cls-magicien'],
        } as unknown as Spell,
        {
          id: 'spl-projectile-magique',
          name: 'Projectile magique',
          level: 1,
          description: '...',
          classes: ['cls-magicien'],
        } as unknown as Spell,
        {
          id: 'spl-bouclier',
          name: 'Bouclier',
          level: 1,
          description: '...',
          classes: ['cls-magicien'],
        } as unknown as Spell,
      ];
      const racialGrants = [
        { choiceId: 'elf-cantrip', label: '', desc: '', pool: ['spl-lueur'], spellLevel: 0, spellcastingAbility: 'Intelligence' },
      ];
      const details = buildAutoSpellcastingDetails(makeMagicienCls(), spells, racialGrants, {}) as {
        cantrips: { refId: string }[];
        spells: { refId: string }[];
      };
      expect(details.cantrips.length).toBe(3); // 3 quota, dédupliqués avec le don racial
      expect(details.cantrips.map((c) => c.refId)).toContain('spl-lueur');
      expect(details.spells.length).toBe(2);
    });
  });
describe('buildAutoSpellcastingDetails — cas additionnels', () => {
    it('picks a random racial cantrip from the pool when no explicit species choice answer exists', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const spells: Spell[] = [
        { id: 'spl-lueur', name: 'Lueur', level: 0, description: '', classes: ['cls-magicien'] } as unknown as Spell,
      ];
      const racialGrants = [
        { choiceId: 'elf-cantrip', label: '', desc: '', pool: ['spl-lueur'], spellLevel: 0, spellcastingAbility: 'Intelligence' },
      ];
      const details = buildAutoSpellcastingDetails(makeMagicienCls(), spells, racialGrants, {}) as {
        cantrips: { refId: string }[];
      };
      expect(details.cantrips.map((c) => c.refId)).toContain('spl-lueur');
    });
  });
describe('buildAutoSpellcastingDetails — paladin oath spells', () => {
    it('includes subclass oath spell grants for paladins', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const paladin = {
        id: 'cls-paladin',
        name: 'Paladin',
        data: {
          spellcasting: { type: 'prepared', ability: 'cha', prepared_formula: 'cha_mod + floor(paladin_level / 2)' },
          progression: [{ level: 5, resources: {} }],
          subclasses: {
            options: [
              {
                id: 'subcls-serment-de-devotion',
                bonus_spells_granted: [{ level_unlocked: 5, spells: ['spl-protection'] }],
              },
            ],
          },
        },
      } as unknown as CharacterClass;
      const spells: Spell[] = [
        { id: 'spl-protection', name: 'Protection', level: 1, description: '', classes: ['cls-paladin'] } as unknown as Spell,
      ];
      const details = buildAutoSpellcastingDetails(
        paladin,
        spells,
        [],
        {},
        { charisme: 2 },
        { level: 5, subclassId: 'subcls-serment-de-devotion' },
      ) as { oathSpells?: { spells: string[] }[] };
      expect(details.oathSpells?.length).toBe(1);
      expect(details.oathSpells?.[0].spells).toContain('Protection');
    });
  });
  describe('cas limites (ex-branches)', () => {
    it('buildAutoSpellcastingDetails leaves effectSummary empty when spell descriptions are missing', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const spells: Spell[] = [
          { id: 'spl-lueur', name: 'Lueur', level: 0, classes: ['cls-magicien'] } as unknown as Spell,
          { id: 'spl-projectile-magique', name: 'Projectile magique', level: 1, classes: ['cls-magicien'] } as unknown as Spell,
        ];
        const details = buildAutoSpellcastingDetails(makeMagicienCls(), spells, [], {}) as {
          cantrips: { effectSummary: string }[];
          spells: { effectSummary: string }[];
        };
        expect(details.cantrips[0].effectSummary).toBe('');
        expect(details.spells[0].effectSummary).toBe('');
      });
    it('buildAutoSpellcastingDetails matches spells whose classes use a partial id', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const spells: Spell[] = [
          { id: 'spl-a', name: 'A', level: 0, classes: ['magicien'] } as unknown as Spell,
          { id: 'spl-b', name: 'B', level: 1, classes: ['magicien'] } as unknown as Spell,
        ];
        const details = buildAutoSpellcastingDetails(makeMagicienCls(), spells, [], {}) as {
          cantrips: unknown[];
          spells: unknown[];
        };
        expect(details.cantrips.length).toBeGreaterThan(0);
        expect(details.spells.length).toBeGreaterThan(0);
      });
    it('buildAutoSpellcastingDetails falls back to raw ids when spells are absent from the catalog', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const racialGrants = [
          {
            choiceId: 'grant-x',
            label: '',
            desc: '',
            pool: ['spl-missing'],
            spellLevel: 0,
            spellcastingAbility: 'Intelligence',
          },
        ];
        const details = buildAutoSpellcastingDetails(
          makeMagicienCls(),
          [{ id: 'spl-projectile-magique', name: 'PM', level: 1, classes: ['cls-magicien'] } as unknown as Spell],
          racialGrants as never,
          { 'grant-x': ['spl-missing'] },
          null,
          { level: 1 },
        ) as { cantrips: { refId: string; name: string; effectSummary: string }[]; spells: { name: string }[] };
        expect(details.cantrips.some((c) => c.refId === 'spl-missing' && c.name === 'spl-missing')).toBeTrue();
        expect(details.cantrips.find((c) => c.refId === 'spl-missing')?.effectSummary).toBe('');
        expect(details.spells[0]?.name).toBe('PM');
      });
    it('covers spell quota and feat benefit helper branches', () => {
        expect(evaluatePreparedFormula(null, 5, {})).toBeNull();
        expect(evaluatePreparedFormula('invalid * formula', 5, {})).toBeNull();
        expect(evaluatePreparedFormula('wis_mod + level', 5, { sagesse: 2 })).toBe(7);
        expect(evaluatePreparedFormula('floor(paladin_level / 2) + cha_mod', 6, { charisme: 3 })).toBe(6);

        const clericQuota = resolveSpellQuota({
          cls: {
            data: {
              spellcasting: { type: 'prepared', ability: 'wis', prepared_formula: 'wis_mod + level' },
              progression: [{ level: 5, resources: { cantrips_known: 4 } }],
            },
          },
          kind: 'cleric',
          classLevel: 5,
          abilityModifiers: { sagesse: 2 },
        });
        expect(clericQuota?.preparedSpells).toBeGreaterThan(0);
        expect(spellPickCount(clericQuota!)).toBe(clericQuota!.preparedSpells);

        const wizardQuota = resolveSpellQuota({
          cls: {
            data: {
              spellcasting: {
                type: 'prepared',
                grimoire: { initial_spells: 6, spells_per_level_up: 2 },
              },
              progression: [{ level: 3, resources: { cantrips_known: 3 } }],
            },
          },
          kind: 'wizard',
          classLevel: 3,
        });
        expect(wizardQuota?.grimoireSpells).toBe(10);

        const flexibleFeat = {
          benefits: [{ type: 'flexible_points', total: 4 }],
          ability_score_increase: { ability: 'CON_or_CHA', value: 1 },
        };
        expect(featIsFlexiblePoints(flexibleFeat)).toBeTrue();
        expect(featFlexiblePointsTotal(flexibleFeat)).toBe(4);
        expect(featAsiNeedsAbilityChoice(flexibleFeat)).toBeTrue();
        expect(featAsiAbilityOptions(flexibleFeat)).toEqual(['constitution', 'charisme']);
        expect(resolveFeatAsiAbilityKey(flexibleFeat, null, 'charisme')).toBe('charisme');
        expect(resolveFeatAsiAbilityKey({ ability_score_increase: { ability: 'STR' } }, null, null)).toBe('force');
        expect(resolveFeatAsiAbilityKey({ ability_score_increase: { ability: 'SPELLCASTING' } }, 'intelligence', null)).toBe(
          'intelligence',
        );

        const resistanceFeat = {
          benefits: [{ type: 'damage_resistance', choose_from: ['Feu', 'Foudre'] }],
        };
        expect(featNeedsResistanceChoice(resistanceFeat)).toBeTrue();
        expect(featResistanceOptions(resistanceFeat).map((o) => o.id)).toEqual(['damage-feu', 'damage-foudre']);

        const profFeat = {
          benefits: [
            { type: 'proficiency', proficiency_type: 'armor', value: 'Bouclier' },
            { type: 'proficiency', proficiency_type: 'tool', value: "Nécessaire d'herboristerie" },
            { type: 'darkvision', range_m: 18 },
          ],
        };
        expect(featBonusArmorProficiencies(profFeat)).toEqual(['ar-bouclier']);
        expect(featBonusToolProficiencies(profFeat)).toEqual(['tl-necessaire-dherboristerie']);
        expect(featDarkvisionRadius(profFeat)).toBe(18);

        expect(isTalentSpendComplete({ id: 't1', type: 'skill', skillId: 'skill-stealth' })).toBeTrue();
        expect(isTalentSpendComplete({ id: 't2', type: 'cantrips', cantripIds: ['a', 'b'] })).toBeTrue();
        expect(isTalentSpendComplete({ id: 't3', type: 'cantrips', cantripIds: ['a'] })).toBeFalse();
        expect(
          talentSpendsTotalCost([
            { id: 's1', type: 'skill', skillId: 'skill-stealth' },
            { id: 's2', type: 'saving_throw', savingThrow: 'dexterite' },
          ]),
        ).toBe(3);
        expect(featAsiAbilityOptions({ ability_score_increase: { ability: 'ANY' } }).length).toBe(6);
        expect(resolveSpellQuota({ cls: null, kind: 'ranger', classLevel: 1, bonusCantrips: 1 })?.cantrips).toBe(1);
        expect(
          resolveSpellQuota({
            cls: { data: { spellcasting: { type: 'known' }, progression: [{ level: 1, resources: {} }] } },
            kind: 'paladin',
            classLevel: 1,
          })?.modeLabel,
        ).toContain('serment');
        expect(resolveSpellQuota({ cls: {}, kind: undefined, classLevel: 1 })).toBeNull();
        expect(isTalentSpendComplete({ id: 'x', type: 'tool', toolId: 'tl-luth' })).toBeTrue();
        expect(isTalentSpendComplete({ id: 'y', type: 'armor', armorTier: 'ar-medium' })).toBeTrue();
        expect(isTalentSpendComplete({ id: 'z', type: 'unknown' as never })).toBeFalse();
        expect(
          resolveSpellQuota({ cls: null, kind: 'bard', classLevel: 1, bonusCantrips: 0 })?.modeLabel,
        ).toContain('connus');

        const bonus = extractSubclassBonusSpells(
          {
            id: 'cls-paladin',
            name: 'Paladin',
            data: {
              subclasses: {
                options: [
                  {
                    id: 'sub-devotion',
                    bonus_spells_granted: [
                      { level_unlocked: 3, spells: ['spl-shield'] },
                      { level_unlocked: 9, spells: ['spl-aura'] },
                    ],
                  },
                ],
              },
            },
          } as unknown as CharacterClass,
          'sub-devotion',
          5,
          { 'spl-shield': 'Bouclier de la foi' },
        );
        expect(bonus.length).toBe(1);
        expect(bonus[0]!.spells[0]).toBe('Bouclier de la foi');
        expect(extractSubclassBonusSpells(null, 'sub-x', 5)).toEqual([]);
      });
    it('buildAutoSpellcastingDetails at level 3 requests higher-level slots', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const spells: Spell[] = [
          { id: 'spl-lueur', name: 'Lueur', level: 0, description: 'Lumière.', classes: ['cls-magicien'] } as unknown as Spell,
          { id: 'spl-shield', name: 'Bouclier', level: 1, description: 'Protection.', classes: ['cls-magicien'] } as unknown as Spell,
          { id: 'spl-misty', name: 'Brume', level: 2, description: 'Brume.', classes: ['cls-magicien'] } as unknown as Spell,
        ];
        const details = buildAutoSpellcastingDetails(makeMagicienCls(), spells, [], {}, null, { level: 3 }) as {
          cantrips: unknown[];
          spells: unknown[];
        };
        expect(details.cantrips.length).toBeGreaterThan(0);
        expect(details.spells.length).toBeGreaterThan(0);
      });
  });

});
