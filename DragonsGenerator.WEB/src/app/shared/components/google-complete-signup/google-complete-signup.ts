import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-google-complete-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-4" (ngSubmit)="confirmed.emit()">
      <p class="text-sm text-slate-300 text-center leading-relaxed">
        Compte Google — <span class="text-amber-300 font-semibold">pas de mot de passe</span>.
        Choisis un pseudo et accepte le RGPD.
      </p>
      @if (emailHint()) {
        <p class="text-xs text-slate-500 text-center">{{ emailHint() }}</p>
      }
      <label class="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
        Pseudo
        <input
          type="text"
          required
          minlength="2"
          maxlength="64"
          autocomplete="username"
          name="googleDisplayName"
          [ngModel]="displayName()"
          (ngModelChange)="displayName.set($event)"
          placeholder="Nom affiché"
          class="dg-input mt-1 !py-2.5 !px-3"
        />
      </label>
      <label class="dg-check-row text-xs text-slate-400">
        <input
          type="checkbox"
          required
          class="dg-check"
          name="googleTerms"
          [ngModel]="acceptedTerms()"
          (ngModelChange)="acceptedTerms.set($event)"
        />
        <span>
          J’accepte les
          <a routerLink="/legal/terms" target="_blank" class="text-amber-400 hover:underline">conditions</a>
          et la
          <a routerLink="/legal/privacy" target="_blank" class="text-amber-400 hover:underline"
            >politique de confidentialité (RGPD)</a
          >.
        </span>
      </label>
      @if (error()) {
        <p class="text-sm text-red-400">{{ error() }}</p>
      }
      <button type="submit" class="wizard-nav-primary w-full" [disabled]="loading()">
        {{ loading() ? 'Création…' : 'Créer mon compte' }}
      </button>
      <button type="button" class="text-xs text-slate-400 hover:text-amber-400" (click)="cancelled.emit()">
        Annuler
      </button>
    </form>
  `,
})
export class GoogleCompleteSignupComponent {
  readonly emailHint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly loading = input(false);
  readonly displayName = model('');
  readonly acceptedTerms = model(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
