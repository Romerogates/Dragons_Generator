import { validateCharacterExport } from '../character-export-validation.util';
import {
  featBonusArmorProficiencies,
  featResistanceOptions,
  isTalentSpendComplete,
  resolveFeatAsiAbilityKey,
  talentSpendsTotalCost,
} from '../feat-benefits.util';
import {
  archivePlayPadsText,
  ensureSessionResume,
  seedNotebookFromLegacyNotes,
  sessionNotebookFromPlay,
} from '../notebook.util';
import { resolveFeatureUses } from '../feature-uses.util';
import { isLocalDevHost, mailhogWebUrl } from '../local-dev.util';
import { equipmentSummaryText } from '../equipment-display.util';
import { labelForGameId } from '../game-id-labels';
import {
  buildAutoBackgroundSelection,
  buildAutoSpeciesSelection,
  createSkillMapFromList,
} from '../character-auto-build.util';
import { parseAiRateLimitError } from '../ai-rate-limit.util';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { CURRENT_SCHEMA_VERSION, type Character } from '@core/models/Character/character';
import type { Background } from '@core/models/Backgrounds/background';
import type { Species } from '@core/models/Species/species';
import type { Skill } from '@core/models/Skills/skill';
import {
  canOpenFightPhase,
  createActiveCombat,
  createCombatant,
  currentTurnCombatant,
  sortCombatants,
} from '../combat-tracker.util';
import { layoutGrimoireEffect } from '../spell-grimoire-effect.util';

describe('character-export remaining', () => {
    it('rejects empty weapon id, tool-any and empty equipment ref', () => {
      const broken = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        name: 'X',
        species: { id: 'spc-humain', label: 'Humain' },
        classes: [{ classId: 'cls-guerrier', classLabel: 'Guerrier', level: 1, hitDie: 10 }],
        totalLevel: 1,
        proficiencies: {
          weapons: [''],
          tools: ['tool-any', 'tl-cat-artisan'],
          armor: [],
          languages: [],
        },
        equipment: [{ refId: '  ', name: 'Vide', qty: 1 }],
      } as unknown as Character;
      const result = validateCharacterExport(broken);
      expect(result.valid).toBeFalse();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('accepts tool GEAR/VEHICLE categories and sparse optional arrays', () => {
      const ok = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        name: 'Artisan',
        species: { id: 'spc-humain', label: 'Humain' },
        classes: [{ classId: 'cls-guerrier', classLabel: 'Guerrier', level: 1, hitDie: 10 }],
        totalLevel: 1,
        proficiencies: {
          weapons: ['wp-cat-simple'],
          tools: ['tl-focaliseur-arcanique', 'category-vehicles'],
        },
        equipment: [],
      } as unknown as Character;
      expect(validateCharacterExport(ok).valid).toBeTrue();

      const sparse = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        name: 'Sparse',
        species: { id: 'spc-humain', label: 'Humain' },
        classes: [{ classId: 'cls-guerrier', classLabel: 'Guerrier', level: 1, hitDie: 10 }],
        proficiencies: {},
      } as unknown as Character;
      const sparseResult = validateCharacterExport(sparse);
      expect(sparseResult.errors.some((e) => e.includes('Niveau'))).toBeTrue();
    });
  });

  describe('feat-benefits remaining', () => {
    it('skips non-object benefits and unknown talent spend types', () => {
      expect(
        featBonusArmorProficiencies({
          benefits: [null, 'x', { type: 'proficiency', proficiency_type: 'armor', value: 3 }],
        } as never),
      ).toEqual([]);
      expect(
        featResistanceOptions({
          benefits: [null, { type: 'damage_resistance', choose_from: [1, 'feu', ''] }],
        } as never).map((o) => o.id),
      ).toContain('damage-feu');
      expect(talentSpendsTotalCost([{ id: '1', type: 'unknown' as never }])).toBe(0);
      expect(isTalentSpendComplete({ id: '1', type: 'unknown' as never })).toBeFalse();
    });
  });

  describe('ai-rate-limit remaining', () => {
    it('rejects empty url and non-object body', () => {
      expect(
        parseAiRateLimitError(
          new HttpErrorResponse({
            status: 429,
            url: undefined,
            error: { code: 'ai_rate_limit' },
          }),
        ),
      ).toBeNull();
      expect(
        parseAiRateLimitError(
          new HttpErrorResponse({
            status: 429,
            url: '/api/generate-backstory',
            headers: new HttpHeaders({ 'Retry-After': 'nope' }),
            error: 'plain',
          }),
        ),
      ).toBeNull();
    });
  });

  describe('auto-build sparse species / background', () => {
    const skills: Skill[] = [
      { id: 'skill-acrobaties', name: 'Acrobaties', ability: 'DEX' },
      { id: 'skill-athletisme', name: 'Athlétisme', ability: 'STR' },
    ] as Skill[];

    it('species without creationChoices / subspecies / darkvision', () => {
      const species = {
        id: 'spc-sparse',
        name: 'Sparse',
        playable: true,
        baseStats: { speedM: 9, size: undefined, darkvisionM: undefined, abilityScoreIncrease: {} },
        languages: undefined,
        traits: undefined,
        creationChoices: undefined,
        subspecies: undefined,
      } as unknown as Species;
      const sel = buildAutoSpeciesSelection(species, 1, []);
      expect(sel.speciesId).toBe('spc-sparse');
      expect(sel.hasDarkvision).toBeFalse();
      expect(sel.darkvisionRadius).toBe(0);
      expect(sel.subspeciesId).toBeNull();
    });

    it('background skill any-pool and empty personality / equipment qty', () => {
      const bg = {
        id: 'bg-sparse',
        name: 'Sparse',
        data: {
          preset: true,
          privilege: { id: 'p', name: 'P', desc: 'D' },
          proficiencies: {
            skills: { fixed: undefined, options: ['any'], chooseCount: 1 },
            tools: { choose: [{ chooseCount: 1, options: undefined }] },
            languages: undefined,
          },
          equipment: {
            fixed: [{ id: 'wp-dague', name: 'Dague', qty: undefined }],
            choose: [{ name: undefined, pool: [{ id: 'wp-epee', qty: undefined }] }],
            currency: undefined,
          },
          personalityTables: {
            traits: { entries: [] },
            ideals: undefined,
            bonds: { entries: [{ text: 'Bond' }] },
            flaws: { entries: undefined },
          },
          flavor: undefined,
        },
      } as unknown as Background;
      const sel = buildAutoBackgroundSelection(bg, createSkillMapFromList(skills));
      expect(sel.skills.length).toBeGreaterThan(0);
      expect(sel.equipment[0]?.qty).toBe(1);
      expect(sel.bonds).toBe('Bond');
      expect(sel.traits).toBeUndefined();
    });
  });

  describe('extra branches to 93%', () => {
    it('feat cantrips empty list and resolveFeatAsiAbilityKey choice fallback', () => {
      expect(isTalentSpendComplete({ id: '1', type: 'cantrips' })).toBeFalse();
      expect(resolveFeatAsiAbilityKey({ ability_score_increase: { ability: 'any', value: 1 } }, null, 'force')).toBe(
        'force',
      );
      expect(resolveFeatAsiAbilityKey({ ability_score_increase: { ability: 'any', value: 1 } }, null, null)).toBeNull();
    });

    it('grimoire empty header layout', () => {
      const split = (t: string) => (t ? [t] : ['']);
      const layout = layoutGrimoireEffect('', split, 40);
      expect(layout.bodyLines).toEqual([]);
      expect(layout.rowsNeeded).toBeGreaterThanOrEqual(1);
    });

    it('notebook sparse paths', () => {
      expect(seedNotebookFromLegacyNotes(null)).toEqual([]);
      expect(seedNotebookFromLegacyNotes('   ')).toEqual([]);
      expect(ensureSessionResume({ id: 'p', title: '  ', mode: 'text', text: '', inkStrokes: [], updatedAt: '' }).title).toBe(
        'Résumé',
      );
      expect(
        archivePlayPadsText([
          {
            id: 'c1',
            kind: 'checklist',
            title: '',
            order: 0,
            items: [
              { id: 'i1', text: 'Todo', done: false },
              { id: 'i2', text: '', done: true },
            ],
          },
        ]),
      ).toContain('[ ] Todo');
      expect(
        sessionNotebookFromPlay('Soirée', 'notes', {
          id: 'n1',
          title: '',
          mode: 'text',
          text: undefined as unknown as string,
          inkStrokes: [],
          updatedAt: '',
        }).title,
      ).toContain('Soirée');
    });

    it('combat tracker turn order miss and high turnIndex', () => {
      const a = createCombatant({ name: 'A', kind: 'player', initiativeRoll: 10, initiativeBonus: 0 });
      const b = createCombatant({ name: 'B', kind: 'monster', initiativeRoll: 10, initiativeBonus: 0 });
      const sorted = sortCombatants([a, b], ['unknown', b.id]);
      expect(sorted[0]?.id).toBe(b.id);

      const combat = createActiveCombat([a, b]);
      combat.turnIndex = 99;
      expect(currentTurnCombatant(combat)).toBeTruthy();
      expect(
        canOpenFightPhase(
          createActiveCombat([
            createCombatant({ name: 'Ally', kind: 'player', initiativeRoll: 5, initiativeBonus: 0 }),
            createCombatant({ name: 'Enemy', kind: 'monster' }),
          ]),
        ),
      ).toBeFalse();
    });

    it('feature-uses parseResourceMax via mechanics upgrades', () => {
      const cls = {
        data: {
          progression: [{ level: 1, resources: {} }],
        },
      };
      const uses = resolveFeatureUses(
        {
          recharge: 'long_rest',
          mechanics: {
            uses_key: 'missing_key',
            upgrades: [{ at_level: 1, uses: 3 }],
          },
        },
        cls,
        1,
      );
      expect(uses?.max).toBe(3);

      const viaString = resolveFeatureUses(
        {
          recharge: 'long_rest',
          resource_key: 'rage',
        },
        { data: { progression: [{ level: 1, resources: { rage: '2' } }] } },
        1,
      );
      expect(viaString?.max).toBe(2);
    });

    it('local-dev empty host and mailhog 127 rewrite', () => {
      expect(isLocalDevHost('')).toBeFalse();
      expect(mailhogWebUrl('127.0.0.1')).toBe('http://localhost:8025');
    });

    it('equipment display and game-id category fallbacks', () => {
      expect(
        equipmentSummaryText({ type: 'GEAR', subtype: null, data: undefined as unknown as Record<string, unknown> }),
      ).toBe('');
      expect(
        equipmentSummaryText({
          type: 'WEAPON',
          subtype: null,
          data: { ammo_range: { normal: 24 } },
        }),
      ).toContain('Portée 24 m');
      expect(labelForGameId('category-vehicles')).toContain('Véhicule');
      expect(labelForGameId('wp-simple')).toBeTruthy();
    });
  });
