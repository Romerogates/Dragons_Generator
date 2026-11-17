import { Injectable, InjectionToken, OnDestroy, effect, inject, signal } from '@angular/core';
import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

export type CampaignLiveReason = 'campaign' | 'initiative' | 'combat' | 'xp' | string;
export type CampaignLiveSurface = 'play' | 'hub';

export interface CampaignLiveUpdate {
  campaignId: string;
  updatedAt: string;
  reason: CampaignLiveReason;
}

export interface CampaignPresenceUser {
  userId: string;
  displayName: string;
  role: string;
  atPlay: boolean;
}

/** Factory injectable pour les tests (mock HubConnection). */
export const CAMPAIGN_LIVE_HUB_FACTORY = new InjectionToken<(url: string) => HubConnection>(
  'CAMPAIGN_LIVE_HUB_FACTORY',
);

/**
 * Sync temps réel table (SignalR) — combat / fog / init / XP.
 * Fallback poll reste côté pages si {@link connected} est false.
 */
@Injectable({ providedIn: 'root' })
export class CampaignLiveService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly hubFactory =
    inject(CAMPAIGN_LIVE_HUB_FACTORY, { optional: true }) ?? defaultHubFactory;

  private connection: HubConnection | null = null;
  private watchId: string | null = null;
  private hubRefs = 0;
  private playRefs = 0;
  private startPromise: Promise<void> | null = null;
  private readonly updatesSubject = new Subject<CampaignLiveUpdate>();

  /** Connexion hub établie (poll peut ralentir). */
  readonly connected = signal(false);
  /** Sièges connectés à la campagne actuellement watchée. */
  readonly presence = signal<CampaignPresenceUser[]>([]);

  constructor() {
    effect(() => {
      if (!this.auth.user()) void this.teardown();
    });
  }

  ngOnDestroy(): void {
    void this.teardown();
  }

  /** Flux des mises à jour pour une campagne (ou toutes si id omis). */
  updates(campaignId?: string): Observable<CampaignLiveUpdate> {
    return this.updatesSubject.asObservable().pipe(
      filter((u) => !campaignId || u.campaignId === campaignId),
    );
  }

  /** Rejoint le groupe campagne ; reconnect auto via SignalR. */
  async watch(campaignId: string, surface: CampaignLiveSurface = 'hub'): Promise<void> {
    if (!campaignId || !this.auth.isLoggedIn()) return;
    if (this.watchId && this.watchId !== campaignId) {
      await this.forceLeave();
    }
    if (surface === 'play') this.playRefs += 1;
    else this.hubRefs += 1;
    this.watchId = campaignId;
    await this.ensureConnected();
    await this.invokeJoin();
  }

  async unwatch(surface: CampaignLiveSurface = 'hub'): Promise<void> {
    if (surface === 'play') this.playRefs = Math.max(0, this.playRefs - 1);
    else this.hubRefs = Math.max(0, this.hubRefs - 1);
    if (this.playRefs + this.hubRefs > 0) {
      await this.invokeJoin();
      return;
    }
    await this.forceLeave();
  }

  private currentSurface(): CampaignLiveSurface {
    return this.playRefs > 0 ? 'play' : 'hub';
  }

  private async invokeJoin(): Promise<void> {
    const id = this.watchId;
    if (!id || this.connection?.state !== HubConnectionState.Connected) return;
    try {
      await this.connection.invoke('JoinCampaign', id, this.currentSurface());
    } catch {
      this.connected.set(false);
    }
  }

  private async forceLeave(): Promise<void> {
    const id = this.watchId;
    this.watchId = null;
    this.hubRefs = 0;
    this.playRefs = 0;
    this.presence.set([]);
    if (id && this.connection?.state === HubConnectionState.Connected) {
      try {
        await this.connection.invoke('LeaveCampaign', id);
      } catch {
        /* ignore */
      }
    }
  }

  /** Intervalle de secours : 30 s si hub OK, sinon poll agressif. */
  fallbackPollMs(aggressiveMs: number, connectedMs = 30_000): number {
    return this.connected() ? connectedMs : aggressiveMs;
  }

  private async ensureConnected(): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected) return;
    if (this.startPromise) {
      await this.startPromise;
      return;
    }
    this.startPromise = this.startConnection();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async startConnection(): Promise<void> {
    if (!this.connection) {
      this.connection = this.hubFactory(`${environment.apiUrl}/hubs/campaign-live`);

      this.connection.on('campaignUpdated', (payload: CampaignLiveUpdate) => {
        if (!payload?.campaignId) return;
        this.updatesSubject.next({
          campaignId: String(payload.campaignId),
          updatedAt: payload.updatedAt ?? '',
          reason: payload.reason ?? 'campaign',
        });
      });

      this.connection.on(
        'presenceUpdated',
        (payload: { campaignId?: string; users?: CampaignPresenceUser[] }) => {
          if (!payload?.campaignId || payload.campaignId !== this.watchId) return;
          this.presence.set(Array.isArray(payload.users) ? payload.users : []);
        },
      );

      this.connection.onreconnecting(() => this.connected.set(false));
      this.connection.onreconnected(() => {
        this.connected.set(true);
        void this.invokeJoin();
      });
      this.connection.onclose(() => {
        this.connected.set(false);
        this.presence.set([]);
      });
    }

    if (this.connection.state === HubConnectionState.Disconnected) {
      try {
        await this.connection.start();
        this.connected.set(true);
      } catch {
        this.connected.set(false);
      }
    }
  }

  private async teardown(): Promise<void> {
    this.watchId = null;
    this.hubRefs = 0;
    this.playRefs = 0;
    this.presence.set([]);
    this.connected.set(false);
    const conn = this.connection;
    this.connection = null;
    if (!conn) return;
    try {
      await conn.stop();
    } catch {
      /* ignore */
    }
  }
}

function defaultHubFactory(url: string): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(url, {
      withCredentials: true,
      transport:
        HttpTransportType.WebSockets |
        HttpTransportType.ServerSentEvents |
        HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Error)
    .build();
}
