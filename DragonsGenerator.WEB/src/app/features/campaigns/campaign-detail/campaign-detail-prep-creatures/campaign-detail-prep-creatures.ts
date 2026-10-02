import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CREATURE_ROLE_LABELS, type CreatureRole, type StoryCreatureSelection } from '@core/models/Story/story';
import { formatChallengeRating, getCreatureCategoryLabel } from '@core/utils/creature-display.util';

export type CreatureCardField = 'voice' | 'desire' | 'fear' | 'secret' | 'noteStats';

export interface CreatureRoleChangeEvent {
  creature: StoryCreatureSelection;
  role: CreatureRole;
}

export interface CreatureCardFieldEvent {
  creature: StoryCreatureSelection;
  field: CreatureCardField;
  value: string;
}

@Component({
  selector: 'app-campaign-detail-prep-creatures',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './campaign-detail-prep-creatures.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDetailPrepCreatures {
  readonly isOwner = input.required<boolean>();
  readonly creatures = input<StoryCreatureSelection[]>([]);

  readonly addCreatures = output<void>();
  readonly openBestiary = output<void>();
  readonly openCreatureInBook = output<StoryCreatureSelection>();
  readonly roleChange = output<CreatureRoleChangeEvent>();
  readonly cardFieldChange = output<CreatureCardFieldEvent>();
  readonly bulkClassify = output<'ally' | 'antagonist'>();

  readonly allyCreatures = computed(() =>
    this.creatures().filter((cr) => cr.role === 'ally'),
  );

  readonly adversaryCreatures = computed(() =>
    this.creatures().filter((cr) => cr.role === 'antagonist'),
  );

  readonly otherCreatures = computed(() =>
    this.creatures().filter((cr) => cr.role !== 'ally' && cr.role !== 'antagonist'),
  );

  readonly creatureGroups = computed(() => {
    const groups: { id: string; label: string; items: StoryCreatureSelection[] }[] = [
      { id: 'ally', label: 'Alliés', items: this.allyCreatures() },
      { id: 'adversary', label: 'Adversaires', items: this.adversaryCreatures() },
      { id: 'other', label: 'Autres (à classer)', items: this.otherCreatures() },
    ];
    return groups.filter((g) => g.items.length > 0);
  });

  readonly creatureRoleOptions = Object.entries(CREATURE_ROLE_LABELS) as [CreatureRole, string][];
  readonly formatCr = formatChallengeRating;
  readonly categoryLabel = getCreatureCategoryLabel;

  creatureTrackKey(cr: StoryCreatureSelection): string {
    return `${cr.creatureId}::${cr.customName || cr.creatureName}`;
  }
}
