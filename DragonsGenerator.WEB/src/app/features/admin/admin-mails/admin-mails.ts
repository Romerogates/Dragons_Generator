import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { InboxMail, OutboundEmail } from '../admin.types';

@Component({
  selector: 'app-admin-mails',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-mails.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMailsPanel {
  readonly inboxMails = input<InboxMail[]>([]);
  readonly outboundEmails = input<OutboundEmail[]>([]);
  readonly selectedMail = model<OutboundEmail | null>(null);
}
