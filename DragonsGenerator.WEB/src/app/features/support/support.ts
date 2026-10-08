import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  viewChild,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '@env/environment';
import { AuthService } from '@core/services/auth.service';
import { CharacterCloudService, CloudCharacterSummary } from '@core/services/character-cloud.service';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CampaignSummary } from '@core/models/Campaign/campaign';
import { SupportTicket, SupportTicketThread } from '@core/models/support-ticket';
import { downloadTicketCharacterJson, openTicketAttachment } from '@core/utils/support-download.util';
import { supportStatusLabel } from '@core/utils/support-status.util';
import {
  SupportConversation,
  SupportReplyPayload,
} from '@shared/components/support-conversation/support-conversation';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SupportConversation],
  templateUrl: './support.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SupportPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly characters = inject(CharacterCloudService);
  private readonly campaignsApi = inject(CampaignCloudService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;
  private readonly convo = viewChild(SupportConversation);

  subject = '';
  message = '';
  characterId = '';
  campaignId = '';
  file: File | null = null;
  readonly fileName = signal('');

  readonly myCharacters = signal<CloudCharacterSummary[]>([]);
  readonly myCampaigns = signal<CampaignSummary[]>([]);
  readonly tickets = signal<SupportTicket[]>([]);
  readonly thread = signal<SupportTicketThread | null>(null);
  readonly selectedId = computed(() => this.thread()?.ticket?.id ?? null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly loading = signal(false);
  readonly sendingReply = signal(false);

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const subject = q.get('subject')?.trim();
    const message = q.get('message')?.trim();
    const ticket = q.get('ticket')?.trim();
    if (subject) this.subject = subject.slice(0, 200);
    if (message) this.message = message.slice(0, 4000);

    this.characters.list().subscribe((list) => this.myCharacters.set(list));
    this.campaignsApi.list().subscribe((list) =>
      this.myCampaigns.set(list.filter((c) => !c.isHistory)),
    );
    this.reload(ticket);
  }

  onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
    this.fileName.set(this.file?.name ?? '');
  }

  closeThread(): void {
    this.thread.set(null);
    this.error.set(null);
  }

  statusLabel(status: string): string {
    return supportStatusLabel(status, 'player');
  }

  reload(openId?: string | null): void {
    this.http.get<SupportTicket[]>(`${this.api}/support/tickets`).subscribe({
      next: (list) => {
        this.tickets.set(list);
        const id = openId || this.selectedId();
        if (id) this.openTicket(id);
      },
      error: () => this.tickets.set([]),
    });
  }

  openTicket(id: string): void {
    this.error.set(null);
    this.http.get<SupportTicketThread>(`${this.api}/support/tickets/${id}`).subscribe({
      next: (t) => this.thread.set(t),
      error: () => this.error.set('Impossible d’ouvrir ce ticket.'),
    });
  }

  onConversationSend(payload: SupportReplyPayload): void {
    const t = this.thread()?.ticket;
    if (!t) return;
    this.sendingReply.set(true);
    const fd = new FormData();
    fd.append('body', payload.body);
    if (payload.characterId) fd.append('characterId', payload.characterId);
    if (payload.campaignId) fd.append('campaignId', payload.campaignId);
    if (payload.file) fd.append('file', payload.file, payload.file.name);
    this.http.post(`${this.api}/support/tickets/${t.id}/messages`, fd).subscribe({
      next: () => {
        this.sendingReply.set(false);
        this.convo()?.clearReplyUi();
        this.reload(t.id);
      },
      error: () => {
        this.sendingReply.set(false);
        this.error.set('Réponse non envoyée.');
      },
    });
  }

  submit(): void {
    this.error.set(null);
    this.success.set(null);
    this.loading.set(true);
    const fd = new FormData();
    fd.append('subject', this.subject.trim());
    fd.append('message', this.message.trim());
    if (this.characterId) fd.append('characterId', this.characterId);
    if (this.campaignId) fd.append('campaignId', this.campaignId);
    if (this.file) fd.append('file', this.file, this.file.name);

    this.http.post<SupportTicket>(`${this.api}/support/tickets`, fd).subscribe({
      next: (created) => {
        this.loading.set(false);
        this.success.set('Ticket ouvert. Le support a été prévenu par mail.');
        this.subject = '';
        this.message = '';
        this.characterId = '';
        this.campaignId = '';
        this.file = null;
        this.fileName.set('');
        this.reload(created.id);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.errors?.[0]?.reason || 'Envoi impossible.');
      },
    });
  }

  onDownloadCharacter(ev: {
    ticket?: SupportTicket;
    message?: { id: string; characterId?: string; characterName?: string };
  }): void {
    const thread = this.thread();
    if (!thread) return;
    if (ev.message?.characterId) {
      downloadTicketCharacterJson(
        this.http,
        thread.ticket.id,
        ev.message.characterName ?? 'personnage',
        () => this.error.set('Impossible de télécharger le JSON du personnage.'),
        ev.message.id,
      );
      return;
    }
    const ticket = ev.ticket ?? thread.ticket;
    if (!ticket.characterId) return;
    downloadTicketCharacterJson(this.http, ticket.id, ticket.characterName ?? 'personnage', () =>
      this.error.set('Impossible de télécharger le JSON du personnage.'),
    );
  }

  onOpenAttachment(ev: {
    ticket?: SupportTicket;
    message?: { id: string; attachmentOriginalName?: string };
  }): void {
    const thread = this.thread();
    if (!thread) return;
    if (ev.message?.attachmentOriginalName) {
      openTicketAttachment(
        this.http,
        thread.ticket.id,
        () => this.error.set("Impossible d'ouvrir la pièce jointe."),
        ev.message.id,
      );
      return;
    }
    const ticket = ev.ticket ?? thread.ticket;
    if (!ticket.attachmentOriginalName) return;
    openTicketAttachment(this.http, ticket.id, () =>
      this.error.set("Impossible d'ouvrir la pièce jointe."),
    );
  }
}
