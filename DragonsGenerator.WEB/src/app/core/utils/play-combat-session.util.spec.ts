import { createCombatant, createActiveCombat } from './combat-tracker.util';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import type { EncounterGroup } from '@core/models/Campaign/campaign';
import {
  approvedMembersNotInCombat,
  combatEnteringFight,
  combatEnteringInitiative,
  encounterCombatSessionPatch,
  exclusivePlayImportPickers,
  placeEncounterCombatantsOnMap,
  playerSubmittedCombatantIds,
  sessionPatchAfterCombatEnd,
  sessionPatchAfterPlayEnd,
  withCombatantAtTile,
} from './play-combat-session.util';

function floorMap(encounterId: string): CampaignDungeonMap {
  return {
    id: 'map1',
    name: 'Crypte',
    theme: 'crypt',
    gridWidth: 6,
    gridHeight: 6,
    tiles: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 'floor' as const)),
    rooms: [{ id: 'r1', label: 'Salle', x: 1, y: 2, width: 2, height: 2, encounterId }],
    markers: [],
    createdAt: '',
    updatedAt: '',
  };
}

function encounter(over: Partial<EncounterGroup> = {}): EncounterGroup {
  return {
    id: 'e1',
    name: 'Embuscade',
    creatures: [
      {
        creatureId: 'gob',
        creatureName: 'Gobelin',
        challengeRating: '1/4',
        xp: 50,
        quantity: 2,
        defeated: 0,
      },
    ],
    ...over,
  };
}

describe('play-combat-session.util', () => {
  it('opens one import picker at a time', () => {
    expect(exclusivePlayImportPickers('ally')).toEqual({
      ally: true,
      campaignAlly: false,
      enemy: false,
    });
    expect(exclusivePlayImportPickers(null).ally).toBeFalse();
  });

  it('places encounter tokens on the linked room', () => {
    const cbs = [
      createCombatant({ name: 'A', kind: 'monster' }),
      createCombatant({ name: 'B', kind: 'monster' }),
    ];
    const placed = placeEncounterCombatantsOnMap(cbs, { id: 'e1', dungeonMapId: 'map1' }, [
      floorMap('e1'),
    ]);
    expect(placed[0]!.mapX).toBe(1);
    expect(placed[0]!.mapY).toBe(2);
    expect(placed[1]!.mapX).toBe(2);
    expect(placeEncounterCombatantsOnMap(cbs, { id: 'e1' }, [floorMap('e1')])).toEqual(cbs);
  });

  it('starts combat from an encounter and pins the map', () => {
    const patch = encounterCombatSessionPatch(encounter({ dungeonMapId: 'map1' }), [floorMap('e1')]);
    expect(patch.activeMapId).toBe('map1');
    expect(patch.activeCombat?.label).toBe('Embuscade');
    expect(patch.activeCombat?.combatants.length).toBe(2);
  });

  it('archives play pads into MJ notes and closes the session', () => {
    const session = {
      id: 's1',
      title: 'Soir',
      scheduledAt: '',
      status: 'planned' as const,
      notes: 'Prep',
      playNotes: 'Live',
      playPads: [
        {
          id: 'p1',
          kind: 'note' as const,
          title: 'Notes',
          order: 0,
          page: {
            id: 'n1',
            title: 'Notes',
            mode: 'text' as const,
            text: 'Ce qu’il s’est passé',
            inkStrokes: [],
            updatedAt: '',
          },
        },
      ],
      activeCombat: createActiveCombat([createCombatant({ name: 'Orc', kind: 'monster' })]),
    };
    const patch = sessionPatchAfterPlayEnd(session, 'Les héros ont fui.');
    expect(patch.status).toBe('played');
    expect(patch.activeCombat).toBeNull();
    expect(patch.playPads).toEqual([]);
    expect(patch.playNotes).toBe('');
    expect(patch.playerRecap).toBe('Les héros ont fui.');
    expect(patch.notes).toContain('Prep');
    expect(patch.notes).toContain('Ce qu’il s’est passé');
    expect(patch.notes).toContain('--- Notes de session ---');
  });

  it('archives combat into pads + history', () => {
    const combat = createActiveCombat([createCombatant({ name: 'Orc', kind: 'monster' })], {
      label: 'Duel',
    });
    const session = {
      id: 's1',
      title: 'Soir',
      scheduledAt: '',
      status: 'played' as const,
      mode: 'online' as const,
    };
    const patch = sessionPatchAfterCombatEnd(session, combat);
    expect(patch.activeCombat).toBeNull();
    expect(patch.combatHistory?.[0]?.label).toBe('Duel');
    expect(patch.playPads?.some((p) => (p.page?.text ?? '').includes('Fin combat'))).toBeTrue();
  });

  it('filters approved members already in combat', () => {
    const approved = [{ userId: 'a' }, { userId: 'b' }];
    expect(
      approvedMembersNotInCombat(approved, [{ memberUserId: 'a' }, { memberUserId: null }]).map(
        (m) => m.userId,
      ),
    ).toEqual(['b']);
  });

  it('refuses occupied tiles', () => {
    const a = createCombatant({ name: 'A', kind: 'player' });
    const b = createCombatant({ name: 'B', kind: 'monster', mapX: 3, mapY: 4 });
    expect(withCombatantAtTile([a, b], a.id, 3, 4)).toBeNull();
    expect(withCombatantAtTile([a, b], a.id, 1, 1)?.[0]!.mapX).toBe(1);
  });

  it('gates initiative and fight patches', () => {
    const setupOnly = createActiveCombat([createCombatant({ name: 'A', kind: 'player' })]);
    expect(combatEnteringInitiative(setupOnly)).toBeNull();
    const ready = createActiveCombat([
      createCombatant({ name: 'A', kind: 'player', initiativeRoll: 12 }),
      createCombatant({ name: 'B', kind: 'monster', initiativeRoll: 8 }),
    ]);
    const init = combatEnteringInitiative(ready);
    expect(init?.flowPhase).toBe('initiative');
    expect(init?.initiativeCode).toBeTruthy();
    expect(combatEnteringFight(ready)?.flowPhase).toBe('fight');
    const submitted = createActiveCombat([
      createCombatant({ name: 'A', kind: 'player', playerSubmitted: true }),
    ]);
    expect(playerSubmittedCombatantIds(submitted)).toEqual([submitted.combatants[0]!.id]);
  });
});
