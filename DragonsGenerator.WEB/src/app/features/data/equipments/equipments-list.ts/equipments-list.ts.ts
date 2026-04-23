import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { Equipment } from '@core/models/Equipments/equipment';

@Component({
  selector: 'app-equipments-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './equipments-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentsList implements OnInit {
  private readonly dataService = inject(DataService);

  readonly equipments = signal<Equipment[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

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
    this.dataService.getEquipments().subscribe({
      next: (data) => {
        this.equipments.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set("Impossible d'accéder à l'inventaire. Les marchands ont déserté.");
        this.loading.set(false);
        console.error(err);
      },
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  /**
   * Retourne une icône stylisée basée sur les vrais Enums (EquipmentType & EquipmentSubtype)
   */
  getTypeIcon(eq: Equipment): string {
    switch (eq.type) {
      case 'WEAPON':
        return eq.subtype?.includes('RANGED') ? '🏹' : '⚔️';
      case 'ARMOR':
        return eq.subtype === 'SHIELD' ? '🛡️' : '🪖';
      case 'MOUNT':
        const nameMount = eq.name.toLowerCase();
        if (nameMount.includes('éléphant')) return '🐘';
        if (nameMount.includes('chameau')) return '🐫';
        return '🐎';
      case 'VEHICLE':
        if (eq.subtype === 'WATER') return '⛵';
        if (eq.subtype === 'AIR') return '☁️';
        return '🛒'; // Véhicules terrestres
      case 'TOOL':
        const nameTool = eq.name.toLowerCase();
        // Instruments de musique
        if (
          nameTool.includes('instrument') ||
          nameTool.match(/luth|flûte|tambour|cor|lyre|cornemuse/)
        )
          return '🪕';
        // Jeux
        if (nameTool.includes('jeu') || nameTool.includes('dés') || nameTool.includes('échecs'))
          return '🎲';
        return '🛠️';
      case 'GEAR':
        if (eq.subtype === 'CONTAINER') return '🎒';
        const nameGear = eq.name.toLowerCase();
        // Alchimie et potions
        if (
          nameGear.includes('potion') ||
          nameGear.includes('eau bénite') ||
          nameGear.includes('acide') ||
          nameGear.includes('feu grégeois')
        )
          return '🧪';
        // Papiers et magie
        if (
          nameGear.includes('parchemin') ||
          nameGear.includes('grimoire') ||
          nameGear.includes('carnet')
        )
          return '📜';
        return '🧭'; // Matériel générique
      case 'SERVICE':
        if (eq.name.toLowerCase().includes('repas') || eq.name.toLowerCase().includes('vin'))
          return '🍺';
        return '🛏️';
      default:
        return '🎒';
    }
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
}
