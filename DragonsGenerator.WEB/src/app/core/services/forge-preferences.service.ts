import { Injectable, signal } from '@angular/core';

const SKIP_MODE_PROMPT_KEY = 'dragons-forge-skip-mode-prompt';
const MOBILE_RECAP_MODE_KEY = 'dragons-forge-mobile-recap-mode';

/** Aperçu du récap forge sur téléphone (réglé dans Paramètres). */
export type ForgeMobileRecapMode = 'pdf' | 'compact';

/**
 * Préférences locales de la forge (pas de sync cloud).
 * Ex. : ne plus demander pré-tiré vs manuel ; aperçu récap mobile.
 */
@Injectable({ providedIn: 'root' })
export class ForgePreferencesService {
  readonly skipModePrompt = signal(this.readSkip());
  /** Défaut PDF — fiche Illustrée sur le récap téléphone. */
  readonly mobileRecapMode = signal<ForgeMobileRecapMode>(this.readMobileRecapMode());

  setSkipModePrompt(value: boolean): void {
    this.skipModePrompt.set(value);
    try {
      localStorage.setItem(SKIP_MODE_PROMPT_KEY, value ? '1' : '0');
    } catch {
      /* private mode */
    }
  }

  setMobileRecapMode(mode: ForgeMobileRecapMode): void {
    this.mobileRecapMode.set(mode);
    try {
      localStorage.setItem(MOBILE_RECAP_MODE_KEY, mode);
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

  private readMobileRecapMode(): ForgeMobileRecapMode {
    try {
      const raw = localStorage.getItem(MOBILE_RECAP_MODE_KEY);
      return raw === 'compact' ? 'compact' : 'pdf';
    } catch {
      return 'pdf';
    }
  }
}
