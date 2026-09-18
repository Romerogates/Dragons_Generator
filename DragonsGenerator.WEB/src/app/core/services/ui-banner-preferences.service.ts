import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

/** Ids stables des bannières d’aide (compte). */
export const UI_BANNER_IDS = {
  setupGuide: 'setup-guide',
  dungeonToast: 'dungeon-toast',
  welcomeCampaign: 'welcome-campaign',
  firstSessionComplete: 'first-session-complete',
} as const;

export type UiBannerId = (typeof UI_BANNER_IDS)[keyof typeof UI_BANNER_IDS] | string;

interface UiBannerPreferencesDto {
  hideAllBanners: boolean;
  dismissedBannerIds: string[];
}

@Injectable({ providedIn: 'root' })
export class UiBannerPreferencesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  readonly hideAllBanners = signal(false);
  readonly dismissedBannerIds = signal<Record<string, true>>({});
  readonly hydrated = signal(false);
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private loadGen = 0;

  readonly anyHidden = computed(
    () => this.hideAllBanners() || Object.keys(this.dismissedBannerIds()).length > 0,
  );

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        untracked(() => void this.load());
      } else {
        this.resetAnonymous();
      }
    });
  }

  /** Visible si pas hideAll et pas dans dismissed. */
  isVisible(bannerId: UiBannerId): boolean {
    if (this.hideAllBanners()) return false;
    return !this.dismissedBannerIds()[bannerId];
  }

  isDismissed(bannerId: UiBannerId): boolean {
    return !!this.dismissedBannerIds()[bannerId];
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
        this.http.get<UiBannerPreferencesDto>(`${this.api}/me/ui-banner-preferences`),
      );
      if (gen !== this.loadGen) return;
      this.hideAllBanners.set(!!remote.hideAllBanners);
      this.dismissedBannerIds.set(this.toRecord(remote.dismissedBannerIds ?? []));
      this.hydrated.set(true);
    } catch {
      if (gen !== this.loadGen) return;
      this.hydrated.set(true);
    }
  }

  setHideAllBanners(value: boolean): void {
    this.hideAllBanners.set(value);
    this.schedulePersist();
  }

  dismiss(bannerId: UiBannerId): void {
    if (!bannerId || this.dismissedBannerIds()[bannerId]) return;
    this.dismissedBannerIds.update((current) => ({ ...current, [bannerId]: true }));
    this.schedulePersist();
  }

  undismiss(bannerId: UiBannerId): void {
    if (!this.dismissedBannerIds()[bannerId]) return;
    const next = { ...this.dismissedBannerIds() };
    delete next[bannerId];
    this.dismissedBannerIds.set(next);
    this.schedulePersist();
  }

  clearDismissed(): void {
    if (Object.keys(this.dismissedBannerIds()).length === 0) return;
    this.dismissedBannerIds.set({});
    this.schedulePersist();
  }

  private resetAnonymous(): void {
    this.hideAllBanners.set(false);
    this.dismissedBannerIds.set({});
    this.hydrated.set(true);
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistNow(), 400);
  }

  private persistNow(): void {
    if (!this.auth.isLoggedIn()) return;
    void firstValueFrom(
      this.http.put<UiBannerPreferencesDto>(`${this.api}/me/ui-banner-preferences`, {
        hideAllBanners: this.hideAllBanners(),
        dismissedBannerIds: Object.keys(this.dismissedBannerIds()),
      }),
    );
  }

  private toRecord(ids: string[]): Record<string, true> {
    return Object.fromEntries(ids.map((id) => [id, true as const]));
  }
}
