import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { GUIDE_ALL_NAV, GUIDE_BLOG_POSTS } from '@features/guide/guide-content';
import { AuthService } from './auth.service';

export type GuideAudiencePref = 'all' | 'dm' | 'player';

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
  /** true tant que l'utilisateur n'a pas choisi (ou ignoré) l'onboarding rôle MJ/joueur. */
  readonly needsRoleOnboarding = signal(false);
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
    if (!this.auth.isLoggedIn()) {
      this.readNewsIds.set({});
      this.readSectionIds.set({});
      this.audience.set('all');
      this.needsRoleOnboarding.set(false);
      return;
    }

    try {
      const remote = await firstValueFrom(
        this.http.get<GuidePreferencesDto>(`${this.api}/me/guide-preferences`),
      );
      this.readNewsIds.set(this.toRecord(remote.readNewsIds ?? []));
      this.readSectionIds.set(this.toRecord(remote.readSectionIds ?? []));
      this.audience.set(remote.audience ?? 'all');
      this.needsRoleOnboarding.set(remote.audience == null);
    } catch {
      /* garde l'état en mémoire — pas de repli localStorage */
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
    this.needsRoleOnboarding.set(false);
    this.schedulePersist();
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistNow(), 400);
  }

  private persistNow(): void {
    if (!this.auth.isLoggedIn()) return;
    const newsIds = Object.keys(this.readNewsIds());
    const sectionIds = Object.keys(this.readSectionIds());
    const aud = this.audience();
    void this.persistRemote(newsIds, sectionIds, aud);
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

  private toRecord(ids: string[]): Record<string, true> {
    return Object.fromEntries(ids.map((id) => [id, true as const]));
  }
}
