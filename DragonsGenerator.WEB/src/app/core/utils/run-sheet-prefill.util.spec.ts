import { prefillRunSheetFromCampaign } from './run-sheet-prefill.util';
import type { CampaignHandout, EncounterGroup } from '@core/models/Campaign/campaign';

describe('run-sheet-prefill.util', () => {
  it('fills empty run sheet from adventure and encounters', () => {
    const patch = prefillRunSheetFromCampaign(
      {
        adventure: 'Les héros défendent la Cité Franche.\nSuite…',
        encounters: [{ id: 'e1', name: 'Embuscade', creatures: [] } as EncounterGroup],
        creatures: [{ id: 'c1', creatureName: 'Gobelin' } as never],
        handouts: [
          {
            id: 'h1',
            title: 'Lettre',
            body: '',
            kind: 'letter',
            published: false,
            createdAt: '',
          } as CampaignHandout,
        ],
        dungeonMaps: [{ id: 'm1', name: 'Donjon A' } as never],
      },
      { title: 'S1', objectives: '', scenes: '', prepChecklist: '' },
    );
    expect(patch.objectives).toContain('Cité Franche');
    expect(patch.scenes).toContain('1) Embuscade');
    expect(patch.prepChecklist).toContain('Publier 1 document(s)');
    expect(patch.prepChecklist).toContain('Donjon A');
    expect(patch.prepChecklist).toContain('1 créature(s)');
  });

  it('keeps existing fields unless overwrite', () => {
    const patch = prefillRunSheetFromCampaign(
      { adventure: 'X', encounters: [], creatures: [], handouts: [], dungeonMaps: [] },
      { title: 'S', objectives: 'Déjà là', scenes: 'Déjà scènes', prepChecklist: 'Déjà prep' },
    );
    expect(patch).toEqual({});
  });

  it('overwrites when requested and handles empty adventure / unnamed encounter', () => {
    const patch = prefillRunSheetFromCampaign(
      {
        adventure: '',
        encounters: [
          {
            id: 'e1',
            name: '  ',
            creatures: [{ quantity: 2 } as never, { quantity: 1 } as never],
          } as EncounterGroup,
          { id: 'e2', name: undefined as never, creatures: [] } as EncounterGroup,
        ],
        creatures: [],
        handouts: [
          {
            id: 'h2',
            title: '',
            body: '',
            kind: 'other',
            published: false,
            createdAt: '',
          } as CampaignHandout,
          {
            id: 'h3',
            title: 'Publié',
            body: '',
            kind: 'letter',
            published: true,
            createdAt: '',
          } as CampaignHandout,
        ],
        dungeonMaps: [],
      },
      { title: 'Nuit', objectives: 'Ancien', scenes: 'Vieilles', prepChecklist: 'Checklist' },
      { overwrite: true },
    );
    expect(patch.objectives).toContain('Nuit');
    expect(patch.scenes).toContain('Rencontre (2 créature(s))');
    expect(patch.scenes).toContain('Rencontre');
    expect(patch.prepChecklist).toContain('sans titre');
    expect(patch.prepChecklist).toContain('Ouvrir la collecte');
    expect(patch.prepChecklist).not.toContain('Carte(s)');
  });

  it('truncates long synopsis and falls back when first line blank', () => {
    const long = 'A'.repeat(320);
    const truncated = prefillRunSheetFromCampaign(
      { adventure: long, encounters: [], creatures: [], handouts: [], dungeonMaps: [] },
      { title: 'S', objectives: '', scenes: 'keep', prepChecklist: 'keep' },
    );
    expect(truncated.objectives!.endsWith('…')).toBe(true);
    expect(truncated.objectives!.length).toBeLessThanOrEqual(280);
    expect(truncated.scenes).toBeUndefined();

    const blankFirst = prefillRunSheetFromCampaign(
      { adventure: '\n\n  \n', encounters: undefined as never, creatures: undefined as never, handouts: undefined as never, dungeonMaps: undefined as never },
      { title: '', objectives: undefined as never, scenes: undefined as never, prepChecklist: undefined as never },
    );
    expect(blankFirst.objectives).toContain('la session');
    expect(blankFirst.scenes).toContain('Accroche');
    expect(blankFirst.prepChecklist).toContain('Récap joueurs');
  });
});
