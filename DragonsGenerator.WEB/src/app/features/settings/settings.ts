import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { PasswordFieldComponent } from '@shared/components/password-field/password-field';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, PasswordFieldComponent],
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SettingsPage implements OnInit {
  private readonly auth = inject(AuthService);

  displayName = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  readonly profileMsg = signal<string | null>(null);
  readonly profileError = signal<string | null>(null);
  readonly profileLoading = signal(false);

  readonly passwordMsg = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  readonly passwordLoading = signal(false);

  readonly confirmMsg = signal<string | null>(null);
  readonly confirmLink = signal<string | null>(null);
  readonly confirmLoading = signal(false);

  readonly user = this.auth.user;

  ngOnInit(): void {
    this.displayName = this.auth.user()?.displayName ?? '';
  }

  saveProfile(): void {
    this.profileMsg.set(null);
    this.profileError.set(null);
    const name = this.displayName.trim();
    if (name.length < 2) {
      this.profileError.set('Le pseudo est obligatoire (2 caractères minimum).');
      return;
    }
    this.profileLoading.set(true);
    this.auth.updateProfile(name).subscribe({
      next: () => {
        this.profileLoading.set(false);
        this.profileMsg.set('Pseudo mis à jour.');
      },
      error: (err) => {
        this.profileLoading.set(false);
        this.profileError.set(this.extractError(err) || 'Échec de la mise à jour.');
      },
    });
  }

  savePassword(): void {
    this.passwordMsg.set(null);
    this.passwordError.set(null);
    if (this.newPassword.length < 8) {
      this.passwordError.set('Le nouveau mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError.set('Les mots de passe ne correspondent pas.');
      return;
    }
    this.passwordLoading.set(true);
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: (res) => {
        this.passwordLoading.set(false);
        this.passwordMsg.set(res.message || 'Mot de passe mis à jour.');
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.passwordLoading.set(false);
        this.passwordError.set(this.extractError(err) || 'Échec du changement.');
      },
    });
  }

  resendConfirmation(): void {
    const email = this.auth.user()?.email;
    if (!email) return;
    this.confirmMsg.set(null);
    this.confirmLink.set(null);
    this.confirmLoading.set(true);
    this.auth.resendConfirmation(email).subscribe({
      next: (res) => {
        this.confirmLoading.set(false);
        this.confirmMsg.set(res.message || 'Email renvoyé.');
        if (res.confirmLink) this.confirmLink.set(res.confirmLink);
      },
      error: () => {
        this.confirmLoading.set(false);
        this.confirmMsg.set('Demande envoyée si le compte est en attente.');
      },
    });
  }

  private extractError(err: { status?: number; error?: unknown }): string {
    const e = err?.error as { errors?: { reason?: string }[] | Record<string, string[]>; message?: string };
    if (Array.isArray(e?.errors) && e.errors[0]?.reason) return e.errors[0].reason;
    if (e?.message) return e.message;
    if (err.status === 0) return 'Impossible de joindre le serveur.';
    return '';
  }
}
