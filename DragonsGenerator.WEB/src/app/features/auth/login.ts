import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly forgotSent = signal(false);
  readonly mode = signal<'login' | 'forgot'>('login');

  submitLogin(): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl('/characters');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.extractError(err) || 'Connexion impossible.');
      },
    });
  }

  submitForgot(): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        this.loading.set(false);
        this.forgotSent.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.extractError(err) || 'Envoi impossible.');
      },
    });
  }

  private extractError(err: any): string {
    const e = err?.error;
    if (typeof e === 'string') return e;
    if (e?.errors && typeof e.errors === 'object') {
      const first = Object.values(e.errors).flat()[0];
      if (typeof first === 'string') return first;
    }
    if (Array.isArray(e?.errors) && e.errors[0]?.reason) return e.errors[0].reason;
    return e?.message || err?.message || '';
  }
}
