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
import { CreatureBookPage } from '@shared/components/creature-book-page/creature-book-page';

@Component({
  selector: 'app-creature-by-id',
  standalone: true,
  imports: [RouterLink, BookReaderShell, CreatureBookPage],
  templateUrl: './creature-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CreatureById {
  private readonly dataService = inject(DataService);
  private readonly route = inject(ActivatedRoute);

  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);

  protected readonly creature = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id') ?? '';
        this.error.set(null);
        this.notFound.set(false);
        return this.dataService.getCreatureById(id).pipe(
          catchError((err) => {
            if (err?.status === 404) {
              this.notFound.set(true);
            } else {
              this.error.set('Impossible de consulter cette fiche de créature.');
            }
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );
}
