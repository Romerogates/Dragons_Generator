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
import { Feat } from '@core/models/Feats/feat';

const CATEGORY_LABELS: Record<string, string> = {
  survival: 'Survie',
  combat: 'Combat',
  exploration: 'Exploration',
  magic: 'Magie',
};

@Component({
  selector: 'app-feats-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './feats-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FeatsList {
  private dataService = inject(DataService);

  protected error = signal<string | null>(null);
  readonly search = signal('');
  readonly categoryFilter = signal<string | null>(null);
  readonly magicOnly = signal(false);

  protected feats = toSignal(
    this.dataService.getFeats().pipe(
      catchError(() => {
        this.error.set('Impossible de charger les dons.');
        return of([] as Feat[]);
      }),
    ),
    { initialValue: null },
  );

  readonly categories = computed(() => {
    const list = this.feats() ?? [];
    return [...new Set(list.map((f) => f.category).filter(Boolean))].sort() as string[];
  });

  readonly filteredFeats = computed(() => {
    const list = this.feats();
    if (!list) return [];

    const term = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    const magic = this.magicOnly();

    return list.filter((f) => {
      if (cat && f.category !== cat) return false;
      if (magic && !f.requiresMagic) return false;
      if (!term) return true;
      return (
        f.name.toLowerCase().includes(term) ||
        (f.description ?? '').toLowerCase().includes(term) ||
        f.tags.some((t) => t.toLowerCase().includes(term))
      );
    });
  });

  onSearch(value: string): void {
    this.search.set(value);
  }

  categoryLabel(cat: string | null | undefined): string {
    if (!cat) return '—';
    return CATEGORY_LABELS[cat] ?? cat;
  }

  featIcon(category: string | null | undefined): string {
    switch (category) {
      case 'combat':
        return 'fluent-emoji:crossed-swords';
      case 'survival':
        return 'fluent-emoji:camping';
      case 'exploration':
        return 'fluent-emoji:compass';
      case 'magic':
        return 'fluent-emoji:sparkles';
      default:
        return 'fluent-emoji:trophy';
    }
  }

  featSummary(feat: Feat): string {
    const desc = feat.description?.trim();
    if (desc) {
      const short = desc.slice(0, 180);
      return short + (desc.length > 180 ? '…' : '');
    }
    return `Don ${this.categoryLabel(feat.category).toLowerCase()}${feat.requiresMagic ? ' nécessitant la magie' : ''}.`;
  }
}
