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
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { OfflineCodexService } from '@core/services/offline-codex.service';
import { Species } from '@core/models/Species/species';
import { formatApiAsiDisplay } from '@core/utils/ability-mapping';
import { CodexEmptyState } from '@shared/components/codex-empty-state/codex-empty-state';

@Component({
  selector: 'app-species',
  standalone: true,
  imports: [CommonModule, RouterLink, CodexEmptyState],
  templateUrl: './species.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SpeciesList implements OnInit {
  private dataService = inject(DataService);
  private offlineCodex = inject(OfflineCodexService);

  species = signal<Species[]>([]);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  readonly offlineBanner = signal(false);
  readonly search = signal('');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.species();
    if (!term) return list;
    return list.filter(
      (sp) =>
        sp.name.toLowerCase().includes(term) ||
        (sp.nameAlt ?? []).some((a) => a.toLowerCase().includes(term)) ||
        (sp.flavor?.summary ?? '').toLowerCase().includes(term),
    );
  });

  ngOnInit(): void {
    this.loadSpecies();
  }

  loadSpecies(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.offlineBanner.set(false);

    this.dataService.getSpecies().subscribe({
      next: (donnees: Species[]) => {
        this.species.set(donnees);
        this.isLoading.set(false);
      },
      error: (erreur) => {
        console.error('Erreur lors du chargement des espèces', erreur);
        const cached = this.offlineCodex.getSnapshot<Species[]>('species');
        if (cached?.length) {
          this.species.set(cached);
          this.offlineBanner.set(true);
          this.error.set(null);
        } else {
          this.error.set('Les parchemins sont illisibles. Impossible de charger les espèces.');
        }
        this.isLoading.set(false);
      },
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  /** Formate les bonus de caractéristiques en chaîne lisible : "Force +2, Charisme +1" */
  formatAsi(asi: Record<string, number>): string {
    return formatApiAsiDisplay(asi, 'Aucun');
  }
}
