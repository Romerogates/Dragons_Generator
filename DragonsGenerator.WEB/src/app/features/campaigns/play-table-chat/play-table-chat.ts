import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiceRollComponent } from '@shared/components/dice-roll/dice-roll';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';

@Component({
  selector: 'app-play-table-chat',
  standalone: true,
  imports: [FormsModule, DiceRollComponent],
  templateUrl: './play-table-chat.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PlayTableChat {
  private readonly store = inject(CampaignPlaySessionStore);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly auth = inject(AuthService);

  /** Affiche la rangée macros MJ (hors combat). */
  readonly showMacros = input(false);
  readonly showThread = input(true);

  readonly macroPerception = output<void>();
  readonly macroNextTurn = output<void>();
  readonly macroEndCombat = output<void>();

  readonly tableChatDraft = signal('');
  readonly tableChatSending = signal(false);
  readonly tableChatOpen = signal(true);

  readonly isDm = this.store.isDm;
  readonly isSpectator = this.store.isSpectator;
  readonly tableChatMessages = this.store.tableChatMessages;
  readonly activeSession = this.store.activeSession;

  sendTableChat(): void {
    if (this.isSpectator()) return;
    const session = this.activeSession();
    const campaign = this.store.campaign();
    const body = this.tableChatDraft().trim();
    if (!session || !campaign || !body || this.tableChatSending()) return;
    this.tableChatSending.set(true);
    this.campaigns.postTableChat(campaign.id, { sessionId: session.id, body }).subscribe({
      next: () => {
        this.tableChatDraft.set('');
        this.tableChatSending.set(false);
      },
      error: () => {
        this.tableChatSending.set(false);
        this.store.setFeedback('err', 'Impossible d’envoyer le message.');
      },
    });
  }

  shareDiceRoll(faces: number, result: number, label?: string): void {
    if (this.isSpectator()) return;
    const session = this.activeSession();
    const campaign = this.store.campaign();
    if (!session || !campaign) return;
    const who = this.auth.user()?.displayName?.trim() || 'Joueur';
    const tag = label?.trim() ? ` (${label.trim()})` : '';
    const body = `🎲 ${who}${tag} : d${faces} → ${result}`;
    this.campaigns.postTableChat(campaign.id, { sessionId: session.id, body }).subscribe({
      error: () => this.store.setFeedback('err', 'Jet non partagé (fil de table).'),
    });
  }

  onSharedTableDie(result: number): void {
    this.shareDiceRoll(20, result, 'table');
  }

  /** Alias used by panel keyboard / shortcuts. */
  shareTableD20(result: number): void {
    this.onSharedTableDie(result);
  }

  formatTableChatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  pinTableMessage(body: string): void {
    if (!this.isDm()) return;
    const text = body.trim().slice(0, 280);
    if (!text) return;
    this.store.patchSession({ tablePin: text }, { immediate: true });
    this.store.setFeedback('ok', 'Message épinglé en haut du fil.');
  }

  clearTablePin(): void {
    if (!this.isDm()) return;
    this.store.patchSession({ tablePin: '' }, { immediate: true });
  }

  runTableMacro(kind: 'perception' | 'next_turn' | 'end_combat'): void {
    if (kind === 'perception') this.macroPerception.emit();
    else if (kind === 'next_turn') this.macroNextTurn.emit();
    else this.macroEndCombat.emit();
  }
}
