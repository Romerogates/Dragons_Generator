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
import { catchError, of, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataService } from '@core/services/data.service';
import { Spell } from '@core/models/Spells/spell';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-spells-by-level',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './spells-by-level.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class SpellsByLevel {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  protected readonly levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  protected error = signal<string | null>(null);

  protected level = toSignal(
    this.route.paramMap.pipe(map((params) => Number(params.get('level')))),
    { initialValue: 0 },
  );

  protected spells = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const level = Number(params.get('level'));
        this.error.set(null);
        return this.dataService.getSpellsByLevel(level).pipe(
          catchError(() => {
            this.error.set(`Impossible de charger les sorts de niveau ${level}.`);
            return of([] as Spell[]);
          }),
        );
      }),
    ),
    { initialValue: null },
  );

  protected levelLabel = computed(() => {
    const lvl = this.level();
    return lvl === 0 ? 'Tour de magie' : `Niveau ${lvl}`;
  });

  protected formatMeta(meta: { amount: number | string | null; unit: string | null }): string {
    if (meta.amount === null && meta.unit === null) return '—';
    if (meta.amount === null) return meta.unit ?? '—';
    if (meta.unit === null) return String(meta.amount);
    return `${meta.amount} ${meta.unit}`;
  }

  protected formatComponents(c: { v: boolean; s: boolean; m: string | null }): string {
    const parts: string[] = [];
    if (c.v) parts.push('V');
    if (c.s) parts.push('S');
    if (c.m) parts.push('M');
    return parts.length ? parts.join(' · ') : '—';
  }

  /** Associe une icône Iconify selon l'école de magie pour styliser les cartes */
  getSchoolIcon(school: string): string {
    const s = school.toLowerCase();
    if (s.includes('abjuration')) return 'fluent-emoji:shield';
    if (s.includes('évocation') || s.includes('evocation')) return 'fluent-emoji:collision';
    if (s.includes('nécromancie') || s.includes('necromancie')) return 'fluent-emoji:skull';
    if (s.includes('illusion')) return 'fluent-emoji:eye';
    if (s.includes('transmutation')) return 'fluent-emoji:butterfly';
    if (s.includes('divination')) return 'fluent-emoji:crystal-ball';
    if (s.includes('enchantement')) return 'fluent-emoji:sparkles';
    if (s.includes('invocation') || s.includes('conjuration')) return 'fluent-emoji:cyclone';
    return 'fluent-emoji:magic-wand';
  }
}
