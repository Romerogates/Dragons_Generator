import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
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
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
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

  /** Retourne l'identifiant Iconify correspondant à la civilisation */
  getIconForCiv(id: string): string {
    const icons: Record<string, string> = {
      'civ-acoatl': 'fluent-emoji:hindu-temple',
      'civ-ajagar': 'fluent-emoji:elephant',
      'civ-arolavie': 'fluent-emoji:evergreen-tree',
      'civ-iles-barbaresques': 'fluent-emoji:sailboat',
      'civ-cite-franche': 'fluent-emoji:classical-building',
      'civ-cyrillane': 'fluent-emoji:crown',
      'civ-drakenbergen': 'fluent-emoji:mountain',
      'civ-ellerina': 'fluent-emoji:herb',
      'civ-iles-eoliennes': 'fluent-emoji:cloud',
      'civ-inframonde': 'fluent-emoji:spider',
      'civ-kaan': 'fluent-emoji:horse',
      'civ-lothrienne': 'fluent-emoji:shield',
      'civ-mibu': 'fluent-emoji:lion',
      'civ-rachamangekr': 'fluent-emoji:dragon',
      'civ-royaumes-des-sables': 'fluent-emoji:desert',
      'civ-septentrion': 'fluent-emoji:snowflake',
      'civ-shi-huang': 'fluent-emoji:japanese-castle',
      'civ-torea': 'fluent-emoji:desert-island',
    };
    return icons[id] || 'fluent-emoji:world-map';
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
