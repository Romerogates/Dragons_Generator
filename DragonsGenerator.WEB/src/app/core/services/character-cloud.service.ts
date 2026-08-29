import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, switchMap, tap, catchError, map, throwError } from 'rxjs';
import { environment } from '@env/environment';
import type { Character } from '@core/models/Character/character';
import {
  formatCharacterCloudListError,
  formatCharacterCloudLoadError,
  formatCharacterCloudSyncSummary,
} from '@core/utils/character-cloud-sync.util';
import { AuthService } from './auth.service';

export interface CloudCharacterSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface SaveCharacterOptions {
  /** Force la mise à jour PUT (perso déjà connu côté serveur). */
  updateExisting?: boolean;
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable({ providedIn: 'root' })
export class CharacterCloudService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  /** Dernier échec partiel ou total lors d'un syncFromCloud(). */
  readonly lastSyncError = signal<string | null>(null);

  list(): Observable<CloudCharacterSummary[]> {
    if (!this.auth.isLoggedIn()) return of([]);
    return this.http.get<CloudCharacterSummary[]>(`${this.api}/me/characters`);
  }

  get(id: string): Observable<{ id: string; name: string; data: unknown }> {
    return this.http.get<{ id: string; name: string; data: unknown }>(
      `${this.api}/me/characters/${id}`,
    );
  }

  /** Crée ou met à jour un perso cloud ; retourne l'id serveur. */
  save(character: Character, options?: SaveCharacterOptions): Observable<string> {
    if (!this.auth.isLoggedIn()) return of(character.id ?? '');

    const body = { name: character.name ?? 'Sans nom', data: character };
    const shouldUpdate =
      options?.updateExisting === true ||
      (character.cloudSynced === true &&
        typeof character.id === 'string' &&
        GUID_RE.test(character.id));

    if (shouldUpdate && character.id) {
      return this.http
        .put<{ id: string }>(`${this.api}/me/characters/${character.id}`, body)
        .pipe(
          map((r) => r.id ?? character.id),
          catchError((err: unknown) => {
            if (err instanceof HttpErrorResponse && err.status === 404) {
              return this.createCharacter(body);
            }
            return throwError(() => err);
          }),
        );
    }

    return this.createCharacter(body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/characters/${id}`);
  }

  /** Merge cloud → localStorage pour la page Héros. */
  syncFromCloud(): Observable<unknown[]> {
    if (!this.auth.isLoggedIn()) {
      return of(this.readLocal());
    }
    this.lastSyncError.set(null);
    return this.list().pipe(
      switchMap((summaries) => {
        if (!summaries.length) return of([] as unknown[]);
        return this.loadSummariesSequentially(summaries);
      }),
      tap((merged) => {
        const pendingLocal = this.readLocal().filter(
          (c): c is { id?: string; cloudSynced?: boolean } =>
            typeof c === 'object' &&
            c !== null &&
            (c as { cloudSynced?: boolean }).cloudSynced === false,
        );
        const mergedIds = new Set(
          (merged as { id?: string }[]).map((c) => c.id).filter(Boolean),
        );
        const extras = pendingLocal.filter((c) => !mergedIds.has(c.id));
        const combined = [...(merged as unknown[]), ...extras];
        localStorage.setItem('dragons-characters', JSON.stringify(combined));
      }),
      catchError((err) => {
        this.lastSyncError.set(formatCharacterCloudListError(err));
        return of(this.readLocal());
      }),
    );
  }

  private loadSummariesSequentially(
    summaries: CloudCharacterSummary[],
  ): Observable<unknown[]> {
    const loadErrors: string[] = [];
    return summaries.reduce(
      (acc$, summary) =>
        acc$.pipe(
          switchMap((arr) =>
            this.get(summary.id).pipe(
              map((full) => {
                const data = {
                  ...(full.data as object),
                  id: full.id,
                  name: full.name,
                  cloudSynced: true,
                };
                return [...arr, data];
              }),
              catchError((err) => {
                loadErrors.push(formatCharacterCloudLoadError(summary.name, err));
                return of(arr);
              }),
            ),
          ),
        ),
      of([] as unknown[]),
    ).pipe(
      tap(() => {
        if (loadErrors.length > 0) {
          this.lastSyncError.set(formatCharacterCloudSyncSummary(loadErrors));
        }
      }),
    );
  }

  private createCharacter(body: { name: string; data: Character }): Observable<string> {
    return this.http.post<{ id: string }>(`${this.api}/me/characters`, body).pipe(map((r) => r.id));
  }

  private readLocal(): unknown[] {
    try {
      const raw = localStorage.getItem('dragons-characters');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
