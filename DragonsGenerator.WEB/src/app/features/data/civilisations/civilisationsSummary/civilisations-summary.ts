import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DataService } from '@core/services/data.service';
import { CivilisationSummary } from '@core/models/Civilisations/civilisation-summary';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-civilisations-summary',
  imports: [RouterLink],
  templateUrl: './civilisations-summary.html',
  styleUrl: './civilisations-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CivilisationsSummary implements OnInit {
  private civilisationService = inject(DataService);

  civilisations = signal<CivilisationSummary[]>([]);
  isLoading = signal<boolean>(true);

  ngOnInit(): void {
    this.loadCivilisations();
  }
  loadCivilisations() {
    this.civilisationService.getCivilisationsSummary().subscribe({
      next: (donnees: CivilisationSummary[]) => {
        // Pour modifier un signal, on utilise la méthode .set()
        this.civilisations.set(donnees);
        this.isLoading.set(false);
      },
      error: (erreur) => {
        console.error('Erreur lors du chargement des civilisations', erreur);
        this.isLoading.set(false);
      },
    });
  }
}
