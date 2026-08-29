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
import { catchError, map, of, switchMap } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { normalizeBackground } from '@core/utils/background-data.adapter';
import { GameIdLabelPipe, GameIdLabelsPipe } from '@shared/pipes/game-id-label.pipe';
import type { BackgroundToolRef } from '@core/models/Backgrounds/background';

@Component({
  selector: 'app-background-by-id',
  standalone: true,
  imports: [RouterLink, GameIdLabelPipe, GameIdLabelsPipe],
  templateUrl: './background-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BackgroundById {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  protected error = signal<string | null>(null);
  protected notFound = signal(false);

  protected background = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id') ?? '';
        this.error.set(null);
        this.notFound.set(false);
        return this.dataService.getBackgroundById(id).pipe(
          map((bg) => (bg ? normalizeBackground(bg) : null)),
          catchError((err) => {
            if (err?.status === 404) this.notFound.set(true);
            else this.error.set('Impossible de charger cet historique.');
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  protected readonly skillLabels = computed(() => {
    const bg = this.background();
    if (!bg) return [] as string[];
    const skills = bg.data.proficiencies.skills;
    return [...(skills.fixed ?? []), ...(Array.isArray(skills.options) ? skills.options : [])];
  });

  toolLabel(ref: BackgroundToolRef): string {
    if (ref.any) {
      switch (ref.type) {
        case 'instrument':
          return 'Instrument de musique (au choix)';
        case 'gameSet':
          return 'Matériel de jeu (au choix)';
        case 'vehicle':
          return 'Véhicule (au choix)';
        default:
          return 'Outil d’artisan (au choix)';
      }
    }
    return ref.id ?? 'Outil';
  }
}
