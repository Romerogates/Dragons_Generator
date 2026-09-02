import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';
import { clearPersistedAiRateLimit } from '@core/utils/ai-rate-limit.util';
import { clearLocalAppData } from '@core/utils/clear-local-app-data.util';
import { environment } from '@env/environment';
import { OfflineProfileService } from './offline-profile.service';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailConfirmed: boolean;
  bio?: string | null;
  avatarEmoji?: string | null;
  accentColor?: string;
  memberSince?: string;
}

export interface UpdateProfilePayload {
  displayName: string;
  bio?: string | null;
  avatarEmoji?: string | null;
  accentColor?: string;
}

interface AuthResponse {
  token?: string | null;
  user: AuthUser;
}

const USER_KEY = 'dragons_auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly offlineProfile = inject(OfflineProfileService);
  private readonly api = environment.apiUrl;

  private readonly userSignal = signal<AuthUser | null>(this.readUser());
  private readonly sessionChecked = signal(false);

  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => !!this.userSignal());
  readonly isAdmin = computed(() => this.userSignal()?.role === 'Admin');
  readonly sessionReady = this.sessionChecked.asReadonly();

  register(email: string, password: string, displayName: string, acceptTerms: boolean): Observable<unknown> {
    const webUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    return this.http.post(`${this.api}/auth/register`, {
      email,
      password,
      displayName: displayName.trim(),
      webUrl,
      acceptTerms,
    });
  }

  resendConfirmation(email: string): Observable<{ message?: string; confirmLink?: string }> {
    const webUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    return this.http.post<{ message?: string; confirmLink?: string }>(
      `${this.api}/auth/resend-confirmation`,
      { email, webUrl },
    );
  }

  updateProfile(payload: UpdateProfilePayload): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${this.api}/auth/me`, payload).pipe(
      tap((u) => {
        this.userSignal.set(u);
        this.persistUser(u);
        this.writeThroughPublicProfileCache(u);
      }),
    );
  }

  private writeThroughPublicProfileCache(u: AuthUser): void {
    type CachedProfile = {
      id: string;
      displayName: string;
      bio: string | null;
      avatarEmoji: string | null;
      accentColor: string;
      memberSince: string;
      isSelf: boolean;
      isFriend: boolean;
    };
    const cached = this.offlineProfile.readProfile<CachedProfile>(u.id);
    const next: CachedProfile = {
      id: u.id,
      displayName: u.displayName,
      bio: u.bio ?? null,
      avatarEmoji: u.avatarEmoji ?? null,
      accentColor: u.accentColor ?? cached?.accentColor ?? 'violet',
      memberSince: u.memberSince ?? cached?.memberSince ?? new Date().toISOString(),
      isSelf: true,
      isFriend: cached?.isFriend ?? false,
    };
    this.offlineProfile.writeProfile(u.id, next);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  exportMyData(): Observable<Blob> {
    return this.http.get(`${this.api}/me/export`, { responseType: 'blob' });
  }

  deleteAccount(currentPassword: string): Observable<void> {
    return this.http.request<void>('DELETE', `${this.api}/auth/me`, {
      body: { currentPassword },
    });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/auth/login`, { email, password }).pipe(
      tap((res) => this.persist(res.user)),
    );
  }

  confirmEmail(token: string): Observable<unknown> {
    return this.http.get(`${this.api}/auth/confirm-email`, { params: { token } });
  }

  forgotPassword(email: string): Observable<unknown> {
    const webUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    return this.http.post(`${this.api}/auth/forgot-password`, { email, webUrl });
  }

  resetPassword(token: string, newPassword: string): Observable<unknown> {
    return this.http.post(`${this.api}/auth/reset-password`, { token, newPassword });
  }

  refreshMe(): Observable<AuthUser | null> {
    return this.http.get<AuthUser>(`${this.api}/auth/me`).pipe(
      tap((u) => {
        this.userSignal.set(u);
        this.persistUser(u);
        this.sessionChecked.set(true);
      }),
      catchError((err: unknown) => {
        this.sessionChecked.set(true);
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.clearLocalSession(false);
          return of(null);
        }
        return of(this.userSignal());
      }),
    );
  }

  /** Valide le cookie de session au démarrage et au retour sur l'app. */
  initSessionSync(): void {
    if (typeof window === 'undefined') return;
    this.refreshMe().subscribe();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isLoggedIn()) {
        this.refreshMe().subscribe();
      }
    });
    window.addEventListener('focus', () => {
      if (this.isLoggedIn()) {
        this.refreshMe().subscribe();
      }
    });
  }

  logout(navigate = true): void {
    this.http.post(`${this.api}/auth/logout`, {}).subscribe({
      complete: () => this.clearLocalSession(navigate),
      error: () => this.clearLocalSession(navigate),
    });
  }

  logoutAndClearLocalData(): void {
    clearLocalAppData();
    this.http.post(`${this.api}/auth/logout`, {}).subscribe({
      complete: () => this.clearLocalSession(true),
      error: () => this.clearLocalSession(true),
    });
  }

  private persist(user: AuthUser): void {
    this.userSignal.set(user);
    this.persistUser(user);
    this.sessionChecked.set(true);
    this.purgeLegacyLocalStorage();
    if (user.role === 'Admin') clearPersistedAiRateLimit();
  }

  private clearLocalSession(navigate: boolean): void {
    sessionStorage.removeItem(USER_KEY);
    this.userSignal.set(null);
    // Ne pas purger les artefacts Phase 1 ici : la bannière de migration doit rester visible.
    if (navigate) void this.router.navigateByUrl('/login');
  }

  /** Anciennes clés localStorage (Phase 1) — nettoyage à la connexion / déconnexion. */
  private purgeLegacyLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    const legacyKeys = [
      'dragons_auth_token',
      'dragons_auth_user',
      'dragons-characters',
      'dragons-campaigns-local',
      'dragons-current-character',
      'dragons-edit-character',
    ];
    for (const key of legacyKeys) {
      localStorage.removeItem(key);
    }
  }

  private persistUser(user: AuthUser): void {
    try {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
  }

  private readUser(): AuthUser | null {
    try {
      const raw = sessionStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
