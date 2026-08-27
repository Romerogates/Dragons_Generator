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
import { CharacterCloudService, CloudCharacterSummary } from '@core/services/character-cloud.service';
import { resolveApiAssetUrl } from '@core/utils/api-url.util';
import { downloadTicketCharacterJson } from '@core/utils/support-download.util';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  attachmentOriginalName?: string;
  attachmentUrl?: string;
  characterId?: string;
  characterName?: string;
  createdAt: string;
}

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SupportPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly characters = inject(CharacterCloudService);
  private readonly api = environment.apiUrl;

  subject = '';
  message = '';
  characterId = '';
  file: File | null = null;

  readonly myCharacters = signal<CloudCharacterSummary[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly loading = signal(false);

  readonly assetUrl = resolveApiAssetUrl;

  ngOnInit(): void {
    this.characters.list().subscribe((list) => this.myCharacters.set(list));
    this.reload();
  }

  onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
  }

  reload(): void {
    this.http.get<Ticket[]>(`${this.api}/support/tickets`).subscribe({
      next: (list) => this.tickets.set(list),
      error: () => this.tickets.set([]),
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
    if (this.file) fd.append('file', this.file, this.file.name);

    this.http.post<Ticket>(`${this.api}/support/tickets`, fd).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set('Ticket envoyé. Merci !');
        this.subject = '';
        this.message = '';
        this.characterId = '';
        this.file = null;
        this.reload();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.errors?.[0]?.reason || 'Envoi impossible.');
      },
    });
  }

  downloadCharacterJson(ticket: Ticket): void {
    if (!ticket.characterId) return;
    downloadTicketCharacterJson(this.http, ticket.id, ticket.characterName ?? 'personnage', () =>
      this.error.set('Impossible de télécharger le JSON du personnage.'),
    );
  }
}
