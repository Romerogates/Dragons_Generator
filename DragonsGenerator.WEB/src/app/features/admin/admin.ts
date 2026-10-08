import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '@env/environment';
import { downloadTicketCharacterJson, openTicketAttachment } from '@core/utils/support-download.util';
import { supportStatusLabel } from '@core/utils/support-status.util';

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastLoginAt?: string;
  characterCount: number;
  passwordStatus: string;
}

interface AdminTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  userEmail?: string;
  attachmentOriginalName?: string;
  attachmentUrl?: string;
  characterId?: string;
  characterName?: string;
  createdAt: string;
  updatedAt?: string;
  adminNotes?: string;
  messageCount?: number;
}

interface TicketMessage {
  id: string;
  fromStaff: boolean;
  body: string;
  createdAt: string;
  characterName?: string;
  attachmentOriginalName?: string;
}

interface HostBackupFile {
  name: string;
  size: number;
  modified: string;
}

interface InboxMail {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
}

interface TicketThread {
  ticket: AdminTicket;
  messages: TicketMessage[];
}

interface OpsEvent {
  id: string;
  kind: string;
  title: string;
  detail: string;
  createdAt: string;
}

interface CronRow {
  name: string;
  schedule: string;
  lastKind: string;
}

interface OutboundEmail {
  id: string;
  toEmail: string;
  fromEmail: string;
  subject: string;
  htmlBody: string;
  status: string;
  error?: string | null;
  createdAt: string;
}

interface Overview {
  users: number;
  confirmedUsers: number;
  campaigns: number;
  ticketsOpen: number;
  ticketsInProgress: number;
  ticketsClosed: number;
  remindersLast24h: number;
  lastBackup: OpsEvent | null;
  lastAlert: OpsEvent | null;
  recentOps: OpsEvent[];
  crons: CronRow[];
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AdminPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = environment.apiUrl;

  readonly tab = signal<'overview' | 'tickets' | 'ops' | 'mails' | 'users'>('overview');
  readonly users = signal<AdminUser[]>([]);
  readonly tickets = signal<AdminTicket[]>([]);
  readonly overview = signal<Overview | null>(null);
  readonly outboundEmails = signal<OutboundEmail[]>([]);
  readonly selectedMail = signal<OutboundEmail | null>(null);
  readonly hostBackups = signal<HostBackupFile[]>([]);
  readonly inboxMails = signal<InboxMail[]>([]);
  readonly thread = signal<TicketThread | null>(null);
  readonly selectedId = computed(() => this.thread()?.ticket?.id ?? null);
  readonly diagnostic = signal<string>('');
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  replyBody = '';
  adminNotesDraft = '';

  edits: Record<
    string,
    { email: string; displayName: string; role: string; newPassword: string; emailConfirmed: boolean }
  > = {};

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const tab = q.get('tab');
    if (tab === 'tickets' || tab === 'ops' || tab === 'mails' || tab === 'users' || tab === 'overview')
      this.tab.set(tab);
    this.loadUsers();
    this.loadTickets(q.get('ticket'));
    this.loadOverview();
    if (this.tab() === 'mails') this.loadMails();
    if (this.tab() === 'ops') this.loadHostBackups();
  }

  setTab(tab: 'overview' | 'tickets' | 'ops' | 'mails' | 'users'): void {
    this.tab.set(tab);
    void this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge' });
    if (tab === 'overview' || tab === 'ops') this.loadOverview();
    if (tab === 'ops') this.loadHostBackups();
    if (tab === 'mails') this.loadMails();
  }

  loadMails(): void {
    this.loadOutboundEmails();
    this.http.get<InboxMail[]>(`${this.api}/admin/ops/inbox`).subscribe({
      next: (list) => this.inboxMails.set(list),
      error: () => this.inboxMails.set([]),
    });
  }

  loadHostBackups(): void {
    this.http.get<HostBackupFile[]>(`${this.api}/admin/ops/backups`).subscribe({
      next: (list) => this.hostBackups.set(list),
      error: () => this.hostBackups.set([]),
    });
  }

  downloadBackup(name: string): void {
    this.http.get(`${this.api}/admin/ops/backups/${encodeURIComponent(name)}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Téléchargement backup impossible.'),
    });
  }

  loadOutboundEmails(): void {
    this.http.get<OutboundEmail[]>(`${this.api}/admin/outbound-emails`).subscribe({
      next: (list) => {
        this.outboundEmails.set(list);
        const current = this.selectedMail();
        if (current) {
          const still = list.find((m) => m.id === current.id);
          this.selectedMail.set(still ?? null);
        }
      },
      error: () => this.error.set('Impossible de charger les mails envoyés.'),
    });
  }

  loadOverview(): void {
    this.http.get<Overview>(`${this.api}/admin/ops/overview`).subscribe({
      next: (o) => this.overview.set(o),
      error: () => this.error.set('Impossible de charger le tableau ops.'),
    });
  }

  loadUsers(): void {
    this.http.get<AdminUser[]>(`${this.api}/admin/users`).subscribe({
      next: (list) => {
        this.users.set(list);
        for (const u of list) {
          this.edits[u.id] = {
            email: u.email,
            displayName: u.displayName,
            role: u.role,
            newPassword: '',
            emailConfirmed: u.emailConfirmed,
          };
        }
      },
      error: () => this.error.set('Impossible de charger les utilisateurs (droits admin ?).'),
    });
  }

  loadTickets(openId?: string | null): void {
    this.http.get<AdminTicket[]>(`${this.api}/admin/support/tickets`).subscribe({
      next: (list) => {
        this.tickets.set(list);
        const id = openId || this.selectedId();
        if (id) this.openTicket(id);
      },
      error: () => {},
    });
  }

  openTicket(id: string): void {
    this.http.get<TicketThread>(`${this.api}/support/tickets/${id}`).subscribe({
      next: (t) => {
        this.thread.set(t);
        this.adminNotesDraft = t.ticket.adminNotes ?? '';
        this.tab.set('tickets');
      },
    });
  }

  takeTicket(id: string): void {
    this.http.patch(`${this.api}/admin/support/tickets/${id}`, { status: 'in_progress' }).subscribe({
      next: () => {
        this.message.set('Mail envoyé : nous consultons la situation.');
        this.loadTickets(id);
      },
    });
  }

  setTicketStatus(id: string, status: string): void {
    this.http.patch(`${this.api}/admin/support/tickets/${id}`, { status }).subscribe({
      next: () => this.loadTickets(id),
    });
  }

  saveNotes(id: string): void {
    this.http
      .patch(`${this.api}/admin/support/tickets/${id}`, { adminNotes: this.adminNotesDraft })
      .subscribe({ next: () => this.message.set('Notes internes enregistrées.') });
  }

  sendReply(): void {
    const t = this.thread()?.ticket;
    const body = this.replyBody.trim();
    if (!t || body.length < 2) return;
    const fd = new FormData();
    fd.append('body', body);
    this.http.post(`${this.api}/support/tickets/${t.id}/messages`, fd).subscribe({
      next: () => {
        this.replyBody = '';
        this.message.set('Réponse envoyée au joueur (mail + fil).');
        this.loadTickets(t.id);
      },
      error: () => this.error.set('Réponse non envoyée.'),
    });
  }

  copyDiagnostic(ticketId?: string): void {
    const q = ticketId ? `?ticketId=${ticketId}` : '';
    this.http.get<{ markdown: string }>(`${this.api}/admin/ops/diagnostic${q}`).subscribe({
      next: (res) => {
        this.diagnostic.set(res.markdown);
        void navigator.clipboard.writeText(res.markdown);
        this.message.set('Pack diagnostic copié — colle-le dans Cursor.');
      },
      error: () => this.error.set('Diagnostic indisponible.'),
    });
  }

  saveUser(id: string): void {
    const e = this.edits[id];
    if (!e) return;
    this.message.set(null);
    this.error.set(null);
    const body: Record<string, unknown> = {
      email: e.email,
      displayName: e.displayName,
      role: e.role,
      emailConfirmed: e.emailConfirmed,
    };
    if (e.newPassword.trim()) body['newPassword'] = e.newPassword.trim();

    this.http.put(`${this.api}/admin/users/${id}`, body).subscribe({
      next: () => {
        this.message.set('Utilisateur mis à jour.');
        e.newPassword = '';
        this.loadUsers();
      },
      error: (err) =>
        this.error.set(err?.error?.errors?.[0]?.reason || 'Mise à jour impossible.'),
    });
  }

  sendReset(id: string): void {
    this.message.set(null);
    this.http.post<{ message?: string }>(`${this.api}/admin/users/${id}/send-reset-email`, {}).subscribe({
      next: (res) => this.message.set(res?.message || 'Email envoyé.'),
      error: (err: { error?: { errors?: { reason?: string }[] } }) =>
        this.error.set(err?.error?.errors?.[0]?.reason || "Échec d'envoi email."),
    });
  }

  downloadCharacterJson(ticket: AdminTicket): void {
    if (!ticket.characterId) return;
    downloadTicketCharacterJson(this.http, ticket.id, ticket.characterName ?? 'personnage', () =>
      this.error.set('Impossible de télécharger le JSON du personnage.'),
    );
  }

  openAttachment(ticket: AdminTicket): void {
    if (!ticket.attachmentUrl && !ticket.attachmentOriginalName) return;
    openTicketAttachment(this.http, ticket.id, () =>
      this.error.set('Impossible d\'ouvrir la pièce jointe.'),
    );
  }

  statusLabel(status: string): string {
    return supportStatusLabel(status, 'staff');
  }
}
