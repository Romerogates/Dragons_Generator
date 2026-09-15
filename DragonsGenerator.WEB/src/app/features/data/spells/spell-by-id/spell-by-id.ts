import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { BookReaderShell } from '@shared/components/book-reader-shell/book-reader-shell';
import { SpellBookPage } from '@shared/components/spell-book-page/spell-book-page';

@Component({
  selector: 'app-spell-by-id',
  standalone: true,
  imports: [RouterLink, BookReaderShell, SpellBookPage],
  templateUrl: './spell-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SpellById {
  private readonly dataService = inject(DataService);
  private readonly route = inject(ActivatedRoute);

  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);

  protected readonly spell = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id') ?? '';
        this.error.set(null);
        this.notFound.set(false);
        return this.dataService.getSpellById(id).pipe(
          catchError((err) => {
            if (err?.status === 404) {
              this.notFound.set(true);
            } else {
              this.error.set('Les flux magiques sont perturbés. Impossible de lire ce sort.');
            }
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );
}
