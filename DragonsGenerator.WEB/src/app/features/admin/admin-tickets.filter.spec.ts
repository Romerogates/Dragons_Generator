import { SupportTicket } from '@core/models/support-ticket';
import {
  filterAdminTickets,
  formatTicketAge,
  ticketIsStale,
  ticketMatchesSearch,
  ticketQueue,
} from './admin-tickets.filter';

function ticket(partial: Partial<SupportTicket>): SupportTicket {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    subject: 'PDF cassé',
    message: 'La fiche ne sort pas',
    status: 'open',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    userEmail: 'hero@dragons.local',
    category: 'bug',
    lastFromStaff: false,
    ...partial,
  };
}

describe('admin-tickets.filter', () => {
  it('keeps waiting-on-staff tickets in the staff queue', () => {
    const open = ticket({ id: '1', lastFromStaff: false });
    const waitingPlayer = ticket({ id: '2', status: 'in_progress', lastFromStaff: true });
    const closed = ticket({ id: '3', status: 'closed', lastFromStaff: true });
    expect(ticketQueue(open)).toBe('support');
    expect(ticketQueue(waitingPlayer)).toBe('player');
    const staff = filterAdminTickets([open, waitingPlayer, closed], {
      status: 'all',
      category: 'all',
      queue: 'staff',
      mine: false,
      search: '',
    });
    expect(staff.map((t) => t.id)).toEqual(['1']);
  });

  it('searches email subject and id, then sorts oldest staff first', () => {
    const newer = ticket({
      id: 'new',
      subject: 'IA muette',
      updatedAt: '2026-11-16T10:00:00Z',
      lastFromStaff: false,
    });
    const older = ticket({
      id: 'old',
      subject: 'IA encore',
      updatedAt: '2026-11-01T10:00:00Z',
      lastFromStaff: false,
    });
    expect(ticketMatchesSearch(newer, 'hero@')).toBeTrue();
    const list = filterAdminTickets([newer, older], {
      status: 'all',
      category: 'all',
      queue: 'all',
      mine: false,
      search: 'ia',
    });
    expect(list.map((t) => t.id)).toEqual(['old', 'new']);
  });

  it('formats age and flags stale staff tickets', () => {
    const now = Date.parse('2026-11-17T12:00:00Z');
    expect(formatTicketAge('2026-11-17T11:30:00Z', now)).toBe('< 1 h');
    expect(formatTicketAge('2026-11-16T12:00:00Z', now)).toBe('24 h');
    expect(formatTicketAge('2026-11-10T12:00:00Z', now)).toBe('7 j');
    expect(ticketIsStale(ticket({ lastFromStaff: false, updatedAt: '2026-11-10T12:00:00Z' }), now)).toBeTrue();
    expect(ticketIsStale(ticket({ lastFromStaff: true, updatedAt: '2026-11-10T12:00:00Z' }), now)).toBeFalse();
  });
});
