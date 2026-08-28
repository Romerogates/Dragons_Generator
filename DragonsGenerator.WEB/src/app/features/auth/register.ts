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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { PendingCharacterSaveService } from '@core/services/pending-character-save.service';
import { PasswordFieldComponent } from '@shared/components/password-field/password-field';
import { isLocalDevHost, mailhogWebUrl } from '@core/utils/local-dev.util';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PasswordFieldComponent],
  templateUrl: './register.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class RegisterPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly pendingSave = inject(PendingCharacterSaveService);

  email = '';
  password = '';
  passwordConfirm = '';
  displayName = '';
  readonly error = signal<string | null>(null);
  readonly success = signal(false);
  readonly confirmLink = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly showResend = signal(false);
  readonly resendLoading = signal(false);
  readonly loading = signal(false);
  readonly saveIntent = signal(false);
  readonly localDev = signal(false);
  readonly mailhogUrl = signal('http://localhost:8025');

  loginQueryParams: Record<string, string> = {};

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const returnUrl = q.get('returnUrl') || '/characters';
    const intent = q.get('intent') || (this.pendingSave.hasPending() ? 'save' : '');
    this.saveIntent.set(intent === 'save');
    this.loginQueryParams = {
      returnUrl,
      ...(intent ? { intent } : {}),
    };
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      this.localDev.set(isLocalDevHost(host));
      this.mailhogUrl.set(mailhogWebUrl(host));
    }
  }

  submit(): void {
    this.error.set(null);
    this.showResend.set(false);
    if (this.password !== this.passwordConfirm) {
      this.error.set('Les mots de passe ne correspondent pas.');
      return;
    }
    const pseudo = this.displayName.trim();
    if (pseudo.length < 2) {
      this.error.set('Le pseudo est obligatoire (2 caractères minimum).');
      return;
    }
    this.loading.set(true);
    this.auth
      .register(this.email.trim(), this.password, pseudo)
      .subscribe({
        next: (res: unknown) => {
          this.loading.set(false);
          this.success.set(true);
          const body = res as { confirmLink?: string; message?: string };
          this.successMessage.set(body?.message ?? null);
          if (body?.confirmLink) {
            this.confirmLink.set(body.confirmLink);
          }
        },
        error: (err) => {
          this.loading.set(false);
          if (err.status === 0) {
            this.error.set(
              'Impossible de joindre le serveur. Vérifiez votre connexion réseau.',
            );
            return;
          }
          const e = err?.error;
          const msg =
            (Array.isArray(e?.errors) && e.errors[0]?.reason) ||
            e?.message ||
            'Inscription impossible.';
          this.error.set(msg);
          if (msg.includes('non confirmé')) {
            this.showResend.set(true);
          }
        },
      });
  }

  resendConfirmation(): void {
    if (!this.email.trim()) return;
    this.resendLoading.set(true);
    this.error.set(null);
    this.auth.resendConfirmation(this.email.trim()).subscribe({
      next: (res) => {
        this.resendLoading.set(false);
        this.success.set(true);
        this.successMessage.set(res.message || 'Lien renvoyé.');
        if (res.confirmLink) this.confirmLink.set(res.confirmLink);
      },
      error: () => {
        this.resendLoading.set(false);
        this.error.set('Échec du renvoi. Réessayez.');
      },
    });
  }
}
