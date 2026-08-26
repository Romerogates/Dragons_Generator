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

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
  displayName = '';
  readonly error = signal<string | null>(null);
  readonly success = signal(false);
  readonly loading = signal(false);
  readonly saveIntent = signal(false);

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
  }

  submit(): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth
      .register(this.email.trim(), this.password, this.displayName.trim() || undefined)
      .subscribe({
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
