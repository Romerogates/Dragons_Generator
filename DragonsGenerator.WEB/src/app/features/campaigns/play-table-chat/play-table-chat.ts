import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiceRollComponent } from '@shared/components/dice-roll/dice-roll';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import {
  DEFAULT_TABLE_MACROS,
  type TableMacroDef,
  type TableMacroKind,
} from '@core/models/Campaign/campaign';
import { applyTablePin, clearTablePinState } from '@core/utils/table-pin.util';
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
  private readonly connectivity = inject(ConnectivityService);

  /** Affiche la rangée macros MJ (hors combat). */
  readonly showMacros = input(false);
  readonly showThread = input(true);

  readonly macroPerception = output<void>();
  readonly macroNextTurn = output<void>();
  readonly macroEndCombat = output<void>();

  readonly tableChatDraft = signal('');
  readonly tableChatSending = signal(false);
  readonly tableChatOpen = signal(true);
  readonly pinHistoryOpen = signal(false);

  readonly isDm = this.store.isDm;
  readonly isSpectator = this.store.isSpectator;
  readonly tableChatMessages = this.store.tableChatMessages;
  readonly activeSession = this.store.activeSession;

  readonly tableMacros = computed((): TableMacroDef[] => {
    const custom = this.activeSession()?.tableMacros;
    return custom?.length ? custom : DEFAULT_TABLE_MACROS;
  });

  readonly pinHistory = computed(() => this.activeSession()?.tablePinHistory ?? []);

  sendTableChat(): void {
    if (this.isSpectator()) return;
    if (!this.connectivity.isOnline()) {
      this.store.setFeedback('err', 'Échec chat — vérifiez la connexion.');
      return;
    }
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
        this.store.setFeedback('err', 'Échec chat — vérifiez la connexion.');
      },
    });
  }

  shareDiceRoll(faces: number, result: number, label?: string): void {
    if (this.isSpectator()) return;
    if (!this.connectivity.isOnline()) {
      this.store.setFeedback('err', 'Échec chat — vérifiez la connexion.');
      return;
    }
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

  pinTableMessage(body: string, messageId?: string): void {
    if (!this.isDm()) return;
    const session = this.activeSession();
    if (!session) return;
    const patch = applyTablePin(session, body, messageId);
    if (!patch.tablePin) return;
    this.ensureMacrosPersisted();
    this.store.patchSession(patch, { immediate: true });
    this.store.setFeedback('ok', 'Message épinglé en haut du fil.');
  }

  clearTablePin(): void {
    if (!this.isDm()) return;
    const session = this.activeSession();
    if (!session) return;
    this.store.patchSession(clearTablePinState(session), { immediate: true });
  }

  restorePin(body: string): void {
    this.pinTableMessage(body);
  }

  /** Persiste les macros par défaut une fois pour partage multi-device. */
  ensureMacrosPersisted(): void {
    if (!this.isDm()) return;
    const session = this.activeSession();
    if (!session || session.tableMacros?.length) return;
    this.store.patchSession({ tableMacros: [...DEFAULT_TABLE_MACROS] }, { immediate: true });
  }

  runTableMacro(kind: TableMacroKind): void {
    this.ensureMacrosPersisted();
    if (kind === 'perception') this.macroPerception.emit();
    else if (kind === 'next_turn') this.macroNextTurn.emit();
    else this.macroEndCombat.emit();
  }
}
