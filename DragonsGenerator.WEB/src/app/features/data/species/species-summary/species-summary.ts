import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { SpeciesSummary as SpeciesSummaryModel } from '@core/models/Species/species-summary';

@Component({
  selector: 'app-species-summary',
  imports: [RouterLink],
  templateUrl: './species-summary.html',
  styleUrl: './species-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeciesSummary implements OnInit {
  private dataService = inject(DataService);

  summaries = signal<SpeciesSummaryModel[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.dataService.getSpeciesSummary().subscribe({
      next: (donnees: SpeciesSummaryModel[]) => {
        this.summaries.set(donnees);
        this.isLoading.set(false);
      },
      error: (erreur) => {
        console.error('Erreur lors du chargement du résumé des espèces', erreur);
        this.error.set('Impossible de charger le résumé des espèces.');
        this.isLoading.set(false);
      },
    });
  }
}
