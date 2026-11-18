import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SUPPORT_CATEGORIES, supportCategoryLabel } from '@core/utils/support-category.util';
import { supportStatusBadgeClass, supportStatusLabel, supportWaitingLabel } from '@core/utils/support-status.util';
import {
  formatTicketAge,
  ticketIsStale,
  ticketQueue,
  type TicketQueueFilter,
} from '../admin-tickets.filter';
import type { AdminTicket } from '../admin.types';

@Component({
  selector: 'app-admin-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-tickets.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTicketsPanel {
  readonly tickets = input<AdminTicket[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly diagnostic = input('');
  readonly categories = input<readonly string[]>(SUPPORT_CATEGORIES);
  readonly queueFilter = model<TicketQueueFilter>('staff');
  readonly statusFilter = model<'all' | 'open' | 'in_progress' | 'closed'>('all');
  readonly categoryFilter = model<'all' | string>('all');
  readonly search = model('');
  readonly mineOnly = model(false);
  readonly openTicket = output<string>();
  readonly copyDiagnostic = output<string | undefined>();

  readonly formatTicketAge = formatTicketAge;

  waitingLabel(ticket: AdminTicket): string {
    return supportWaitingLabel(ticketQueue(ticket), 'staff');
  }
  isStale(ticket: AdminTicket): boolean {
    return ticketIsStale(ticket);
  }
  categoryLabel(category: string | undefined): string {
    return supportCategoryLabel(category);
  }
  statusLabel(status: string): string {
    return supportStatusLabel(status, 'staff');
  }
  statusBadgeClass(status: string): string {
    return supportStatusBadgeClass(status);
  }
}
