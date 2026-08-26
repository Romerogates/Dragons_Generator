import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { DataService } from '@core/services/data.service';

@Component({
  selector: 'app-deity-by-id',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './deity-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DeityById {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  protected error = signal<string | null>(null);
  protected notFound = signal(false);

  protected deity = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id') ?? '';
        this.error.set(null);
        this.notFound.set(false);
        return this.dataService.getDeityById(id).pipe(
          catchError((err) => {
            if (err?.status === 404) this.notFound.set(true);
            else this.error.set('Impossible de charger cette divinité.');
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  tonalityLabel(t: string | null | undefined): string {
    if (t === 'harmonique') return 'Harmonique';
    if (t === 'entropique') return 'Entropique';
    return t ?? '—';
  }
}
