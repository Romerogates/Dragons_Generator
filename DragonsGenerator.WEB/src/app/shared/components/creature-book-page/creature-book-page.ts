import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Creature } from '@core/models/Creatures/creature';
import {
  ABILITY_LABELS,
  formatChallengeRating,
  getCreatureCategoryLabel,
} from '@core/utils/creature-display.util';

@Component({
  selector: 'app-creature-book-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './creature-book-page.html',
  styleUrl: './creature-book-page.scss',
})
export class CreatureBookPage {
  readonly creature = input.required<Creature>();
  /** Alias campagne (customName) affiché au-dessus du nom Codex. */
  readonly campaignAlias = input<string | null>(null);
  readonly campaignBackstory = input<string | null>(null);
  readonly campaignRoleLabel = input<string | null>(null);

  protected readonly abilityOrder = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
  protected readonly abilityLabels = ABILITY_LABELS;
  protected readonly categoryLabel = getCreatureCategoryLabel;
  protected readonly formatCr = formatChallengeRating;

  protected abilityKeys(creature: Creature): string[] {
    return this.abilityOrder.filter((k) => creature.abilities[k]);
  }
}
