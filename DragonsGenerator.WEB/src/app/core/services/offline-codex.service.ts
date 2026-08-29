import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, map, Observable, of, catchError } from 'rxjs';
import { DataService } from './data.service';

const STORAGE_KEY = 'dragons-offline-codex-v1';
const META_KEY = 'dragons-offline-codex-meta';

export interface OfflineCodexMeta {
  downloadedAt: string;
  keys: string[];
}

@Injectable({ providedIn: 'root' })
export class OfflineCodexService {
  private readonly data = inject(DataService);

  readonly downloading = signal(false);
  readonly downloadError = signal<string | null>(null);

  isDownloaded(): boolean {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  meta(): OfflineCodexMeta | null {
    try {
      const raw = localStorage.getItem(META_KEY);
      return raw ? (JSON.parse(raw) as OfflineCodexMeta) : null;
    } catch {
      return null;
    }
  }

  getSnapshot<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const bundle = JSON.parse(raw) as Record<string, unknown>;
      return (bundle[key] as T) ?? null;
    } catch {
      return null;
    }
  }

  findById<T extends { id?: string }>(listKey: string, id: string): T | null {
    const list = this.getSnapshot<T[]>(listKey);
    if (!list?.length) return null;
    return list.find((item) => item.id === id) ?? null;
  }

  /** Télécharge toutes les données nécessaires à la création de perso / campagne hors ligne. */
  downloadCodex(): Observable<boolean> {
    if (this.downloading()) return of(false);
    this.downloading.set(true);
    this.downloadError.set(null);

    const jobs = {
      species: this.data.getSpecies(),
      'species-summary': this.data.getSpeciesSummary(),
      'species-codes': this.data.getSpeciesCodes(),
      classes: this.data.getClasses(),
      'classes-summary': this.data.getClassesSummary(),
      civilisations: this.data.getCivilisations(),
      'civilisations-summary': this.data.getCivilisationsSummary(),
      equipments: this.data.getEquipments(),
      'equipments-summary': this.data.getEquipmentsSummary(),
      'equipment-types': this.data.getEquipmentTypes(),
      spells: this.data.getSpells(),
      'spells-summary': this.data.getSpellsSummary(),
      'spell-schools': this.data.getSpellSchools(),
      creatures: this.data.getCreatures(),
      'creatures-summary': this.data.getCreaturesSummary(),
      'creature-categories': this.data.getCreatureCategories(),
      backgrounds: this.data.getBackgrounds(),
      'backgrounds-summary': this.data.getBackgroundsSummary(),
      handicaps: this.data.getHandicaps(),
      'handicap-rules': this.data.getHandicapRules(),
      languages: this.data.getLanguages(),
      'languages-summary': this.data.getLanguagesSummary(),
      'language-categories': this.data.getLanguageCategories(),
      skills: this.data.getSkills(),
      'skills-summary': this.data.getSkillsSummary(),
      feats: this.data.getFeats(),
      'feats-summary': this.data.getFeatsSummary(),
      deities: this.data.getDeities(),
      'deities-summary': this.data.getDeitiesSummary(),
      'combat-actions': this.data.getCombatActions(),
      'combat-actions-summary': this.data.getCombatActionsSummary(),
    };

    return forkJoin(jobs).pipe(
      map((bundle) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
        const meta: OfflineCodexMeta = {
          downloadedAt: new Date().toISOString(),
          keys: Object.keys(bundle),
        };
        localStorage.setItem(META_KEY, JSON.stringify(meta));
        this.downloading.set(false);
        return true;
      }),
      catchError(() => {
        this.downloading.set(false);
        this.downloadError.set('Échec du téléchargement. Vérifie ta connexion et réessaie.');
        return of(false);
      }),
    );
  }

  clearDownload(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
  }
}
