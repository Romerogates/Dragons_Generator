// features/data/spells/spell-schools/spell-schools.ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { DataService } from '@core/services/data.service';

@Component({
  selector: 'app-spell-schools',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './spells-schools.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpellSchools {
  private dataService = inject(DataService);

  protected error = signal<string | null>(null);

  protected schools = toSignal(
    this.dataService.getSpellSchools().pipe(
      catchError(() => {
        this.error.set('Impossible de charger les écoles de magie.');
        return of([] as string[]);
      }),
    ),
    { initialValue: null },
  );

  /** Associe un émoji selon l'école de magie pour styliser les cartes */
  getSchoolIcon(school: string): string {
    const s = school.toLowerCase();
    if (s.includes('abjuration')) return '🛡️';
    if (s.includes('évocation') || s.includes('evocation')) return '💥';
    if (s.includes('nécromancie') || s.includes('necromancie')) return '💀';
    if (s.includes('illusion')) return '👁️';
    if (s.includes('transmutation')) return '🦋';
    if (s.includes('divination')) return '🔮';
    if (s.includes('enchantement')) return '✨';
    if (s.includes('invocation') || s.includes('conjuration')) return '🌀';
    return '🪄';
  }
}
