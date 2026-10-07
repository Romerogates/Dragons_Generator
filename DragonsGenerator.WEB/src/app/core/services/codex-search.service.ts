import { Injectable, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { DataService } from './data.service';
import { filterCodexNavLinks, type CodexNavLink } from '@core/config/codex-nav';

export interface CodexSearchHit {
  kind: 'section' | 'entry';
  label: string;
  path: string;
  icon: string;
  category?: string;
}

const MAX_ENTRY_HITS = 20;

@Injectable({ providedIn: 'root' })
export class CodexSearchService {
  private readonly data = inject(DataService);
  private readonly index = signal<CodexSearchHit[] | null>(null);
  readonly loading = signal(false);

  ensureIndex(): void {
    if (this.index() || this.loading()) return;
    this.loading.set(true);

    const fallback = catchError(() => of<{ id: string; name: string }[]>([]));

    forkJoin({
      species: this.data.getSpeciesSummary().pipe(fallback),
      classes: this.data.getClassesSummary().pipe(fallback),
      civilisations: this.data.getCivilisationsSummary().pipe(fallback),
      equipments: this.data.getEquipmentsSummary().pipe(fallback),
      spells: this.data.getSpellsSummary().pipe(fallback),
      creatures: this.data.getCreaturesSummary().pipe(fallback),
      skills: this.data.getSkillsSummary().pipe(fallback),
      feats: this.data.getFeatsSummary().pipe(fallback),
      backgrounds: this.data.getBackgroundsSummary().pipe(fallback),
      combat: this.data.getCombatActionsSummary().pipe(fallback),
      deities: this.data.getDeitiesSummary().pipe(fallback),
    }).subscribe({
      next: (bundle) => {
        const hits: CodexSearchHit[] = [
          ...mapEntries(asNamed(bundle.species), '/species', 'fluent-emoji:dna', 'Espèces'),
          ...mapEntries(asNamed(bundle.classes), '/classes', 'fluent-emoji:crossed-swords', 'Classes'),
          ...mapEntries(asNamed(bundle.civilisations), '/civilisations', 'fluent-emoji:classical-building', 'Civilisations'),
          ...mapEntries(asNamed(bundle.equipments), '/equipments', 'fluent-emoji:shield', 'Équipements'),
          ...mapEntries(asNamed(bundle.spells), '/spells', 'fluent-emoji:sparkles', 'Sortilèges'),
          ...mapEntries(asNamed(bundle.creatures), '/creatures', 'fluent-emoji:dragon', 'Bestiaire'),
          ...mapEntries(asNamed(bundle.skills), '/skills', 'fluent-emoji:bookmark-tabs', 'Compétences'),
          ...mapEntries(asNamed(bundle.feats), '/feats', 'fluent-emoji:trophy', 'Dons'),
          ...mapEntries(asNamed(bundle.backgrounds), '/backgrounds', 'fluent-emoji:scroll', 'Historiques'),
          ...mapEntries(asNamed(bundle.combat), '/combat-actions', 'fluent-emoji:collision', 'Actions de combat'),
          ...mapEntries(asNamed(bundle.deities), '/deities', 'fluent-emoji:glowing-star', 'Divinités'),
        ];
        this.index.set(hits);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  sections(query: string): CodexNavLink[] {
    return filterCodexNavLinks(query);
  }

  entries(query: string): CodexSearchHit[] {
    const q = fold(query);
    if (!q) return [];
    const idx = this.index() ?? [];
    const hits: CodexSearchHit[] = [];
    for (const item of idx) {
      if (fold(item.label).includes(q) || fold(item.category ?? '').includes(q)) {
        hits.push(item);
        if (hits.length >= MAX_ENTRY_HITS) break;
      }
    }
    return hits;
  }
}

function asNamed(value: unknown): { id: string; name: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is { id: string; name: string } =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { name?: unknown }).name === 'string',
  );
}

function mapEntries(
  items: { id: string; name: string }[],
  basePath: string,
  icon: string,
  category: string,
): CodexSearchHit[] {
  return items
    .filter((item) => item?.id && item?.name)
    .map((item) => ({
      kind: 'entry' as const,
      label: item.name,
      path: `${basePath}/${item.id}`,
      icon,
      category,
    }));
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}
