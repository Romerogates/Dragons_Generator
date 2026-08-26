import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-[60vh] flex items-center justify-center px-4">
      <div class="max-w-md w-full bg-[#1b2028] border border-slate-800 rounded-2xl p-8">
        <h1 class="font-serif text-2xl text-amber-500 mb-4 text-center">Nouveau mot de passe</h1>
        @if (done()) {
          <p class="text-emerald-400 text-sm text-center mb-4">{{ message() }}</p>
          <a routerLink="/login" class="wizard-nav-primary w-full text-center block">Connexion</a>
        } @else {
          <form class="flex flex-col gap-4" (ngSubmit)="submit()">
            <label class="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              Nouveau mot de passe
              <input
                type="password"
                required
                minlength="8"
                [(ngModel)]="password"
                name="password"
                class="mt-1 w-full rounded-lg bg-[#171b22] border border-slate-700 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-500"
              />
            </label>
            @if (error()) {
              <p class="text-sm text-red-400">{{ error() }}</p>
            }
            <button type="submit" class="wizard-nav-primary w-full" [disabled]="loading()">
              Enregistrer
            </button>
          </form>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ResetPasswordPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  password = '';
  private token = '';
  readonly loading = signal(false);
  readonly done = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal('');

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.error.set('Lien invalide.');
  }

  submit(): void {
    if (!this.token) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.resetPassword(this.token, this.password).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        this.done.set(true);
        this.message.set(res?.message || 'Mot de passe mis à jour.');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.errors?.[0]?.reason || 'Échec.');
      },
    });
  }
}
