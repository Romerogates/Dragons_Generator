import { Injectable, inject } from '@angular/core';
import { Observable, of, map, catchError } from 'rxjs';
import type { Character } from '@core/models/Character/character';
import {
  validateCharacterExport,
} from '@core/utils/character-export-validation.util';
import { CharacterCloudService } from './character-cloud.service';
import { CharacterHandoffService } from './character-handoff.service';
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
  private readonly handoff = inject(CharacterHandoffService);

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
   * Si connecté + pending : pousse en DB, met à jour le handoff, nettoie.
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
        this.handoff.setCurrent(updated);
        this.clear();
        return updated;
      }),
      catchError(() => of(null)),
    );
  }
}
