import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { CampaignSession } from '@core/models/Campaign/campaign';
import {
  formatSessionDate,
  sessionInputValue,
  sessionModeChipClass,
  sessionModeHint,
  sessionModeLabel,
  sessionStatusChipClass,
  sessionStatusLabel,
  normalizeSessionMode,
} from '../campaign-session.util';

export interface SessionPatchEvent {
  sessionId: string;
  patch: Partial<CampaignSession>;
}

export interface SessionDateChangeEvent {
  sessionId: string;
  value: string;
}

export type SessionListFilter = 'upcoming' | 'past' | 'all';

@Component({
  selector: 'app-campaign-detail-sessions',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './campaign-detail-sessions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDetailSessions {
  readonly isOwner = input.required<boolean>();
  readonly sortedSessions = input<CampaignSession[]>([]);
  readonly upcomingSessions = input<CampaignSession[]>([]);
  readonly pastSessions = input<CampaignSession[]>([]);
  readonly editingSessionId = input<string | null>(null);
  readonly hasActiveSession = input(false);
  readonly activeSessionId = input<string | null>(null);

  readonly addSession = output<void>();
  readonly startEditSession = output<string>();
  readonly stopEditSession = output<void>();
  readonly startPlaySession = output<string>();
  readonly openLiveSession = output<void>();
  readonly removeSession = output<string>();
  readonly sessionPatch = output<SessionPatchEvent>();
  readonly sessionPatchImmediate = output<SessionPatchEvent>();
  readonly sessionDateChange = output<SessionDateChangeEvent>();

  readonly filter = signal<SessionListFilter>('upcoming');

  readonly editingSession = computed(() => {
    const id = this.editingSessionId();
    if (!id) return null;
    return this.sortedSessions().find((s) => s.id === id) ?? null;
  });

  readonly filteredSessions = computed(() => {
    const f = this.filter();
    let list: CampaignSession[];
    if (f === 'upcoming') {
      list = this.upcomingSessions().length
        ? this.upcomingSessions()
        : this.sortedSessions().filter((s) => s.status === 'planned');
    } else if (f === 'past') {
      list = this.pastSessions().length
        ? this.pastSessions()
        : this.sortedSessions().filter((s) => s.status !== 'planned');
    } else {
      list = this.sortedSessions();
    }

    const activeId = this.activeSessionId();
    if (!activeId || f === 'past') return list;

    const active = this.sortedSessions().find((s) => s.id === activeId);
    if (!active) return list;
    const without = list.filter((s) => s.id !== activeId);
    return [active, ...without];
  });

  readonly formatSessionDate = formatSessionDate;
  readonly sessionStatusLabel = sessionStatusLabel;
  readonly sessionStatusChipClass = sessionStatusChipClass;
  readonly sessionModeLabel = sessionModeLabel;
  readonly sessionModeChipClass = sessionModeChipClass;
  readonly sessionModeHint = sessionModeHint;
  readonly normalizeSessionMode = normalizeSessionMode;
  readonly sessionInputValue = sessionInputValue;

  setFilter(f: SessionListFilter): void {
    this.filter.set(f);
  }

  isActive(session: CampaignSession): boolean {
    return this.activeSessionId() === session.id;
  }
}
