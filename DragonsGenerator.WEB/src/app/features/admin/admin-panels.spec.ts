import { TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import type { SupportTicket } from '@core/models/support-ticket';
import { AdminTicketsPanel } from './admin-tickets/admin-tickets';
import { AdminOpsPanel } from './admin-ops/admin-ops';
import { AdminMailsPanel } from './admin-mails/admin-mails';
import { AdminUsersPanel } from './admin-users/admin-users';
import type {
  AdminUser,
  AdminUserEdit,
  HostBackupFile,
  InboxMail,
  OutboundEmail,
  Overview,
} from './admin.types';

function ticket(partial: Partial<SupportTicket> = {}): SupportTicket {
  return {
    id: 't1',
    subject: 'PDF cassé',
    message: 'fiche',
    status: 'open',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    userEmail: 'hero@dragons.local',
    category: 'bug',
    lastFromStaff: false,
    messageCount: 2,
    ...partial,
  };
}

const overview: Overview = {
  users: 3,
  confirmedUsers: 2,
  campaigns: 1,
  ticketsOpen: 1,
  ticketsInProgress: 0,
  ticketsClosed: 4,
  remindersLast24h: 0,
  lastBackup: { id: 'b', kind: 'backup', title: 'ok', detail: 'sqlite', createdAt: '2026-11-18T03:00:00Z' },
  lastAlert: { id: 'a', kind: 'alert', title: 'retard', detail: '36h', createdAt: '2026-11-18T08:00:00Z' },
  recentOps: [{ id: 'e1', kind: 'backup', title: 'copie', detail: 'ok', createdAt: '2026-11-18T03:00:00Z' }],
  crons: [
    { name: 'backup', schedule: '0 3 * * *', lastKind: 'backup' },
    { name: 'alert', schedule: '0 8 * * *', lastKind: 'alert' },
    { name: 'idle', schedule: '0 0 * * *', lastKind: 'none' },
  ],
};

describe('admin tab panels', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminTicketsPanel, AdminOpsPanel, AdminMailsPanel, AdminUsersPanel],
      providers: [...zonelessTestProviders],
    });
  });

  it('tickets : file vide, sélection, pack diagnostic et libellés', () => {
    const fixture = TestBed.createComponent(AdminTicketsPanel);
    fixture.componentRef.setInput('tickets', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucun ticket');

    const stale = ticket({
      id: 'stale',
      updatedAt: '2020-01-01T00:00:00Z',
      status: 'in_progress',
    });
    fixture.componentRef.setInput('tickets', [ticket(), stale]);
    fixture.componentRef.setInput('selectedId', 't1');
    fixture.componentRef.setInput('diagnostic', '# pack');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('PDF cassé');
    expect(text).toContain('# pack');
    const c = fixture.componentInstance;
    expect(c.waitingLabel(ticket())).toContain('traiter');
    expect(c.isStale(stale)).toBeTrue();
    expect(c.statusLabel('open').length).toBeGreaterThan(0);
    expect(c.statusBadgeClass('closed').length).toBeGreaterThan(0);
    expect(c.categoryLabel('bug').length).toBeGreaterThan(0);

    spyOn(c.openTicket, 'emit');
    spyOn(c.copyDiagnostic, 'emit');
    const ticketBtn = fixture.nativeElement.querySelector('button.text-left') as HTMLButtonElement;
    ticketBtn.click();
    expect(c.openTicket.emit).toHaveBeenCalledWith('t1');
    const pack = fixture.nativeElement.querySelector('button.ml-3') as HTMLButtonElement;
    pack.click();
    expect(c.copyDiagnostic.emit).toHaveBeenCalledWith('t1');
  });

  it('ops : crons, backups vides puis fichier à télécharger', () => {
    const fixture = TestBed.createComponent(AdminOpsPanel);
    fixture.componentRef.setInput('overview', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Crons VPS');

    fixture.componentRef.setInput('overview', overview);
    fixture.componentRef.setInput('hostBackups', [] as HostBackupFile[]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Crons VPS');
    expect(fixture.nativeElement.textContent).toContain('Aucun fichier');

    const files: HostBackupFile[] = [
      { name: 'dragons.db', size: 12, modified: '2026-11-18T03:00:00Z' },
    ];
    fixture.componentRef.setInput('hostBackups', files);
    fixture.detectChanges();
    spyOn(fixture.componentInstance.downloadBackup, 'emit');
    const dl = [...fixture.nativeElement.querySelectorAll('button')].find((b: HTMLButtonElement) =>
      b.textContent?.includes('Télécharger'),
    );
    dl.click();
    expect(fixture.componentInstance.downloadBackup.emit).toHaveBeenCalledWith('dragons.db');
  });

  it('mails : boîtes vides puis aperçu HTML', () => {
    const fixture = TestBed.createComponent(AdminMailsPanel);
    fixture.componentRef.setInput('inboxMails', [] as InboxMail[]);
    fixture.componentRef.setInput('outboundEmails', [] as OutboundEmail[]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucun mail IMAP');
    expect(fixture.nativeElement.textContent).toContain('Aucun mail enregistré');

    const sent: OutboundEmail = {
      id: 'm1',
      toEmail: 'a@b.c',
      fromEmail: 'site@x',
      subject: 'Bienvenue',
      htmlBody: '<p>ok</p>',
      status: 'sent',
      createdAt: '2026-11-18T10:00:00Z',
    };
    const failed: OutboundEmail = { ...sent, id: 'm2', status: 'error', error: 'smtp' };
    fixture.componentRef.setInput('inboxMails', [
      { id: 'i1', from: 'x', to: 'y', subject: 'Hello', snippet: 'snip', date: '2026-11-18T09:00:00Z' },
    ]);
    fixture.componentRef.setInput('outboundEmails', [sent, failed]);
    fixture.detectChanges();
    const mailBtns = fixture.nativeElement.querySelectorAll('button');
    mailBtns[0].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Bienvenue');
    expect(fixture.nativeElement.querySelector('[data-testid="admin-outbound-mail"]')).toBeTruthy();
    mailBtns[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('smtp');
  });

  it('users : édition et actions', () => {
    const fixture = TestBed.createComponent(AdminUsersPanel);
    const user: AdminUser = {
      id: 'u1',
      email: 'test@dragons.local',
      displayName: 'Test',
      role: 'User',
      emailConfirmed: true,
      createdAt: '2026-01-01T00:00:00Z',
      characterCount: 1,
      passwordStatus: 'ok',
      disabled: false,
    };
    const edits: Record<string, AdminUserEdit> = {
      u1: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        newPassword: '',
        emailConfirmed: true,
        disabled: false,
      },
    };
    fixture.componentRef.setInput('users', [user]);
    fixture.componentRef.setInput('edits', edits);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Test');
    spyOn(fixture.componentInstance.saveUser, 'emit');
    spyOn(fixture.componentInstance.sendReset, 'emit');
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    buttons[1].click();
    expect(fixture.componentInstance.saveUser.emit).toHaveBeenCalledWith('u1');
    expect(fixture.componentInstance.sendReset.emit).toHaveBeenCalledWith('u1');
  });
});
