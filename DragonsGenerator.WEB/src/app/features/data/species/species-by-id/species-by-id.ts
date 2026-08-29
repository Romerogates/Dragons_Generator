import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { Species } from '@core/models/Species/species';
import { SpeciesMechanicsPanel } from '../species-mechanics-panel/species-mechanics-panel';

@Component({
  selector: 'app-species-by-id',
  standalone: true,
  imports: [CommonModule, RouterLink, SpeciesMechanicsPanel],
  templateUrl: './species-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class SpeciesById implements OnInit {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  species = signal<Species | null>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set("Identifiant d'espèce manquant.");
      this.isLoading.set(false);
      return;
    }
    this.loadSpecies(id);
  }

  loadSpecies(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.dataService.getSpeciesById(id).subscribe({
      next: (donnee: Species) => {
        this.species.set(donnee);
        this.isLoading.set(false);
      },
      error: (erreur) => {
        console.error("Erreur lors du chargement de l'espèce", erreur);
        this.error.set('Les archives de cette espèce sont introuvables.');
        this.isLoading.set(false);
      },
    });
  }

  /** Formate les bonus de caractéristiques : { str:2, cha:1 } -> "FOR +2, CHA +1" */
  formatAsi(asi: Record<string, number> | undefined | null): string {
    if (!asi) return '—';
    const entries = Object.entries(asi);
    if (entries.length === 0) return '—';
    return entries.map(([key, value]) => `${key.toUpperCase()} +${value}`).join(', ');
  }

  hasMeasurements(sp: Species): boolean {
    const h = sp.baseStats.height;
    const w = sp.baseStats.weight;
    return this.hasStatBlock(h?.desc, h?.rangeM) || this.hasStatBlock(w?.desc, w?.rangeKg);
  }

  sizeLabel(code: string): string {
    const labels: Record<string, string> = {
      P: 'Petite',
      M: 'Moyenne',
      G: 'Grande',
    };
    return labels[code] ?? code;
  }

  private hasStatBlock(desc?: string, range?: string): boolean {
    return !!(desc?.trim() || range?.trim());
  }
}
