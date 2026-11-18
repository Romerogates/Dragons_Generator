import { mergeRemoteInitiativeRolls, mergeRemoteLiveTable } from '../campaign-persist.util';
import {
  buildGrimoireEffectSummary,
  normalizeSpellDescription,
  paginateGrimoireOverflow,
  planGrimoireTable,
} from '../spell-grimoire-effect.util';
import {
  fogRevealSet,
  roomAt,
  roomLabelAt,
  themePalette,
  tileAt,
} from '../dungeon-render.util';
import {
  canOpenFightPhase,
  createActiveCombat,
  createCombatant,
  currentTurnCombatant,
} from '../combat-tracker.util';
import type { Spell } from '@core/models/Spells/spell';
import type { SpellInstance } from '@core/models/Character/character';
import { baseCampaign, emptyMap } from './helpers';

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
            rooms: [],
            markers: [],
            tiles: [],
            gridWidth: 5,
            gridHeight: 5,
          },
        ],
      });
      const remoteCombat = remote.data.sessions![0].activeCombat;
      if (remoteCombat) {
        delete remoteCombat.round;
        remoteCombat.initiativeCode = undefined;
        remoteCombat.flowPhase = undefined;
      }
      delete remote.data.sessions![0].status;
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
