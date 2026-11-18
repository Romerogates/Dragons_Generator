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
  equipmentDescription,
  equipmentStatLines,
  equipmentSubtypeLabel,
  equipmentSummaryText,
  equipmentTypeLabel,
} from './spec-helpers';
import type { CharacterClass, Species, Spell, Language, EquipmentCatalogItem } from './spec-helpers';

describe('character-auto-build equipment', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('resolveBgToolToConcrete', () => {
    it('passes through ids already prefixed with tl-', () => {
      expect(resolveBgToolToConcrete('tl-des', TOOL_CATALOG)).toBe('tl-des');
    });

    it('resolves an "instrument" token to a random musical instrument', () => {
      spyOn(Math, 'random').and.returnValue(0);
      expect(resolveBgToolToConcrete('instrument-any', TOOL_CATALOG)).toBe('tl-luth');
    });

    it('resolves a "game" token to a random gaming set', () => {
      spyOn(Math, 'random').and.returnValue(0);
      expect(resolveBgToolToConcrete('game-any', TOOL_CATALOG)).toBe('tl-des');
    });

    it('falls back to a random TOOL for an unrecognized token', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const resolved = resolveBgToolToConcrete('vehicle-any', TOOL_CATALOG);
      expect(TOOL_CATALOG.map((t) => t.id)).toContain(resolved);
    });

    it('falls back to the raw ref when the catalog has no matching TOOL', () => {
      expect(resolveBgToolToConcrete('vehicle-any', [])).toBe('vehicle-any');
    });
  });
describe('buildBackgroundToolSlots', () => {
    it('builds category slots for "any"/instrument/game tokens and a fixed slot otherwise', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const slots = buildBackgroundToolSlots(['instrument-any', 'vehicle-any', 'tl-des'], TOOL_CATALOG);
      expect(slots.length).toBe(3);
      expect(slots[0].alternatives).toEqual([[{ id: 'category-musical-instruments', qty: 1 }]]);
      expect(slots[1].alternatives).toEqual([[{ id: 'category-tools', qty: 1 }]]);
      expect(slots[2].fixed).toEqual([{ id: 'tl-des', qty: 1 }]);
    });
  });
describe('buildAutoEquipment', () => {
    const catalog: EquipmentCatalogItem[] = [
      {
        id: 'wp-epee-courte',
        name: 'Épée courte',
        type: 'WEAPON',
        subtype: 'SIMPLE_MELEE',
        cost: { v: 10, u: 'po' },
        wKg: 2,
        data: { dmg_d: '1d6', dmg_t: 'perforant', props: ['Légère'] },
      },
      {
        id: 'wp-dague',
        name: 'Dague',
        type: 'WEAPON',
        subtype: 'SIMPLE_MELEE',
        cost: { v: 2, u: 'po' },
        wKg: 0.5,
        data: { dmg_d: '1d4' },
      },
      {
        id: 'ar-armure-de-cuir',
        name: 'Armure de cuir',
        type: 'ARMOR',
        subtype: 'LIGHT',
        cost: { v: 10, u: 'po' },
        wKg: 5,
        data: { ac: 11 },
      },
      {
        id: 'ar-bouclier',
        name: 'Bouclier',
        type: 'ARMOR',
        subtype: 'SHIELD',
        cost: { v: 10, u: 'po' },
        wKg: 3,
        data: { ac: 2 },
      },
    ];

    it('resolves fixed direct-id slots, mastered-choice categories, filter categories and alternatives', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const slots = [
        { slot: 1, fixed: [{ id: 'wp-dague', qty: 1 }] },
        { slot: 2, fixed: [{ id: 'wp-mastered-choice', qty: 1 }] },
        { slot: 3, fixed: [{ id: 'category-simple-weapons', qty: 1 }] },
        { slot: 4, alternatives: [[{ id: 'ar-armure-de-cuir', qty: 1 }], [{ id: 'ar-bouclier', qty: 1 }]] },
        { slot: 5, alternatives: [] },
      ];
      const result = buildAutoEquipment(slots, catalog, ['wp-epee-courte', 'wp-dague'], []);

      const cd = (i: number) => result[i].customData as Record<string, unknown> | undefined;
      expect(result.length).toBe(4); // le slot 5 (alternatives vides) ne produit rien
      expect(result[0].refId).toBe('wp-dague');
      expect(cd(0)?.['isWeapon']).toBeTrue();
      expect(['wp-epee-courte', 'wp-dague']).toContain(result[1].refId); // mastered-choice
      expect(['wp-epee-courte', 'wp-dague']).toContain(result[2].refId); // category-simple-weapons
      expect(result[3].refId).toBe('ar-armure-de-cuir');
      expect(result[3].equipped).toBeTrue();
      expect(cd(3)?.['isArmor']).toBeTrue();
    });

    it('marks shields distinctly from armor', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const result = buildAutoEquipment(
        [{ slot: 1, fixed: [{ id: 'ar-bouclier', qty: 1 }] }],
        catalog,
        [],
        [],
      );
      const cd = result[0].customData as Record<string, unknown> | undefined;
      expect(cd?.['isShield']).toBeTrue();
      expect(cd?.['isArmor']).toBeFalse();
    });
  });
describe('buildAutoEquipment — armor ac fallbacks', () => {
    it('uses ac_base when ac is missing and defaults heavy armor to 10', () => {
      const catalog: EquipmentCatalogItem[] = [
        {
          id: 'ar-plate',
          name: 'Armure de plates',
          type: 'ARMOR',
          subtype: 'HEAVY',
          cost: { v: 0, u: 'po' },
          wKg: 0,
          data: { ac_base: 18, dex_modifier: false },
        },
        {
          id: 'ar-weird',
          name: 'Armure étrange',
          type: 'ARMOR',
          subtype: 'LIGHT',
          cost: { v: 0, u: 'po' },
          wKg: 0,
          data: {},
        },
      ];
      const withBase = buildAutoEquipment(
        [{ slot: 1, fixed: [{ id: 'ar-plate', qty: 1 }] }],
        catalog,
        [],
        [],
      );
      expect((withBase[0].customData as Record<string, unknown>)['ac']).toBe(18);

      const defaulted = buildAutoEquipment(
        [{ slot: 1, fixed: [{ id: 'ar-weird', qty: 1 }] }],
        catalog,
        [],
        [],
      );
      expect((defaulted[0].customData as Record<string, unknown>)['ac']).toBe(10);
    });
  });
  describe('cas limites (ex-branches)', () => {
    it('resolveCatalogItem falls back to an empty category when a mastered-choice weapon has no matching proficiencies', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const result = buildAutoEquipment(
          [{ slot: 1, fixed: [{ id: 'wp-mastered-choice', qty: 1 }] }],
          [{ id: 'wp-dague', name: 'Dague', type: 'WEAPON', subtype: 'SIMPLE_MELEE', cost: { v: 2, u: 'po' }, wKg: 0.5, data: {} }],
          [], // aucune maîtrise martiale -> aucun item ne matche
          [],
        );
        expect(result).toEqual([]);
      });
    it('resolveCatalogItem falls back to an unresolved equipment id when no catalog entry matches', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const result = buildAutoEquipment(
          [{ slot: 1, fixed: [{ id: 'wp-inexistant', qty: 1 }] }],
          [{ id: 'wp-dague', name: 'Dague', type: 'WEAPON', subtype: 'SIMPLE_MELEE', cost: { v: 2, u: 'po' }, wKg: 0.5, data: {} }],
          [],
          [],
        );
        expect(result).toEqual([]);
      });
    it('buildAutoEquipment resolves alternative slots and category picks inside alternatives', () => {
        spyOn(Math, 'random').and.returnValue(0.99);
        const catalog: EquipmentCatalogItem[] = [
          {
            id: 'wp-dague',
            name: 'Dague',
            type: 'WEAPON',
            subtype: 'SIMPLE_MELEE',
            cost: { v: 2, u: 'po' },
            wKg: 0.5,
            data: {},
          },
          {
            id: 'ar-bouclier',
            name: 'Bouclier',
            type: 'ARMOR',
            subtype: 'SHIELD',
            cost: { v: 10, u: 'po' },
            wKg: 3,
            data: { ac: 2 },
          },
        ];
        const result = buildAutoEquipment(
          [
            {
              slot: 1,
              alternatives: [[{ id: 'wp-dague', qty: 1 }], [{ id: 'category-simple-weapons', qty: 1 }]],
            },
            { slot: 2, alternatives: [[{ id: 'ar-bouclier', qty: 1 }], [{ id: 'ar-bouclier', qty: 1 }]] },
          ],
          catalog,
          ['wp-dague'],
          [],
        );
        expect(result.length).toBe(2);
        expect(result[0].refId).toBe('wp-dague');
        expect(result[1].refId).toBe('ar-bouclier');
      });
    it('buildBackgroundToolSlots maps gameSet-any to gaming set categories', () => {
        const slots = buildBackgroundToolSlots(['gameSet-any'], TOOL_CATALOG);
        expect(slots[0].alternatives).toEqual([[{ id: 'category-gaming-sets', qty: 1 }]]);
      });
    it('resolveBgToolToConcrete resolves gameSet-any through the game branch', () => {
        spyOn(Math, 'random').and.returnValue(0);
        expect(resolveBgToolToConcrete('gameSet-any', TOOL_CATALOG)).toBe('tl-des');
      });
    it('buildAutoEquipment resolves tool mastered-choice and weapon customData fallbacks', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const catalog: EquipmentCatalogItem[] = [
          {
            id: 'wp-hache',
            name: 'Hache',
            type: 'WEAPON',
            subtype: 'SIMPLE_MELEE',
            cost: { v: 5, u: 'po' },
            wKg: 2,
            data: { damage_dice: '1d6', damage_type: 'tranchant', properties: ['Légère'] },
          },
          {
            id: 'tl-luth',
            name: 'Luth',
            type: 'TOOL',
            subtype: 'instrument',
            cost: { v: 1, u: 'po' },
            wKg: 1,
            data: {},
          },
        ];
        const result = buildAutoEquipment(
          [
            { slot: 1, fixed: [{ id: 'wp-hache', qty: 1 }] },
            { slot: 2, fixed: [{ id: 'wp-mastered-choice', qty: 1 }] },
          ],
          catalog,
          ['wp-hache'],
          [],
        );
        const weaponCd = result[0].customData as Record<string, unknown>;
        expect(weaponCd['damage']).toBe('1d6');
        expect(weaponCd['damageType']).toBe('tranchant');
        expect(result[1].refId).toBe('wp-hache');
      });
    it('resolveBgToolToConcrete falls back to hard-coded defaults when catalogs are empty', () => {
        expect(resolveBgToolToConcrete('instrument-any', [])).toBe('tl-luth');
        expect(resolveBgToolToConcrete('gameSet-any', [])).toBe('tl-des');
      });
    it('buildAutoEquipment resolves explicit category id lists', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const catalog: EquipmentCatalogItem[] = [
          {
            id: 'tl-des',
            name: 'Dés',
            type: 'TOOL',
            subtype: 'gaming_set',
            cost: { v: 0, u: 'po' },
            wKg: 0,
            data: {},
          },
        ];
        const result = buildAutoEquipment(
          [{ slot: 1, fixed: [{ id: 'category-gaming-sets', qty: 1 }] }],
          catalog,
          [],
          [],
        );
        expect(result[0].refId).toBe('tl-des');
      });
    it('buildAutoEquipment uses shield AC defaults for light armor without stats', () => {
        const catalog: EquipmentCatalogItem[] = [
          {
            id: 'ar-light-weird',
            name: 'Weird light',
            type: 'ARMOR',
            subtype: 'LIGHT',
            cost: { v: 0, u: 'po' },
            wKg: 0,
            data: {},
          },
          {
            id: 'ar-bouclier',
            name: 'Bouclier',
            type: 'ARMOR',
            subtype: 'SHIELD',
            cost: { v: 0, u: 'po' },
            wKg: 0,
            data: {},
          },
        ];
        const light = buildAutoEquipment([{ slot: 1, fixed: [{ id: 'ar-light-weird', qty: 1 }] }], catalog, [], [])[0];
        const shield = buildAutoEquipment([{ slot: 1, fixed: [{ id: 'ar-bouclier', qty: 1 }] }], catalog, [], [])[0];
        expect((light.customData as Record<string, unknown>)['ac']).toBe(10);
        expect((shield.customData as Record<string, unknown>)['ac']).toBe(2);
      });
    it('buildAutoEquipment prefers alternatives when fixed and alternatives coexist', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const catalog: EquipmentCatalogItem[] = [
          {
            id: 'wp-dague',
            name: 'Dague',
            type: 'WEAPON',
            subtype: 'SIMPLE_MELEE',
            cost: { v: 2, u: 'po' },
            wKg: 0.5,
            data: {},
          },
        ];
        const result = buildAutoEquipment(
          [{ slot: 1, fixed: [{ id: 'wp-dague', qty: 1 }], alternatives: [[{ id: 'wp-dague', qty: 1 }]] }],
          catalog,
          [],
          [],
        );
        expect(result.length).toBe(1);
      });
    it('buildAutoEquipment resolves subtype-based weapon categories', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const catalog: EquipmentCatalogItem[] = [
          {
            id: 'wp-club',
            name: 'Gourdin',
            type: 'WEAPON',
            subtype: 'SIMPLE_MELEE',
            cost: { v: 0, u: 'po' },
            wKg: 1,
            data: {},
          },
        ];
        const result = buildAutoEquipment(
          [{ slot: 1, fixed: [{ id: 'category-simple-weapons', qty: 1 }] }],
          catalog,
          [],
          [],
        );
        expect(result[0].refId).toBe('wp-club');
      });
    it('covers equipment display formatters for weapons and armor', () => {
        expect(equipmentTypeLabel('gear')).toBe('Équipement');
        expect(equipmentTypeLabel('exotic')).toBe('exotic');
        expect(equipmentSubtypeLabel(null)).toBe('');
        expect(equipmentSubtypeLabel('CUSTOM')).toBe('CUSTOM');

        const weapon = {
          type: 'WEAPON',
          subtype: 'MARTIAL_RANGED',
          wKg: 2,
          cost: { v: 50, u: 'po' },
          data: {
            dmg_d: '1d8',
            dmg_t: 'perforant',
            props: ['wp-prop'],
            ammo_range: { normal: 24, max: 96 },
            str_req: 13,
          },
        };
        const weaponSummary = equipmentSummaryText(weapon);
        expect(weaponSummary).toContain('1d8');
        expect(weaponSummary).toContain('Portée 24/96 m');
        expect(weaponSummary).toContain('For 13');

        const armor = {
          type: 'ARMOR',
          subtype: 'HEAVY',
          wKg: 20,
          cost: { v: null, u: 'po' },
          data: {
            ac_base: 18,
            dex_modifier: false,
            stealth_dis: true,
            description: '  Plates lourdes  ',
          },
        };
        expect(equipmentDescription(armor)).toBe('Plates lourdes');
        const armorSummary = equipmentSummaryText(armor);
        expect(armorSummary).toContain('CA 18');
        expect(armorSummary).toContain('Dex non applicable');
        expect(armorSummary).toContain('Discrétion −');
        expect(equipmentStatLines(armor).length).toBe(2);

        const throwOnly = equipmentSummaryText({
          type: 'WEAPON',
          subtype: null,
          data: { throw_range: { normal: 6 } },
        });
        expect(throwOnly).toContain('Lancer 6 m');

        const dexPartial = equipmentSummaryText({
          type: 'ARMOR',
          subtype: 'MEDIUM',
          data: { ac: 14, dex_modifier: 'partial', max_dex_bonus: 2 },
        });
        expect(dexPartial).toContain('Dex max +2');

        const numericRange = equipmentSummaryText({
          type: 'WEAPON',
          subtype: null,
          data: { range: 12 },
        });
        expect(numericRange).toContain('Portée 12 m');

        const stringRange = equipmentSummaryText({
          type: 'WEAPON',
          subtype: null,
          data: { range: 'Contact' },
        });
        expect(stringRange).toContain('Contact');

        const throwWithMax = equipmentSummaryText({
          type: 'WEAPON',
          subtype: null,
          data: { throw_range: { normal: 6, max: 18 } },
        });
        expect(throwWithMax).toContain('Lancer 6/18 m');

        const dexPartialOnly = equipmentSummaryText({
          type: 'ARMOR',
          subtype: 'MEDIUM',
          data: { ac: 13, dex_modifier: 'partiel' },
        });
        expect(dexPartialOnly).toContain('Dex partiel');

        const dexFull = equipmentSummaryText({
          type: 'ARMOR',
          subtype: 'LIGHT',
          data: { ac: 11, dex_modifier: 'full' },
        });
        expect(dexFull).toContain('Dex complet');

        expect(equipmentStatLines({ type: 'GEAR', subtype: null, data: {} })).toEqual([]);

        const ammoMax = equipmentSummaryText({
          type: 'WEAPON',
          subtype: null,
          data: { ammo_range: { normal: 30, max: 120 } },
        });
        expect(ammoMax).toContain('Portée 30/120 m');
      });
  });

});
