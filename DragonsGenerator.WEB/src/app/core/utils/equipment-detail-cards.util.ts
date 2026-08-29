import { formatGameIds } from './game-id-labels';
import {
  equipmentDescription,
  equipmentSubtypeLabel,
  equipmentTypeLabel,
  type EquipmentDisplayLike,
} from './equipment-display.util';

export interface EquipmentStatCard {
  label: string;
  value: string;
  kind?: 'text' | 'yes' | 'no' | 'chips';
  chips?: string[];
}

/** Cartes techniques lisibles pour la fiche équipement catalogue. */
export function equipmentDetailCards(eq: EquipmentDisplayLike): EquipmentStatCard[] {
  const data = eq.data ?? {};
  const cards: EquipmentStatCard[] = [];

  const type = equipmentTypeLabel(eq.type);
  if (type) cards.push({ label: 'Catégorie', value: type });

  const subtype = equipmentSubtypeLabel(eq.subtype);
  if (subtype) cards.push({ label: 'Sous-catégorie', value: subtype });

  if (eq.type === 'WEAPON' || data['dmg_d'] || data['damage_dice']) {
    const dmg = data['dmg_d'] ?? data['damage_dice'];
    const dmgType = data['dmg_t'] ?? data['damage_type'];
    if (dmg) {
      cards.push({
        label: 'Dégâts',
        value: `${dmg}${dmgType ? ` ${String(dmgType)}` : ''}`,
      });
    }
    const props = data['props'] ?? data['properties'];
    if (Array.isArray(props) && props.length) {
      const chips = (props as string[]).map((p) => formatGameIds([p], ', '));
      cards.push({ label: 'Propriétés', value: chips.join(', '), kind: 'chips', chips });
    }
    pushRangeCards(cards, data);
  }

  if (eq.type === 'ARMOR' || data['ac'] != null || data['ac_base'] != null) {
    const ac = data['ac'] ?? data['ac_base'];
    if (ac != null) cards.push({ label: "Classe d'armure", value: String(ac) });
    const stealth = data['stealth_dis'] ?? data['stealth_disadvantage'];
    if (typeof stealth === 'boolean') {
      cards.push({
        label: 'Désavantage Discrétion',
        value: stealth ? 'Oui' : 'Non',
        kind: stealth ? 'yes' : 'no',
      });
    }
  }

  const strReq = data['str_req'] ?? data['str_required'];
  if (strReq != null && strReq !== '') {
    cards.push({ label: 'Force requise', value: String(strReq) });
  }

  const speed = data['speed'];
  if (speed != null && speed !== '') {
    cards.push({ label: 'Vitesse', value: String(speed) });
  }

  const cap = data['cap_kg'] ?? data['capacity_kg'];
  if (cap != null && cap !== '') {
    cards.push({ label: 'Capacité', value: `${cap} kg` });
  }

  // Champs restants non couverts (sans desc / id techniques déjà affichés ailleurs)
  const skip = new Set([
    'desc',
    'description',
    'dmg_d',
    'damage_dice',
    'dmg_t',
    'damage_type',
    'props',
    'properties',
    'ac',
    'ac_base',
    'stealth_dis',
    'stealth_disadvantage',
    'str_req',
    'str_required',
    'speed',
    'cap_kg',
    'capacity_kg',
    'throw_range',
    'throwRange',
    'ammo_range',
    'ammoRange',
    'range',
    'dex_modifier',
    'max_dex_bonus',
  ]);

  for (const [key, value] of Object.entries(data)) {
    if (skip.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'object') {
      // Nested objects already handled or skipped
      continue;
    }
    cards.push({
      label: labelKey(key),
      value: typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value),
      kind: typeof value === 'boolean' ? (value ? 'yes' : 'no') : 'text',
    });
  }

  return cards;
}

export function equipmentDetailDescription(eq: EquipmentDisplayLike): string | null {
  return equipmentDescription(eq);
}

function pushRangeCards(cards: EquipmentStatCard[], data: Record<string, unknown>): void {
  const throwRange = data['throw_range'] ?? data['throwRange'];
  if (throwRange && typeof throwRange === 'object') {
    const r = throwRange as { normal?: number; max?: number };
    if (r.normal != null) {
      cards.push({
        label: 'Portée (lancer)',
        value: r.max != null ? `${r.normal}/${r.max} m` : `${r.normal} m`,
      });
    }
  }
  const ammoRange = data['ammo_range'] ?? data['ammoRange'];
  if (ammoRange && typeof ammoRange === 'object') {
    const r = ammoRange as { normal?: number; max?: number };
    if (r.normal != null) {
      cards.push({
        label: 'Portée',
        value: r.max != null ? `${r.normal}/${r.max} m` : `${r.normal} m`,
      });
    }
  }
}

function labelKey(key: string): string {
  const dict: Record<string, string> = {
    material: 'Matériau',
    rarity: 'Rareté',
    quantity: 'Quantité',
    uses: 'Utilisations',
  };
  return dict[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
