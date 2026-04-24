import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { Equipment } from '@core/models/Equipments/equipment';

@Component({
  selector: 'app-equipment-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './equipment-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class EquipmentDetail implements OnInit {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  equipment = signal<Equipment | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Identifiant manquant');
      this.loading.set(false);
      return;
    }
    this.dataService.getEquipmentById(id).subscribe({
      next: (eq) => {
        this.equipment.set(eq);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Équipement introuvable dans les archives.');
        this.loading.set(false);
        console.error(err);
      },
    });
  }

  // Helper pour itérer sur les clés de data (en excluant la description qui a un affichage spécifique)
  dataEntries(data: unknown): { key: string; value: unknown }[] {
    if (!data || typeof data !== 'object') return [];
    return Object.entries(data as Record<string, unknown>)
      .filter(([key]) => key !== 'desc') // On filtre la description
      .map(([key, value]) => ({
        key: this.translateKey(key), // On traduit la clé pour l'affichage
        value,
      }));
  }

  formatValue(value: unknown, key?: string): string | boolean {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  /**
   * Traduit les types anglais en français pour l'affichage
   */
  translateType(type: string): string {
    const map: Record<string, string> = {
      WEAPON: 'Arme',
      ARMOR: 'Armure',
      MOUNT: 'Monture',
      VEHICLE: 'Véhicule',
      TOOL: 'Outil',
      GEAR: 'Équipement',
      SERVICE: 'Service',
    };
    return map[type] || type;
  }

  /**
   * Traduit les sous-types anglais en français pour l'affichage
   */
  translateSubtype(subtype: string | null): string {
    if (!subtype) return '—';
    const map: Record<string, string> = {
      SIMPLE_MELEE: 'Courante (Mêlée)',
      SIMPLE_RANGED: 'Courante (Distance)',
      MARTIAL_MELEE: 'Guerre (Mêlée)',
      MARTIAL_RANGED: 'Guerre (Distance)',
      LIGHT: 'Légère',
      MEDIUM: 'Intermédiaire',
      HEAVY: 'Lourde',
      SHIELD: 'Bouclier',
      ANIMAL: 'Animal',
      LAND: 'Terrestre',
      WATER: 'Maritime',
      AIR: 'Aérien',
      CONTAINER: 'Contenant',
    };
    return map[subtype] || subtype;
  }

  /**
   * Traduit les clés techniques du JSON en termes lisibles par les joueurs
   */
  private translateKey(key: string): string {
    const dict: Record<string, string> = {
      ac: "Classe d'Armure (CA)",
      str_req: 'Force requise',
      stealth_dis: 'Désavantage Discrétion',
      dmg_d: 'Dégâts',
      dmg_t: 'Type de dégâts',
      props: 'Propriétés',
      speed: 'Vitesse de déplacement',
      cap_kg: 'Capacité de charge (kg)',
    };
    return dict[key] || key;
  }
}
