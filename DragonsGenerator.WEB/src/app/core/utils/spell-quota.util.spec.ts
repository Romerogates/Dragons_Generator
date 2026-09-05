import {
  evaluatePreparedFormula,
  resolveSpellQuota,
  spellPickCount,
} from './spell-quota.util';

describe('spell-quota.util', () => {
  const mods = {
    force: 0,
    dexterite: 1,
    constitution: 2,
    intelligence: 3,
    sagesse: 2,
    charisme: 1,
  };

  describe('evaluatePreparedFormula', () => {
    it('evaluates wis_mod + class_level', () => {
      expect(evaluatePreparedFormula('wis_mod + class_level', 5, mods)).toBe(7);
    });

    it('evaluates floor(paladin_level / 2)', () => {
      expect(evaluatePreparedFormula('cha_mod + floor(paladin_level / 2)', 5, mods)).toBe(3);
    });
  });

  describe('resolveSpellQuota', () => {
    it('reads known caster quotas from progression resources', () => {
      const cls = {
        data: {
          spellcasting: { type: 'known', ability: 'cha' },
          progression: [
            { level: 1, resources: { cantrips_known: 2, spells_known: 4 } },
            { level: 5, resources: { cantrips_known: 3, spells_known: 8 } },
          ],
        },
      };
      const q1 = resolveSpellQuota({ cls, kind: 'bard', classLevel: 1, abilityModifiers: mods });
      expect(q1).toEqual(
        jasmine.objectContaining({
          cantrips: 2,
          knownSpells: 4,
          grimoireSpells: 0,
          preparedSpells: 0,
          hasFullListAccess: false,
        }),
      );
      const q5 = resolveSpellQuota({ cls, kind: 'bard', classLevel: 5, abilityModifiers: mods });
      expect(q5?.cantrips).toBe(3);
      expect(q5?.knownSpells).toBe(8);
      expect(spellPickCount(q5!)).toBe(8);
    });

    it('computes wizard grimoire from spellcasting.grimoire', () => {
      const cls = {
        data: {
          spellcasting: {
            type: 'prepared',
            ability: 'int',
            prepared_formula: 'int_mod + class_level',
            grimoire: { initial_spells: 6, spells_per_level_up: 2 },
          },
          progression: [
            { level: 1, resources: { cantrips_known: 3 } },
            { level: 5, resources: { cantrips_known: 4 } },
          ],
        },
      };
      const q1 = resolveSpellQuota({ cls, kind: 'wizard', classLevel: 1, abilityModifiers: mods });
      expect(q1?.cantrips).toBe(3);
      expect(q1?.grimoireSpells).toBe(6);
      expect(q1?.preparedSpells).toBe(0);
      expect(q1?.hasFullListAccess).toBeFalse();
      expect(spellPickCount(q1!)).toBe(6);

      const q5 = resolveSpellQuota({ cls, kind: 'wizard', classLevel: 5, abilityModifiers: mods });
      expect(q5?.cantrips).toBe(4);
      expect(q5?.grimoireSpells).toBe(14);
    });

    it('uses prepared_formula for full-list prepared casters', () => {
      const cls = {
        data: {
          spellcasting: {
            type: 'prepared',
            ability: 'wis',
            prepared_formula: 'wis_mod + class_level',
            prepared_minimum: 1,
          },
          progression: [{ level: 1, resources: { cantrips_known: 3 } }],
        },
      };
      const q = resolveSpellQuota({ cls, kind: 'cleric', classLevel: 3, abilityModifiers: mods });
      expect(q?.cantrips).toBe(3);
      expect(q?.knownSpells).toBe(0);
      expect(q?.preparedSpells).toBe(5);
      expect(q?.hasFullListAccess).toBeTrue();
      expect(spellPickCount(q!)).toBe(5);
    });

    it('uses paladin prepared formula with floor', () => {
      const cls = {
        data: {
          spellcasting: {
            type: 'prepared',
            ability: 'cha',
            prepared_formula: 'cha_mod + floor(paladin_level / 2)',
            prepared_minimum: 1,
          },
          progression: [{ level: 2, resources: {} }],
        },
      };
      const q = resolveSpellQuota({ cls, kind: 'paladin', classLevel: 5, abilityModifiers: mods });
      expect(q?.preparedSpells).toBe(3);
      expect(q?.cantrips).toBe(0);
    });

    it('falls back by kind when class JSON is missing', () => {
      const q = resolveSpellQuota({ cls: null, kind: 'warlock', classLevel: 1 });
      expect(q?.cantrips).toBe(2);
      expect(q?.knownSpells).toBe(2);
    });

    it('returns null for an unknown kind without fallback data', () => {
      expect(resolveSpellQuota({ cls: null, kind: 'unknown-caster', classLevel: 1 })).toBeNull();
    });

    it('uses grimoire fallback when initial_spells is absent from JSON', () => {
      const cls = {
        data: {
          spellcasting: {
            type: 'prepared',
            ability: 'int',
            grimoire: { spells_per_level_up: 2 },
          },
          progression: [{ level: 1, resources: { cantrips_known: 3 } }],
        },
      };
      const q = resolveSpellQuota({ cls, kind: 'wizard', classLevel: 3, abilityModifiers: mods });
      expect(q?.grimoireSpells).toBe(6);
      expect(q?.modeLabel).toContain('Grimoire');
    });

    it('computes prepared count without formula using ability mod and level', () => {
      const cls = {
        data: {
          spellcasting: { type: 'prepared', ability: 'wis' },
          progression: [{ level: 3, resources: { cantrips_known: 2 } }],
        },
      };
      const q = resolveSpellQuota({ cls, kind: 'cleric', classLevel: 3, abilityModifiers: mods });
      expect(q?.preparedSpells).toBe(5);
      expect(q?.modeLabel).toContain('5 au choix');
    });

    it('honours prepared_minimum alias keys', () => {
      const cls = {
        data: {
          spellcasting: {
            type: 'prepared',
            ability: 'wis',
            prepared_formula: 'wis_mod + class_level',
            minimum_prepared: 4,
          },
          progression: [{ level: 1, resources: {} }],
        },
      };
      const q = resolveSpellQuota({ cls, kind: 'cleric', classLevel: 1, abilityModifiers: mods });
      expect(q?.preparedSpells).toBe(4);
    });

    it('adds bonus cantrips and resolves known-caster mode label', () => {
      const cls = {
        data: {
          spellcasting: { type: 'known', ability: 'cha' },
          progression: [{ level: 1, resources: { cantrips_known: 2, spells_known: 3 } }],
        },
      };
      const q = resolveSpellQuota({
        cls,
        kind: 'bard',
        classLevel: 1,
        abilityModifiers: mods,
        bonusCantrips: 1,
      });
      expect(q?.cantrips).toBe(3);
      expect(q?.knownSpells).toBe(3);
      expect(q?.modeLabel).toBe('Sorts connus');
    });

    it('uses paladin serment label when JSON marks a known caster without spells', () => {
      const cls = {
        data: {
          spellcasting: { type: 'known', ability: 'cha' },
          progression: [{ level: 1, resources: {} }],
        },
      };
      const q = resolveSpellQuota({ cls, kind: 'paladin', classLevel: 1, abilityModifiers: mods });
      expect(q?.modeLabel).toBe('Sorts préparés (serment)');
    });

    it('uses ranger mode label from fallback when no spells are known yet', () => {
      const q = resolveSpellQuota({ cls: null, kind: 'ranger', classLevel: 1 });
      expect(q?.modeLabel).toBe('Sorts connus (niv. 2+)');
    });
  });

  describe('evaluatePreparedFormula edge cases', () => {
    it('returns null for blank or invalid formulas', () => {
      expect(evaluatePreparedFormula('', 5, mods)).toBeNull();
      expect(evaluatePreparedFormula(undefined, 5, mods)).toBeNull();
      expect(evaluatePreparedFormula('wis_mod + foo', 5, mods)).toBeNull();
    });

    it('treats unknown ability codes as zero in formulas', () => {
      expect(evaluatePreparedFormula('xxx_mod + 2', 5, mods)).toBe(2);
    });
  });
});
