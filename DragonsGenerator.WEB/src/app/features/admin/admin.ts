import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { downloadTicketCharacterJson, openTicketAttachment } from '@core/utils/support-download.util';

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
  adminNotes?: string;
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
  private readonly api = environment.apiUrl;

  readonly tab = signal<'users' | 'tickets'>('users');
  readonly users = signal<AdminUser[]>([]);
  readonly tickets = signal<AdminTicket[]>([]);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  /** Édition locale par user id */
  edits: Record<
    string,
    { email: string; displayName: string; role: string; newPassword: string; emailConfirmed: boolean }
  > = {};

  ngOnInit(): void {
    this.loadUsers();
    this.loadTickets();
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

  loadTickets(): void {
    this.http.get<AdminTicket[]>(`${this.api}/admin/support/tickets`).subscribe({
      next: (list) => this.tickets.set(list),
      error: () => {},
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
    this.http.post(`${this.api}/admin/users/${id}/send-reset-email`, {}).subscribe({
      next: (res: any) => this.message.set(res?.message || 'Email envoyé.'),
      error: (err) =>
        this.error.set(err?.error?.errors?.[0]?.reason || "Échec d'envoi email."),
    });
  }

  setTicketStatus(id: string, status: string): void {
    this.http.patch(`${this.api}/admin/support/tickets/${id}`, { status }).subscribe({
      next: () => this.loadTickets(),
    });
  }

  downloadCharacterJson(ticket: AdminTicket): void {
    if (!ticket.characterId) return;
    downloadTicketCharacterJson(this.http, ticket.id, ticket.characterName ?? 'personnage', () =>
      this.error.set('Impossible de télécharger le JSON du personnage.'),
    );
  }

  openAttachment(ticket: AdminTicket): void {
    if (!ticket.attachmentUrl) return;
    openTicketAttachment(this.http, ticket.id, () =>
      this.error.set('Impossible d\'ouvrir la pièce jointe.'),
    );
  }
}
