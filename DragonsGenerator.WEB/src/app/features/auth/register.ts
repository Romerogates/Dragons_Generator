import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class RegisterPage {
  private readonly auth = inject(AuthService);

  email = '';
  password = '';
  displayName = '';
  readonly error = signal<string | null>(null);
  readonly success = signal(false);
  readonly loading = signal(false);

  submit(): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth.register(this.email.trim(), this.password, this.displayName.trim() || undefined).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        const e = err?.error;
        const msg =
          (Array.isArray(e?.errors) && e.errors[0]?.reason) ||
          e?.message ||
          'Inscription impossible.';
        this.error.set(msg);
      },
    });
  }
}
