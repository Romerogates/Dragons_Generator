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
import { MAX_CHARACTERS_PER_USER } from '@core/constants/character-limits';
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

  /** Dernier échec partiel ou total lors d'un loadAll(). */
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

  /** Charge tous les personnages depuis le cloud (mémoire uniquement — pas de cache localStorage). */
  loadAll(): Observable<Character[]> {
    if (!this.auth.isLoggedIn()) {
      return of([]);
    }
    this.lastSyncError.set(null);
    return this.list().pipe(
      switchMap((summaries) => {
        if (!summaries.length) return of([] as Character[]);
        return this.loadSummariesSequentially(summaries);
      }),
      catchError((err) => {
        this.lastSyncError.set(formatCharacterCloudListError(err));
        return of([] as Character[]);
      }),
    );
  }

  /** @deprecated Utiliser loadAll() — alias pour compatibilité interne. */
  syncFromCloud(): Observable<Character[]> {
    return this.loadAll();
  }

  private loadSummariesSequentially(
    summaries: CloudCharacterSummary[],
  ): Observable<Character[]> {
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
                } as Character;
                return [...arr, data];
              }),
              catchError((err) => {
                loadErrors.push(formatCharacterCloudLoadError(summary.name, err));
                return of(arr);
              }),
            ),
          ),
        ),
      of([] as Character[]),
    ).pipe(
      tap(() => {
        if (loadErrors.length > 0) {
          this.lastSyncError.set(formatCharacterCloudSyncSummary(loadErrors));
        }
      }),
    );
  }

  private createCharacter(body: { name: string; data: Character }): Observable<string> {
    return this.list().pipe(
      map((summaries) => summaries.length),
      catchError(() => of(-1)),
      switchMap((count) => {
        if (count >= MAX_CHARACTERS_PER_USER) {
          return throwError(
            () =>
              new HttpErrorResponse({
                status: 400,
                statusText: 'Bad Request',
                error: {
                  message: `Limite atteinte : maximum ${MAX_CHARACTERS_PER_USER} personnages par compte.`,
                },
              }),
          );
        }
        return this.http
          .post<{ id: string }>(`${this.api}/me/characters`, body)
          .pipe(map((r) => r.id));
      }),
    );
  }
}
