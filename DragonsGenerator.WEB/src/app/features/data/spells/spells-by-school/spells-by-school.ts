import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataService } from '@core/services/data.service';
import { Spell } from '@core/models/Spells/spell';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-spells-by-school',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './spells-by-school.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpellsBySchool {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  protected error = signal<string | null>(null);

  protected school = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('school') ?? '')),
    { initialValue: '' },
  );

  protected schools = toSignal(
    this.dataService.getSpellSchools().pipe(catchError(() => of([] as string[]))),
    { initialValue: [] as string[] },
  );

  protected spells = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const school = params.get('school') ?? '';
        this.error.set(null);
        return this.dataService.getSpellsBySchool(school).pipe(
          catchError(() => {
            this.error.set(`Impossible de charger les sorts de l'école « ${school} ».`);
            return of([] as Spell[]);
          }),
        );
      }),
    ),
    { initialValue: null },
  );

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
