import { Injectable, inject, signal, computed, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '@env/environment';
import type { NotificationsSummary } from '@core/models/notification.model';
import { AuthService } from './auth.service';

const EMPTY_SUMMARY: NotificationsSummary = {
  friendsActionCount: 0,
  campaignsActionCount: 0,
  totalCount: 0,
  notifications: [],
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = environment.apiUrl;

  private readonly summarySignal = signal<NotificationsSummary | null>(null);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  readonly summary = this.summarySignal.asReadonly();
  readonly friendsActionCount = computed(() => this.summarySignal()?.friendsActionCount ?? 0);
  readonly campaignsActionCount = computed(() => this.summarySignal()?.campaignsActionCount ?? 0);
  readonly totalCount = computed(() => this.summarySignal()?.totalCount ?? 0);
  readonly items = computed(() => this.summarySignal()?.notifications ?? []);

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        untracked(() => this.refresh());
      } else {
        this.summarySignal.set(null);
      }
    });
  }

  init(): void {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.auth.isLoggedIn()) this.refresh();
      });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.onFocus);
      this.refreshTimer = setInterval(() => {
        if (this.auth.isLoggedIn()) this.refresh();
      }, 60_000);
    }
  }

  refresh(): void {
    if (!this.auth.isLoggedIn()) {
      this.summarySignal.set(null);
      return;
    }
    this.http.get<NotificationsSummary>(`${this.api}/me/notifications`).subscribe({
      next: (s) => this.summarySignal.set(s),
      error: () => this.summarySignal.set(EMPTY_SUMMARY),
    });
  }

  private readonly onFocus = (): void => {
    if (this.auth.isLoggedIn()) this.refresh();
  };
}
