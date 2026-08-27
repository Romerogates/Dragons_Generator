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
import { Creature } from '@core/models/Creatures/creature';
import {
  ABILITY_LABELS,
  formatChallengeRating,
  getCreatureCategoryLabel,
} from '@core/utils/creature-display.util';

@Component({
  selector: 'app-creature-by-id',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './creature-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CreatureById {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  protected error = signal<string | null>(null);
  protected notFound = signal(false);

  protected creature = toSignal(
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

  protected abilityLabels = ABILITY_LABELS;
  protected categoryLabel = getCreatureCategoryLabel;
  protected formatCr = formatChallengeRating;

  protected abilityKeys(creature: Creature): string[] {
    return ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter((k) => creature.abilities[k]);
  }
}
