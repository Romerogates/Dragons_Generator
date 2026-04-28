import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../../core/services/data.service';
import { CharacterBuilderService } from '../../../../core/services/character-builder.service';
import type { EquipmentInstance } from '../../../../core/models/Character/character';

export interface EquipmentRaw {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  cost: { v: number | null; u: string };
  wKg: number | null;
  data: Record<string, unknown>;
}

interface ItemRef {
  id: string;
  qty: number;
}

interface RawSlot {
  slot: number;
  description?: string;
  fixed?: ItemRef[];
  alternatives?: ItemRef[][];
}

interface ResolvedItem {
  ref: ItemRef;
  isCategory: boolean;
  equipment: EquipmentRaw | null;
  categoryLabel: string | null;
  categoryItems: EquipmentRaw[];
}

interface ResolvedAlternative {
  index: number;
  items: ResolvedItem[];
  label: string;
}

interface ResolvedSlot {
  slotNumber: number;
  description: string;
  isFixed: boolean;
  fixedItems: ResolvedItem[];
  alternatives: ResolvedAlternative[];
}

const CATEGORY_FILTERS: Record<
  string,
  { type: string; subtypes?: string[]; ids?: string[]; label: string }
> = {
  'category-simple-weapons': {
    type: 'WEAPON',
    subtypes: ['SIMPLE_MELEE', 'SIMPLE_RANGED'],
    label: 'Arme courante',
  },
  'category-martial-weapons': {
    type: 'WEAPON',
    subtypes: ['MARTIAL_MELEE', 'MARTIAL_RANGED'],
    label: 'Arme de guerre',
  },
  'category-light-armor': { type: 'ARMOR', subtypes: ['LIGHT'], label: 'Armure légère' },
  'category-medium-armor': { type: 'ARMOR', subtypes: ['MEDIUM'], label: 'Armure intermédiaire' },
  'category-shield': { type: 'ARMOR', subtypes: ['SHIELD'], label: 'Bouclier' },
  'category-musical-instruments': {
    type: 'TOOL',
    ids: [
      'tl-bombarde',
      'tl-cor',
      'tl-cornemuse',
      'tl-dulcimer',
      'tl-flute',
      'tl-flute-de-pan',
      'tl-luth',
      'tl-lyre',
      'tl-tambour',
      'tl-viole',
    ],
    label: 'Instrument de musique',
  },
  'category-gaming-sets': {
    type: 'TOOL',
    ids: ['tl-des', 'tl-echecs', 'tl-go', 'tl-jeu-de-cartes', 'tl-osselets'],
    label: 'Matériel de jeu',
  },
  'category-vehicles': { type: 'VEHICLE', label: 'Véhicule' },
  'category-tools': { type: 'TOOL', label: "Outil d'artisan" },
  'category-simple-melee-weapons': {
    type: 'WEAPON',
    subtypes: ['SIMPLE_MELEE'],
    label: 'Arme courante de corps à corps',
  },
  'category-arcane-focus': {
    type: 'GEAR',
    subtypes: ['ARCANE_FOCUS'],
    label: 'Focaliseur arcanique',
  },
  'category-druidic-focus': {
    type: 'GEAR',
    subtypes: ['DRUIDIC_FOCUS'],
    label: 'Focaliseur druidique',
  },
  'category-holy-symbol': {
    type: 'GEAR',
    subtypes: ['HOLY_SYMBOL'],
    label: 'Symbole sacré',
  },
};

@Component({
  selector: 'app-equipment-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './equipment-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EquipmentStep implements OnInit {
  private dataService = inject(DataService);
  readonly builder = inject(CharacterBuilderService);

  readonly catalog = signal<EquipmentRaw[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly pickedAlt = signal<Map<number, number>>(new Map());
  readonly pickedCategory = signal<Map<string, string>>(new Map());
  readonly activeSlotIndex = signal(0);

  private readonly catalogMap = computed(() => {
    const m = new Map<string, EquipmentRaw>();
    this.catalog().forEach((e) => m.set(e.id, e));
    return m;
  });

  readonly resolvedSlots = computed<ResolvedSlot[]>(() => {
    const map = this.catalogMap();
    if (map.size === 0) return [];

    const cAny = this.builder.creation() as any;
    const rawSlots: RawSlot[] = [
      ...(this.builder.creation().startingEquipmentSlots ?? []),
      ...(cAny.backgroundEquipmentSlots ?? []),
    ];

    return rawSlots.map((raw) => {
      const isFixed = !!raw.fixed && (!raw.alternatives || raw.alternatives.length === 0);
      return {
        slotNumber: raw.slot,
        description: raw.description ?? '',
        isFixed,
        fixedItems: (raw.fixed ?? []).map((r) => this.resolve(r, map)),
        alternatives: (raw.alternatives ?? []).map((altRefs, idx) => ({
          index: idx,
          items: altRefs.map((r) => this.resolve(r, map)),
          label: 'Alternative ' + (idx + 1),
        })),
      };
    });
  });

  readonly currentSlot = computed(() => this.resolvedSlots()[this.activeSlotIndex()]);
  readonly selectedAlternatives = computed(() => this.pickedAlt());
  readonly categoryChoices = computed(() => this.pickedCategory());

  readonly selectionComplete = computed(() => {
    const alts = this.pickedAlt();
    const cats = this.pickedCategory();
    for (const slot of this.resolvedSlots()) {
      // Vérifier les catégories dans les items fixes
      for (let i = 0; i < slot.fixedItems.length; i++) {
        if (slot.fixedItems[i].isCategory && !cats.has(`${slot.slotNumber}-fixed-${i}`)) {
          return false;
        }
      }
      // Vérifier les alternatives
      if (slot.isFixed) continue;
      const altIdx = alts.get(slot.slotNumber);
      if (altIdx === undefined) return false;
      const alt = slot.alternatives[altIdx];
      for (let i = 0; i < alt.items.length; i++) {
        if (alt.items[i].isCategory && !cats.has(`${slot.slotNumber}-${altIdx}-${i}`)) return false;
      }
    }
    return true;
  });

  ngOnInit(): void {
    this.dataService.getEquipments().subscribe({
      next: (items) => {
        this.catalog.set(items as unknown as EquipmentRaw[]);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur de chargement du catalogue.');
        this.loading.set(false);
      },
    });
  }

  nextSlot(): void {
    if (this.activeSlotIndex() < this.resolvedSlots().length - 1) {
      this.activeSlotIndex.update((i) => i + 1);
    }
  }

  prevSlot(): void {
    if (this.activeSlotIndex() > 0) this.activeSlotIndex.update((i) => i - 1);
  }

  selectAlternative(altIdx: number): void {
    const slot = this.currentSlot();
    if (!slot) return;
    this.pickedAlt.update((m) => new Map(m).set(slot.slotNumber, altIdx));

    this.pickedCategory.update((m) => {
      const n = new Map(m);
      for (const k of n.keys()) if (k.startsWith(`${slot.slotNumber}-`)) n.delete(k);
      return n;
    });

    if (!slot.alternatives[altIdx].items.some((i) => i.isCategory)) {
      setTimeout(() => this.nextSlot(), 300);
    }
  }

  selectFromCategory(itemIdx: number, eqId: string): void {
    const slot = this.currentSlot();
    const altIdx = this.pickedAlt().get(slot.slotNumber);
    if (altIdx === undefined) return;

    const key = `${slot.slotNumber}-${altIdx}-${itemIdx}`;
    this.pickedCategory.update((m) => new Map(m).set(key, eqId));

    setTimeout(() => this.nextSlot(), 300);
  }

  isAlreadyPicked(slot: number, altIdx: number, itemIdx: number, eqId: string): boolean {
    const currentKey = `${slot}-${altIdx}-${itemIdx}`;
    for (const [key, val] of this.pickedCategory().entries()) {
      if (key !== currentKey && val === eqId) return true;
    }
    return false;
  }

  confirm(): void {
    const map = this.catalogMap();
    const result: EquipmentInstance[] = [];

    this.resolvedSlots().forEach((slot) => {
      // Items fixes — résoudre les catégories via pickedCategory
      slot.fixedItems.forEach((item, i) => {
        const inst = this.toInstance(
          item,
          map,
          this.pickedCategory(),
          slot.slotNumber,
          -1, // altIdx = -1 pour les fixes
          i,
        );
        if (inst) result.push(inst);
      });
      // Alternatives
      if (!slot.isFixed) {
        const altIdx = this.pickedAlt().get(slot.slotNumber);
        if (altIdx !== undefined) {
          slot.alternatives[altIdx].items.forEach((item, i) => {
            const inst = this.toInstance(
              item,
              map,
              this.pickedCategory(),
              slot.slotNumber,
              altIdx,
              i,
            );
            if (inst) result.push(inst);
          });
        }
      }
    });

    this.builder.setEquipment(result);
    this.builder.nextStep();
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  getIconForItem(item: ResolvedItem): string {
    if (item.isCategory) {
      const id = item.ref.id;
      if (id.includes('weapon')) return 'fluent-emoji:crossed-swords';
      if (id.includes('focus') || id.includes('holy-symbol')) return 'fluent-emoji:sparkles';
      if (id.includes('instrument')) return 'fluent-emoji:violin';
      if (id.includes('gaming') || id.includes('game')) return 'fluent-emoji:game-die';
      if (id.includes('vehicle')) return 'fluent-emoji:horse';
      return 'fluent-emoji:hammer-and-wrench';
    }
    return item.equipment?.type === 'WEAPON'
      ? 'fluent-emoji:crossed-swords'
      : 'fluent-emoji:package';
  }

  itemName(item: ResolvedItem): string {
    return item.isCategory ? (item.categoryLabel ?? 'Choix') : (item.equipment?.name ?? 'Objet');
  }

  eqDetail(eq: EquipmentRaw): string {
    return eq.wKg ? `${eq.wKg} kg` : '';
  }

  private resolve(ref: ItemRef, map: Map<string, EquipmentRaw>): ResolvedItem {
    const filter = CATEGORY_FILTERS[ref.id];
    if (filter) {
      const items = filter.ids
        ? filter.ids.map((id) => map.get(id)).filter((e): e is EquipmentRaw => !!e)
        : this.catalog().filter(
            (eq) =>
              eq.type === filter.type &&
              (!filter.subtypes || filter.subtypes.includes(eq.subtype!)),
          );

      return {
        ref,
        isCategory: true,
        equipment: null,
        categoryLabel: filter.label,
        categoryItems: items.sort((a, b) => a.name.localeCompare(b.name)),
      };
    }
    return {
      ref,
      isCategory: false,
      equipment: map.get(ref.id) ?? null,
      categoryLabel: null,
      categoryItems: [],
    };
  }

  private toInstance(
    item: ResolvedItem,
    map: Map<string, EquipmentRaw>,
    cats: Map<string, string>,
    slot: number,
    altIdx: number,
    itemIdx: number,
  ): EquipmentInstance | null {
    let eq: EquipmentRaw | undefined;
    if (item.isCategory) {
      // Clé "fixed" ou clé alternative classique
      const key = altIdx === -1 ? `${slot}-fixed-${itemIdx}` : `${slot}-${altIdx}-${itemIdx}`;
      eq = map.get(cats.get(key)!);
    } else {
      eq = item.equipment ?? undefined;
    }
    if (!eq) return null;
    return {
      instanceId: crypto.randomUUID(),
      refId: eq.id,
      name: eq.name,
      qty: item.ref.qty,
      location: 'at_hand',
      equipped: false,
      wKg: eq.wKg,
      customData:
        eq.type === 'WEAPON'
          ? {
              isWeapon: true,
              damage: (eq.data as any).dmg_d,
              damageType: (eq.data as any).dmg_t,
              properties: (eq.data as any).props ?? [],
            }
          : undefined,
    };
  }

  readonly backgroundFixedItems = computed<EquipmentInstance[]>(() => {
    return (this.builder.creation() as any).backgroundEquipment ?? [];
  });

  readonly backgroundName = computed<string | null>(() => {
    return this.builder.creation().backgroundName;
  });

  selectFromFixedCategory(slotNumber: number, itemIdx: number, eqId: string): void {
    const key = `${slotNumber}-fixed-${itemIdx}`;
    this.pickedCategory.update((m) => new Map(m).set(key, eqId));
  }
}
