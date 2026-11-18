import {
  pickRandomSubset,
  buildAutoSpeciesSelection,
  buildAutoCivilizationSelection,
  buildAutoBackgroundSelection,
  primaryAbilityKeys,
  buildStandardAbilityScores,
  buildAutoClassSelection,
  autoPickClassSkills,
  autoResolveClassProficiencies,
  resolveBgToolToConcrete,
  buildBackgroundToolSlots,
  buildAutoEquipment,
  buildAutoSpellcastingDetails,
  pickBonusLanguages,
  normalizeEquipmentCatalog,
  createSkillMapFromList,
  pickPlayableSpecies,
  pickPresetBackgrounds,
  CLASS_SPELLCASTING,
} from '../character-auto-build.util';
import {
  makeGuerrierCls,
  makeMagicienCls,
  makePretreLikeCls,
  makeElfSpecies,
  makeDrakeideLikeSpecies,
  makeCivilisation,
  makeErudBackground,
  SKILLS,
  TOOL_CATALOG,
  createLettreClass,
} from './spec-helpers';
import type { CharacterClass, Species, Spell, Language, EquipmentCatalogItem } from './spec-helpers';

describe('character-auto-build class', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('buildAutoClassSelection', () => {
    it('builds a level 1 non-caster class (no subclass yet, combat style + active choice pools)', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const { selection, classChoiceAnswers, extraFeatures } = buildAutoClassSelection(makeGuerrierCls(), 1);

      expect(selection.hitDie).toBe(10);
      expect(selection.hpAtLevel1).toBe(10);
      expect(selection.hpPerLevelAverage).toBe(6);
      expect(selection.hasSpellcasting).toBeFalse();
      expect(selection.subclassId).toBeUndefined();
      expect(selection.savingThrows).toEqual(['Force', 'Constitution']);
      expect(selection.armorProficiencies).toEqual(['ar-legere', 'ar-intermediaire', 'ar-bouclier']);

      // Second souffle (résolu) + 1 style de combat piochés ; le feat "resolves_to_choice_pool"
      // et le style de combat lui-même (géré par choice_pools) ne sont PAS dupliqués en feature brute.
      expect(selection.classFeatures.length).toBe(2);
      const secondSouffle = selection.classFeatures.find((f) => f.refId === 'feat-second-souffle');
      expect(secondSouffle?.uses).toEqual({ max: 1, current: 1, recharge: 'short_rest' });
      const style = selection.classFeatures.find((f) => (f.refId ?? '').startsWith('feat-style-'));
      expect(style).toBeTruthy();
      expect(['feat-style-duel', 'feat-style-defense']).toContain(style?.refId as string);

      // Choix actif de classe (non déferré) : 1 pick + 1 feature fixe toujours présente.
      expect(classChoiceAnswers['choice-fanfaronnade']).toEqual(['feat-a']);
      expect(extraFeatures.map((f) => f.refId).sort()).toEqual(['feat-a', 'feat-toujours-present']);
    });

    it('unlocks the subclass at level 3 and applies its bonus proficiencies/resistances/senses', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const { selection } = buildAutoClassSelection(makeGuerrierCls(), 3);

      expect(selection.subclassId).toBe('subcls-champion');
      expect(selection.subclassName).toBe('Champion');
      expect(selection.classFeatures.some((f) => f.refId === 'feat-critique-ameliore')).toBeTrue();
      expect(selection.classResistances).toEqual(['feu']);
      expect(selection.classDarkvisionRadius).toBe(18);
      expect(selection.classHasBlindsight).toBeFalse();
    });

    it('resolves spellcasting kind/ability and JSON spell slots for a caster class', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const { selection } = buildAutoClassSelection(makeMagicienCls(), 3);
      expect(selection.hasSpellcasting).toBeTrue();
      expect(selection.spellcastingKind).toBe('wizard');
      expect(selection.spellcastingAbility).toBe('Intelligence');
      expect(selection.classSpellSlots).toEqual([
        { level: 1, max: 4 },
        { level: 2, max: 2 },
      ]);
      expect(selection.classBonusLanguageCount).toBe(1);
      expect(selection.classRequiredExoticLanguageCount).toBe(1);
    });

    it('materializes subclass sub_choices (domain-style pick) into extra features and bonus proficiencies', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const { selection, classChoiceAnswers, extraFeatures } = buildAutoClassSelection(makePretreLikeCls(), 1);

      expect(selection.subclassId).toBe('subcls-domaine-de-la-vie');
      expect(selection.armorProficiencies).toContain('ar-lourde');
      expect(classChoiceAnswers['choice-domaine-pretre']).toEqual(['dom-vie']);
      const domainFeature = extraFeatures.find((f) => f.refId === 'dom-vie');
      expect(domainFeature).toEqual(
        jasmine.objectContaining({ name: 'Vie', desc: 'Soins accrus.', level: 1 }),
      );
    });
  });
describe('isFightingStylePool detection (via buildAutoClassSelection)', () => {
    function clsWithPool(pool: Record<string, unknown>): CharacterClass {
      return {
        id: 'cls-test-style',
        name: 'Test',
        data: {
          hit_die: 8,
          primary_abilities: [],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
          features_details: [
            { id: 'feat-style-x', name: 'Style X', desc: '' },
            { id: 'feat-style-y', name: 'Style Y', desc: '' },
          ],
          choice_pools: [pool],
        } as any,
      } as unknown as CharacterClass;
    }

    it('detects a fighting style pool by id/type regex even when type differs', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls = clsWithPool({ id: 'choice-combat-style', type: 'other', pool: ['feat-style-x', 'feat-style-y'] });
      const { selection } = buildAutoClassSelection(cls, 1);
      // Reconnu comme style de combat -> pioché en feature directement (pas de choix générique restant).
      expect(selection.classFeatures.some((f) => (f.refId ?? '').startsWith('feat-style-'))).toBeTrue();
    });

    it('detects a fighting style pool via feature_option type with a style/combat/fighting keyword', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls = clsWithPool({ id: 'choice-fighting-thing', type: 'feature_option', pool: ['feat-style-x', 'feat-style-y'] });
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.classFeatures.some((f) => (f.refId ?? '').startsWith('feat-style-'))).toBeTrue();
    });

    it('does not treat an unrelated feature_option pool as a fighting style', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls = clsWithPool({ id: 'choice-autre', type: 'feature_option', pool: ['feat-style-x'] });
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.classFeatures.length).toBe(0);
    });

    it('returns no combat style feature when the class declares no fighting-style pool at all', () => {
      const cls = clsWithPool({ id: 'choice-langue', type: 'language_proficiency', pool: ['lang-category-exotique'] });
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.classFeatures.length).toBe(0);
    });
  });
describe('buildAutoClassSelection — cas additionnels', () => {
    it('returns no subclass for a class with no subclasses field at all', () => {
      const cls: CharacterClass = {
        id: 'cls-sans-sous-classe',
        name: 'Sans sous-classe',
        data: {
          hit_die: 8,
          primary_abilities: ['Force'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [],
          features_details: [],
          choice_pools: [],
        } as any,
      } as unknown as CharacterClass;
      const { selection } = buildAutoClassSelection(cls, 5);
      expect(selection.subclassId).toBeUndefined();
    });

    it('treats a raw subclasses array as unlocked from level 1', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls: CharacterClass = {
        id: 'cls-array-subclasses',
        name: 'Array',
        data: {
          hit_die: 8,
          primary_abilities: ['Force'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [],
          features_details: [],
          choice_pools: [],
          subclasses: [{ id: 'subcls-a', name: 'A', features: [] }],
        } as any,
      } as unknown as CharacterClass;
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.subclassId).toBe('subcls-a');
    });

    it('skips sub_choices not yet unlocked at the target level and with an empty option list', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls: CharacterClass = {
        id: 'cls-sub-choices',
        name: 'Test',
        data: {
          hit_die: 8,
          primary_abilities: ['Sagesse'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
          features_details: [],
          choice_pools: [],
          subclasses: {
            unlocked_at_level: 1,
            options: [
              {
                id: 'subcls-x',
                name: 'X',
                features: [],
                sub_choices: [
                  { id: 'choice-tardif', type: 'single_select', level_required: 3, options: ['a', 'b'] },
                  { id: 'choice-vide', type: 'single_select', level_required: 1, options: [] },
                ],
              },
            ],
          },
        } as any,
      } as unknown as CharacterClass;
      const { classChoiceAnswers } = buildAutoClassSelection(cls, 1);
      expect(classChoiceAnswers['choice-tardif']).toBeUndefined();
      expect(classChoiceAnswers['choice-vide']).toBeUndefined();
    });

    it('resolves a sub_choice pick that matches an actual class feature (not just a label fallback)', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls: CharacterClass = {
        id: 'cls-sub-choice-feat',
        name: 'Test',
        data: {
          hit_die: 8,
          primary_abilities: ['Sagesse'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
          features_details: [
            { id: 'dom-vie', name: 'Domaine de la vie', desc: 'Soins.', level: 1, recharge: 'long_rest', uses: { base: 1 } },
          ],
          choice_pools: [],
          subclasses: {
            unlocked_at_level: 1,
            options: [
              {
                id: 'subcls-x',
                name: 'X',
                features: [],
                sub_choices: [{ id: 'choice-domaine', type: 'single_select', level_required: 1, options: ['dom-vie'] }],
              },
            ],
          },
        } as any,
      } as unknown as CharacterClass;
      const { extraFeatures } = buildAutoClassSelection(cls, 1);
      const feat = extraFeatures.find((f) => f.refId === 'dom-vie');
      expect(feat?.name).toBe('Domaine de la vie');
      expect(feat?.uses).toEqual({ max: 1, current: 1, recharge: 'long_rest' });
    });

    it('returns null for an unknown feature id and reads explicit hp_at_level_1 / hp_per_level_average overrides', () => {
      const cls: CharacterClass = {
        id: 'cls-hp-explicite',
        name: 'Test',
        data: {
          hit_die: 12,
          hp_at_level_1: 14,
          hp_per_level_average: 8,
          primary_abilities: ['Force'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [{ level: 1, prof_bonus: 2, features: ['feat-inconnu'], resources: {} }],
          features_details: [],
          choice_pools: [],
        } as any,
      } as unknown as CharacterClass;
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.hpAtLevel1).toBe(14);
      expect(selection.hpPerLevelAverage).toBe(8);
      expect(selection.classFeatures).toEqual([]); // feat-inconnu introuvable -> ignoré
    });
  });
describe('buildAutoClassSelection — Lettré feature_selection dedup', () => {
    it('deduplicates fixed astuces across feature_selection pools', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const { classChoiceAnswers, extraFeatures } = buildAutoClassSelection(createLettreClass(), 5);
      expect(classChoiceAnswers['choice-astuces-initial-cls-lettre']?.length).toBe(2);
      expect(extraFeatures.some((f) => f.refId === 'feat-astuce-empressement')).toBeTrue();
    });
  });
  describe('cas limites (ex-branches)', () => {
    it('isFightingStylePool handles pools with no id/type keys at all', () => {
        const cls: CharacterClass = {
          id: 'cls-sans-cle',
          name: 'Test',
          data: {
            hit_die: 8,
            primary_abilities: [],
            proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
            starting_equipment: [],
            progression: [],
            features_details: [],
            choice_pools: [{ pool: ['feat-x'] }],
          } as any,
        } as unknown as CharacterClass;
        const { selection } = buildAutoClassSelection(cls, 1);
        expect(selection.classFeatures).toEqual([]);
      });
    it('pickAutoSubclass returns null when the subclasses payload has no options array', () => {
        const cls: CharacterClass = {
          id: 'cls-souscls-vide',
          name: 'Test',
          data: {
            hit_die: 8,
            primary_abilities: ['Force'],
            proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
            starting_equipment: [],
            progression: [],
            features_details: [],
            choice_pools: [],
            subclasses: { unlocked_at_level: 1 },
          } as any,
        } as unknown as CharacterClass;
        const { selection } = buildAutoClassSelection(cls, 1);
        expect(selection.subclassId).toBeUndefined();
      });
    it('buildAutoClassSelection waits for the subclass unlock level', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const { selection } = buildAutoClassSelection(makeGuerrierCls(), 2);
        expect(selection.subclassId).toBeUndefined();
        expect(selection.classFeatures.some((f) => f.refId === 'feat-critique-ameliore')).toBeFalse();
      });
    it('buildAutoClassSelection deduplicates overlapping feature_selection pools', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const cls: CharacterClass = {
          id: 'cls-overlap',
          name: 'Overlap',
          data: {
            hit_die: 8,
            primary_abilities: [],
            proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
            starting_equipment: [],
            progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
            features_details: [
              { id: 'feat-a', name: 'A', desc: '' },
              { id: 'feat-b', name: 'B', desc: '' },
              { id: 'feat-fixed', name: 'Fixe', desc: '' },
            ],
            choice_pools: [
              {
                id: 'choice-one',
                type: 'feature_selection',
                name: 'Premier',
                quantity: 1,
                pool: ['feat-a', 'feat-b'],
                fixed_features: ['feat-fixed'],
              },
              {
                id: 'choice-two',
                type: 'feature_selection',
                name: 'Second',
                quantity: 1,
                pool: ['feat-a', 'feat-b'],
              },
            ],
          } as any,
        } as unknown as CharacterClass;
        const { classChoiceAnswers, extraFeatures } = buildAutoClassSelection(cls, 1);
        const picked = new Set(Object.values(classChoiceAnswers).flat());
        expect(picked.size).toBe(2);
        expect(extraFeatures.filter((f) => f.refId === 'feat-fixed').length).toBe(1);
      });
    it('pickAutoSubclass honors level_unlocked and returns null below gate', () => {
        const cls: CharacterClass = {
          id: 'cls-gated',
          name: 'Gated',
          data: {
            hit_die: 8,
            primary_abilities: [],
            proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
            starting_equipment: [],
            progression: [],
            features_details: [],
            choice_pools: [],
            subclasses: { level_unlocked: 5, options: [{ id: 'sub-a', name: 'A', features: [] }] },
          } as any,
        } as unknown as CharacterClass;
        expect(buildAutoClassSelection(cls, 4).selection.subclassId).toBeUndefined();
        expect(buildAutoClassSelection(cls, 5).selection.subclassId).toBe('sub-a');
      });
    it('pickCombatStyles uses feat id fallback when style detail is missing', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const cls: CharacterClass = {
          id: 'cls-style-fallback',
          name: 'Style',
          data: {
            hit_die: 8,
            primary_abilities: [],
            proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
            starting_equipment: [],
            progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
            features_details: [],
            choice_pools: [{ id: 'choice-fighting-style', type: 'fighting_style', pool: ['feat-unknown-style'] }],
          } as any,
        } as unknown as CharacterClass;
        const { selection } = buildAutoClassSelection(cls, 1);
        expect(selection.classFeatures[0]?.name).toBe('Style : feat-unknown-style');
      });
    it('buildAutoClassSelection tolerates non-array proficiency lists', () => {
        const cls: CharacterClass = {
          id: 'cls-weird-prof',
          name: 'Weird',
          data: {
            hit_die: 6,
            primary_abilities: [],
            proficiencies: {
              armor: null,
              weapons: null,
              tools: null,
              saving_throws: [],
              skills: { count: 0, options: null },
            },
            starting_equipment: [],
            progression: [],
            features_details: [],
            choice_pools: [],
          } as any,
        } as unknown as CharacterClass;
        const { selection } = buildAutoClassSelection(cls, 1);
        expect(selection.armorProficiencies).toEqual([]);
        expect(selection.skillOptions).toEqual([]);
      });
    it('materializes subclass sub_choices from labels when feature details are absent', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const cls: CharacterClass = {
          id: 'cls-label-sub',
          name: 'Label',
          data: {
            hit_die: 8,
            primary_abilities: ['Sagesse'],
            proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
            starting_equipment: [],
            progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
            features_details: [],
            choice_pools: [],
            subclasses: {
              unlocked_at_level: 1,
              options: [
                {
                  id: 'sub-x',
                  name: 'X',
                  features: [],
                  sub_choices: [
                    {
                      id: 'choice-domaine',
                      type: 'single_select',
                      level_required: 1,
                      options: ['dom-label'],
                      option_labels: { 'dom-label': 'Domaine étiquette' },
                      option_descs: { 'dom-label': 'Sans fiche feature.' },
                    },
                  ],
                },
              ],
            },
          } as any,
        } as unknown as CharacterClass;
        const { extraFeatures } = buildAutoClassSelection(cls, 1);
        const feat = extraFeatures.find((f) => f.refId === 'dom-label');
        expect(feat?.name).toBe('Domaine étiquette');
        expect(feat?.desc).toBe('Sans fiche feature.');
        expect(feat?.uses).toBeUndefined();
      });
    it('skips unknown or duplicate fixed features in feature_selection pools', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const cls: CharacterClass = {
          id: 'cls-fixed-skip',
          name: 'Fixed',
          data: {
            hit_die: 8,
            primary_abilities: [],
            proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
            starting_equipment: [],
            progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
            features_details: [
              { id: 'feat-a', name: 'A', desc: '' },
              { id: 'feat-fixed', name: 'Fixe', desc: '' },
            ],
            choice_pools: [
              {
                id: 'choice-one',
                type: 'feature_selection',
                name: 'Choix',
                quantity: 1,
                pool: ['feat-a'],
                fixed_features: ['feat-fixed', 'feat-missing'],
              },
            ],
          } as any,
        } as unknown as CharacterClass;
        const { extraFeatures } = buildAutoClassSelection(cls, 1);
        expect(extraFeatures.filter((f) => f.refId === 'feat-fixed').length).toBe(1);
        expect(extraFeatures.some((f) => f.refId === 'feat-missing')).toBeFalse();
      });
    it('buildAutoClassSelection skips high-level progression and subclass features', () => {
        const cls: CharacterClass = {
          id: 'cls-gated-feats',
          name: 'Gated',
          data: {
            hit_die: 8,
            primary_abilities: ['Force'],
            proficiencies: { armor: [], weapons: [], tools: [], saving_throws: ['str', 'invalid-code'], skills: { count: 0, options: null } },
            starting_equipment: [],
            progression: [
              { level: 1, prof_bonus: 2, features: ['feat-l1'], resources: {} },
              { level: 5, prof_bonus: 3, features: ['feat-l5'], resources: {} },
            ],
            features_details: [
              { id: 'feat-l1', name: 'L1', desc: '', level: 1 },
              { id: 'feat-l5', name: 'L5', desc: '', level: 5 },
              { id: 'feat-style-de-combat-x', name: 'Style', desc: '', level: 1 },
            ],
            choice_pools: [],
            subclasses: {
              unlocked_at_level: 1,
              options: [
                {
                  id: 'sub-y',
                  name: 'Y',
                  features: [{ id: 'sub-f5', name: 'Sub 5', desc: '', level: 5 }],
                },
              ],
            },
          } as any,
        } as unknown as CharacterClass;
        const { selection } = buildAutoClassSelection(cls, 1);
        expect(selection.classFeatures.some((f) => f.refId === 'feat-l1')).toBeTrue();
        expect(selection.classFeatures.some((f) => f.refId === 'feat-l5' || f.refId === 'sub-f5')).toBeFalse();
        expect(selection.savingThrows as string[]).toContain('invalid-code');
        expect(selection.skillChooseCount).toBe(0);
      });
    it('buildAutoClassSelection uses option labels when picked features lack detail rows', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const cls: CharacterClass = {
          id: 'cls-opt-label',
          name: 'Opt',
          data: {
            hit_die: 8,
            primary_abilities: [],
            proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
            starting_equipment: [],
            progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
            features_details: [],
            choice_pools: [
              {
                id: 'choice-opt',
                type: 'feature_selection',
                name: 'Choix',
                quantity: 1,
                pool: ['feat-sans-fiche'],
              },
            ],
          } as any,
        } as unknown as CharacterClass;
        const { extraFeatures } = buildAutoClassSelection(cls, 1);
        expect(extraFeatures[0]?.name).toBe('Sans Fiche');
      });
  });

});
