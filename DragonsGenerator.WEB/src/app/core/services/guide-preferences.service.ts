import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { GUIDE_ALL_NAV, GUIDE_BLOG_POSTS } from '@features/guide/guide-content';
import { AuthService } from './auth.service';

export type GuideAudiencePref = 'all' | 'dm' | 'player';

const READ_NEWS_KEY = 'dragons-guide-read-news';
const READ_SECTIONS_KEY = 'dragons-guide-read-sections';
const AUDIENCE_KEY = 'dragons-guide-audience';

interface GuidePreferencesDto {
  readNewsIds: string[];
  readSectionIds: string[];
  audience?: GuideAudiencePref | null;
}

@Injectable({ providedIn: 'root' })
export class GuidePreferencesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  readonly readNewsIds = signal<Record<string, true>>({});
  readonly readSectionIds = signal<Record<string, true>>({});
  readonly audience = signal<GuideAudiencePref>('all');
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  readonly unreadNewsCount = computed(() => {
    const read = this.readNewsIds();
    return GUIDE_BLOG_POSTS.filter((p) => !read[p.id]).length;
  });

  readonly unreadSectionCount = computed(() => {
    const read = this.readSectionIds();
    const aud = this.audience();
    return GUIDE_ALL_NAV.filter((s) => {
      if (aud !== 'all' && s.audience !== 'all' && s.audience !== aud) return false;
      return !read[s.id];
    }).length;
  });

  readonly unreadCount = computed(() => this.unreadNewsCount() + this.unreadSectionCount());

  readonly readPosts = computed(() => {
    const read = this.readNewsIds();
    return GUIDE_BLOG_POSTS.filter((p) => read[p.id]);
  });

  isSectionUnread(sectionId: string): boolean {
    return !this.readSectionIds()[sectionId];
  }

  async load(): Promise<void> {
    const localNews = this.loadLocalArray(READ_NEWS_KEY);
    const localSections = this.loadLocalArray(READ_SECTIONS_KEY);
    const localAudience = this.loadLocalAudience();
    if (!this.auth.isLoggedIn()) {
      this.readNewsIds.set(this.toRecord(localNews));
      this.readSectionIds.set(this.toRecord(localSections));
      this.audience.set(localAudience);
      return;
    }

    try {
      const remote = await firstValueFrom(
        this.http.get<GuidePreferencesDto>(`${this.api}/me/guide-preferences`),
      );
      const remoteNews = remote.readNewsIds ?? [];
      const remoteSections = remote.readSectionIds ?? [];
      const mergedNews = [...new Set([...localNews, ...remoteNews])];
      const mergedSections = [...new Set([...localSections, ...remoteSections])];
      const mergedAudience = remote.audience ?? localAudience;
      this.readNewsIds.set(this.toRecord(mergedNews));
      this.readSectionIds.set(this.toRecord(mergedSections));
      this.audience.set(mergedAudience);
      const needsSync =
        mergedNews.length !== remoteNews.length ||
        mergedSections.length !== remoteSections.length ||
        localNews.some((id) => !remoteNews.includes(id)) ||
        localSections.some((id) => !remoteSections.includes(id)) ||
        (remote.audience == null && localAudience !== 'all');
      if (needsSync) {
        await this.persistRemote(mergedNews, mergedSections, mergedAudience);
      }
      if (localNews.length) this.clearLocalKey(READ_NEWS_KEY);
      if (localSections.length) this.clearLocalKey(READ_SECTIONS_KEY);
    } catch {
      this.readNewsIds.set(this.toRecord(localNews));
      this.readSectionIds.set(this.toRecord(localSections));
      this.audience.set(localAudience);
    }
  }

  markRead(newsId: string): void {
    if (this.readNewsIds()[newsId]) return;
    this.readNewsIds.update((current) => ({ ...current, [newsId]: true }));
    this.schedulePersist();
  }

  markUnread(newsId: string): void {
    const next = { ...this.readNewsIds() };
    delete next[newsId];
    this.readNewsIds.set(next);
    this.schedulePersist();
  }

  markAllNews(ids: string[]): void {
    this.readNewsIds.set(this.toRecord(ids));
    this.schedulePersist();
  }

  markSectionRead(sectionId: string): void {
    if (this.readSectionIds()[sectionId]) return;
    this.readSectionIds.update((current) => ({ ...current, [sectionId]: true }));
    this.schedulePersist();
  }

  setAudience(value: GuideAudiencePref): void {
    this.audience.set(value);
    try {
      localStorage.setItem(AUDIENCE_KEY, value);
    } catch {
      /* ignore */
    }
    this.schedulePersist();
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistNow(), 400);
  }

  private persistNow(): void {
    const newsIds = Object.keys(this.readNewsIds());
    const sectionIds = Object.keys(this.readSectionIds());
    const aud = this.audience();
    if (this.auth.isLoggedIn()) {
      void this.persistRemote(newsIds, sectionIds, aud).catch(() => {
        this.saveLocalArray(READ_NEWS_KEY, newsIds);
        this.saveLocalArray(READ_SECTIONS_KEY, sectionIds);
        try {
          localStorage.setItem(AUDIENCE_KEY, aud);
        } catch {
          /* ignore */
        }
      });
    } else {
      this.saveLocalArray(READ_NEWS_KEY, newsIds);
      this.saveLocalArray(READ_SECTIONS_KEY, sectionIds);
      try {
        localStorage.setItem(AUDIENCE_KEY, aud);
      } catch {
        /* ignore */
      }
    }
  }

  private async persistRemote(
    newsIds: string[],
    sectionIds: string[],
    aud: GuideAudiencePref,
  ): Promise<void> {
    await firstValueFrom(
      this.http.put<GuidePreferencesDto>(`${this.api}/me/guide-preferences`, {
        readNewsIds: newsIds,
        readSectionIds: sectionIds,
        audience: aud,
      }),
    );
  }

  private loadLocalArray(key: string): string[] {
    try {
      const raw = localStorage.getItem(key);
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

  private saveLocalArray(key: string, ids: string[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }

  private clearLocalKey(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  private toRecord(ids: string[]): Record<string, true> {
    return Object.fromEntries(ids.map((id) => [id, true as const]));
  }
}
