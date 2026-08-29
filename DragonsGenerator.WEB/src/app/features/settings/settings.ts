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
import { OfflineCodexService } from '@core/services/offline-codex.service';
import { OfflineSyncService } from '@core/services/offline-sync.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { PushNotificationService } from '@core/services/push-notification.service';
import { PwaLifecycleService } from '@core/services/pwa-lifecycle.service';
import { PasswordFieldComponent } from '@shared/components/password-field/password-field';
import { RouterLink } from '@angular/router';
import {
  PROFILE_ACCENTS,
  PROFILE_AVATAR_OPTIONS,
  accentGradient,
  profileInitial,
} from '@core/utils/profile.util';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, PasswordFieldComponent, RouterLink],
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SettingsPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly offlineCodex = inject(OfflineCodexService);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly push = inject(PushNotificationService);
  private readonly pwa = inject(PwaLifecycleService);

  displayName = '';
  bio = '';
  avatarEmoji: string | null = null;
  accentColor = 'violet';

  readonly avatarOptions = PROFILE_AVATAR_OPTIONS;
  readonly accentOptions = PROFILE_ACCENTS;
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

  readonly codexDownloaded = signal(false);
  readonly codexDownloadedAt = signal<string | null>(null);
  readonly codexDownloading = this.offlineCodex.downloading;
  readonly codexDownloadError = this.offlineCodex.downloadError;
  readonly pendingSyncCount = this.offlineSync.pendingCount;
  readonly isOnline = this.connectivity.isOnline;
  readonly syncMessage = this.offlineSync.lastSyncMessage;
  readonly syncError = this.offlineSync.lastSyncError;

  readonly exportLoading = signal(false);
  readonly exportMsg = signal<string | null>(null);
  readonly exportError = signal<string | null>(null);

  deletePassword = '';
  readonly deleteConfirmEmail = signal('');
  readonly deleteLoading = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly showDeleteForm = signal(false);

  readonly pushSupported = this.push.supported;
  readonly pushEnabled = signal(false);
  readonly pushBusy = this.push.busy;
  readonly pushError = this.push.lastError;
  readonly canInstallPwa = this.pwa.canInstall;
  readonly isPwaStandalone = this.pwa.isStandalone;
  readonly installBusy = signal(false);

  readonly user = this.auth.user;

  ngOnInit(): void {
    const u = this.auth.user();
    this.displayName = u?.displayName ?? '';
    this.bio = u?.bio ?? '';
    this.avatarEmoji = u?.avatarEmoji ?? null;
    this.accentColor = u?.accentColor ?? 'violet';
    this.pushEnabled.set(this.push.isPreferredEnabled());
    this.refreshCodexMeta();
    this.offlineSync.refreshPendingCount();
  }

  async installPwa(): Promise<void> {
    if (this.installBusy()) return;
    this.installBusy.set(true);
    try {
      await this.pwa.promptInstall();
    } finally {
      this.installBusy.set(false);
    }
  }

  async togglePushNotifications(event: Event): Promise<void> {
    const checked = (event.target as HTMLInputElement).checked;
    const ok = await this.push.setEnabled(checked);
    this.pushEnabled.set(ok ? checked : !checked);
  }

  previewGradient(): string {
    return accentGradient(this.accentColor);
  }

  previewInitial(): string {
    return profileInitial(this.displayName);
  }

  selectAvatar(icon: string | null): void {
    this.avatarEmoji = this.avatarEmoji === icon ? null : icon;
  }

  selectAccent(id: string): void {
    this.accentColor = id;
  }

  downloadCodex(): void {
    this.offlineCodex.downloadCodex().subscribe((ok) => {
      if (ok) this.refreshCodexMeta();
    });
  }

  syncNow(): void {
    this.offlineSync.flushIfPossible();
  }

  exportData(): void {
    this.exportMsg.set(null);
    this.exportError.set(null);
    this.exportLoading.set(true);
    this.auth.exportMyData().subscribe({
      next: (blob) => {
        this.exportLoading.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dragons-generator-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.exportMsg.set('Export téléchargé.');
      },
      error: (err) => {
        this.exportLoading.set(false);
        this.exportError.set(this.extractError(err) || 'Échec de l’export.');
      },
    });
  }

  toggleDeleteForm(): void {
    this.showDeleteForm.update((v) => !v);
    this.deletePassword = '';
    this.deleteConfirmEmail.set('');
    this.deleteError.set(null);
  }

  canConfirmDelete(): boolean {
    const email = this.user()?.email ?? '';
    return (
      this.deletePassword.length >= 8 &&
      this.deleteConfirmEmail().trim().toLowerCase() === email.toLowerCase()
    );
  }

  deleteAccount(): void {
    if (!this.canConfirmDelete() || this.deleteLoading()) return;
    this.deleteError.set(null);
    this.deleteLoading.set(true);
    this.auth.deleteAccount(this.deletePassword).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.auth.logoutAndClearLocalData();
      },
      error: (err) => {
        this.deleteLoading.set(false);
        this.deleteError.set(this.extractError(err) || 'Impossible de supprimer le compte.');
      },
    });
  }

  clearCodexDownload(): void {
    this.offlineCodex.clearDownload();
    this.refreshCodexMeta();
  }

  private refreshCodexMeta(): void {
    this.codexDownloaded.set(this.offlineCodex.isDownloaded());
    this.codexDownloadedAt.set(this.offlineCodex.meta()?.downloadedAt ?? null);
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
    this.auth
      .updateProfile({
        displayName: name,
        bio: this.bio.trim() || null,
        avatarEmoji: this.avatarEmoji,
        accentColor: this.accentColor,
      })
      .subscribe({
      next: () => {
        this.profileLoading.set(false);
        this.profileMsg.set('Profil mis à jour.');
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
