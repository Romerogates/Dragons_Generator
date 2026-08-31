import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { CampaignSession } from '@core/models/Campaign/campaign';
import {
  formatSessionDate,
  sessionInputValue,
  sessionStatusChipClass,
  sessionStatusLabel,
} from '../campaign-session.util';

export interface SessionPatchEvent {
  sessionId: string;
  patch: Partial<CampaignSession>;
}

export interface SessionDateChangeEvent {
  sessionId: string;
  value: string;
}

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

  readonly addSession = output<void>();
  readonly startEditSession = output<string>();
  readonly stopEditSession = output<void>();
  readonly startPlaySession = output<string>();
  readonly removeSession = output<string>();
  readonly sessionPatch = output<SessionPatchEvent>();
  readonly sessionPatchImmediate = output<SessionPatchEvent>();
  readonly sessionDateChange = output<SessionDateChangeEvent>();

  readonly formatSessionDate = formatSessionDate;
  readonly sessionStatusLabel = sessionStatusLabel;
  readonly sessionStatusChipClass = sessionStatusChipClass;
  readonly sessionInputValue = sessionInputValue;
}
