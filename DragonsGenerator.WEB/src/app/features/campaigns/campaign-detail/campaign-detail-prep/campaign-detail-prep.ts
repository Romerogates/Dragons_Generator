import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  input,
  output,
} from '@angular/core';
import type { CampaignPrepSub, CampaignPrepSubTab } from '@core/utils/campaign-detail-tabs.util';
import type { CampaignSetupAction, CampaignSetupGuideInput } from '../campaign-setup-guide/campaign-setup-guide.util';
import { CampaignSetupGuide } from '../campaign-setup-guide/campaign-setup-guide';
import { PlayDockTile, type PlayDockTone } from '../../campaign-play-panel/play-dock-tile';

export interface PrepDossierCounts {
  hasAdventure: boolean;
  creatureCount: number;
  mapCount: number;
  encounterCount: number;
  pregenCount: number;
  notebookPageCount: number;
}

type PrepTile = {
  id: CampaignPrepSub;
  title: string;
  detail: string;
  tone: PlayDockTone;
};

/** Coquille onglet Préparation : dossier tuiles + nav + guide MJ. */
@Component({
  selector: 'app-campaign-detail-prep',
  standalone: true,
  imports: [CampaignSetupGuide, PlayDockTile],
  templateUrl: './campaign-detail-prep.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailPrep {
  readonly isMj = input.required<boolean>();
  readonly prepSub = input.required<CampaignPrepSub>();
  readonly tabs = input.required<CampaignPrepSubTab[]>();
  readonly guideState = input.required<CampaignSetupGuideInput>();
  readonly dossier = input<PrepDossierCounts>({
    hasAdventure: false,
    creatureCount: 0,
    mapCount: 0,
    encounterCount: 0,
    pregenCount: 0,
    notebookPageCount: 0,
  });

  readonly prepSubChange = output<CampaignPrepSub>();
  readonly guideAction = output<CampaignSetupAction>();

  readonly dossierTiles = computed((): PrepTile[] => {
    if (!this.isMj()) return [];
    const d = this.dossier();
    const allowed = new Set(this.tabs().map((t) => t.id));
    const all: PrepTile[] = [
      {
        id: 'scenario',
        title: 'Scénario',
        detail: d.hasAdventure ? 'Synopsis prêt' : 'À rédiger',
        tone: d.hasAdventure ? 'violet' : 'slate',
      },
      {
        id: 'creatures',
        title: 'Créatures',
        detail: d.creatureCount === 0 ? 'Aucune' : `${d.creatureCount} fiche${d.creatureCount > 1 ? 's' : ''}`,
        tone: d.creatureCount > 0 ? 'rose' : 'slate',
      },
      {
        id: 'maps',
        title: 'Donjons',
        detail: d.mapCount === 0 ? 'Aucune carte' : `${d.mapCount} carte${d.mapCount > 1 ? 's' : ''}`,
        tone: d.mapCount > 0 ? 'sky' : 'slate',
      },
      {
        id: 'encounters',
        title: 'Rencontres',
        detail:
          d.encounterCount === 0
            ? 'Aucune'
            : `${d.encounterCount} rencontre${d.encounterCount > 1 ? 's' : ''}`,
        tone: d.encounterCount > 0 ? 'amber' : 'slate',
      },
      {
        id: 'pregens',
        title: 'Pré-tirés',
        detail: d.pregenCount === 0 ? 'Aucun' : `${d.pregenCount} héros`,
        tone: d.pregenCount > 0 ? 'violet' : 'slate',
      },
      {
        id: 'notebook',
        title: 'Carnet',
        detail:
          d.notebookPageCount === 0
            ? 'Vide'
            : `${d.notebookPageCount} page${d.notebookPageCount > 1 ? 's' : ''}`,
        tone: d.notebookPageCount > 0 ? 'slate' : 'slate',
      },
    ];
    return all.filter((t) => allowed.has(t.id));
  });
}
