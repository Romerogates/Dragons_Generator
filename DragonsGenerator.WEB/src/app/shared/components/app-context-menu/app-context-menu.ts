import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { CODEX_NAV_LINKS } from '@core/config/codex-nav';

interface ContextMenuLink {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './app-context-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppContextMenu {
  readonly auth = inject(AuthService);

  readonly open = signal(false);
  readonly position = signal({ x: 0, y: 0 });

  readonly primaryLinks: ContextMenuLink[] = [
    { label: 'Accueil', path: '/', icon: 'fluent-emoji:house' },
    { label: 'Forger un héros', path: '/create', icon: 'fluent-emoji:hammer-and-pick' },
    { label: 'Mes héros', path: '/characters', icon: 'fluent-emoji:busts-in-silhouette' },
    { label: 'Scénario', path: '/story/create', icon: 'fluent-emoji:scroll' },
    { label: 'Campagnes', path: '/campaigns', icon: 'fluent-emoji:world-map' },
    { label: 'Amis', path: '/friends', icon: 'fluent-emoji:handshake' },
  ];

  readonly codexLinks: ContextMenuLink[] = [
    { label: 'Codex', path: '/codex', icon: 'fluent-emoji:books' },
    ...CODEX_NAV_LINKS.map((l) => ({ label: l.label, path: l.path, icon: l.icon })),
  ];

  @HostListener('document:contextmenu', ['$event'])
  onDocumentContextMenu(event: MouseEvent): void {
    if (!this.isDesktopPointer()) return;
    if (this.shouldKeepNativeMenu(event)) return;
    if (this.isWizardFlipCard(event)) return;

    event.preventDefault();
    this.showAt(event.clientX, event.clientY);
  }

  @HostListener('document:click')
  @HostListener('document:scroll')
  @HostListener('window:resize')
  onDismiss(): void {
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  onBackdropContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.showAt(event.clientX, event.clientY);
  }

  close(): void {
    this.open.set(false);
  }

  logout(): void {
    this.close();
    this.auth.logout();
  }

  private showAt(clientX: number, clientY: number): void {
    const menuWidth = 288;
    const menuHeight = 520;
    const padding = 12;

    const x = Math.min(clientX, window.innerWidth - menuWidth - padding);
    const y = Math.min(clientY, window.innerHeight - menuHeight - padding);

    this.position.set({
      x: Math.max(padding, x),
      y: Math.max(padding, y),
    });
    this.open.set(true);
  }

  private isDesktopPointer(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
  }

  private shouldKeepNativeMenu(event: MouseEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return true;

    return !!target.closest(
      'input, textarea, select, option, [contenteditable="true"], [data-native-contextmenu]',
    );
  }

  /** Clic droit réservé au retournement des cartes du wizard (pas le menu global). */
  private isWizardFlipCard(event: MouseEvent): boolean {
    const target = event.target as HTMLElement | null;
    return !!target?.closest('[data-wizard-flip-card]');
  }
}
