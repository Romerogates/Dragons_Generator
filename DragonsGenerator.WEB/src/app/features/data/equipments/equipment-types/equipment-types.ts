import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { getEquipmentCategoryIcon } from '@core/utils/equipment-display.util';
import { CodexGlyph } from '@shared/components/codex-glyph/codex-glyph';

@Component({
  selector: 'app-equipment-types',
  standalone: true,
  imports: [CommonModule, RouterLink, CodexGlyph],
  templateUrl: './equipment-types.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class EquipmentTypes implements OnInit {
  private dataService = inject(DataService);

  types = signal<string[]>([]);
  loading = signal<boolean>(true);

  ngOnInit(): void {
    this.dataService.getEquipmentTypes().subscribe({
      next: (t) => {
        this.types.set(t);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Traduit les types anglais en français pour l'affichage */
  translateType(type: string): string {
    const map: Record<string, string> = {
      WEAPON: 'Armes',
      ARMOR: 'Armures & Boucliers',
      MOUNT: 'Montures',
      VEHICLE: 'Véhicules',
      TOOL: 'Outils',
      GEAR: "Équipement d'aventure",
      SERVICE: 'Services',
    };
    return map[type.toUpperCase()] || type;
  }

  getTypeIcon(type: string): string {
    return getEquipmentCategoryIcon(type);
  }
}
