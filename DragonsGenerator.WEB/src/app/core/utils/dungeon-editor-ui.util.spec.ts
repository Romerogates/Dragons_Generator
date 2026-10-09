import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import {
  clampDungeonEditorScale,
  dungeonEditorCursorClass,
  dungeonEncounterLabel,
  dungeonLegendTileColor,
  DUNGEON_EDITOR_MAX_SCALE,
  DUNGEON_EDITOR_MIN_SCALE,
  DUNGEON_EDITOR_TOOLS,
  DUNGEON_SIZE_PRESETS,
  formatDungeonMapDate,
  markersInRoom,
} from './dungeon-editor-ui.util';

function room(
  partial: Partial<CampaignDungeonMap['rooms'][0]> = {},
): CampaignDungeonMap['rooms'][0] {
  return {
    id: 'r1',
    label: 'Salle 1',
    x: 2,
    y: 2,
    width: 4,
    height: 4,
    ...partial,
  };
}

describe('dungeon-editor-ui.util', () => {
  it('lists the editor tools', () => {
    expect(DUNGEON_EDITOR_TOOLS.map((t) => t.id)).toContain('floor');
    expect(DUNGEON_EDITOR_TOOLS.map((t) => t.id)).toContain('fill');
    expect(DUNGEON_SIZE_PRESETS[0].id).toBe('compact');
  });

  it('clamps zoom', () => {
    expect(clampDungeonEditorScale(1, 0.5)).toBe(1.5);
    expect(clampDungeonEditorScale(DUNGEON_EDITOR_MAX_SCALE, 1)).toBe(DUNGEON_EDITOR_MAX_SCALE);
    expect(clampDungeonEditorScale(DUNGEON_EDITOR_MIN_SCALE, -1)).toBe(DUNGEON_EDITOR_MIN_SCALE);
  });

  it('picks a cursor class', () => {
    expect(dungeonEditorCursorClass({ isPanning: true, spaceHeld: false, tool: 'select' })).toBe(
      'cursor-grabbing',
    );
    expect(dungeonEditorCursorClass({ isPanning: false, spaceHeld: true, tool: 'floor' })).toBe(
      'cursor-grabbing',
    );
    expect(dungeonEditorCursorClass({ isPanning: false, spaceHeld: false, tool: 'select' })).toBe(
      'cursor-default',
    );
    expect(dungeonEditorCursorClass({ isPanning: false, spaceHeld: false, tool: 'fill' })).toBe(
      'cursor-crosshair',
    );
  });

  it('labels encounters from linked group or random roll', () => {
    expect(dungeonEncounterLabel(room(), [])).toBe('—');
    expect(
      dungeonEncounterLabel(room({ encounterId: 'e1' }), [
        {
          id: 'e1',
          name: 'Embuscade',
          creatures: [
            {
              creatureId: 'g',
              creatureName: 'Gobelin',
              challengeRating: '1/4',
              xp: 50,
              quantity: 2,
              defeated: 0,
            },
          ],
          xpAwarded: false,
        },
      ]),
    ).toBe('2× Gobelin');
    expect(
      dungeonEncounterLabel(
        room({
          randomEncounter: {
            creatures: [{ name: 'Rat', quantity: 3 }],
          },
        }),
        [],
      ),
    ).toBe('3× Rat');
  });

  it('keeps non-door markers in a room', () => {
    const r = room();
    const markers: CampaignDungeonMap['markers'] = [
      { id: 'd', kind: 'door', x: 3, y: 3 },
      { id: 'c', kind: 'chest', x: 3, y: 3 },
      { id: 'out', kind: 'trap', x: 20, y: 20 },
      { id: 'link', kind: 'stairs', x: 0, y: 0, linkedRoomId: 'r1' },
    ];
    expect(markersInRoom(r, markers).map((m) => m.id)).toEqual(['c', 'link']);
  });

  it('formats a map date and legend colors', () => {
    expect(formatDungeonMapDate('2026-06-01T12:00:00Z')).toMatch(/\d/);
    expect(dungeonLegendTileColor('wall', 'crypt')).toBeTruthy();
    expect(dungeonLegendTileColor('door', 'cave')).toBeTruthy();
    expect(dungeonLegendTileColor('floor', 'generic')).toBeTruthy();
  });
});
