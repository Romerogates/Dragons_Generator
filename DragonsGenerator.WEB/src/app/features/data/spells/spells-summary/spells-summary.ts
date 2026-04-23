// features/data/spells/spells-summary/spells-summary.ts
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { SpellSummary } from '@core/models/Spells/spell-summary';

@Component({
  selector: 'app-spells-summary',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './spells-summary.html',
})
export class SpellsSummary {
  private dataService = inject(DataService);

  protected error = signal<string | null>(null);

  protected spells = toSignal(
    this.dataService.getSpellsSummary().pipe(
      catchError(() => {
        this.error.set('Impossible de charger le résumé des sorts.');
        return of([] as SpellSummary[]);
      }),
    ),
    { initialValue: null },
  );
}
