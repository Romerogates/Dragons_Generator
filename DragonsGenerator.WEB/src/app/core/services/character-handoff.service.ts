import { Injectable } from '@angular/core';
import type { Character } from '@core/models/Character/character';

const CURRENT_KEY = 'dragons-current-character';
const MODE_KEY = 'dragons-current-character-mode';
const SOURCE_KEY = 'dragons-current-character-source';
const RETURN_KEY = 'dragons-current-character-return';
const PROPOSAL_KEY = 'dragons-current-character-proposal';
const META_KEY = 'dragons-current-character-meta';
const EDIT_KEY = 'dragons-edit-character';

/** TTL handoff fiche (multi-onglets / refresh tardif). */
export const CHARACTER_HANDOFF_TTL_MS = 30 * 60 * 1000;

export type CharacterHandoffMode = 'own' | 'consult';

/** Contexte MJ : accepter / refuser une proposition depuis la fiche consultée. */
export interface CharacterProposalReview {
  campaignId: string;
  memberId: string;
  memberDisplayName?: string;
}

export interface CharacterHandoffOptions {
  mode?: CharacterHandoffMode;
  sourceLabel?: string;
  /** Après consultation, retour préféré (ex. table /play). */
  returnUrl?: string;
  /** Si défini, la fiche consultée propose Accepter / Refuser. */
  proposalReview?: CharacterProposalReview;
}

interface HandoffMeta {
  savedAt: number;
  tabId: string;
}

function tabId(): string {
  try {
    const key = 'dragons-handoff-tab-id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `tab-${Date.now()}`;
  }
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
      if (options?.proposalReview) {
        sessionStorage.setItem(PROPOSAL_KEY, JSON.stringify(options.proposalReview));
      } else {
        sessionStorage.removeItem(PROPOSAL_KEY);
      }
      const meta: HandoffMeta = { savedAt: Date.now(), tabId: tabId() };
      sessionStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {
      /* ignore quota */
    }
  }

  peekCurrent(): Character | null {
    try {
      if (!this.isHandoffFresh()) {
        this.clearCurrent();
        return null;
      }
      const raw = sessionStorage.getItem(CURRENT_KEY);
      return raw ? (JSON.parse(raw) as Character) : null;
    } catch {
      return null;
    }
  }

  peekMode(): CharacterHandoffMode {
    try {
      if (!this.isHandoffFresh()) return 'own';
      return sessionStorage.getItem(MODE_KEY) === 'consult' ? 'consult' : 'own';
    } catch {
      return 'own';
    }
  }

  peekSourceLabel(): string | null {
    try {
      if (!this.isHandoffFresh()) return null;
      return sessionStorage.getItem(SOURCE_KEY);
    } catch {
      return null;
    }
  }

  peekReturnUrl(): string | null {
    try {
      if (!this.isHandoffFresh()) return null;
      return sessionStorage.getItem(RETURN_KEY);
    } catch {
      return null;
    }
  }

  peekProposalReview(): CharacterProposalReview | null {
    try {
      if (!this.isHandoffFresh()) return null;
      const raw = sessionStorage.getItem(PROPOSAL_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CharacterProposalReview;
      if (!parsed?.campaignId || !parsed?.memberId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /** true si le handoff a un meta frais (TTL) pour cet onglet sessionStorage. */
  isHandoffFresh(now = Date.now()): boolean {
    try {
      const raw = sessionStorage.getItem(META_KEY);
      if (!raw) {
        // Ancien handoff sans meta : accepter une fois, puis stamp.
        if (!sessionStorage.getItem(CURRENT_KEY)) return false;
        const meta: HandoffMeta = { savedAt: now, tabId: tabId() };
        sessionStorage.setItem(META_KEY, JSON.stringify(meta));
        return true;
      }
      const meta = JSON.parse(raw) as HandoffMeta;
      if (!meta?.savedAt) return false;
      if (now - meta.savedAt > CHARACTER_HANDOFF_TTL_MS) return false;
      return true;
    } catch {
      return false;
    }
  }

  clearCurrent(): void {
    sessionStorage.removeItem(CURRENT_KEY);
    sessionStorage.removeItem(MODE_KEY);
    sessionStorage.removeItem(SOURCE_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    sessionStorage.removeItem(PROPOSAL_KEY);
    sessionStorage.removeItem(META_KEY);
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
