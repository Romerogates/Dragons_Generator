import { Component, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar implements OnInit {
  // On utilise un signal pour une meilleure performance avec OnPush
  private _savedCount = signal(0);

  get savedCount() {
    return this._savedCount();
  }

  ngOnInit() {
    this.refreshCharacterCount();

    // Petite astuce : on rafraîchit le compteur si l'utilisateur change d'onglet ou revient sur la page
    window.addEventListener('storage', () => this.refreshCharacterCount());
  }

  refreshCharacterCount(): void {
    const raw = localStorage.getItem('dragons-characters');
    if (raw) {
      try {
        const chars = JSON.parse(raw);
        this._savedCount.set(Array.isArray(chars) ? chars.length : 0);
      } catch {
        this._savedCount.set(0);
      }
    }
  }
}
