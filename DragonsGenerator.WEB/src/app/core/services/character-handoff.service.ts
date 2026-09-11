import { Injectable } from '@angular/core';
import type { Character } from '@core/models/Character/character';

const CURRENT_KEY = 'dragons-current-character';
const MODE_KEY = 'dragons-current-character-mode';
const SOURCE_KEY = 'dragons-current-character-source';
const RETURN_KEY = 'dragons-current-character-return';
const EDIT_KEY = 'dragons-edit-character';

export type CharacterHandoffMode = 'own' | 'consult';

export interface CharacterHandoffOptions {
  mode?: CharacterHandoffMode;
  sourceLabel?: string;
  /** Après consultation, retour préféré (ex. table /play). */
  returnUrl?: string;
}

/** Navigation personnage (sessionStorage — pas une bibliothèque persistante). */
@Injectable({ providedIn: 'root' })
export class CharacterHandoffService {
  setCurrent(character: Character, options?: CharacterHandoffOptions): void {
    try {
      sessionStorage.setItem(CURRENT_KEY, JSON.stringify(character));
      sessionStorage.setItem(MODE_KEY, options?.mode === 'consult' ? 'consult' : 'own');
      if (options?.sourceLabel) {
        sessionStorage.setItem(SOURCE_KEY, options.sourceLabel);
      } else {
        sessionStorage.removeItem(SOURCE_KEY);
      }
      if (options?.returnUrl) {
        sessionStorage.setItem(RETURN_KEY, options.returnUrl);
      } else {
        sessionStorage.removeItem(RETURN_KEY);
      }
    } catch {
      /* ignore quota */
    }
  }

  peekCurrent(): Character | null {
    try {
      const raw = sessionStorage.getItem(CURRENT_KEY);
      return raw ? (JSON.parse(raw) as Character) : null;
    } catch {
      return null;
    }
  }

  peekMode(): CharacterHandoffMode {
    try {
      return sessionStorage.getItem(MODE_KEY) === 'consult' ? 'consult' : 'own';
    } catch {
      return 'own';
    }
  }

  peekSourceLabel(): string | null {
    try {
      return sessionStorage.getItem(SOURCE_KEY);
    } catch {
      return null;
    }
  }

  peekReturnUrl(): string | null {
    try {
      return sessionStorage.getItem(RETURN_KEY);
    } catch {
      return null;
    }
  }

  clearCurrent(): void {
    sessionStorage.removeItem(CURRENT_KEY);
    sessionStorage.removeItem(MODE_KEY);
    sessionStorage.removeItem(SOURCE_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  }

  stashEdit(character: Character): void {
    try {
      sessionStorage.setItem(EDIT_KEY, JSON.stringify(character));
    } catch {
      /* ignore */
    }
  }

  consumeEdit(): Character | null {
    try {
      const raw = sessionStorage.getItem(EDIT_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(EDIT_KEY);
      return JSON.parse(raw) as Character;
    } catch {
      sessionStorage.removeItem(EDIT_KEY);
      return null;
    }
  }

  hasEditPending(): boolean {
    return !!sessionStorage.getItem(EDIT_KEY);
  }
}
