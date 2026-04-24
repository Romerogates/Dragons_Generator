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

@Component({
  selector: 'app-equipments-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './equipments-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
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
   * Retourne une icône Iconify stylisée basée sur les vrais Enums (EquipmentType & EquipmentSubtype)
   */
  getTypeIcon(eq: Equipment): string {
    switch (eq.type) {
      case 'WEAPON':
        return eq.subtype?.includes('RANGED')
          ? 'fluent-emoji:bow-and-arrow'
          : 'fluent-emoji:crossed-swords';
      case 'ARMOR':
        return eq.subtype === 'SHIELD' ? 'fluent-emoji:shield' : 'fluent-emoji:military-helmet';
      case 'MOUNT':
        const nameMount = eq.name.toLowerCase();
        if (nameMount.includes('éléphant')) return 'fluent-emoji:elephant';
        if (nameMount.includes('chameau')) return 'fluent-emoji:camel';
        return 'fluent-emoji:horse';
      case 'VEHICLE':
        if (eq.subtype === 'WATER') return 'fluent-emoji:sailboat';
        if (eq.subtype === 'AIR') return 'fluent-emoji:cloud';
        return 'fluent-emoji:shopping-cart'; // Véhicules terrestres
      case 'TOOL':
        const nameTool = eq.name.toLowerCase();
        // Instruments de musique
        if (
          nameTool.includes('instrument') ||
          nameTool.match(/luth|flûte|tambour|cor|lyre|cornemuse/)
        )
          return 'fluent-emoji:banjo';
        // Jeux
        if (nameTool.includes('jeu') || nameTool.includes('dés') || nameTool.includes('échecs'))
          return 'fluent-emoji:game-die';
        return 'fluent-emoji:hammer-and-wrench';
      case 'GEAR':
        if (eq.subtype === 'CONTAINER') return 'fluent-emoji:backpack';
        const nameGear = eq.name.toLowerCase();
        // Alchimie et potions
        if (
          nameGear.includes('potion') ||
          nameGear.includes('eau bénite') ||
          nameGear.includes('acide') ||
          nameGear.includes('feu grégeois')
        )
          return 'fluent-emoji:test-tube';
        // Papiers et magie
        if (
          nameGear.includes('parchemin') ||
          nameGear.includes('grimoire') ||
          nameGear.includes('carnet')
        )
          return 'fluent-emoji:scroll';
        return 'fluent-emoji:compass'; // Matériel générique
      case 'SERVICE':
        if (eq.name.toLowerCase().includes('repas') || eq.name.toLowerCase().includes('vin'))
          return 'fluent-emoji:beer-mug';
        return 'fluent-emoji:bed';
      default:
        return 'fluent-emoji:backpack';
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
