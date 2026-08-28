import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, switchMap, tap, catchError, map, throwError } from 'rxjs';
import { environment } from '@env/environment';
import type { Character } from '@core/models/Character/character';
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
    return this.list().pipe(
      switchMap((summaries) => {
        if (!summaries.length) return of([] as unknown[]);
        const loads = summaries.map((s) => this.get(s.id));
        return loads.reduce(
          (acc$, req) =>
            acc$.pipe(
              switchMap((arr) =>
                req.pipe(
                  map((full) => {
                    const data = {
                      ...(full.data as object),
                      id: full.id,
                      name: full.name,
                      cloudSynced: true,
                    };
                    return [...arr, data];
                  }),
                  catchError(() => of(arr)),
                ),
              ),
            ),
          of([] as unknown[]),
        );
      }),
      tap((merged) => {
        localStorage.setItem('dragons-characters', JSON.stringify(merged));
      }),
      catchError(() => of(this.readLocal())),
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
