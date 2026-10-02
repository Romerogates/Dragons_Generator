import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  encounterPendingXp,
  encounterTotalXp,
  type EncounterGroup,
} from '@core/models/Campaign/campaign';
import { ENCOUNTER_PACK_PRESETS } from '@core/utils/campaign-content-presets.util';

export interface EncounterPatchEvent {
  encounterId: string;
  patch: Partial<EncounterGroup>;
}

export interface EncounterCreatureIndexEvent {
  encounterId: string;
  creatureIndex: number;
}

@Component({
  selector: 'app-campaign-detail-prep-encounters',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './campaign-detail-prep-encounters.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDetailPrepEncounters {
  readonly isOwner = input.required<boolean>();
  readonly encounters = input<EncounterGroup[]>([]);
  readonly creaturesCount = input(0);
  readonly dungeonMaps = input<{ id: string; name: string }[]>([]);
  readonly awardingXpId = input<string | null>(null);

  readonly insertEncounterPack = output<string>();
  readonly generateEncounters = output<void>();
  readonly goCreatures = output<void>();
  readonly encounterPatch = output<EncounterPatchEvent>();
  readonly openDungeon = output<EncounterGroup>();
  readonly markDefeated = output<EncounterCreatureIndexEvent>();
  readonly undoDefeated = output<EncounterCreatureIndexEvent>();
  readonly distributeXp = output<EncounterGroup>();

  readonly encounterPacks = ENCOUNTER_PACK_PRESETS;
  readonly encounterTotalXp = encounterTotalXp;
  readonly encounterPendingXp = encounterPendingXp;
}
