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
import { catchError, map, of } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { Background } from '@core/models/Backgrounds/background';
import { normalizeBackgrounds } from '@core/utils/background-data.adapter';

@Component({
  selector: 'app-backgrounds-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './backgrounds-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BackgroundsList {
  private dataService = inject(DataService);

  protected error = signal<string | null>(null);
  readonly search = signal('');
  readonly presetOnly = signal(false);

  protected backgrounds = toSignal(
    this.dataService.getBackgrounds().pipe(
      map((list) => normalizeBackgrounds(list)),
      catchError(() => {
        this.error.set('Impossible de charger les historiques.');
        return of([] as Background[]);
      }),
    ),
    { initialValue: null },
  );

  readonly filtered = computed(() => {
    const list = this.backgrounds();
    if (!list) return [];
    const term = this.search().trim().toLowerCase();
    const preset = this.presetOnly();
    return list.filter((bg) => {
      if (preset && !bg.data.preset) return false;
      if (!term) return true;
      return (
        bg.name.toLowerCase().includes(term) ||
        (bg.data.flavor.summary ?? '').toLowerCase().includes(term) ||
        (bg.data.privilege.name ?? '').toLowerCase().includes(term)
      );
    });
  });

  onSearch(value: string): void {
    this.search.set(value);
  }
}
