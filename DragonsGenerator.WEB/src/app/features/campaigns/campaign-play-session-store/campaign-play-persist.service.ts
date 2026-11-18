import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import type { CampaignData, CampaignDetail } from '@core/models/Campaign/campaign';
import { stripTableChatForPersist } from '@core/utils/campaign-persist.util';
import type { LiveTablePersistBody } from '@core/utils/live-table-persist.util';

export type CampaignPlayPersistHost = {
  getCampaign: () => CampaignDetail | null;
  applyCampaign: (next: CampaignDetail) => void;
  setSaving: (value: boolean) => void;
  onPersistError: () => void;
};

/**
 * File unique PUT / PATCH live-table. Le store reste le seul à muter l’état local.
 */
@Injectable()
export class CampaignPlayPersistService {
  private readonly campaigns = inject(CampaignCloudService);
  private host: CampaignPlayPersistHost | null = null;
  private persistSeq = 0;
  private persistTail: Promise<void> = Promise.resolve();

  attach(host: CampaignPlayPersistHost): void {
    this.host = host;
  }

  whenIdle(): Promise<void> {
    return this.persistTail.catch(() => undefined);
  }

  persistFull(title: string, data: CampaignData, onSuccess?: () => void): void {
    const host = this.host;
    const c = host?.getCampaign();
    if (!host || !c) return;
    const campaignId = c.id;
    const seq = ++this.persistSeq;
    host.setSaving(true);
    const payload = stripTableChatForPersist(data);

    this.persistTail = this.persistTail
      .catch(() => undefined)
      .then(async () => {
        try {
          const summary = await firstValueFrom(this.campaigns.update(campaignId, title, payload));
          if (seq !== this.persistSeq) return;
          const current = host.getCampaign();
          if (!current) return;
          host.applyCampaign({ ...current, updatedAt: summary.updatedAt });
          host.setSaving(false);
          onSuccess?.();
        } catch {
          if (seq === this.persistSeq) {
            host.setSaving(false);
            host.onPersistError();
          }
        }
      });
  }

  persistLiveTable(body: LiveTablePersistBody, onSuccess?: () => void): void {
    const host = this.host;
    const c = host?.getCampaign();
    if (!host || !c) return;
    const campaignId = c.id;
    const seq = ++this.persistSeq;
    host.setSaving(true);

    this.persistTail = this.persistTail
      .catch(() => undefined)
      .then(async () => {
        try {
          const summary = await firstValueFrom(this.campaigns.patchLiveTable(campaignId, body));
          if (seq !== this.persistSeq) return;
          const current = host.getCampaign();
          if (!current) return;
          host.applyCampaign({ ...current, updatedAt: summary.updatedAt });
          host.setSaving(false);
          onSuccess?.();
        } catch {
          if (seq === this.persistSeq) {
            host.setSaving(false);
            host.onPersistError();
          }
        }
      });
  }
}
