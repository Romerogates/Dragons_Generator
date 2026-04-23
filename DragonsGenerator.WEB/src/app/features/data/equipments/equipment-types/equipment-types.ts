import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';

@Component({
  selector: 'app-equipment-types',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './equipment-types.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  /** Associe un émoji épique selon le type de la catégorie */
  getTypeIcon(type: string): string {
    switch (type.toUpperCase()) {
      case 'WEAPON':
        return '⚔️';
      case 'ARMOR':
        return '🛡️';
      case 'MOUNT':
        return '🐎';
      case 'VEHICLE':
        return '⛵';
      case 'TOOL':
        return '🛠️';
      case 'GEAR':
        return '🎒';
      case 'SERVICE':
        return '🍺';
      default:
        return '📦';
    }
  }
}
