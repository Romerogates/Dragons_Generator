import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { clearPersistedAiRateLimit } from '@core/utils/ai-rate-limit.util';
import { clearLocalAppData } from '@core/utils/clear-local-app-data.util';
import { environment } from '@env/environment';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailConfirmed: boolean;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = 'dragons_auth_token';
const USER_KEY = 'dragons_auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = environment.apiUrl;

  private readonly userSignal = signal<AuthUser | null>(this.readUser());
  private readonly tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly user = this.userSignal.asReadonly();
  readonly token = this.tokenSignal.asReadonly();
  readonly isLoggedIn = computed(() => !!this.tokenSignal() && !!this.userSignal());
  readonly isAdmin = computed(() => this.userSignal()?.role === 'Admin');

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

  updateProfile(displayName: string): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${this.api}/auth/me`, { displayName }).pipe(
      tap((u) => {
        this.userSignal.set(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      }),
    );
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
      tap((res) => this.persist(res.token, res.user)),
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
    if (!this.tokenSignal()) return of(null);
    return this.http.get<AuthUser>(`${this.api}/auth/me`).pipe(
      tap((u) => {
        this.userSignal.set(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      }),
      catchError(() => {
        this.logout(false);
        return of(null);
      }),
    );
  }

  /** Vérifie le token au démarrage et au retour sur l'app (PWA / onglet). */
  initSessionSync(): void {
    if (typeof window === 'undefined') return;
    if (this.tokenSignal()) {
      this.refreshMe().subscribe();
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.tokenSignal()) {
        this.refreshMe().subscribe();
      }
    });
    window.addEventListener('focus', () => {
      if (this.tokenSignal()) {
        this.refreshMe().subscribe();
      }
    });
  }

  logout(navigate = true): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    if (navigate) void this.router.navigateByUrl('/login');
  }

  /** Déconnexion + effacement complet des données locales après suppression de compte. */
  logoutAndClearLocalData(): void {
    clearLocalAppData();
    this.logout(true);
  }

  private persist(token: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.tokenSignal.set(token);
    this.userSignal.set(user);
    if (user.role === 'Admin') clearPersistedAiRateLimit();
  }

  private readUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
