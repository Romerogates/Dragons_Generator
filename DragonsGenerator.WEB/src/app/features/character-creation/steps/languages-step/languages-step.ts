// features/character-creation/steps/languages-step/languages-step.ts

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import type { Language } from '@core/models/Languages/language';

const CLASS_GRANTED_LANGUAGES: Record<string, string> = {
  'cls-druide': 'Langue des druides',
  'cls-roublard': 'Argot des voleurs',
};

@Component({
  selector: 'app-languages-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './languages-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LanguagesStep implements OnInit {
  private dataService = inject(DataService);
  readonly builder = inject(CharacterBuilderService);

  readonly allLanguages = signal<Language[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly expandedId = signal<string | null>(null);

  readonly lockedLanguages = computed<string[]>(() => {
    const c = this.builder.creation();
    const set = new Set([...c.speciesLanguages, ...c.civilizationLanguages]);
    const classLang = CLASS_GRANTED_LANGUAGES[c.classId ?? ''];
    if (classLang) set.add(classLang);
    return [...set];
  });

  readonly bonusCount = computed<number>(() => this.builder.creation().bonusLanguageCount);

  readonly chosenBonusLanguages = computed<string[]>(() => {
    const locked = new Set(this.lockedLanguages());
    return this.builder.creation().languages.filter((l) => !locked.has(l));
  });

  readonly remainingPicks = computed(() =>
    Math.max(0, this.bonusCount() - this.chosenBonusLanguages().length),
  );

  readonly availableBaseLanguages = computed<Language[]>(() => {
    const taken = new Set(this.builder.creation().languages);
    return this.allLanguages()
      .filter((l) => l.category === 'base' && !taken.has(l.name) && !l.speakers.isExtinct)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly availableExoticLanguages = computed<Language[]>(() => {
    const taken = new Set(this.builder.creation().languages);
    return this.allLanguages()
      .filter((l) => l.category === 'exotique' && !taken.has(l.name) && !l.speakers.isExtinct)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly currentLanguages = computed(() => {
    const map = new Map<string, Language>();
    this.allLanguages().forEach((l) => map.set(l.name, l));
    const locked = new Set(this.lockedLanguages());
    return this.builder.creation().languages.map((name) => ({
      name,
      data: map.get(name) ?? null,
      isLocked: locked.has(name),
      source: this.getSource(name),
    }));
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.dataService.getLanguages().subscribe({
      next: (langs) => {
        this.allLanguages.set(langs);
        this.loading.set(false);
        this.normalizeLanguageIds(langs);
        this.ensureClassLanguage();
        this.ensureLockedLanguages();
      },
      error: () => {
        this.error.set('Impossible de charger les langues.');
        this.loading.set(false);
      },
    });
  }

  addLanguage(langName: string): void {
    if (this.remainingPicks() <= 0) return;
    this.builder.addLanguage(langName);
  }

  removeLanguage(langName: string): void {
    if (this.lockedLanguages().includes(langName)) return;
    this.builder.removeLanguage(langName);
  }

  toggleDetail(langId: string): void {
    this.expandedId.update((id) => (id === langId ? null : langId));
  }

  isExpanded(langId: string): boolean {
    return this.expandedId() === langId;
  }

  getSource(langName: string): string {
    const c = this.builder.creation();
    if (c.speciesLanguages.includes(langName)) return 'Espèce';
    if (c.civilizationLanguages.includes(langName)) return 'Civilisation';
    if (CLASS_GRANTED_LANGUAGES[c.classId ?? ''] === langName) return 'Classe';
    return 'Bonus';
  }

  writingLabel(lang: Language): string {
    if (lang.linguistics.isOralOnly) return 'Oral uniquement';
    return lang.linguistics.writingSystems.map((w) => w.label).join(', ');
  }

  speakersLabel(lang: Language): string {
    return lang.speakers.primary.map((s) => s.label).join(', ');
  }

  confirm(): void {
    if (this.remainingPicks() === 0) {
      this.builder.nextStep();
    }
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  private normalizeLanguageIds(langs: Language[]): void {
    const idToName = new Map<string, string>();
    langs.forEach((l) => idToName.set(l.id, l.name));

    const resolve = (s: string) => idToName.get(s) ?? s;
    const c = this.builder.creation();

    const newSpeciesLangs = c.speciesLanguages.map(resolve);
    const newCivLangs = c.civilizationLanguages.map(resolve);
    const newBgLangs = c.backgroundLanguages.map(resolve);
    const newAll = [...new Set(c.languages.map(resolve))];

    const changed =
      newSpeciesLangs.some((l, i) => l !== c.speciesLanguages[i]) ||
      newCivLangs.some((l, i) => l !== c.civilizationLanguages[i]) ||
      newBgLangs.some((l, i) => l !== c.backgroundLanguages[i]) ||
      newAll.length !== c.languages.length ||
      newAll.some((l, i) => l !== c.languages[i]);

    if (changed) {
      this.builder.creation.update((state) => ({
        ...state,
        speciesLanguages: newSpeciesLangs,
        civilizationLanguages: newCivLangs,
        backgroundLanguages: newBgLangs,
        languages: newAll,
      }));
    }
  }

  private ensureClassLanguage(): void {
    const classLang = CLASS_GRANTED_LANGUAGES[this.builder.creation().classId ?? ''];
    if (classLang && !this.builder.creation().languages.includes(classLang)) {
      this.builder.addLanguage(classLang);
    }
  }

  private ensureLockedLanguages(): void {
    const current = new Set(this.builder.creation().languages);
    for (const lang of this.lockedLanguages()) {
      if (!current.has(lang)) this.builder.addLanguage(lang);
    }
  }
}
