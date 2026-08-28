import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, switchMap, tap, catchError, map } from 'rxjs';
import { environment } from '@env/environment';
import type { Character } from '@core/models/Character/character';
import { AuthService } from './auth.service';

export interface CloudCharacterSummary {
  id: string;
  name: string;
  updatedAt: string;
}

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
  save(character: Character): Observable<string> {
    if (!this.auth.isLoggedIn()) return of(character.id ?? '');

    const body = { name: character.name ?? 'Sans nom', data: character };
    const existingId = typeof character.id === 'string' && character.id.length > 20
      ? character.id
      : null;

    if (existingId && !existingId.includes('-') === false && existingId.length === 36) {
      // GUID serveur
    }

    // Si l'id ressemble à un GUID → update, sinon create
    const looksGuid =
      typeof character.id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(character.id);

    if (looksGuid) {
      return this.http
        .put<{ id: string }>(`${this.api}/me/characters/${character.id}`, body)
        .pipe(
          map((r) => r.id),
          catchError(() =>
            this.http.post<{ id: string }>(`${this.api}/me/characters`, body).pipe(map((r) => r.id)),
          ),
        );
    }

    return this.http.post<{ id: string }>(`${this.api}/me/characters`, body).pipe(map((r) => r.id));
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
                    const data = { ...(full.data as object), id: full.id, name: full.name };
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

  private readLocal(): unknown[] {
    try {
      const raw = localStorage.getItem('dragons-characters');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
