import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import {
  AiRateLimitInfo,
  clearPersistedAiRateLimit,
  formatAiRateLimitRemaining,
  parseAiRateLimitError,
  persistAiRateLimitUntil,
  readPersistedAiRateLimitUntil,
} from '@core/utils/ai-rate-limit.util';

@Injectable({ providedIn: 'root' })
export class AiRateLimitDialogService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly now = signal(Date.now());

  readonly visible = signal(false);
  readonly retryAtMs = signal<number | null>(null);
  readonly suggestLogin = signal(false);
  readonly message = signal('Limite de génération IA atteinte pour le moment.');

  readonly remainingMs = computed(() => {
    const until = this.retryAtMs();
    if (!until) return 0;
    return Math.max(0, until - this.now());
  });

  readonly remainingLabel = computed(() => formatAiRateLimitRemaining(this.remainingMs()));

  readonly isBlocked = computed(() => this.remainingMs() > 0);

  ngOnDestroy(): void {
    this.stopTick();
  }

  /** Affiche le dialogue si une limite persistée est encore active. */
  showIfBlocked(): boolean {
    const until = readPersistedAiRateLimitUntil();
    if (!until) return false;
    this.openFromUntil(until, !this.auth.isLoggedIn());
    return true;
  }

  /** Retourne true si l'erreur HTTP a été traitée comme limite IA. */
  handleHttpError(err: unknown): boolean {
    const info = parseAiRateLimitError(err);
    if (!info) return false;
    this.open(info);
    return true;
  }

  open(info: AiRateLimitInfo): void {
    const until = Date.now() + info.retryAfterSeconds * 1000;
    persistAiRateLimitUntil(until);
    this.openFromUntil(until, info.suggestLogin && !this.auth.isLoggedIn(), info.message);
  }

  close(): void {
    this.visible.set(false);
    this.stopTick();
  }

  goLogin(): void {
    const returnUrl = this.router.url;
    this.close();
    void this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }

  private openFromUntil(untilMs: number, suggestLogin: boolean, message?: string): void {
    this.retryAtMs.set(untilMs);
    this.suggestLogin.set(suggestLogin);
    if (message) this.message.set(message);
    this.visible.set(true);
    this.startTick();

    if (untilMs <= Date.now()) {
      clearPersistedAiRateLimit();
      this.close();
    }
  }

  private startTick(): void {
    this.stopTick();
    this.now.set(Date.now());
    this.tickTimer = setInterval(() => {
      this.now.set(Date.now());
      if (this.remainingMs() <= 0) {
        clearPersistedAiRateLimit();
        this.close();
      }
    }, 1000);
  }

  private stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}
