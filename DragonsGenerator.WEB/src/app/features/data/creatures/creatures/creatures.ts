import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { CreatureSummary } from '@core/models/Creatures/creature-summary';
import {
  CR_TIER_LABELS,
  CrTier,
  formatChallengeRating,
  getCategoryIcon,
  getCreatureCategoryLabel,
  getCrTier,
  parseChallengeRating,
} from '@core/utils/creature-display.util';

type SortKey = 'name' | 'cr-asc' | 'cr-desc' | 'xp-desc';

@Component({
  selector: 'app-creatures',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './creatures.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Creatures {
  private dataService = inject(DataService);

  protected error = signal<string | null>(null);
  readonly search = signal('');
  readonly categoryFilter = signal<string | null>(null);
  readonly crTierFilter = signal<CrTier | null>(null);
  readonly sortKey = signal<SortKey>('name');

  protected creatures = toSignal(
    this.dataService.getCreaturesSummary().pipe(
      catchError(() => {
        this.error.set('Impossible de charger le bestiaire.');
        return of([] as CreatureSummary[]);
      }),
    ),
    { initialValue: null },
  );

  readonly categories = computed(() => {
    const list = this.creatures() ?? [];
    return [...new Set(list.map((c) => c.category).filter(Boolean))].sort((a, b) =>
      getCreatureCategoryLabel(a).localeCompare(getCreatureCategoryLabel(b), 'fr'),
    );
  });

  readonly filteredCreatures = computed(() => {
    const list = this.creatures();
    if (!list) return [];

    const term = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    const tier = this.crTierFilter();
    const sort = this.sortKey();

    const filtered = list.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (tier && getCrTier(c.challengeRating) !== tier) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        getCreatureCategoryLabel(c.category).toLowerCase().includes(term) ||
        formatChallengeRating(c.challengeRating).toLowerCase().includes(term)
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'cr-asc':
          return parseChallengeRating(a.challengeRating) - parseChallengeRating(b.challengeRating);
        case 'cr-desc':
          return parseChallengeRating(b.challengeRating) - parseChallengeRating(a.challengeRating);
        case 'xp-desc':
          return b.xp - a.xp;
        default:
          return a.name.localeCompare(b.name, 'fr');
      }
    });
  });

  readonly hasActiveFilters = computed(
    () => !!this.search().trim() || !!this.categoryFilter() || !!this.crTierFilter(),
  );

  onSearch(value: string): void {
    this.search.set(value);
  }

  setCategoryFilter(category: string | null): void {
    this.categoryFilter.set(category);
  }

  setCrTierFilter(tier: CrTier | null): void {
    this.crTierFilter.set(tier);
  }

  clearFilters(): void {
    this.search.set('');
    this.categoryFilter.set(null);
    this.crTierFilter.set(null);
    this.sortKey.set('name');
  }

  protected categoryLabel = getCreatureCategoryLabel;
  protected formatCr = formatChallengeRating;
  protected categoryIcon = getCategoryIcon;
  protected crTierLabels = CR_TIER_LABELS;
  protected crTiers: CrTier[] = ['low', 'mid', 'high', 'legendary'];
}
