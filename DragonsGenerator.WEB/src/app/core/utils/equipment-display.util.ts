import { formatGameIds } from './game-id-labels';

export interface EquipmentDisplayLike {
  type: string;
  subtype: string | null;
  cost?: { v: number | null; u: string };
  wKg?: number | null;
  data: Record<string, unknown>;
}

const TYPE_LABELS: Record<string, string> = {
  WEAPON: 'Arme',
  ARMOR: 'Armure',
  TOOL: 'Outil',
  GEAR: 'Équipement',
  VEHICLE: 'Véhicule',
  MOUNT: 'Monture',
  SERVICE: 'Service',
};

const SUBTYPE_LABELS: Record<string, string> = {
  SIMPLE_MELEE: 'Courante (mêlée)',
  SIMPLE_RANGED: 'Courante (distance)',
  MARTIAL_MELEE: 'Guerre (mêlée)',
  MARTIAL_RANGED: 'Guerre (distance)',
  LIGHT: 'Légère',
  MEDIUM: 'Intermédiaire',
  HEAVY: 'Lourde',
  SHIELD: 'Bouclier',
  ARCANE_FOCUS: 'Focaliseur arcanique',
  DRUIDIC_FOCUS: 'Focaliseur druidique',
  HOLY_SYMBOL: 'Symbole sacré',
};

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  tranchant: 'tranchant',
  perforant: 'perforant',
  contondant: 'contondant',
  feu: 'feu',
  froid: 'froid',
  foudre: 'foudre',
  acide: 'acide',
  poison: 'poison',
  necrotique: 'nécrotique',
  radiant: 'radiant',
  force: 'force',
  psychique: 'psychique',
  tonnerre: 'tonnerre',
};

function labelDamageType(raw: string): string {
  const key = raw.toLowerCase().trim();
  return DAMAGE_TYPE_LABELS[key] ?? raw;
}

/** Libellé FR lisible pour un id de résistance (`damage-feu` → "Feu"). Passe les autres chaînes telles quelles. */
export function resistanceLabel(id: string): string {
  if (!id) return id;
  const stripped = id.toLowerCase().startsWith('damage-') ? id.slice('damage-'.length) : id;
  const label = labelDamageType(stripped);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatWeaponRange(data: Record<string, unknown>): string | null {
  const throwRange = data['throw_range'] ?? data['throwRange'];
  const ammoRange = data['ammo_range'] ?? data['ammoRange'];
  if (throwRange && typeof throwRange === 'object') {
    const r = throwRange as { normal?: number; max?: number };
    if (r.normal != null) {
      return r.max != null ? `Lancer ${r.normal}/${r.max} m` : `Lancer ${r.normal} m`;
    }
  }
  if (ammoRange && typeof ammoRange === 'object') {
    const r = ammoRange as { normal?: number; max?: number };
    if (r.normal != null) {
      return r.max != null ? `Portée ${r.normal}/${r.max} m` : `Portée ${r.normal} m`;
    }
  }
  const range = data['range'];
  if (typeof range === 'string' && range.trim()) return range;
  if (typeof range === 'number') return `Portée ${range} m`;
  return null;
}

function formatDexModifier(data: Record<string, unknown>): string | null {
  const dexMod = data['dex_modifier'];
  if (dexMod === false || dexMod === 'none' || dexMod === 'aucun') return 'Dex non applicable';
  if (dexMod === true || dexMod === 'full' || dexMod === 'complet') return '+ Dex complet';
  const maxDex = data['max_dex_bonus'];
  if (maxDex != null && maxDex !== '') return `Dex max +${maxDex}`;
  if (dexMod === 'partial' || dexMod === 'partiel') return 'Dex partiel';
  return null;
}

export function equipmentTypeLabel(type: string): string {
  return TYPE_LABELS[type?.toUpperCase()] ?? type;
}

export function equipmentSubtypeLabel(subtype: string | null): string {
  if (!subtype) return '';
  return SUBTYPE_LABELS[subtype.toUpperCase()] ?? subtype;
}

export function equipmentDescription(eq: EquipmentDisplayLike): string | null {
  const desc = eq.data?.['desc'] ?? eq.data?.['description'];
  return typeof desc === 'string' && desc.trim() ? desc.trim() : null;
}

/** Ligne compacte pour boutons / listes du wizard. */
export function equipmentSummaryText(eq: EquipmentDisplayLike): string {
  const data = eq.data ?? {};
  const parts: string[] = [];

  const sub = equipmentSubtypeLabel(eq.subtype);
  if (sub) parts.push(sub);

  if (eq.type === 'WEAPON') {
    const dmg = data['dmg_d'] ?? data['damage_dice'];
    const dmgType = data['dmg_t'] ?? data['damage_type'];
    if (dmg) {
      parts.push(`${dmg}${dmgType ? ' ' + labelDamageType(String(dmgType)) : ''}`);
    }
    const props = data['props'] ?? data['properties'];
    if (Array.isArray(props) && props.length) {
      parts.push(formatGameIds(props as string[], ', '));
    }
    const range = formatWeaponRange(data);
    if (range) parts.push(range);
    const strReq = data['str_req'] ?? data['str_required'];
    if (strReq) parts.push(`For ${strReq}`);
  } else if (eq.type === 'ARMOR') {
    const ac = data['ac'] ?? data['ac_base'];
    if (ac != null) parts.push(`CA ${ac}`);
    const dexLabel = formatDexModifier(data);
    if (dexLabel) parts.push(dexLabel);
    if (data['stealth_dis'] || data['stealth_disadvantage']) {
      parts.push('Discrétion −');
    }
    const strReq = data['str_req'] ?? data['str_required'];
    if (strReq) parts.push(`For ${strReq}`);
  }

  if (eq.wKg != null) parts.push(`${eq.wKg} kg`);
  if (eq.cost?.v != null && eq.cost.u) {
    parts.push(`${eq.cost.v} ${eq.cost.u}`);
  }

  return parts.filter(Boolean).join(' · ');
}

/** Stats détaillées pour panneau / carte étendue. */
export function equipmentStatLines(eq: EquipmentDisplayLike): string[] {
  const summary = equipmentSummaryText(eq);
  const lines = summary ? [summary] : [];
  const desc = equipmentDescription(eq);
  if (desc) lines.push(desc);
  return lines;
}
