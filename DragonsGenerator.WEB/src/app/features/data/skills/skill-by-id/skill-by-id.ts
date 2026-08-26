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
import { buildSkillMap, normalizeSkillId } from '@core/utils/skill.utils';

const ABILITY_LABELS: Record<string, string> = {
  FOR: 'Force',
  DEX: 'Dextérité',
  CON: 'Constitution',
  INT: 'Intelligence',
  SAG: 'Sagesse',
  CHA: 'Charisme',
};

@Component({
  selector: 'app-skill-by-id',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './skill-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SkillById {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  protected error = signal<string | null>(null);
  protected notFound = signal(false);

  protected skill = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id') ?? '';
        this.error.set(null);
        this.notFound.set(false);
        return this.dataService.getSkillById(id).pipe(
          catchError((err) => {
            if (err?.status === 404) this.notFound.set(true);
            else this.error.set('Impossible de charger cette compétence.');
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  abilityLabel(code: string): string {
    return ABILITY_LABELS[code] ?? code;
  }

  skillIcon(id: string): string {
    const skill = this.skill();
    if (!skill) return 'fluent-emoji:bookmark-tabs';
    return buildSkillMap([skill])[normalizeSkillId(id)]?.icon ?? 'fluent-emoji:bookmark-tabs';
  }
}
