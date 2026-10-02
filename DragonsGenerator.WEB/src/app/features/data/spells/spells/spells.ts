import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { OfflineCodexService } from '@core/services/offline-codex.service';
import { Spell } from '@core/models/Spells/spell';
import { spellSchoolLabel } from '@core/utils/spell-display.util';
import { CodexEmptyState } from '@shared/components/codex-empty-state/codex-empty-state';
import { labelForGameId } from '@core/utils/game-id-labels';

@Component({
  selector: 'app-spells',
  standalone: true,
  imports: [CommonModule, RouterLink, CodexEmptyState],
  templateUrl: './spells.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Spells {
  private dataService = inject(DataService);
  private offlineCodex = inject(OfflineCodexService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected error = signal<string | null>(null);
  protected offlineBanner = signal(false);
  protected readonly schoolLabel = spellSchoolLabel;

  readonly search = signal('');
  readonly classFilter = signal('');

  protected spells = toSignal(
    this.dataService.getSpells().pipe(
      catchError(() => {
        const cached = this.offlineCodex.getSnapshot<Spell[]>('spells');
        if (cached?.length) {
          this.offlineBanner.set(true);
          this.error.set(null);
          return of(cached);
        }
        this.error.set('Les pages de ce grimoire sont indéchiffrables (Erreur de chargement).');
        return of([] as Spell[]);
      }),
    ),
    { initialValue: null },
  );

  protected readonly classOptions = toSignal(
    this.dataService.getClassesSummary().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  readonly castingClasses = computed(() =>
    this.classOptions()
      .filter((c) => c.hasSpellcasting)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  );

  readonly filteredSpells = computed(() => {
    const list = this.spells();
    if (!list) return [];

    const term = this.search().trim().toLowerCase();
    const classId = this.classFilter().trim();

    return list.filter((s) => {
      if (classId && !(s.classes ?? []).includes(classId)) return false;
      if (!term) return true;
      const schoolFr = spellSchoolLabel(s.school).toLowerCase();
      return (
        s.name.toLowerCase().includes(term) ||
        s.school.toLowerCase().includes(term) ||
        schoolFr.includes(term)
      );
    });
  });

  constructor() {
    const fromQuery = this.route.snapshot.queryParamMap.get('class') ?? '';
    if (fromQuery) this.classFilter.set(fromQuery);
  }

  protected spellSummary(spell: Spell): string {
    const desc = spell.description?.trim();
    if (desc) {
      const short = desc.slice(0, 180);
      return short + (desc.length > 180 ? '…' : '');
    }
    return `${spell.level === 0 ? 'Tour de magie' : 'Sort de niveau ' + spell.level} — ${spellSchoolLabel(spell.school)}.`;
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  onClassFilter(value: string): void {
    this.classFilter.set(value);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: value ? { class: value } : { class: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  clearFilters(): void {
    this.search.set('');
    this.onClassFilter('');
  }

  classLabel(id: string): string {
    const found = this.classOptions().find((c) => c.id === id);
    return found?.name ?? labelForGameId(id);
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
