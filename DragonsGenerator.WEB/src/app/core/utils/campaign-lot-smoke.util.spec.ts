import type { CampaignSession } from '@core/models/Campaign/campaign';
import { buildPlayerRecapTemplate } from './player-recap-template.util';
import {
  buildEncountersFromPack,
  buildHandoutsFromPack,
  buildNotebookPageFromTemplate,
  ENCOUNTER_PACK_PRESETS,
  HANDOUT_PACK_PRESETS,
  NOTEBOOK_TEMPLATE_PRESETS,
} from './campaign-content-presets.util';

describe('player-recap-template', () => {
  it('builds markdown from timeline and combat history', () => {
    const session: CampaignSession = {
      id: 's1',
      title: 'Nuit des docks',
      scheduledAt: '2026-09-27T19:00:00.000Z',
      status: 'planned',
      timeline: [{ id: 't1', kind: 'note', label: 'Arrivée au port' }],
      combatHistory: [
        { id: 'c1', endedAt: '2026-09-27T21:00:00.000Z', round: 3, summary: 'Victoire vs bandits' },
      ],
      combatLog: ['Alice touche le gobelin'],
      objectives: 'Sécuriser l’entrepôt',
    };
    const text = buildPlayerRecapTemplate(session);
    expect(text).toContain('Nuit des docks');
    expect(text).toContain('Arrivée au port');
    expect(text).toContain('Victoire vs bandits');
    expect(text).toContain('Alice touche le gobelin');
    expect(text).toContain('### Suite');
  });

  it('falls back when title/timeline/history are empty', () => {
    const text = buildPlayerRecapTemplate({
      id: 's2',
      title: '   ',
      scheduledAt: 'not-a-date',
      status: 'planned',
      timeline: [{ id: 't', kind: 'note', label: '  ' }],
      combatHistory: [{ id: 'c', endedAt: '', round: 2, summary: '' }],
      combatLog: ['  ', 'Moment'],
    });
    expect(text).toContain('## Session');
    expect(text).toContain('Manche 2');
    expect(text).toContain('- Moment');
    expect(text).not.toContain('Objectifs');
  });
});

describe('handout / notebook / encounter packs', () => {
  it('exposes cite-franche and oneshot packs with creatures', () => {
    expect(ENCOUNTER_PACK_PRESETS.length).toBeGreaterThanOrEqual(2);
    const cite = buildEncountersFromPack('cite-franche-streets');
    expect(cite.length).toBe(2);
    expect(cite[0].creatures.some((c) => c.creatureId === 'cre-baron-du-crime')).toBe(true);
    const dungeon = buildEncountersFromPack('oneshot-dungeon');
    expect(dungeon[0].creatures.some((c) => c.quantity >= 2)).toBe(true);
  });

  it('returns empty for unknown pack', () => {
    expect(buildEncountersFromPack('nope')).toEqual([]);
    expect(buildHandoutsFromPack('nope')).toEqual([]);
    expect(buildNotebookPageFromTemplate('nope')).toBeNull();
  });

  it('builds handouts and notebook pages from presets', () => {
    expect(HANDOUT_PACK_PRESETS.length).toBeGreaterThanOrEqual(2);
    expect(NOTEBOOK_TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(2);

    const handouts = buildHandoutsFromPack('oneshot-starter');
    expect(handouts.length).toBe(3);
    expect(handouts[0].title).toContain('Brief');
    expect(handouts.every((h) => h.published === false)).toBe(true);

    const prep = buildHandoutsFromPack('prep-mj');
    expect(prep.some((h) => h.kind === 'other')).toBe(true);

    const page = buildNotebookPageFromTemplate('run-sheet');
    expect(page?.title).toBe('Run sheet');
    expect(page?.text).toContain('Objectifs');
  });
});
