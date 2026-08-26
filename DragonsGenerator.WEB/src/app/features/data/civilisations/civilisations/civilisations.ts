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
import { EANA_MAP_ASPECT, getEanaMapCoordinates } from '@core/utils/eana-map';

@Component({
  selector: 'app-civilisations',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './civilisations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Civilisations implements OnInit {
  private civilisationService = inject(DataService);

  readonly mapAspect = EANA_MAP_ASPECT;
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
    return getEanaMapCoordinates(id);
  }
}
