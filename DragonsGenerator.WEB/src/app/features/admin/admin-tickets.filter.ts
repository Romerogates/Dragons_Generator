import { SupportTicket } from '@core/models/support-ticket';
import { supportWaitingOn, type SupportWaitingOn } from '@core/utils/support-status.util';

export type TicketQueueFilter = 'all' | 'staff' | 'player';

export function ticketLastFromStaff(ticket: SupportTicket): boolean | null {
  if (ticket.lastFromStaff === true) return true;
  if (ticket.lastFromStaff === false) return false;
  return null;
}

export function ticketQueue(ticket: SupportTicket): SupportWaitingOn {
  return supportWaitingOn(ticket.status, ticketLastFromStaff(ticket));
}

export function ticketMatchesSearch(ticket: SupportTicket, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    ticket.id,
    ticket.subject,
    ticket.message,
    ticket.userEmail,
    ticket.category,
    ticket.assignedStaffName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function filterAdminTickets(
  tickets: SupportTicket[],
  opts: {
    status: string;
    category: string;
    queue: TicketQueueFilter;
    mine: boolean;
    mineId?: string | null;
    search: string;
  },
): SupportTicket[] {
  const filtered = tickets.filter((t) => {
    if (opts.status !== 'all' && t.status !== opts.status) return false;
    if (opts.category !== 'all' && (t.category ?? 'autre') !== opts.category) return false;
    if (opts.mine && t.assignedStaffUserId !== opts.mineId) return false;
    if (opts.queue === 'staff' && ticketQueue(t) !== 'support') return false;
    if (opts.queue === 'player' && ticketQueue(t) !== 'player') return false;
    return ticketMatchesSearch(t, opts.search);
  });

  return filtered.sort((a, b) => {
    const aw = ticketQueue(a) === 'support' ? 0 : 1;
    const bw = ticketQueue(b) === 'support' ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return ticketStamp(a) - ticketStamp(b);
  });
}

export function ticketStamp(ticket: SupportTicket): number {
  const raw = ticket.updatedAt || ticket.createdAt;
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

export function formatTicketAge(iso: string | undefined, nowMs = Date.now()): string {
  if (!iso) return '—';
  const n = Date.parse(iso);
  if (!Number.isFinite(n)) return '—';
  const hours = Math.max(0, Math.floor((nowMs - n) / 3_600_000));
  if (hours < 1) return '< 1 h';
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

export function ticketIsStale(ticket: SupportTicket, nowMs = Date.now()): boolean {
  if (ticketQueue(ticket) !== 'support') return false;
  return nowMs - ticketStamp(ticket) >= 48 * 3_600_000;
}
