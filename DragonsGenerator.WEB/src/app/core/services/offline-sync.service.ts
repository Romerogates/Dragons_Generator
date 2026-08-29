import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, forkJoin, switchMap, map, catchError, tap } from 'rxjs';
import type { Character } from '@core/models/Character/character';
import { CampaignData, CampaignSummary } from '@core/models/Campaign/campaign';
import { AuthService } from './auth.service';
import { ConnectivityService } from './connectivity.service';
import { CharacterCloudService } from './character-cloud.service';
import { CampaignCloudService } from './campaign-cloud.service';

const QUEUE_KEY = 'dragons-offline-sync-queue';
const LOCAL_CAMPAIGNS_KEY = 'dragons-campaigns-local';

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

  queueCharacterSave(character: Character, updateExisting?: boolean): void {
    const queued: SyncQueueItem = {
      type: 'character-save',
      character: { ...character, cloudSynced: false },
      updateExisting,
      queuedAt: new Date().toISOString(),
    };
    this.pushQueue(queued);
    this.upsertLocalCharacter(queued.character);
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
    this.upsertLocalCampaign(record);
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
    const record = this.getLocalCampaign(id);
    if (record) {
      this.upsertLocalCampaign({
        ...record,
        title,
        data,
        cloudSynced: false,
        updatedAt: new Date().toISOString(),
      });
    }
    this.pushQueue({
      type: 'campaign-update',
      id,
      title,
      data,
      queuedAt: new Date().toISOString(),
    });
  }

  getLocalCampaignSummaries(): CampaignSummary[] {
    return this.readLocalCampaigns()
      .filter((c) => !c.cloudSynced)
      .map((c) => ({
        id: c.serverId ?? c.id,
        title: c.title,
        role: 'dm' as const,
        updatedAt: c.updatedAt,
        playerCount: 0,
        regionName: c.data.regionName ?? null,
        pendingSync: true,
        localId: c.id,
      }));
  }

  getLocalCampaign(id: string): LocalCampaignRecord | null {
    return (
      this.readLocalCampaigns().find((c) => c.id === id || c.serverId === id) ?? null
    );
  }

  /** Fusionne campagnes cloud + brouillons locaux non synchronisés. */
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
    this.flushSequential(queue, 0).subscribe({
      next: (remaining) => {
        this.writeQueue(remaining);
        this.refreshPendingCount();
        this.flushing.set(false);
        if (remaining.length === 0) {
          this.lastSyncMessage.set('Synchronisation terminée.');
        }
      },
      error: () => {
        this.flushing.set(false);
        this.refreshPendingCount();
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
        if (this.isRetryable(err)) {
          return of(queue.slice(index));
        }
        return this.flushSequential(queue, index + 1);
      }),
    );
  }

  private processItem(item: SyncQueueItem): Observable<void> {
    if (item.type === 'character-save') {
      return this.characters.save(item.character, { updateExisting: item.updateExisting }).pipe(
        tap((serverId) => {
          const updated = {
            ...item.character,
            id: serverId || item.character.id,
            cloudSynced: true,
          };
          this.upsertLocalCharacter(updated);
        }),
        map(() => undefined),
      );
    }

    if (item.type === 'campaign-create') {
      return this.campaigns.create(item.title, item.data).pipe(
        tap((summary) => {
          const local = this.getLocalCampaign(item.localId);
          if (local) {
            this.upsertLocalCampaign({
              ...local,
              cloudSynced: true,
              serverId: summary.id,
              updatedAt: summary.updatedAt ?? new Date().toISOString(),
            });
          }
        }),
        map(() => undefined),
      );
    }

    const campaignId = item.id;
    return this.campaigns.update(campaignId, item.title, item.data).pipe(
      tap((summary) => {
        const local = this.getLocalCampaign(campaignId);
        if (local) {
          this.upsertLocalCampaign({
            ...local,
            cloudSynced: true,
            serverId: summary.id,
            title: summary.title,
            updatedAt: summary.updatedAt ?? new Date().toISOString(),
          });
        }
      }),
      map(() => undefined),
    );
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof HttpErrorResponse) {
      return err.status === 0 || err.status >= 500;
    }
    return true;
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

  private upsertLocalCharacter(character: Character): void {
    let list: Character[] = [];
    try {
      const raw = localStorage.getItem('dragons-characters');
      list = raw ? JSON.parse(raw) : [];
    } catch {
      list = [];
    }
    const id = character.id;
    const idx = list.findIndex((c) => c.id === id);
    const withMeta = {
      ...character,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) list[idx] = withMeta;
    else list.push(withMeta);
    localStorage.setItem('dragons-characters', JSON.stringify(list));
  }

  private readLocalCampaigns(): LocalCampaignRecord[] {
    try {
      const raw = localStorage.getItem(LOCAL_CAMPAIGNS_KEY);
      return raw ? (JSON.parse(raw) as LocalCampaignRecord[]) : [];
    } catch {
      return [];
    }
  }

  private upsertLocalCampaign(record: LocalCampaignRecord): void {
    const list = this.readLocalCampaigns();
    const idx = list.findIndex((c) => c.id === record.id);
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(list));
  }
}
