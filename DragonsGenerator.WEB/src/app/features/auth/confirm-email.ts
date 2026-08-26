import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-confirm-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-[60vh] flex items-center justify-center px-4">
      <div class="max-w-md w-full bg-[#1b2028] border border-slate-800 rounded-2xl p-8 text-center">
        <h1 class="font-serif text-2xl text-amber-500 mb-4">Confirmation email</h1>
        @if (loading()) {
          <p class="text-slate-400 text-sm">Vérification…</p>
        } @else if (ok()) {
          <p class="text-emerald-400 text-sm mb-4">{{ message() }}</p>
          <a routerLink="/login" class="wizard-nav-primary inline-block">Se connecter</a>
        } @else {
          <p class="text-red-400 text-sm mb-4">{{ message() }}</p>
          <a routerLink="/register" class="text-amber-500 text-xs hover:underline">Réessayer l'inscription</a>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ConfirmEmailPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly ok = signal(false);
  readonly message = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.loading.set(false);
      this.message.set('Lien invalide.');
      return;
    }
    this.auth.confirmEmail(token).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        this.ok.set(true);
        this.message.set(res?.message || 'Email confirmé.');
      },
      error: (err) => {
        this.loading.set(false);
        this.message.set(err?.error?.errors?.[0]?.reason || 'Confirmation impossible.');
      },
    });
  }
}
