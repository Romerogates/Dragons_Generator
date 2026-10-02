import { Injectable, signal } from '@angular/core';

const SKIP_MODE_PROMPT_KEY = 'dragons-forge-skip-mode-prompt';

/**
 * Préférences locales de la forge (pas de sync cloud).
 * Ex. : ne plus demander pré-tiré vs manuel à l’entrée de /create.
 */
@Injectable({ providedIn: 'root' })
export class ForgePreferencesService {
  readonly skipModePrompt = signal(this.readSkip());

  setSkipModePrompt(value: boolean): void {
    this.skipModePrompt.set(value);
    try {
      localStorage.setItem(SKIP_MODE_PROMPT_KEY, value ? '1' : '0');
    } catch {
      /* private mode */
    }
  }

  private readSkip(): boolean {
    try {
      return localStorage.getItem(SKIP_MODE_PROMPT_KEY) === '1';
    } catch {
      return false;
    }
  }
}
