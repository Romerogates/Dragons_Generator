import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DataService } from '@core/services/data.service';
import { SpeciesCodesResponse } from '@core/models/Species/species-codes';

interface CodeEntry {
  code: string;
  label: string;
}

@Component({
  selector: 'app-species-codes',
  imports: [],
  templateUrl: './species-codes.html',
  styleUrl: './species-codes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeciesCodes implements OnInit {
  private dataService = inject(DataService);

  sizeCodes = signal<CodeEntry[]>([]);
  abilityCodes = signal<CodeEntry[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCodes();
  }

  loadCodes(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.dataService.getSpeciesCodes().subscribe({
      next: (donnees: SpeciesCodesResponse) => {
        this.sizeCodes.set(this.toEntries(donnees.sizeCodes));
        this.abilityCodes.set(this.toEntries(donnees.abilityCodes));
        this.isLoading.set(false);
      },
      error: (erreur) => {
        console.error('Erreur lors du chargement des codes', erreur);
        this.error.set('Impossible de charger les codes.');
        this.isLoading.set(false);
      },
    });
  }

  /** Transforme un Record<string,string> en tableau pour pouvoir l'utiliser avec @for + track. */
  private toEntries(record: Record<string, string> | undefined | null): CodeEntry[] {
    if (!record) return [];
    return Object.entries(record).map(([code, label]) => ({ code, label }));
  }
}
