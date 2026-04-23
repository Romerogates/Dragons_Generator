import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { Spell } from '@core/models/Spells/spell';

@Component({
  selector: 'app-spells',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './spells.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spells {
  private dataService = inject(DataService);

  protected error = signal<string | null>(null);

  // Barre de recherche
  readonly search = signal('');

  protected spells = toSignal(
    this.dataService.getSpells().pipe(
      catchError(() => {
        this.error.set('Les pages de ce grimoire sont indéchiffrables (Erreur de chargement).');
        return of([] as Spell[]);
      }),
    ),
    { initialValue: null },
  );

  // Liste filtrée dynamiquement
  readonly filteredSpells = computed(() => {
    const list = this.spells();
    if (!list) return [];

    const term = this.search().trim().toLowerCase();
    if (!term) return list;

    return list.filter(
      (s) => s.name.toLowerCase().includes(term) || s.school.toLowerCase().includes(term),
    );
  });

  onSearch(value: string): void {
    this.search.set(value);
  }

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
