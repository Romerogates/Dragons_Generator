import { Injectable } from '@angular/core';
import type { Character } from '@core/models/Character/character';

const CURRENT_KEY = 'dragons-current-character';
const EDIT_KEY = 'dragons-edit-character';

/** Navigation personnage (sessionStorage — pas une bibliothèque persistante). */
@Injectable({ providedIn: 'root' })
export class CharacterHandoffService {
  setCurrent(character: Character): void {
    try {
      sessionStorage.setItem(CURRENT_KEY, JSON.stringify(character));
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

  clearCurrent(): void {
    sessionStorage.removeItem(CURRENT_KEY);
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
