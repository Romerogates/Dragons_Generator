import { Injectable } from '@angular/core';
import type { CampaignData, CampaignHandout } from '@core/models/Campaign/campaign';

const CACHE_PREFIX = 'dragons-session-cache-';

export interface SessionCachePayload {
  campaignId: string;
  cachedAt: string;
  title: string;
  handouts: CampaignHandout[];
  pinnedHandout: CampaignHandout | null;
  nextSessionTitle?: string;
  nextSessionAt?: string;
}

@Injectable({ providedIn: 'root' })
export class CampaignSessionCacheService {
  cache(campaignId: string, title: string, data: CampaignData): void {
    if (typeof localStorage === 'undefined') return;
    const published = (data.handouts ?? []).filter((h) => h.published);
    const pinned = data.pinnedHandoutId
      ? published.find((h) => h.id === data.pinnedHandoutId) ?? null
      : null;
    const next = (data.sessions ?? [])
      .filter((s) => s.status === 'planned')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
    const payload: SessionCachePayload = {
      campaignId,
      cachedAt: new Date().toISOString(),
      title,
      handouts: published,
      pinnedHandout: pinned,
      nextSessionTitle: next?.title,
      nextSessionAt: next?.scheduledAt,
    };
    try {
      localStorage.setItem(`${CACHE_PREFIX}${campaignId}`, JSON.stringify(payload));
    } catch {
      /* ignore quota */
    }
  }

  read(campaignId: string): SessionCachePayload | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${campaignId}`);
      if (!raw) return null;
      return JSON.parse(raw) as SessionCachePayload;
    } catch {
      return null;
    }
  }

  clear(campaignId: string): void {
    try {
      localStorage.removeItem(`${CACHE_PREFIX}${campaignId}`);
    } catch {
      /* ignore */
    }
  }
}
