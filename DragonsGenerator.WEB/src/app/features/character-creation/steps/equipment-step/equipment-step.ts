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
import {
  CATEGORY_FILTERS,
  normalizeEquipments,
  resolveEquipmentRefId,
  isMasteredProficiencyChoice,
  masteredProficiencyChoiceLabel,
} from '@core/utils/equipment.utils';
import {
  equipmentDescription,
  equipmentSummaryText,
  type EquipmentDisplayLike,
} from '@core/utils/equipment-display.util';
import { registerGameLabels } from '@core/utils/game-id-labels';
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
  readonly pickedCategory = signal<Map<string, string[]>>(new Map());
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
        const item = slot.fixedItems[i];
        if (item.isCategory) {
          const key = `${slot.slotNumber}-fixed-${i}`;
          const needed = this.neededCategoryPicks(item);
          if ((cats.get(key)?.length ?? 0) < needed) return false;
        }
      }
      // Vérifier les alternatives
      if (slot.isFixed) continue;
      const altIdx = alts.get(slot.slotNumber);
      if (altIdx === undefined) return false;
      const alt = slot.alternatives[altIdx];
      for (let i = 0; i < alt.items.length; i++) {
        const item = alt.items[i];
        if (item.isCategory) {
          const key = `${slot.slotNumber}-${altIdx}-${i}`;
          const needed = this.neededCategoryPicks(item);
          if ((cats.get(key)?.length ?? 0) < needed) return false;
        }
      }
    }
    return true;
  });

  ngOnInit(): void {
    this.dataService.getEquipments().subscribe({
      next: (items) => {
        const normalized = normalizeEquipments(items) as unknown as EquipmentRaw[];
        this.catalog.set(normalized);
        registerGameLabels(normalized.map((e) => [e.id, e.name]));
        this.restorePicksFromBuilder();
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur de chargement du catalogue.');
        this.loading.set(false);
      },
    });
  }

  private restorePicksFromBuilder(): void {
    const picks = (this.builder.creation() as { equipmentWizardPicks?: {
      alt?: Record<string, number>;
      category?: Record<string, string[]>;
    } | null }).equipmentWizardPicks;
    if (!picks) return;

    const alt = new Map<number, number>();
    for (const [k, v] of Object.entries(picks.alt ?? {})) {
      const slot = Number(k);
      if (!Number.isNaN(slot)) alt.set(slot, v);
    }
    const category = new Map<string, string[]>();
    for (const [k, v] of Object.entries(picks.category ?? {})) {
      if (Array.isArray(v) && v.length) category.set(k, v);
    }
    if (alt.size) this.pickedAlt.set(alt);
    if (category.size) this.pickedCategory.set(category);
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

    const item = slot.alternatives[altIdx].items[itemIdx];
    const key = `${slot.slotNumber}-${altIdx}-${itemIdx}`;
    const needed = this.neededCategoryPicks(item);
    this.toggleCategoryPick(key, eqId, needed);

    if (this.getCategoryPicks(key).length >= needed) {
      setTimeout(() => this.nextSlot(), 300);
    }
  }

  getCategoryPicks(key: string): string[] {
    return this.pickedCategory().get(key) ?? [];
  }

  categoryKey(slot: number, altIdx: number, itemIdx: number): string {
    return altIdx === -1 ? `${slot}-fixed-${itemIdx}` : `${slot}-${altIdx}-${itemIdx}`;
  }

  isCategoryChoiceSelected(key: string, eqId: string): boolean {
    return this.getCategoryPicks(key).includes(eqId);
  }

  neededCategoryPicks(item: ResolvedItem): number {
    return item.isCategory ? Math.max(1, item.ref.qty) : 0;
  }

  private toggleCategoryPick(key: string, eqId: string, needed: number): void {
    this.pickedCategory.update((m) => {
      const next = new Map(m);
      const current = [...(next.get(key) ?? [])];
      const idx = current.indexOf(eqId);
      if (idx >= 0) {
        current.splice(idx, 1);
      } else if (current.length < needed) {
        current.push(eqId);
      }
      if (current.length === 0) next.delete(key);
      else next.set(key, current);
      return next;
    });
  }

  isAlreadyPicked(slot: number, altIdx: number, itemIdx: number, eqId: string): boolean {
    const currentKey = this.categoryKey(slot, altIdx, itemIdx);
    if (this.getCategoryPicks(currentKey).includes(eqId)) return false;

    for (const [key, picks] of this.pickedCategory().entries()) {
      if (key === currentKey) continue;
      if (picks.includes(eqId)) return true;
    }
    return false;
  }

  confirm(): void {
    if (!this.selectionComplete()) return;
    const map = this.catalogMap();
    const result: EquipmentInstance[] = [];

    this.resolvedSlots().forEach((slot) => {
      // Items fixes — résoudre les catégories via pickedCategory
      slot.fixedItems.forEach((item, i) => {
        result.push(
          ...this.toInstances(
            item,
            map,
            this.pickedCategory(),
            slot.slotNumber,
            -1,
            i,
          ),
        );
      });
      // Alternatives
      if (!slot.isFixed) {
        const altIdx = this.pickedAlt().get(slot.slotNumber);
        if (altIdx !== undefined) {
          slot.alternatives[altIdx].items.forEach((item, i) => {
            result.push(
              ...this.toInstances(
                item,
                map,
                this.pickedCategory(),
                slot.slotNumber,
                altIdx,
                i,
              ),
            );
          });
        }
      }
    });

    this.builder.setEquipment(result, {
      alt: Object.fromEntries([...this.pickedAlt()].map(([k, v]) => [String(k), v])),
      category: Object.fromEntries(this.pickedCategory()),
    });
    this.builder.nextStep();
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  getIconForItem(item: ResolvedItem): string {
    if (item.isCategory) {
      const id = item.ref.id;
      if (id === 'wp-mastered-choice') return 'fluent-emoji:crossed-swords';
      if (id === 'tl-mastered-choice') return 'fluent-emoji:hammer-and-wrench';
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

  equipmentSummary(eq: EquipmentRaw): string {
    return equipmentSummaryText(eq as EquipmentDisplayLike);
  }

  equipmentDesc(eq: EquipmentRaw): string | null {
    return equipmentDescription(eq as EquipmentDisplayLike);
  }

  eqDetail(eq: EquipmentRaw): string {
    return equipmentSummaryText(eq as EquipmentDisplayLike);
  }

  private resolve(ref: ItemRef, map: Map<string, EquipmentRaw>): ResolvedItem {
    const resolvedId = resolveEquipmentRefId(ref.id);

    if (isMasteredProficiencyChoice(resolvedId)) {
      const isWeapon = resolvedId === 'wp-mastered-choice';
      const c = this.builder.creation();
      const profIds = isWeapon
        ? c.weaponProficiencies
        : [...new Set([...c.toolProficiencies, ...(c.backgroundTools ?? [])])];
      const items = profIds
        .map((id) => map.get(resolveEquipmentRefId(id)))
        .filter((e): e is EquipmentRaw => !!e);

      return {
        ref: { ...ref, id: resolvedId },
        isCategory: true,
        equipment: null,
        categoryLabel: masteredProficiencyChoiceLabel(resolvedId),
        categoryItems: items.sort((a, b) => a.name.localeCompare(b.name)),
      };
    }

    const filter = CATEGORY_FILTERS[resolvedId];
    if (filter) {
      const items = filter.ids
        ? filter.ids.map((id) => map.get(id)).filter((e): e is EquipmentRaw => !!e)
        : this.catalog().filter(
            (eq) =>
              eq.type === filter.type &&
              (!filter.subtypes || filter.subtypes.includes(eq.subtype!)),
          );

      return {
        ref: { ...ref, id: resolvedId },
        isCategory: true,
        equipment: null,
        categoryLabel: filter.label,
        categoryItems: items.sort((a, b) => a.name.localeCompare(b.name)),
      };
    }
    return {
      ref: { ...ref, id: resolvedId },
      isCategory: false,
      equipment: map.get(resolvedId) ?? null,
      categoryLabel: null,
      categoryItems: [],
    };
  }

  private toInstances(
    item: ResolvedItem,
    map: Map<string, EquipmentRaw>,
    cats: Map<string, string[]>,
    slot: number,
    altIdx: number,
    itemIdx: number,
  ): EquipmentInstance[] {
    if (item.isCategory) {
      const key = altIdx === -1 ? `${slot}-fixed-${itemIdx}` : `${slot}-${altIdx}-${itemIdx}`;
      const picks = cats.get(key) ?? [];
      return picks
        .map((pickId) => this.buildInstance(map.get(pickId), 1))
        .filter((inst): inst is EquipmentInstance => !!inst);
    }

    const inst = this.buildInstance(item.equipment ?? undefined, item.ref.qty);
    return inst ? [inst] : [];
  }

  private buildInstance(eq: EquipmentRaw | undefined, qty: number): EquipmentInstance | null {
    if (!eq) return null;

    const data = (eq.data ?? {}) as Record<string, any>;
    const isArmor = eq.type === 'ARMOR';
    const isShield = isArmor && eq.subtype === 'SHIELD';
    const isWeapon = eq.type === 'WEAPON';

    let customData: Record<string, unknown> | undefined;
    if (isWeapon) {
      customData = {
        isWeapon: true,
        damage: data['dmg_d'] ?? data['damage_dice'],
        damageType: data['dmg_t'] ?? data['damage_type'],
        properties: data['props'] ?? data['properties'] ?? [],
        subtype: eq.subtype,
      };
    } else if (isArmor) {
      customData = {
        isArmor: !isShield,
        isShield,
        ac: data['ac'] ?? data['ac_base'] ?? (isShield ? 2 : 10),
        dexModifier: data['dex_modifier'],
        maxDexBonus: data['max_dex_bonus'] ?? null,
        stealthDis: data['stealth_dis'] ?? data['stealth_disadvantage'] ?? false,
        subtype: eq.subtype,
      };
    }

    return {
      instanceId: crypto.randomUUID(),
      refId: eq.id,
      name: eq.name,
      qty,
      location: isArmor ? 'equipped' : 'at_hand',
      equipped: isArmor,
      wKg: eq.wKg,
      customData,
    };
  }

  readonly backgroundFixedItems = computed<EquipmentInstance[]>(() => {
    return (this.builder.creation() as any).backgroundEquipment ?? [];
  });

  readonly backgroundName = computed<string | null>(() => {
    return this.builder.creation().backgroundName;
  });

  selectFromFixedCategory(slotNumber: number, itemIdx: number, eqId: string): void {
    const slot = this.resolvedSlots().find((s) => s.slotNumber === slotNumber);
    const item = slot?.fixedItems[itemIdx];
    if (!item?.isCategory) return;

    const key = `${slotNumber}-fixed-${itemIdx}`;
    const needed = this.neededCategoryPicks(item);
    this.toggleCategoryPick(key, eqId, needed);
  }
}
