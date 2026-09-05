import { Injectable, inject } from '@angular/core';
import { DataService } from '@core/services/data.service';
import { registerGameLabel } from '@core/utils/game-id-labels';
import { normalizeSkillId } from '@core/utils/skill.utils';
import { catchError, forkJoin, of, tap } from 'rxjs';

/**
 * Charge une fois les catalogues API (équipements + compétences)
 * pour enrichir le dictionnaire de libellés à l’exécution.
 */
@Injectable({ providedIn: 'root' })
export class GameLabelCatalogService {
  private readonly data = inject(DataService);
  private loaded = false;

  /** À appeler au démarrage (app / layout) — idempotent. */
  warmUp(): void {
    if (this.loaded) return;
    this.loaded = true;

    forkJoin({
      equipment: this.data.getEquipments().pipe(catchError(() => of([]))),
      skills: this.data.getSkills().pipe(catchError(() => of([]))),
      classes: this.data.getClassesSummary().pipe(catchError(() => of([]))),
    })
      .pipe(
        tap(({ equipment, skills, classes }) => {
          for (const eq of equipment) {
            if (eq?.id && eq?.name) registerGameLabel(eq.id, eq.name);
          }
          for (const sk of skills) {
            if (sk?.id && sk?.name) {
              registerGameLabel(sk.id, sk.name);
              registerGameLabel(normalizeSkillId(sk.id), sk.name);
            }
          }
          for (const cls of classes) {
            if (cls?.id && cls?.name) registerGameLabel(cls.id, cls.name);
          }
        }),
      )
      .subscribe();
  }
}
