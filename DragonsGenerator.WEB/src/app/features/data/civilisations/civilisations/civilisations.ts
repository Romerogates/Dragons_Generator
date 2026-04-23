import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { Civilisation } from '@core/models/Civilisations/civilisations';

@Component({
  selector: 'app-civilisations',
  standalone: true,
  imports: [CommonModule, RouterLink], // Ne pas oublier RouterLink et CommonModule (pour ngClass/ngStyle)
  templateUrl: './civilisations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Civilisations implements OnInit {
  private civilisationService = inject(DataService);

  civilisations = signal<Civilisation[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCivilisations();
  }

  loadCivilisations() {
    this.civilisationService.getCivilisations().subscribe({
      next: (donnees: Civilisation[]) => {
        this.civilisations.set(donnees);
        this.isLoading.set(false);
      },
      error: (erreur) => {
        console.error('Erreur lors du chargement des civilisations', erreur);
        this.error.set('Impossible de charger les archives du monde.');
        this.isLoading.set(false);
      },
    });
  }

  /** Retourne l'émoji correspondant à la civilisation */
  getIconForCiv(id: string): string {
    const icons: Record<string, string> = {
      'civ-acoatl': '🛕',
      'civ-ajagar': '🐘',
      'civ-arolavie': '🌲',
      'civ-iles-barbaresques': '⛵',
      'civ-cite-franche': '🏛️',
      'civ-cyrillane': '👑',
      'civ-drakenbergen': '⛰️',
      'civ-ellerina': '🌿',
      'civ-iles-eoliennes': '☁️',
      'civ-inframonde': '🕷️',
      'civ-kaan': '🐎',
      'civ-lothrienne': '🛡️',
      'civ-mibu': '🦁',
      'civ-rachamangekr': '🐉',
      'civ-royaumes-des-sables': '🏜️',
      'civ-septentrion': '❄️',
      'civ-shi-huang': '🏯',
      'civ-torea': '🏝️',
    };
    return icons[id] || '🗺️';
  }

  /** Retourne les coordonnées X et Y (en %) pour placer l'icône sur la carte */
  getMapCoordinates(id: string): { x: number; y: number } {
    const coords: Record<string, { x: number; y: number }> = {
      'civ-cyrillane': { x: 60, y: 45 },
      'civ-cite-franche': { x: 45, y: 45 },
      'civ-lothrienne': { x: 50, y: 15 },
      'civ-drakenbergen': { x: 55, y: 25 },
      'civ-arolavie': { x: 65, y: 15 },
      'civ-septentrion': { x: 55, y: 3 },
      'civ-kaan': { x: 77, y: 38 },
      'civ-shi-huang': { x: 92, y: 88 },
      'civ-mibu': { x: 55, y: 72 },
      'civ-royaumes-des-sables': { x: 54, y: 60 },
      'civ-ajagar': { x: 78, y: 65 },
      'civ-acoatl': { x: 15, y: 73 },
      'civ-iles-barbaresques': { x: 28, y: 56 },
      'civ-ellerina': { x: 16, y: 22 },
      'civ-torea': { x: 20, y: 95 },
      'civ-rachamangekr': { x: 65, y: 90 },
      'civ-iles-eoliennes': { x: 22, y: 40 },
      'civ-inframonde': { x: 25, y: 10 },
    };
    return coords[id] || { x: 50, y: 50 };
  }
}
