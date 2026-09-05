import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { PendingCharacterSaveService } from '@core/services/pending-character-save.service';

@Component({
  selector: 'app-confirm-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-[60vh] flex items-center justify-center px-4 py-8">
      <div class="max-w-md w-full bg-[#1b2028] border border-slate-800 rounded-2xl p-6 sm:p-8 text-center">
        <h1 class="font-serif text-2xl text-amber-500 mb-4">Confirmation email</h1>
        @if (loading()) {
          <p class="text-slate-400 text-sm">Vérification…</p>
        } @else if (ok()) {
          <p class="text-emerald-400 text-sm mb-4">{{ message() }}</p>
          @if (redirecting()) {
            <p class="text-slate-400 text-xs">Redirection…</p>
          } @else {
            <a [routerLink]="homeLink" class="wizard-nav-primary inline-block">Continuer</a>
          }
        } @else {
          <p class="text-red-400 text-sm mb-4">{{ message() }}</p>
          <div class="flex flex-col gap-2">
            <a routerLink="/register" class="wizard-nav-primary inline-block text-xs"
              >Réessayer l'inscription</a
            >
            <a routerLink="/login" class="text-amber-500 text-xs hover:underline">Se connecter</a>
          </div>
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
  private readonly router = inject(Router);
  private readonly pendingSave = inject(PendingCharacterSaveService);

  readonly loading = signal(true);
  readonly ok = signal(false);
  readonly redirecting = signal(false);
  readonly message = signal('');
  homeLink = '/';

  ngOnInit(): void {
    if (this.pendingSave.hasPending()) {
      this.homeLink = '/characters';
    }

    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.loading.set(false);
      this.message.set('Lien invalide.');
      return;
    }
    this.auth.confirmEmail(token).subscribe({
      next: () => {
        this.loading.set(false);
        this.ok.set(true);
        this.message.set('Email confirmé — vous êtes connecté.');
        this.redirecting.set(true);
        const target = this.pendingSave.hasPending() ? '/characters' : '/';
        setTimeout(() => void this.router.navigateByUrl(target), 900);
      },
      error: (err: { error?: { errors?: { reason?: string }[] } }) => {
        this.loading.set(false);
        this.message.set(err?.error?.errors?.[0]?.reason || 'Confirmation impossible.');
      },
    });
  }
}
