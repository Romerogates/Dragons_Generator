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
import { CombatAction } from '@core/models/CombatActions/combat-action';

const CATEGORY_LABELS: Record<string, string> = {
  standard: 'Standard',
  special_attack: 'Attaque spéciale',
  reaction: 'Réaction',
  bonus: 'Bonus',
};

const COST_LABELS: Record<string, string> = {
  action: 'Action',
  bonus_action: 'Action bonus',
  reaction: 'Réaction',
};

const COST_ICONS: Record<string, string> = {
  action: 'fluent-emoji:crossed-swords',
  bonus_action: 'fluent-emoji:high-voltage',
  reaction: 'fluent-emoji:counterclockwise-arrows-button',
};

@Component({
  selector: 'app-combat-actions-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './combat-actions-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CombatActionsList {
  private dataService = inject(DataService);

  protected error = signal<string | null>(null);
  readonly search = signal('');
  readonly categoryFilter = signal<string | null>(null);
  readonly costFilter = signal<string | null>(null);

  protected actions = toSignal(
    this.dataService.getCombatActions().pipe(
      catchError(() => {
        this.error.set('Impossible de charger les actions de combat.');
        return of([] as CombatAction[]);
      }),
    ),
    { initialValue: null },
  );

  readonly categories = computed(() => {
    const list = this.actions() ?? [];
    return [...new Set(list.map((a) => a.category).filter(Boolean))].sort() as string[];
  });

  readonly costs = computed(() => {
    const list = this.actions() ?? [];
    return [...new Set(list.map((a) => a.actionCost).filter(Boolean))].sort() as string[];
  });

  readonly filteredActions = computed(() => {
    const list = this.actions();
    if (!list) return [];

    const term = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    const cost = this.costFilter();

    return list
      .filter((a) => {
        if (cat && a.category !== cat) return false;
        if (cost && a.actionCost !== cost) return false;
        if (!term) return true;
        return (
          a.name.toLowerCase().includes(term) ||
          (a.description ?? '').toLowerCase().includes(term) ||
          this.categoryLabel(a.category).toLowerCase().includes(term) ||
          this.costLabel(a.actionCost).toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });

  onSearch(value: string): void {
    this.search.set(value);
  }

  categoryLabel(cat: string | null | undefined): string {
    if (!cat) return '—';
    return CATEGORY_LABELS[cat] ?? cat;
  }

  costLabel(cost: string | null | undefined): string {
    if (!cost) return '—';
    return COST_LABELS[cost] ?? cost;
  }

  costIcon(cost: string | null | undefined): string {
    if (!cost) return 'fluent-emoji:crossed-swords';
    return COST_ICONS[cost] ?? 'fluent-emoji:crossed-swords';
  }
}
