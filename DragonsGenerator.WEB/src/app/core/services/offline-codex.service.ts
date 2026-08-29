import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable, of, catchError } from 'rxjs';
import { environment } from '@env/environment';
import { normalizeCharacterClasses } from '@core/utils/class-data.adapter';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';

const STORAGE_KEY = 'dragons-offline-codex-v1';
const META_KEY = 'dragons-offline-codex-meta';

export interface OfflineCodexMeta {
  downloadedAt: string;
  keys: string[];
}

@Injectable({ providedIn: 'root' })
export class OfflineCodexService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

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

    const get = <T>(path: string) => this.http.get<T>(`${this.apiUrl}${path}`);

    const jobs = {
      species: get('/species'),
      'species-summary': get('/species/summary'),
      'species-codes': get('/species/codes'),
      classes: get<CharacterClass[]>('/classes').pipe(map((list) => normalizeCharacterClasses(list))),
      'classes-summary': get('/classes/summary'),
      civilisations: get('/civilisations'),
      'civilisations-summary': get('/civilisations/summary'),
      equipments: get('/equipments'),
      'equipments-summary': get('/equipments/summary'),
      'equipment-types': get('/equipments/types'),
      spells: get('/spells'),
      'spells-summary': get('/spells/summary'),
      'spell-schools': get('/spells/schools'),
      creatures: get('/creatures'),
      'creatures-summary': get('/creatures/summary'),
      'creature-categories': get('/creatures/categories'),
      backgrounds: get('/backgrounds'),
      'backgrounds-summary': get('/backgrounds/summary'),
      handicaps: get('/handicaps'),
      'handicap-rules': get('/handicaps/rules'),
      languages: get('/languages'),
      'languages-summary': get('/languages/summary'),
      'language-categories': get('/languages/categories'),
      skills: get('/skills'),
      'skills-summary': get('/skills/summary'),
      feats: get('/feats'),
      'feats-summary': get('/feats/summary'),
      deities: get('/deities'),
      'deities-summary': get('/deities/summary'),
      'combat-actions': get('/combat-actions'),
      'combat-actions-summary': get('/combat-actions/summary'),
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
