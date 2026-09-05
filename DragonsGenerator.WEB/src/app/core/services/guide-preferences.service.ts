import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
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

const VETERAN_MS = 86_400_000;

/** Compte assez ancien pour ne pas tout re-marquer « new » si le serveur n’a encore aucune lecture. */
export function shouldAcknowledgeEmptyGuideCatalog(
  memberSince: string | undefined | null,
  now = Date.now(),
): boolean {
  if (!memberSince) return true;
  const t = Date.parse(memberSince);
  if (Number.isNaN(t)) return true;
  return now - t > VETERAN_MS;
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
  /** false tant que le GET n’a pas abouti — évite un badge +9 fantôme au login. */
  readonly hydrated = signal(false);
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private loadGen = 0;

  readonly unreadNewsCount = computed(() => {
    if (!this.hydrated()) return 0;
    const read = this.readNewsIds();
    return GUIDE_BLOG_POSTS.filter((p) => p.isNew && !read[p.id]).length;
  });

  readonly unreadSectionCount = computed(() => {
    if (!this.hydrated()) return 0;
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

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        untracked(() => void this.load());
      } else {
        this.resetAnonymous();
      }
    });
  }

  isSectionUnread(sectionId: string): boolean {
    if (!this.hydrated()) return false;
    return !this.readSectionIds()[sectionId];
  }

  async load(): Promise<void> {
    const gen = ++this.loadGen;
    if (!this.auth.isLoggedIn()) {
      this.resetAnonymous();
      return;
    }

    this.hydrated.set(false);
    try {
      const remote = await firstValueFrom(
        this.http.get<GuidePreferencesDto>(`${this.api}/me/guide-preferences`),
      );
      if (gen !== this.loadGen) return;

      const newsIds = remote.readNewsIds ?? [];
      const sectionIds = remote.readSectionIds ?? [];
      this.audience.set(remote.audience ?? 'all');
      this.needsRoleOnboarding.set(remote.audience == null);

      if (
        remote.audience != null &&
        newsIds.length === 0 &&
        sectionIds.length === 0 &&
        shouldAcknowledgeEmptyGuideCatalog(this.auth.user()?.memberSince)
      ) {
        this.readNewsIds.set(this.toRecord(GUIDE_BLOG_POSTS.map((p) => p.id)));
        this.readSectionIds.set(this.toRecord(GUIDE_ALL_NAV.map((s) => s.id)));
        this.hydrated.set(true);
        this.schedulePersist();
        return;
      }

      this.readNewsIds.set(this.toRecord(newsIds));
      this.readSectionIds.set(this.toRecord(sectionIds));
      this.hydrated.set(true);
    } catch {
      if (gen !== this.loadGen) return;
      this.hydrated.set(true);
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
    const current = this.readNewsIds();
    if (ids.length > 0 && ids.every((id) => current[id]) && Object.keys(current).length >= ids.length) {
      return;
    }
    this.readNewsIds.set(this.toRecord(ids));
    this.schedulePersist();
  }

  markSectionRead(sectionId: string): void {
    if (sectionId === 'journal') {
      this.markAllNews(GUIDE_BLOG_POSTS.map((post) => post.id));
    }
    if (this.readSectionIds()[sectionId]) return;
    this.readSectionIds.update((current) => ({ ...current, [sectionId]: true }));
    this.schedulePersist();
  }

  setAudience(value: GuideAudiencePref): void {
    this.audience.set(value);
    this.needsRoleOnboarding.set(false);
    this.schedulePersist();
  }

  private resetAnonymous(): void {
    this.readNewsIds.set({});
    this.readSectionIds.set({});
    this.audience.set('all');
    this.needsRoleOnboarding.set(false);
    this.hydrated.set(true);
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
