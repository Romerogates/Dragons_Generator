import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common'; // Ajout par sécurité
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { Species } from '@core/models/Species/species';
import { formatApiAsiDisplay } from '@core/utils/ability-mapping';
import { CodexEmptyState } from '@shared/components/codex-empty-state/codex-empty-state';

@Component({
  selector: 'app-species',
  standalone: true, // Si tu es en standalone components (fortement probable avec Angular 17+)
  imports: [CommonModule, RouterLink, CodexEmptyState],
  templateUrl: './species.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class SpeciesList implements OnInit {
  private dataService = inject(DataService);

  species = signal<Species[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSpecies();
  }

  loadSpecies(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.dataService.getSpecies().subscribe({
      next: (donnees: Species[]) => {
        this.species.set(donnees);
        this.isLoading.set(false);
      },
      error: (erreur) => {
        console.error('Erreur lors du chargement des espèces', erreur);
        this.error.set('Les parchemins sont illisibles. Impossible de charger les espèces.');
        this.isLoading.set(false);
      },
    });
  }

  /** Formate les bonus de caractéristiques en chaîne lisible : "Force +2, Charisme +1" */
  formatAsi(asi: Record<string, number>): string {
    return formatApiAsiDisplay(asi, 'Aucun');
  }
}
