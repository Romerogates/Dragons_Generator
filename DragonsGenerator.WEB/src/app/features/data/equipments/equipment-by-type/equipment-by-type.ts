import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA, // <-- Ajout du schéma
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { Equipment } from '@core/models/Equipments/equipment';
import {
  equipmentCardBlurb,
  equipmentSubtypeLabel,
  getEquipmentIcon,
} from '@core/utils/equipment-display.util';
import { CodexGlyph } from '@shared/components/codex-glyph/codex-glyph';

@Component({
  selector: 'app-equipments-by-type',
  standalone: true,
  imports: [CommonModule, RouterLink, CodexGlyph],
  templateUrl: './equipment-by-type.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class EquipmentsByType implements OnInit {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  type = signal<string>('');
  equipments = signal<Equipment[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  // --- GESTION DES FILTRES ---
  selectedSubtype = signal<string | null>(null);

  // Calcule dynamiquement les sous-catégories disponibles dans la liste
  availableSubtypes = computed(() => {
    const list = this.equipments();
    // On extrait tous les sous-types non nuls et on supprime les doublons avec Set
    const subtypes = new Set(list.map((eq) => eq.subtype).filter((st) => st !== null) as string[]);
    return Array.from(subtypes).sort();
  });

  // Liste filtrée à afficher dans le HTML
  filteredEquipments = computed(() => {
    const list = this.equipments();
    const filter = this.selectedSubtype();
    if (!filter) return list; // Aucun filtre actif = on affiche tout
    return list.filter((eq) => eq.subtype === filter);
  });
  // ---------------------------

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const typeParam = params.get('type') ?? '';
      this.type.set(typeParam.toUpperCase());

      // On réinitialise le filtre si on change de page
      this.selectedSubtype.set(null);

      if (!typeParam) {
        this.equipments.set([]);
        this.loading.set(false);
        return;
      }

      this.loading.set(true);
      this.error.set(null);

      this.dataService.getEquipmentsByType(typeParam.toUpperCase()).subscribe({
        next: (data) => {
          this.equipments.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Erreur lors de la fouille des archives de cette catégorie.');
          this.loading.set(false);
          console.error(err);
        },
      });
    });
  }

  // Met à jour le filtre sélectionné
  setFilter(subtype: string | null): void {
    this.selectedSubtype.set(subtype);
  }

  translateType(type: string): string {
    const map: Record<string, string> = {
      WEAPON: 'Armes',
      ARMOR: 'Armures',
      MOUNT: 'Montures',
      VEHICLE: 'Véhicules',
      TOOL: 'Outils',
      GEAR: 'Équipement',
      SERVICE: 'Services',
    };
    return map[type.toUpperCase()] || type;
  }

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

  getTypeIcon(eq: Equipment): string {
    return getEquipmentIcon(eq);
  }
}
