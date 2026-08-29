import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

const PREF_KEY = 'dragons-push-enabled-v1';

interface PushConfig {
  publicKey: string | null;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly http = inject(HttpClient);
  private readonly swPush = inject(SwPush);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  readonly supported = signal(false);
  readonly subscribed = signal(false);
  readonly busy = signal(false);
  readonly lastError = signal<string | null>(null);

  initAfterLogin(): void {
    if (typeof window === 'undefined' || !this.auth.isLoggedIn()) return;
    this.supported.set(this.swPush.isEnabled);
    if (!this.swPush.isEnabled || !this.isPreferredEnabled()) return;
    void this.ensureSubscribed();
  }

  isPreferredEnabled(): boolean {
    return localStorage.getItem(PREF_KEY) === 'true';
  }

  async setEnabled(enable: boolean): Promise<boolean> {
    this.lastError.set(null);
    if (!this.swPush.isEnabled) {
      this.lastError.set('Notifications push indisponibles (PWA / production requis).');
      return false;
    }
    this.busy.set(true);
    try {
      if (enable) {
        const ok = await this.ensureSubscribed();
        if (ok) localStorage.setItem(PREF_KEY, 'true');
        return ok;
      }
      await this.unsubscribeCurrent();
      localStorage.removeItem(PREF_KEY);
      this.subscribed.set(false);
      return true;
    } catch {
      this.lastError.set('Impossible de modifier l’abonnement push.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private async ensureSubscribed(): Promise<boolean> {
    this.lastError.set(null);
    if (!this.swPush.isEnabled) return false;

    const publicKey = await this.resolveVapidKey();
    if (!publicKey) {
      this.lastError.set('Notifications push non configurées sur le serveur.');
      return false;
    }

    let sub = await firstValueFrom(this.swPush.subscription);
    if (!sub) {
      sub = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
    }

    await firstValueFrom(
      this.http.post<void>(`${this.api}/me/push-subscriptions`, {
        endpoint: sub.endpoint,
        p256dh: this.keyToBase64(sub.getKey('p256dh')),
        auth: this.keyToBase64(sub.getKey('auth')),
      }),
    );

    this.subscribed.set(true);
    return true;
  }

  private async unsubscribeCurrent(): Promise<void> {
    const sub = await firstValueFrom(this.swPush.subscription);
    if (!sub) return;

    const endpoint = sub.endpoint;
    await firstValueFrom(
      this.http.delete<void>(`${this.api}/me/push-subscriptions`, {
        params: { endpoint },
      }),
    );
    await sub.unsubscribe();
  }

  private async resolveVapidKey(): Promise<string | null> {
    if (environment.vapidPublicKey?.trim()) {
      return environment.vapidPublicKey.trim();
    }
    const config = await firstValueFrom(this.http.get<PushConfig>(`${this.api}/push/config`));
    return config.publicKey?.trim() || null;
  }

  private keyToBase64(key: ArrayBuffer | null): string {
    if (!key) return '';
    const bytes = new Uint8Array(key);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }
}
