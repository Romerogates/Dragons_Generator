import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaLifecycleService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly swUpdate = inject(SwUpdate, { optional: true });

  readonly updateReady = signal(false);
  readonly canInstall = signal(false);
  readonly isStandalone = signal(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  init(): void {
    if (!isPlatformBrowser(this.platformId)) return;

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

    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => this.updateReady.set(true));
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
    if (!this.swUpdate?.isEnabled) {
      window.location.reload();
      return;
    }
    void this.swUpdate.activateUpdate().then(() => document.location.reload());
  }

  dismissUpdate(): void {
    this.updateReady.set(false);
  }

  private detectStandalone(): boolean {
    const mq = window.matchMedia('(display-mode: standalone)').matches;
    const ios = 'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return mq || ios;
  }
}
