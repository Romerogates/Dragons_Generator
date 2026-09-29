import { prefillRunSheetFromCampaign } from './run-sheet-prefill.util';
import type { CampaignHandout, EncounterGroup } from '@core/models/Campaign/campaign';

describe('run-sheet-prefill.util', () => {
  it('fills empty run sheet from adventure and encounters', () => {
    const patch = prefillRunSheetFromCampaign(
      {
        adventure: 'Les héros défendent la Cité Franche.\nSuite…',
        encounters: [{ id: 'e1', name: 'Embuscade', creatures: [] } as EncounterGroup],
        creatures: [{ id: 'c1', name: 'Gobelin' } as never],
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
    expect(patch.prepChecklist).toContain('Publier 1 document');
    expect(patch.prepChecklist).toContain('Donjon A');
  });

  it('keeps existing fields unless overwrite', () => {
    const patch = prefillRunSheetFromCampaign(
      { adventure: 'X', encounters: [], creatures: [], handouts: [], dungeonMaps: [] },
      { title: 'S', objectives: 'Déjà là', scenes: '', prepChecklist: '' },
    );
    expect(patch.objectives).toBeUndefined();
    expect(patch.scenes).toBeTruthy();
  });
});
