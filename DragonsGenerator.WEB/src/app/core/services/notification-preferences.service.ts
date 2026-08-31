import { Injectable, signal } from '@angular/core';
import type { NotificationType } from '@core/models/notification.model';

const PREFS_KEY = 'dragons-notification-prefs-v1';
const DISMISSED_KEY = 'dragons-notifications-dismissed';

export interface NotificationPreferences {
  friendRequests: boolean;
  friendMessages: boolean;
  campaignInvites: boolean;
  characterProposals: boolean;
  characterResults: boolean;
  sessionReminders: boolean;
  handouts: boolean;
  initiative: boolean;
}

export interface NotificationPrefOption {
  id: keyof NotificationPreferences;
  label: string;
  hint: string;
  group: 'social' | 'campaign' | 'push';
}

export const NOTIFICATION_PREF_OPTIONS: NotificationPrefOption[] = [
  {
    id: 'friendRequests',
    label: 'Demandes d’ami',
    hint: 'Quand quelqu’un souhaite vous ajouter.',
    group: 'social',
  },
  {
    id: 'friendMessages',
    label: 'Messages d’amis',
    hint: 'Nouveaux messages non lus.',
    group: 'social',
  },
  {
    id: 'campaignInvites',
    label: 'Invitations campagne',
    hint: 'Quand un MJ vous invite à une table.',
    group: 'campaign',
  },
  {
    id: 'characterProposals',
    label: 'Personnages à valider',
    hint: 'Propositions de PJ en attente (MJ).',
    group: 'campaign',
  },
  {
    id: 'characterResults',
    label: 'Résultat de proposition',
    hint: 'Personnage accepté ou refusé (joueur).',
    group: 'campaign',
  },
  {
    id: 'sessionReminders',
    label: 'Rappels de session',
    hint: 'Push 24 h et 1 h avant une session planifiée.',
    group: 'push',
  },
  {
    id: 'handouts',
    label: 'Documents publiés',
    hint: 'Handouts et notes partagés par le MJ.',
    group: 'push',
  },
  {
    id: 'initiative',
    label: 'Collecte d’initiative',
    hint: 'Quand le MJ ouvre la saisie des jets.',
    group: 'push',
  },
];

const DEFAULT_PREFS: NotificationPreferences = {
  friendRequests: true,
  friendMessages: true,
  campaignInvites: true,
  characterProposals: true,
  characterResults: true,
  sessionReminders: true,
  handouts: true,
  initiative: true,
};

@Injectable({ providedIn: 'root' })
export class NotificationPreferencesService {
  readonly prefs = signal<NotificationPreferences>(this.loadPrefs());
  private readonly dismissed = signal<Set<string>>(this.loadDismissed());

  optionsForGroup(group: NotificationPrefOption['group']): NotificationPrefOption[] {
    return NOTIFICATION_PREF_OPTIONS.filter((o) => o.group === group);
  }

  isKindEnabled(kind: NotificationType): boolean {
    const p = this.prefs();
    switch (kind) {
      case 'friend_request':
        return p.friendRequests;
      case 'friend_message':
        return p.friendMessages;
      case 'campaign_invite':
        return p.campaignInvites;
      case 'character_pick_requested':
        return p.campaignInvites;
      case 'character_proposal':
        return p.characterProposals;
      case 'proposal_rejected':
      case 'proposal_approved':
        return p.characterResults;
    }
  }

  isDismissed(key: string): boolean {
    return this.dismissed().has(key);
  }

  dismiss(key: string): void {
    const next = new Set(this.dismissed());
    next.add(key);
    this.dismissed.set(next);
    this.saveDismissed(next);
  }

  clearDismissed(): void {
    this.dismissed.set(new Set());
    try {
      localStorage.removeItem(DISMISSED_KEY);
    } catch {
      /* ignore */
    }
  }

  setPref(id: keyof NotificationPreferences, enabled: boolean): void {
    const next = { ...this.prefs(), [id]: enabled };
    this.prefs.set(next);
    this.savePrefs(next);
  }

  resetPrefs(): void {
    this.prefs.set({ ...DEFAULT_PREFS });
    this.savePrefs(DEFAULT_PREFS);
  }

  private loadPrefs(): NotificationPreferences {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
      return { ...DEFAULT_PREFS, ...parsed };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  private savePrefs(prefs: NotificationPreferences): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }

  private loadDismissed(): Set<string> {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as string[];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  private saveDismissed(set: Set<string>): void {
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  }
}
