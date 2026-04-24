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

@Component({
  selector: 'app-equipment-types',
  standalone: true,
  imports: [CommonModule, RouterLink],
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

  /** Associe une icône Iconify selon le type de la catégorie */
  getTypeIcon(type: string): string {
    switch (type.toUpperCase()) {
      case 'WEAPON':
        return 'fluent-emoji:crossed-swords';
      case 'ARMOR':
        return 'fluent-emoji:shield';
      case 'MOUNT':
        return 'fluent-emoji:horse';
      case 'VEHICLE':
        return 'fluent-emoji:sailboat';
      case 'TOOL':
        return 'fluent-emoji:hammer-and-wrench';
      case 'GEAR':
        return 'fluent-emoji:backpack';
      case 'SERVICE':
        return 'fluent-emoji:beer-mug'; // La pinte de bière pour la taverne/les services, un classique !
      default:
        return 'fluent-emoji:package';
    }
  }
}
