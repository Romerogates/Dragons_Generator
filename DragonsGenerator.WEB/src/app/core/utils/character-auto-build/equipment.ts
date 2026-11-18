import type { EquipmentInstance, EquipmentSlot } from '@core/models/Character/character';
import type { Equipment } from '@core/models/Equipments/equipment';
import {
  CATEGORY_FILTERS,
  isMasteredProficiencyChoice,
  masteredProficiencyChoiceLabel,
  resolveEquipmentRefId,
  toEquipmentCatalogRows,
} from '@core/utils/equipment.utils';
import { pickRandom } from '@core/utils/pregen-random.util';
import type { EquipmentCatalogItem } from './types';

export function resolveBgToolToConcrete(toolRef: string, toolCatalog: EquipmentCatalogItem[]): string {
  if (toolRef.startsWith('tl-')) return toolRef;
  if (toolRef.includes('instrument')) {
    const inst = toolCatalog.filter((t) => t.type === 'TOOL' && (t.subtype === 'instrument' || t.id.includes('tl-')));
    return pickRandom(inst)?.id ?? 'tl-luth';
  }
  if (toolRef.includes('game')) {
    const games = toolCatalog.filter((t) => t.id.includes('des') || t.id.includes('echecs') || t.subtype === 'gaming_set');
    return pickRandom(games)?.id ?? 'tl-des';
  }
  const tools = toolCatalog.filter((t) => t.type === 'TOOL');
  return pickRandom(tools)?.id ?? toolRef;
}

export function buildBackgroundToolSlots(
  bgTools: string[],
  toolCatalog: EquipmentCatalogItem[],
): EquipmentSlot[] {
  const slots: EquipmentSlot[] = [];
  let slotIndex = 200;
  for (const tool of bgTools) {
    if (tool.includes('any') || tool.includes('instrument') || tool.includes('game')) {
      const cat =
        tool.includes('instrument') ? 'category-musical-instruments'
        : tool.includes('game') ? 'category-gaming-sets'
        : 'category-tools';
      slots.push({
        slot: slotIndex++,
        description: 'Outil (historique)',
        alternatives: [[{ id: cat, qty: 1 }]],
      });
    } else {
      slots.push({
        slot: slotIndex++,
        description: 'Outil (historique)',
        fixed: [{ id: resolveBgToolToConcrete(tool, toolCatalog), qty: 1 }],
      });
    }
  }
  return slots;
}

function resolveCatalogItem(
  ref: { id: string; qty: number },
  catalog: Map<string, EquipmentCatalogItem>,
  weaponProfs: string[],
  toolProfs: string[],
): { isCategory: boolean; equipment: EquipmentCatalogItem | null; categoryItems: EquipmentCatalogItem[]; categoryLabel: string | null } {
  const resolvedId = resolveEquipmentRefId(ref.id);
  if (isMasteredProficiencyChoice(resolvedId)) {
    const isWeapon = resolvedId === 'wp-mastered-choice';
    const profIds = isWeapon ? weaponProfs : [...new Set(toolProfs)];
    const items = profIds
      .map((id) => catalog.get(resolveEquipmentRefId(id)))
      .filter((e): e is EquipmentCatalogItem => !!e);
    return {
      isCategory: true,
      equipment: null,
      categoryItems: items,
      categoryLabel: masteredProficiencyChoiceLabel(resolvedId),
    };
  }
  const filter = CATEGORY_FILTERS[resolvedId];
  if (filter) {
    const items = filter.ids
      ? filter.ids.map((id) => catalog.get(id)).filter((e): e is EquipmentCatalogItem => !!e)
      : [...catalog.values()].filter(
          (eq) =>
            eq.type === filter.type &&
            (!filter.subtypes || filter.subtypes.includes(eq.subtype!)),
        );
    return { isCategory: true, equipment: null, categoryItems: items, categoryLabel: filter.label };
  }
  return {
    isCategory: false,
    equipment: catalog.get(resolvedId) ?? null,
    categoryItems: [],
    categoryLabel: null,
  };
}

function toEquipmentInstance(eq: EquipmentCatalogItem, qty: number): EquipmentInstance {
  const data = eq.data ?? {};
  const isArmor = eq.type === 'ARMOR';
  const isShield = isArmor && eq.subtype === 'SHIELD';
  const isWeapon = eq.type === 'WEAPON';
  let customData: Record<string, unknown> | undefined;
  if (isWeapon) {
    customData = {
      isWeapon: true,
      damage: (data as Record<string, unknown>)['dmg_d'] ?? (data as Record<string, unknown>)['damage_dice'],
      damageType: (data as Record<string, unknown>)['dmg_t'] ?? (data as Record<string, unknown>)['damage_type'],
      properties: (data as Record<string, unknown>)['props'] ?? (data as Record<string, unknown>)['properties'] ?? [],
      subtype: eq.subtype,
    };
  } else if (isArmor) {
    customData = {
      isArmor: !isShield,
      isShield,
      ac: (data as Record<string, unknown>)['ac'] ?? (data as Record<string, unknown>)['ac_base'] ?? (isShield ? 2 : 10),
      dexModifier: (data as Record<string, unknown>)['dex_modifier'],
      maxDexBonus: (data as Record<string, unknown>)['max_dex_bonus'] ?? null,
      stealthDis: (data as Record<string, unknown>)['stealth_dis'] ?? false,
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

export function buildAutoEquipment(
  slots: EquipmentSlot[],
  catalogItems: EquipmentCatalogItem[],
  weaponProfs: string[],
  toolProfs: string[],
): EquipmentInstance[] {
  const catalog = new Map(catalogItems.map((e) => [e.id, e]));
  const result: EquipmentInstance[] = [];

  for (const slot of slots) {
    const isFixed = !!slot.fixed?.length && !slot.alternatives?.length;
    if (isFixed) {
      for (const ref of slot.fixed ?? []) {
        const resolved = resolveCatalogItem(ref, catalog, weaponProfs, toolProfs);
        if (resolved.isCategory) {
          const pick = pickRandom(resolved.categoryItems);
          if (pick) result.push(toEquipmentInstance(pick, ref.qty));
        } else if (resolved.equipment) {
          result.push(toEquipmentInstance(resolved.equipment, ref.qty));
        }
      }
      continue;
    }
    const alt = pickRandom(slot.alternatives ?? []);
    if (!alt) continue;
    for (const ref of alt) {
      const resolved = resolveCatalogItem(ref, catalog, weaponProfs, toolProfs);
      if (resolved.isCategory) {
        const pick = pickRandom(resolved.categoryItems);
        if (pick) result.push(toEquipmentInstance(pick, ref.qty));
      } else if (resolved.equipment) {
        result.push(toEquipmentInstance(resolved.equipment, ref.qty));
      }
    }
  }
  return result;
}

export function normalizeEquipmentCatalog(raw: Equipment[]): EquipmentCatalogItem[] {
  return toEquipmentCatalogRows(raw);
}
