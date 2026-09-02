import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, switchMap, map, catchError } from 'rxjs';
import type { Character } from '@core/models/Character/character';
import { CampaignData, CampaignSummary } from '@core/models/Campaign/campaign';
import { AuthService } from './auth.service';
import { ConnectivityService } from './connectivity.service';
import { CharacterCloudService } from './character-cloud.service';
import { CampaignCloudService } from './campaign-cloud.service';
import { formatOfflineSyncError } from '@core/utils/offline-sync-error.util';

const QUEUE_KEY = 'dragons-offline-sync-queue';

export interface LocalCampaignRecord {
  id: string;
  title: string;
  data: CampaignData;
  cloudSynced: boolean;
  serverId?: string;
  updatedAt: string;
}

type SyncQueueItem =
  | {
      type: 'character-save';
      character: Character;
      updateExisting?: boolean;
      queuedAt: string;
    }
  | {
      type: 'campaign-create';
      localId: string;
      title: string;
      data: CampaignData;
      queuedAt: string;
      serverId?: string;
    }
  | {
      type: 'campaign-update';
      id: string;
      title: string;
      data: CampaignData;
      queuedAt: string;
    };

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly auth = inject(AuthService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly characters = inject(CharacterCloudService);
  private readonly campaigns = inject(CampaignCloudService);

  readonly flushing = signal(false);
  readonly pendingCount = signal(0);
  readonly lastSyncMessage = signal<string | null>(null);
  readonly lastSyncError = signal<string | null>(null);

  init(): void {
    this.refreshPendingCount();
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.flushIfPossible());
    if (this.auth.isLoggedIn() && this.connectivity.isOnline()) {
      this.flushIfPossible();
    }
  }

  refreshPendingCount(): void {
    this.pendingCount.set(this.readQueue().length);
  }

  getPendingCharacters(): Character[] {
    return this.readQueue()
      .filter((x): x is Extract<SyncQueueItem, { type: 'character-save' }> => x.type === 'character-save')
      .map((x) => x.character);
  }

  queueCharacterSave(character: Character, updateExisting?: boolean): void {
    const queued: SyncQueueItem = {
      type: 'character-save',
      character: { ...character, cloudSynced: false },
      updateExisting,
      queuedAt: new Date().toISOString(),
    };
    this.pushQueue(queued);
  }

  queueCampaignCreate(title: string, data: CampaignData): LocalCampaignRecord {
    const localId = crypto.randomUUID();
    const record: LocalCampaignRecord = {
      id: localId,
      title,
      data,
      cloudSynced: false,
      updatedAt: new Date().toISOString(),
    };
    this.pushQueue({
      type: 'campaign-create',
      localId,
      title,
      data,
      queuedAt: record.updatedAt,
    });
    return record;
  }

  queueCampaignUpdate(id: string, title: string, data: CampaignData): void {
    this.pushQueue({
      type: 'campaign-update',
      id,
      title,
      data,
      queuedAt: new Date().toISOString(),
    });
  }

  getLocalCampaignSummaries(): CampaignSummary[] {
    return this.readQueue()
      .filter(
        (x): x is Extract<SyncQueueItem, { type: 'campaign-create' }> => x.type === 'campaign-create',
      )
      .map((x) => ({
        id: x.serverId ?? x.localId,
        title: x.title,
        role: 'dm' as const,
        updatedAt: x.queuedAt,
        playerCount: 0,
        regionName: x.data.regionName ?? null,
        pendingSync: true,
        localId: x.localId,
      }));
  }

  getLocalCampaign(id: string): LocalCampaignRecord | null {
    const queue = this.readQueue();
    const create = queue.find(
      (x): x is Extract<SyncQueueItem, { type: 'campaign-create' }> =>
        x.type === 'campaign-create' && (x.localId === id || x.serverId === id),
    );
    if (create) {
      return {
        id: create.localId,
        title: create.title,
        data: create.data,
        cloudSynced: false,
        serverId: create.serverId,
        updatedAt: create.queuedAt,
      };
    }
    const update = queue.find(
      (x): x is Extract<SyncQueueItem, { type: 'campaign-update' }> =>
        x.type === 'campaign-update' && x.id === id,
    );
    if (update) {
      return {
        id: update.id,
        title: update.title,
        data: update.data,
        cloudSynced: false,
        serverId: update.id,
        updatedAt: update.queuedAt,
      };
    }
    return null;
  }

  mergeCampaignLists(cloud: CampaignSummary[]): CampaignSummary[] {
    const pending = this.getLocalCampaignSummaries().filter((p) => p.pendingSync);
    const cloudIds = new Set(cloud.map((c) => c.id));
    const extras = pending.filter((p) => !cloudIds.has(p.id));
    return [...extras, ...cloud];
  }

  flushIfPossible(): void {
    if (!this.auth.isLoggedIn() || !this.connectivity.isOnline() || this.flushing()) return;
    const queue = this.readQueue();
    if (!queue.length) return;

    this.flushing.set(true);
    this.lastSyncError.set(null);
    this.flushSequential(queue, 0).subscribe({
      next: (remaining) => {
        this.writeQueue(remaining);
        this.refreshPendingCount();
        this.flushing.set(false);
        if (remaining.length === 0) {
          this.lastSyncMessage.set('Synchronisation terminée.');
        } else if (!this.lastSyncError()) {
          this.lastSyncMessage.set(
            `${remaining.length} élément(s) restent en attente (réseau ou serveur).`,
          );
        }
      },
      error: () => {
        this.flushing.set(false);
        this.refreshPendingCount();
        this.lastSyncError.set('Synchronisation interrompue. Réessayez depuis les paramètres.');
      },
    });
  }

  private flushSequential(
    queue: SyncQueueItem[],
    index: number,
  ): Observable<SyncQueueItem[]> {
    if (index >= queue.length) return of([]);

    const item = queue[index];
    return this.processItem(item).pipe(
      switchMap(() => this.flushSequential(queue, index + 1)),
      catchError((err: unknown) => {
        this.lastSyncError.set(this.formatSyncError(item, err));
        return of(queue.slice(index));
      }),
    );
  }

  private processItem(item: SyncQueueItem): Observable<void> {
    if (item.type === 'character-save') {
      return this.characters.save(item.character, { updateExisting: item.updateExisting }).pipe(
        map(() => undefined),
      );
    }

    if (item.type === 'campaign-create') {
      return this.campaigns.create(item.title, item.data).pipe(map(() => undefined));
    }

    const campaignId = item.id;
    return this.campaigns.update(campaignId, item.title, item.data).pipe(map(() => undefined));
  }

  private formatSyncError(item: SyncQueueItem, err: unknown): string {
    if (item.type === 'character-save') {
      return formatOfflineSyncError(
        { type: 'character-save', name: item.character.name },
        err,
      );
    }
    if (item.type === 'campaign-create') {
      return formatOfflineSyncError({ type: 'campaign-create', title: item.title }, err);
    }
    return formatOfflineSyncError({ type: 'campaign-update', title: item.title }, err);
  }

  private pushQueue(item: SyncQueueItem): void {
    const q = this.readQueue();
    if (item.type === 'character-save') {
      const charId = item.character.id;
      const filtered = q.filter(
        (x) => !(x.type === 'character-save' && x.character.id === charId),
      );
      filtered.push(item);
      this.writeQueue(filtered);
    } else if (item.type === 'campaign-create') {
      const filtered = q.filter(
        (x) => !(x.type === 'campaign-create' && x.localId === item.localId),
      );
      filtered.push(item);
      this.writeQueue(filtered);
    } else {
      const filtered = q.filter(
        (x) => !(x.type === 'campaign-update' && x.id === item.id),
      );
      filtered.push(item);
      this.writeQueue(filtered);
    }
    this.refreshPendingCount();
  }

  private readQueue(): SyncQueueItem[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
    } catch {
      return [];
    }
  }

  private writeQueue(items: SyncQueueItem[]): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    this.refreshPendingCount();
  }
}
