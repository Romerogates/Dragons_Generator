import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataService } from '@core/services/data.service';
import { Species } from '@core/models/Species/species';
import { CodexDetailShell } from '@shared/components/codex-detail-shell/codex-detail-shell';
import { formatApiAsiDisplay } from '@core/utils/ability-mapping';
import { normalizeLanguageName } from '@core/utils/character-languages.util';
import { SpeciesMechanicsPanel } from '../species-mechanics-panel/species-mechanics-panel';

@Component({
  selector: 'app-species-by-id',
  standalone: true,
  imports: [CommonModule, RouterLink, SpeciesMechanicsPanel, CodexDetailShell],
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
  /** Catalogue langues : id → nom affichable. */
  private readonly languageIdToName = signal<Map<string, string>>(new Map());

  readonly nativeLanguageLabels = computed(() => {
    const fixed = this.species()?.languages?.fixed ?? [];
    return fixed.map((id) => this.languageLabel(id));
  });

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

    forkJoin({
      species: this.dataService.getSpeciesById(id),
      languages: this.dataService.getLanguagesSummary().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ species, languages }) => {
        const map = new Map<string, string>();
        for (const l of languages) map.set(l.id, l.name);
        this.languageIdToName.set(map);
        this.species.set(species);
        this.isLoading.set(false);
      },
      error: (erreur) => {
        console.error("Erreur lors du chargement de l'espèce", erreur);
        this.error.set('Les archives de cette espèce sont introuvables.');
        this.isLoading.set(false);
      },
    });
  }

  /** Formate les bonus de caractéristiques : { str:2, cha:1 } -> "Force +2, Charisme +1" */
  formatAsi(asi: Record<string, number> | undefined | null): string {
    return formatApiAsiDisplay(asi);
  }

  languageLabel(idOrName: string): string {
    return this.languageIdToName().get(idOrName) ?? normalizeLanguageName(idOrName);
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
