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
import { Deity } from '@core/models/Deities/deity';

@Component({
  selector: 'app-deities-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './deities-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DeitiesList {
  private dataService = inject(DataService);

  protected error = signal<string | null>(null);
  readonly search = signal('');
  readonly tonalityFilter = signal<string | null>(null);

  protected deities = toSignal(
    this.dataService.getDeities().pipe(
      catchError(() => {
        this.error.set('Impossible de charger les divinités.');
        return of([] as Deity[]);
      }),
    ),
    { initialValue: null },
  );

  readonly filteredDeities = computed(() => {
    const list = this.deities();
    if (!list) return [];

    const term = this.search().trim().toLowerCase();
    const tonality = this.tonalityFilter();

    return list.filter((d) => {
      if (tonality && d.tonality !== tonality) return false;
      if (!term) return true;
      return (
        d.name.toLowerCase().includes(term) ||
        (d.description ?? '').toLowerCase().includes(term) ||
        d.otherNames.some((n) => n.toLowerCase().includes(term))
      );
    });
  });

  onSearch(value: string): void {
    this.search.set(value);
  }

  tonalityLabel(t: string | null | undefined): string {
    if (t === 'harmonique') return 'Harmonique';
    if (t === 'entropique') return 'Entropique';
    return t ?? '—';
  }

  tonalityIcon(t: string | null | undefined): string {
    if (t === 'harmonique') return 'fluent-emoji:sun';
    if (t === 'entropique') return 'fluent-emoji:new-moon';
    return 'fluent-emoji:star';
  }

  deitySummary(deity: Deity): string {
    const desc = deity.description?.trim();
    if (desc) {
      const short = desc.slice(0, 180);
      return short + (desc.length > 180 ? '…' : '');
    }
    const domains = deity.domains.slice(0, 2).join(', ');
    return `Divinité ${this.tonalityLabel(deity.tonality).toLowerCase()}${domains ? ` — ${domains}` : ''}.`;
  }
}
