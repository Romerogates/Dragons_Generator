import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { GUIDE_BLOG_POSTS } from '@features/guide/guide-content';
import { AuthService } from './auth.service';

export type GuideAudiencePref = 'all' | 'dm' | 'player';

const READ_NEWS_KEY = 'dragons-guide-read-news';
const AUDIENCE_KEY = 'dragons-guide-audience';

interface GuidePreferencesDto {
  readNewsIds: string[];
  audience?: GuideAudiencePref | null;
}

@Injectable({ providedIn: 'root' })
export class GuidePreferencesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  readonly readNewsIds = signal<Record<string, true>>({});
  readonly audience = signal<GuideAudiencePref>('all');
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  readonly unreadCount = computed(() => {
    const read = this.readNewsIds();
    return GUIDE_BLOG_POSTS.filter((p) => !read[p.id]).length;
  });

  readonly readPosts = computed(() => {
    const read = this.readNewsIds();
    return GUIDE_BLOG_POSTS.filter((p) => read[p.id]);
  });

  async load(): Promise<void> {
    const localIds = this.loadLocalIds();
    const localAudience = this.loadLocalAudience();
    if (!this.auth.isLoggedIn()) {
      this.readNewsIds.set(this.toRecord(localIds));
      this.audience.set(localAudience);
      return;
    }

    try {
      const remote = await firstValueFrom(
        this.http.get<GuidePreferencesDto>(`${this.api}/me/guide-preferences`),
      );
      const remoteIds = remote.readNewsIds ?? [];
      const merged = [...new Set([...localIds, ...remoteIds])];
      const mergedAudience = remote.audience ?? localAudience;
      this.readNewsIds.set(this.toRecord(merged));
      this.audience.set(mergedAudience);
      const needsSync =
        merged.length !== remoteIds.length ||
        localIds.some((id) => !remoteIds.includes(id)) ||
        (remote.audience == null && localAudience !== 'all');
      if (needsSync) {
        await this.persistRemote(merged, mergedAudience);
      }
      if (localIds.length) this.clearLocalIds();
    } catch {
      this.readNewsIds.set(this.toRecord(localIds));
      this.audience.set(localAudience);
    }
  }

  markRead(newsId: string): void {
    if (this.readNewsIds()[newsId]) return;
    const nextIds = [...Object.keys(this.readNewsIds()), newsId];
    this.readNewsIds.update((current) => ({ ...current, [newsId]: true }));
    this.schedulePersist(nextIds, this.audience());
  }

  markUnread(newsId: string): void {
    const nextIds = Object.keys(this.readNewsIds()).filter((id) => id !== newsId);
    this.readNewsIds.set(this.toRecord(nextIds));
    this.schedulePersist(nextIds, this.audience());
  }

  markAll(ids: string[]): void {
    this.readNewsIds.set(this.toRecord(ids));
    this.schedulePersist(ids, this.audience());
  }

  setAudience(value: GuideAudiencePref): void {
    this.audience.set(value);
    try {
      localStorage.setItem(AUDIENCE_KEY, value);
    } catch {
      /* ignore */
    }
    this.schedulePersist(Object.keys(this.readNewsIds()), value);
  }

  private schedulePersist(ids: string[], aud: GuideAudiencePref): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(ids, aud), 400);
  }

  private persist(ids: string[], aud: GuideAudiencePref): void {
    if (this.auth.isLoggedIn()) {
      void this.persistRemote(ids, aud).catch(() => {
        this.saveLocalIds(ids);
        try {
          localStorage.setItem(AUDIENCE_KEY, aud);
        } catch {
          /* ignore */
        }
      });
    } else {
      this.saveLocalIds(ids);
      try {
        localStorage.setItem(AUDIENCE_KEY, aud);
      } catch {
        /* ignore */
      }
    }
  }

  private async persistRemote(ids: string[], aud: GuideAudiencePref): Promise<void> {
    await firstValueFrom(
      this.http.put<GuidePreferencesDto>(`${this.api}/me/guide-preferences`, {
        readNewsIds: ids,
        audience: aud,
      }),
    );
  }

  private loadLocalIds(): string[] {
    try {
      const raw = localStorage.getItem(READ_NEWS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private loadLocalAudience(): GuideAudiencePref {
    try {
      const raw = localStorage.getItem(AUDIENCE_KEY);
      if (raw === 'dm' || raw === 'player' || raw === 'all') return raw;
    } catch {
      /* ignore */
    }
    return 'all';
  }

  private saveLocalIds(ids: string[]): void {
    try {
      localStorage.setItem(READ_NEWS_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }

  private clearLocalIds(): void {
    try {
      localStorage.removeItem(READ_NEWS_KEY);
    } catch {
      /* ignore */
    }
  }

  private toRecord(ids: string[]): Record<string, true> {
    return Object.fromEntries(ids.map((id) => [id, true as const]));
  }
}
