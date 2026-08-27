import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { Creature } from '@core/models/Creatures/creature';
import {
  formatChallengeRating,
  getCategoryIcon,
  getCreatureCategoryLabel,
  parseChallengeRating,
} from '@core/utils/creature-display.util';

type SortKey = 'name' | 'cr-asc' | 'cr-desc';

@Component({
  selector: 'app-creatures-by-category',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './creatures-by-category.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CreaturesByCategory {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  protected error = signal<string | null>(null);
  readonly search = signal('');
  readonly sortKey = signal<SortKey>('name');

  protected category = toSignal(this.route.paramMap.pipe(switchMap((p) => of(p.get('category') ?? ''))), {
    initialValue: '',
  });

  protected creatures = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const category = params.get('category') ?? '';
        this.error.set(null);
        return this.dataService.getCreaturesByCategory(category).pipe(
          catchError(() => {
            this.error.set('Impossible de charger les créatures de cette catégorie.');
            return of([] as Creature[]);
          }),
        );
      }),
    ),
    { initialValue: null },
  );

  readonly filteredCreatures = computed(() => {
    const list = this.creatures();
    if (!list) return [];
    const term = this.search().trim().toLowerCase();
    const sort = this.sortKey();

    const filtered = term
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            formatChallengeRating(c.challengeRating).toLowerCase().includes(term),
        )
      : list;

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'cr-asc':
          return parseChallengeRating(a.challengeRating) - parseChallengeRating(b.challengeRating);
        case 'cr-desc':
          return parseChallengeRating(b.challengeRating) - parseChallengeRating(a.challengeRating);
        default:
          return a.name.localeCompare(b.name, 'fr');
      }
    });
  });

  onSearch(value: string): void {
    this.search.set(value);
  }

  protected categoryLabel = getCreatureCategoryLabel;
  protected formatCr = formatChallengeRating;
  protected categoryIcon = getCategoryIcon;
}
