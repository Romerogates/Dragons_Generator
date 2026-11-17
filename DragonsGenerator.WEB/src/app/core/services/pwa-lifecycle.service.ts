import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { clearAppCaches, clearUpdateSnooze, isUpdateSnoozed, snoozeUpdate } from '@core/utils/pwa-update.util';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CHECK_EVERY_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PwaLifecycleService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly swUpdate = inject(SwUpdate, { optional: true });

  readonly updateReady = signal(false);
  readonly canInstall = signal(false);
  readonly isStandalone = signal(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private pendingVersion = false;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private inited = false;

  init(): void {
    if (!isPlatformBrowser(this.platformId) || this.inited) return;
    this.inited = true;

    this.isStandalone.set(this.detectStandalone());

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      if (!this.isStandalone()) this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      this.isStandalone.set(true);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.checkNow();
    });

    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => {
          this.pendingVersion = true;
          this.revealBannerIfDue();
        });
      this.swUpdate.unrecoverable.subscribe(() => {
        void this.applyUpdate();
      });
      void this.checkNow();
      this.checkTimer = setInterval(() => void this.checkNow(), CHECK_EVERY_MS);
    }
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;
    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);
    return outcome === 'accepted';
  }

  applyUpdate(): void {
    clearUpdateSnooze();
    void this.reloadFresh();
  }

  dismissUpdate(): void {
    snoozeUpdate();
    this.updateReady.set(false);
  }

  private async checkNow(): Promise<void> {
    this.revealBannerIfDue();
    if (!this.swUpdate?.isEnabled) return;
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      /* réseau / SW pas encore prêt */
    }
  }

  private revealBannerIfDue(): void {
    if (!this.pendingVersion || isUpdateSnoozed()) {
      if (!this.pendingVersion) this.updateReady.set(false);
      return;
    }
    this.updateReady.set(true);
  }

  private async reloadFresh(): Promise<void> {
    try {
      if (this.swUpdate?.isEnabled) {
        await this.swUpdate.activateUpdate();
      }
    } catch {
      /* on force quand même un cache neuf */
    }
    try {
      await clearAppCaches();
    } catch {
      /* reload even if cache purge fails */
    }
    window.location.reload();
  }

  private detectStandalone(): boolean {
    const mq = window.matchMedia('(display-mode: standalone)').matches;
    const ios = 'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return mq || ios;
  }
}
