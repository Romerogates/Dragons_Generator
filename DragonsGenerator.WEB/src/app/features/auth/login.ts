import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { PendingCharacterSaveService } from '@core/services/pending-character-save.service';
import { PasswordFieldComponent } from '@shared/components/password-field/password-field';
import { isLocalDevHost, mailhogWebUrl } from '@core/utils/local-dev.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PasswordFieldComponent],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly pendingSave = inject(PendingCharacterSaveService);

  email = '';
  password = '';
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly forgotSent = signal(false);
  readonly resetLink = signal<string | null>(null);
  readonly unconfirmed = signal(false);
  readonly resendLoading = signal(false);
  readonly resendMsg = signal<string | null>(null);
  readonly confirmLink = signal<string | null>(null);
  readonly mode = signal<'login' | 'forgot'>('login');
  readonly saveIntent = signal(false);
  readonly localDev = signal(false);
  readonly mailhogUrl = signal('http://localhost:8025');

  private returnUrl = '/characters';

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.returnUrl = q.get('returnUrl') || '/characters';
    this.saveIntent.set(q.get('intent') === 'save' || this.pendingSave.hasPending());
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      this.localDev.set(isLocalDevHost(host));
      this.mailhogUrl.set(mailhogWebUrl(host));
    }
  }

  submitLogin(): void {
    this.error.set(null);
    this.unconfirmed.set(false);
    this.resendMsg.set(null);
    this.loading.set(true);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.pendingSave.flushIfPossible().subscribe({
          next: (saved) => {
            this.loading.set(false);
            if (saved) {
              void this.router.navigateByUrl('/character-sheet');
            } else {
              void this.router.navigateByUrl(this.returnUrl);
            }
          },
          error: () => {
            this.loading.set(false);
            void this.router.navigateByUrl(this.returnUrl);
          },
        });
      },
      error: (err) => {
        this.loading.set(false);
        const reason = this.extractError(err);
        if (err.status === 403 && reason === 'email_not_confirmed') {
          this.unconfirmed.set(true);
          this.error.set('Confirmez d\'abord votre email. Vous pouvez renvoyer le lien ci-dessous.');
          return;
        }
        this.error.set(reason || 'Connexion impossible.');
      },
    });
  }

  submitForgot(): void {
    this.error.set(null);
    this.resetLink.set(null);
    this.loading.set(true);
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: (res: unknown) => {
        this.loading.set(false);
        this.forgotSent.set(true);
        const body = res as { resetLink?: string };
        if (body?.resetLink) this.resetLink.set(body.resetLink);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.extractError(err) || 'Envoi impossible.');
      },
    });
  }

  resendConfirmation(): void {
    if (!this.email.trim()) return;
    this.resendLoading.set(true);
    this.resendMsg.set(null);
    this.confirmLink.set(null);
    this.auth.resendConfirmation(this.email.trim()).subscribe({
      next: (res) => {
        this.resendLoading.set(false);
        this.resendMsg.set(res.message || 'Lien renvoyé.');
        if (res.confirmLink) this.confirmLink.set(res.confirmLink);
      },
      error: () => {
        this.resendLoading.set(false);
        this.resendMsg.set('Demande envoyée si le compte est en attente.');
      },
    });
  }

  private extractError(err: { status?: number; error?: unknown }): string {
    const e = err?.error as {
      errors?: { reason?: string }[] | Record<string, string[]>;
      message?: string;
    };
    if (typeof err?.error === 'string') return err.error;
    if (Array.isArray(e?.errors) && e.errors[0]?.reason) return e.errors[0].reason;
    if (e?.errors && typeof e.errors === 'object') {
      const first = Object.values(e.errors).flat()[0];
      if (typeof first === 'string') return first;
    }
    if (err.status === 0) {
      return 'Impossible de joindre le serveur. Vérifiez le Wi‑Fi et que l\'API tourne.';
    }
    return e?.message || '';
  }
}
