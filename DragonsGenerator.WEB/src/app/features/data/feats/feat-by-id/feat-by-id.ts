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

const CATEGORY_LABELS: Record<string, string> = {
  survival: 'Survie',
  combat: 'Combat',
  exploration: 'Exploration',
  magic: 'Magie',
};

@Component({
  selector: 'app-feat-by-id',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './feat-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FeatById {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  protected error = signal<string | null>(null);
  protected notFound = signal(false);

  protected feat = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id') ?? '';
        this.error.set(null);
        this.notFound.set(false);
        return this.dataService.getFeatById(id).pipe(
          catchError((err) => {
            if (err?.status === 404) this.notFound.set(true);
            else this.error.set('Impossible de charger ce don.');
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  categoryLabel(cat: string | null | undefined): string {
    if (!cat) return '—';
    return CATEGORY_LABELS[cat] ?? cat;
  }
}
