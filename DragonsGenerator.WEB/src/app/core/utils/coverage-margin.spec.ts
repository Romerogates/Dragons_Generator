import {
  deleteCustomBackgroundTemplate,
  listCustomBackgroundTemplates,
  saveCustomBackgroundTemplate,
} from './custom-background-templates.util';
import { extractJoinTokenFromUrl, parseChatBodySegments } from './chat-body-links.util';
import {
  parseDamageDice,
  resolveAttackRoll,
  rollDamageTotal,
  rollDie,
} from './combat-roll.util';
import { extractSubclassBonusSpells } from './subclass-bonus-spells.util';
import { mergeRemoteInitiativeRolls, mergeRemoteLiveTable } from './campaign-persist.util';
import {
  buildGrimoireEffectSummary,
  layoutGrimoireEffect,
  normalizeSpellDescription,
  paginateGrimoireOverflow,
  planGrimoireTable,
} from './spell-grimoire-effect.util';
import {
  fogRevealSet,
  roomAt,
  roomLabelAt,
  themePalette,
  tileAt,
} from './dungeon-render.util';
import {
  canOpenFightPhase,
  createActiveCombat,
  createCombatant,
  currentTurnCombatant,
  sortCombatants,
} from './combat-tracker.util';
import { validateCharacterExport } from './character-export-validation.util';
import {
  featBonusArmorProficiencies,
  featResistanceOptions,
  isTalentSpendComplete,
  resolveFeatAsiAbilityKey,
  talentSpendsTotalCost,
} from './feat-benefits.util';
import {
  archivePlayPadsText,
  ensureSessionResume,
  seedNotebookFromLegacyNotes,
  sessionNotebookFromPlay,
} from './notebook.util';
import { resolveFeatureUses } from './feature-uses.util';
import { isLocalDevHost, mailhogWebUrl } from './local-dev.util';
import { equipmentSummaryText } from './equipment-display.util';
import { labelForGameId } from './game-id-labels';
import {
  buildAutoBackgroundSelection,
  buildAutoSpeciesSelection,
  createSkillMapFromList,
} from './character-auto-build.util';
import { parseAiRateLimitError } from './ai-rate-limit.util';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { CURRENT_SCHEMA_VERSION, type Character } from '@core/models/Character/character';
import type { CampaignDetail } from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import type { Background } from '@core/models/Backgrounds/background';
import type { Species } from '@core/models/Species/species';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Spell } from '@core/models/Spells/spell';
import type { SpellInstance } from '@core/models/Character/character';
import type { Skill } from '@core/models/Skills/skill';

const STORAGE_KEY = 'dg_custom_background_templates';

function baseCampaign(overrides: Partial<CampaignDetail['data']> = {}): CampaignDetail {
  return {
    id: 'c1',
    title: 'Test',
    role: 'dm',
    isOwner: true,
    updatedAt: '2026-01-01T00:00:00Z',
    members: [],
    data: {
      setting: '',
      regionId: null,
      regionName: '',
      partyLevel: 3,
      tone: 'classic',
      adventure: '',
      creatures: [],
      encounters: [],
      notes: 'notes',
      pregenCharacters: [],
      sessions: [
        {
          id: 's1',
          title: 'S1',
          scheduledAt: '2026-01-01T20:00:00Z',
          status: 'planned',
          activeCombat: {
            id: 'combat-1',
            label: 'Combat',
            round: 1,
            collectingInitiative: true,
            initiativeCode: 'ABCD',
            turnIndex: 0,
            combatants: [
              {
                id: 'p1',
                name: 'Héro',
                kind: 'player',
                initiativeBonus: 2,
                playerSubmitted: false,
              },
            ],
          },
        },
      ],
      handouts: [],
      activeSessionId: 's1',
      dungeonMaps: [],
      ...overrides,
    },
  };
}

function emptyMap(overrides: Partial<CampaignDungeonMap> = {}): CampaignDungeonMap {
  return {
    id: 'm1',
    name: 'Cave',
    theme: 'cave',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fogOfWarEnabled: false,
    revealedRoomIds: [],
    rooms: [{ id: 'r1', label: 'Entrée', x: 1, y: 1, width: 2, height: 2 }],
    markers: [],
    tiles: [
      ['wall', 'wall', 'wall'],
      ['wall', 'floor', 'door'],
      ['wall', 'wall', 'wall'],
    ],
    gridWidth: 3,
    gridHeight: 3,
    ...overrides,
  };
}

describe('coverage margin — branches utilitaires', () => {
  describe('custom-background-templates', () => {
    beforeEach(() => localStorage.removeItem(STORAGE_KEY));

    it('list returns [] for missing, non-array or corrupt JSON', () => {
      expect(listCustomBackgroundTemplates()).toEqual([]);
      localStorage.setItem(STORAGE_KEY, '{"not":"array"}');
      expect(listCustomBackgroundTemplates()).toEqual([]);
      localStorage.setItem(STORAGE_KEY, '{');
      expect(listCustomBackgroundTemplates()).toEqual([]);
    });

    it('save defaults empty name and delete filters by id', () => {
      const draft = {
        name: '  ',
        privilegeName: 'P',
        privilegeDesc: 'D',
        gold: 10,
        trait: 't',
        ideal: 'i',
        bond: 'b',
        flaw: 'f',
      };
      const saved = saveCustomBackgroundTemplate(draft);
      expect(saved[0]?.name).toBe('Historique personnalisé');
      saveCustomBackgroundTemplate({ ...draft, name: 'Aventureux' });
      const after = deleteCustomBackgroundTemplate(saved[0]!.id);
      expect(after.every((t) => t.id !== saved[0]!.id)).toBeTrue();
    });
  });

  describe('chat-body-links', () => {
    it('covers empty body, non-join URL punctuation and no-match path', () => {
      expect(parseChatBodySegments('')).toEqual([]);
      expect(extractJoinTokenFromUrl('https://example.com/x')).toBeNull();
      const segs = parseChatBodySegments('voir https://example.com/page).');
      expect(segs.some((s) => s.type === 'url')).toBeTrue();
      expect(segs.some((s) => s.type === 'text' && s.value.includes(')'))).toBeTrue();
      expect(parseChatBodySegments('texte seul sans lien')).toEqual([
        { type: 'text', value: 'texte seul sans lien' },
      ]);
    });
  });

  describe('combat-roll', () => {
    it('covers empty/invalid dice and NaN AC', () => {
      expect(parseDamageDice(null)).toBeNull();
      expect(parseDamageDice('')).toBeNull();
      expect(parseDamageDice('abc')).toBeNull();
      expect(rollDamageTotal(null)).toBeNull();
      expect(rollDie(0)).toBe(1);
      expect(resolveAttackRoll(10, 2, Number.NaN).hit).toBeNull();
      expect(resolveAttackRoll(10, 2).hit).toBeNull();
    });
  });

  describe('subclass-bonus-spells', () => {
    it('covers empty options bag, missing names and level_unlocked defaults', () => {
      const cls = {
        id: 'cls-x',
        name: 'X',
        data: { subclasses: {} },
      } as unknown as CharacterClass;
      expect(extractSubclassBonusSpells(cls, 'sub', 5)).toEqual([]);

      const withGrant = {
        id: 'cls-y',
        name: 'Y',
        data: {
          subclasses: {
            options: [
              {
                id: 'sub-a',
                bonus_spells_granted: [
                  { level_unlocked: 0, spells: ['spl-a'] },
                  { level_unlocked: 3, spells: undefined },
                ],
              },
            ],
          },
        },
      } as unknown as CharacterClass;
      const map = new Map<string, string>();
      expect(extractSubclassBonusSpells(withGrant, 'sub-a', 5, map)).toEqual([
        { characterLevel: 0, spells: ['spl-a'] },
      ]);
      expect(extractSubclassBonusSpells(withGrant, 'sub-a', 5, { 'spl-b': 'B' })).toEqual([
        { characterLevel: 0, spells: ['spl-a'] },
      ]);
      expect(
        extractSubclassBonusSpells(
          {
            id: 'cls-z',
            name: 'Z',
            data: {
              subclasses: {
                options: [
                  {
                    id: 'sub-z',
                    bonus_spells_granted: [{ spells: ['spl-late'] }],
                  },
                ],
              },
            },
          } as unknown as CharacterClass,
          'sub-z',
          99,
        ),
      ).toEqual([{ characterLevel: 0, spells: ['spl-late'] }]);
    });
  });

  describe('campaign-persist sparse sessions / fog', () => {
    it('merge initiative with undefined sessions arrays', () => {
      const local = baseCampaign();
      (local.data as { sessions?: unknown }).sessions = undefined;
      const remote = baseCampaign();
      (remote.data as { sessions?: unknown }).sessions = undefined;
      remote.updatedAt = '2026-02-01T00:00:00Z';
      const merged = mergeRemoteInitiativeRolls(local, remote);
      expect(merged.updatedAt).toBe(remote.updatedAt);
    });

    it('merge live table uses remote activeSessionId and fog fallbacks', () => {
      const local = baseCampaign({
        activeSessionId: null,
        dungeonMaps: [
          {
            id: 'm1',
            name: 'Cave',
            theme: 'cave',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            fogOfWarEnabled: true,
            revealedRoomIds: ['keep'],
            rooms: [],
            markers: [],
            tiles: [],
            gridWidth: 5,
            gridHeight: 5,
          },
        ],
      });
      const remote = baseCampaign({
        dungeonMaps: [
          {
            id: 'm1',
            name: 'Cave',
            theme: 'cave',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:01:00Z',
            fogOfWarEnabled: undefined as unknown as boolean,
            revealedRoomIds: undefined as unknown as string[],
            rooms: [],
            markers: [],
            tiles: [],
            gridWidth: 5,
            gridHeight: 5,
          },
        ],
      });
      remote.data.sessions![0].activeCombat!.round = undefined as unknown as number;
      remote.data.sessions![0].activeCombat!.initiativeCode = undefined;
      remote.data.sessions![0].activeCombat!.flowPhase = undefined;
      remote.data.sessions![0].status = undefined as unknown as 'planned';
      const merged = mergeRemoteLiveTable(local, remote);
      expect(merged.data.activeSessionId).toBe('s1');
      expect(merged.data.dungeonMaps![0].revealedRoomIds).toEqual(['keep']);
      expect(merged.data.dungeonMaps![0].fogOfWarEnabled).toBe(true);
    });

    it('merge live table when remote session exists without combat object', () => {
      const local = baseCampaign();
      const remote = baseCampaign();
      remote.data.sessions![0].activeCombat = undefined;
      remote.data.sessions![0].status = 'played';
      (local.data as { dungeonMaps?: unknown }).dungeonMaps = undefined;
      (remote.data as { dungeonMaps?: unknown }).dungeonMaps = undefined;
      const merged = mergeRemoteLiveTable(local, remote);
      expect(merged.data.sessions![0].status).toBe('played');
    });
  });

  describe('spell-grimoire remaining OCR / layout', () => {
    const mockSpell = (overrides: Partial<Spell> = {}): Spell =>
      ({
        id: 'spl-test',
        name: 'Test',
        level: 1,
        school: 'evocation',
        castingTime: { amount: 1, unit: 'action' },
        range: { amount: 9, unit: 'm' },
        duration: { amount: null, unit: 'instantane' },
        components: { v: true, s: false, m: null },
        isRitual: false,
        isConcentration: false,
        isCorrupted: false,
        description: 'Effet.',
        modularOptions: [],
        classes: [],
        ...overrides,
      }) as Spell;

    it('normalizes remaining OCR prefixes and long materials', () => {
      expect(normalizeSpellDescription('D Vous lancez un sort.')).toBe('Vous lancez un sort.');
      expect(normalizeSpellDescription('C Choisissez une cible.')).toBe('Choisissez une cible.');
      expect(normalizeSpellDescription('Jouhait corrompu')).toContain('Souhait');
      const longMat = 'a'.repeat(40);
      const summary = buildGrimoireEffectSummary(
        mockSpell({
          components: { v: false, s: false, m: longMat },
          duration: { amount: null, unit: 'special' as never },
          description: '',
        }),
      );
      expect(summary).toContain('…');
    });

    it('forces truncated placement when first spell alone exceeds page', () => {
      const split = (text: string) => text.split(' ').filter(Boolean);
      const huge: SpellInstance = {
        refId: 'spl-h',
        name: 'Huge',
        level: 1,
        prepared: true,
        effectSummary: undefined,
      };
      const plan = planGrimoireTable([huge, { ...huge, name: 'Next', refId: 'spl-n' }], split, 20, 1, 8);
      expect(plan.placements.length).toBe(1);
      expect(plan.overflow.length).toBe(1);

      const emptyPlacements = paginateGrimoireOverflow(
        [{ ...huge, effectSummary: 'A B C D E F G H I J K L M N O P' }],
        () => Array.from({ length: 20 }, (_, i) => `L${i}`),
        10,
        0,
        8,
      );
      expect(emptyPlacements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('dungeon-render helpers', () => {
    it('theme/tile/room/fog fallbacks', () => {
      expect(themePalette(undefined).floor).toBeTruthy();
      expect(themePalette('unknown-theme' as never).floor).toBeTruthy();
      const map = emptyMap();
      expect(tileAt(map, 9, 9)).toBe('wall');
      expect(roomAt(map, 0, 0)).toBeNull();
      expect(roomAt(map, 1, 1)).toBe('r1');
      expect(roomLabelAt(map, 'missing')).toBe('');
      expect(fogRevealSet(map)).toBeNull();
      expect(fogRevealSet({ ...map, fogOfWarEnabled: true, revealedRoomIds: undefined })).toEqual(
        new Set(),
      );
    });
  });

  describe('combat-tracker edges', () => {
    it('canOpenFightPhase ignores defeated without initiative', () => {
      const ally = createCombatant({
        name: 'Ally',
        kind: 'player',
        initiativeRoll: 10,
        initiativeBonus: 1,
      });
      const dead = createCombatant({
        name: 'Dead',
        kind: 'monster',
        defeated: true,
        currentHp: 0,
      });
      const liveEnemy = createCombatant({
        name: 'Live',
        kind: 'monster',
        initiativeRoll: 8,
        initiativeBonus: 0,
      });
      expect(canOpenFightPhase(createActiveCombat([ally, dead, liveEnemy]))).toBeTrue();
      expect(
        currentTurnCombatant(
          createActiveCombat([ally], { label: 'x' }),
        )?.name,
      ).toBe('Ally');
    });
  });

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
});
