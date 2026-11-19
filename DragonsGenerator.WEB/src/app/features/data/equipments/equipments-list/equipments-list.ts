import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA, // <-- Ajout du schéma
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { Equipment } from '@core/models/Equipments/equipment';
import {
  equipmentCardBlurb,
  equipmentSubtypeLabel,
  equipmentTypeLabel,
  getEquipmentIcon,
} from '@core/utils/equipment-display.util';

import { CodexEmptyState } from '@shared/components/codex-empty-state/codex-empty-state';
import { CodexGlyph } from '@shared/components/codex-glyph/codex-glyph';
import { OfflineCodexService } from '@core/services/offline-codex.service';

@Component({
  selector: 'app-equipments-list',
  standalone: true,
  imports: [CommonModule, RouterLink, CodexEmptyState, CodexGlyph],
  templateUrl: './equipments-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class EquipmentsList implements OnInit {
  private readonly dataService = inject(DataService);
  private readonly offlineCodex = inject(OfflineCodexService);

  readonly equipments = signal<Equipment[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);
  readonly offlineBanner = signal(false);

  // Signal pour la barre de recherche
  readonly search = signal('');

  // Liste filtrée dynamiquement selon la recherche
  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.equipments();
    if (!term) return list;

    // On traduit les types/soustypes à la volée pour que la recherche
    // fonctionne si le joueur tape "Arme" (alors que la donnée est "WEAPON")
    return list.filter((eq) => {
      const translatedType = this.translateType(eq.type).toLowerCase();
      const translatedSubtype = this.translateSubtype(eq.subtype).toLowerCase();

      return (
        eq.name.toLowerCase().includes(term) ||
        translatedType.includes(term) ||
        translatedSubtype.includes(term)
      );
    });
  });

  ngOnInit(): void {
    this.loadEquipments();
  }

  loadEquipments(): void {
    this.loading.set(true);
    this.error.set(null);
    this.offlineBanner.set(false);
    this.dataService.getEquipments().subscribe({
      next: (data) => {
        this.equipments.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        const cached = this.offlineCodex.getSnapshot<Equipment[]>('equipments');
        if (cached?.length) {
          this.equipments.set(cached);
          this.offlineBanner.set(true);
          this.error.set(null);
        } else {
          this.error.set("Impossible d'accéder à l'inventaire. Les marchands ont déserté.");
        }
        this.loading.set(false);
      },
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  getTypeIcon(eq: Equipment): string {
    return getEquipmentIcon(eq);
  }

  /**
   * Traduit les types anglais en français pour l'affichage
   */
  translateType(type: string): string {
    return equipmentTypeLabel(type);
  }

  /**
   * Traduit les sous-types anglais en français pour l'affichage
   */
  translateSubtype(subtype: string | null): string {
    return equipmentSubtypeLabel(subtype) || '—';
  }

  equipmentSummary(eq: Equipment): string | null {
    return equipmentCardBlurb({
      type: eq.type,
      subtype: eq.subtype,
      data: (eq.data ?? undefined) as unknown as Record<string, unknown> | undefined,
    });
  }

  formatCost(eq: Equipment): string {
    if (eq.cost.v === null) return '—';
    return `${eq.cost.v} ${eq.cost.u ?? ''}`.trim();
  }
}
