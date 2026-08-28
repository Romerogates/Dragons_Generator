import { Injectable, inject } from '@angular/core';
import { Observable, of, map, catchError } from 'rxjs';
import type { Character } from '@core/models/Character/character';
import {
  validateCharacterExport,
} from '@core/utils/character-export-validation.util';
import { CharacterCloudService } from './character-cloud.service';
import { AuthService } from './auth.service';

const PENDING_KEY = 'dragons-pending-character-save';

/**
 * Perso en attente de sauvegarde cloud (après login / inscription).
 * sessionStorage : survit à la navigation auth, pas aux onglets fermés.
 */
@Injectable({ providedIn: 'root' })
export class PendingCharacterSaveService {
  private readonly cloud = inject(CharacterCloudService);
  private readonly auth = inject(AuthService);

  stash(character: unknown): void {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(character));
  }

  peek(): unknown | null {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    sessionStorage.removeItem(PENDING_KEY);
  }

  hasPending(): boolean {
    return !!sessionStorage.getItem(PENDING_KEY);
  }

  /**
   * Si connecté + pending : pousse en DB, met à jour le cache local, nettoie.
   * Retourne le personnage final (avec id serveur) ou null.
   */
  flushIfPossible(): Observable<unknown | null> {
    if (!this.auth.isLoggedIn()) return of(null);
    const pending = this.peek();
    if (!pending || typeof pending !== 'object') return of(null);

    const character = pending as Character;
    const validation = validateCharacterExport(character);
    if (!validation.valid) {
      return of(null);
    }

    return this.cloud.save(character).pipe(
      map((serverId) => {
        const updated = {
          ...character,
          id: serverId || character.id,
          cloudSynced: true,
        };
        this.upsertLocal(updated);
        localStorage.setItem('dragons-current-character', JSON.stringify(updated));
        this.clear();
        return updated;
      }),
      catchError(() => {
        // garde le pending pour retenter
        return of(null);
      }),
    );
  }

  private upsertLocal(character: { id?: string }): void {
    let list: any[] = [];
    try {
      const raw = localStorage.getItem('dragons-characters');
      list = raw ? JSON.parse(raw) : [];
    } catch {
      list = [];
    }
    const id = character.id;
    const idx = list.findIndex((c) => c?.id === id);
    if (idx >= 0) list[idx] = character;
    else list.push(character);
    localStorage.setItem('dragons-characters', JSON.stringify(list));
  }
}
