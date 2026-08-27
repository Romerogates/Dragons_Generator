import type { Spell } from '@core/models/Spells/spell';

export const SPELL_SCHOOL_LABELS: Record<string, string> = {
  abjuration: 'Abjuration',
  conjuration: 'Conjuration',
  invocation: 'Invocation',
  divination: 'Divination',
  enchantement: 'Enchantement',
  evocation: 'Évocation',
  illusion: 'Illusion',
  necromancie: 'Nécromancie',
  transmutation: 'Transmutation',
};

const TIME_UNIT_LABELS: Record<string, string> = {
  action: 'action',
  actions: 'actions',
  bonus_action: 'action bonus',
  bonus: 'action bonus',
  reaction: 'réaction',
  minute: 'min',
  minutes: 'min',
  hour: 'h',
  hours: 'h',
  round: 'round',
  rounds: 'rounds',
  jour: 'jour',
  jours: 'jours',
};

const DURATION_UNIT_LABELS: Record<string, string> = {
  ...TIME_UNIT_LABELS,
  instantanee: 'Instantané',
  instantané: 'Instantané',
  instantanée: 'Instantané',
  instantane: 'Instantané',
  dissipation: "Jusqu'à dissipation",
};

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatMetaAmountUnit(
  amount: number | string | null | undefined,
  unit: string | null | undefined,
  unitLabels: Record<string, string>,
  empty = '—',
): string {
  const amt = amount != null && amount !== '' ? String(amount) : '';
  const unitKey = normalizeKey(unit);
  const unitLabel = unitKey ? (unitLabels[unitKey] ?? unit ?? '') : '';

  if (!amt && !unitLabel) return empty;
  if (!amt) return unitLabel;
  if (!unitLabel) return amt;
  if (amt === '1' && unitLabel === 'action') return '1 action';
  if (amt === '1' && unitLabel === 'action bonus') return '1 action bonus';
  if (amt === '1' && unitLabel === 'réaction') return '1 réaction';
  return `${amt} ${unitLabel}`.trim();
}

export function spellSchoolLabel(school: string): string {
  const key = normalizeKey(school);
  return SPELL_SCHOOL_LABELS[key] ?? school;
}

export function spellCastTimeLabel(s: Pick<Spell, 'castingTime'>): string {
  return formatMetaAmountUnit(s.castingTime.amount, s.castingTime.unit, TIME_UNIT_LABELS);
}

export function spellRangeLabel(s: Pick<Spell, 'range'>): string {
  const amount = s.range.amount != null ? String(s.range.amount) : '';
  const unitKey = normalizeKey(s.range.unit);
  const amountKey = normalizeKey(amount);

  if (!amount && !unitKey) return 'Personnel';
  if (amountKey === 'personnelle' || amountKey === 'personnel' || unitKey === 'personnelle') {
    return 'Personnel';
  }
  if (amountKey === 'contact' || unitKey === 'contact') return 'Contact';
  if (unitKey === 'm' || unitKey === 'metre' || unitKey === 'metres') {
    return `${amount} m`.trim();
  }
  if (unitKey === 'km') return `${amount} km`.trim();
  return formatMetaAmountUnit(s.range.amount, s.range.unit, TIME_UNIT_LABELS, '—');
}

export function spellDurationLabel(s: Pick<Spell, 'duration'>): string {
  const amount = s.duration.amount != null ? String(s.duration.amount) : '';
  const unitKey = normalizeKey(s.duration.unit);
  const amountKey = normalizeKey(amount);

  if (!amount && !unitKey) return 'Instantané';
  if (
    amountKey.includes('dissipation') ||
    unitKey.includes('dissipation') ||
    amountKey.includes('concentration')
  ) {
    return "Jusqu'à dissipation";
  }
  if (
    amountKey === 'instantanee' ||
    amountKey === 'instantane' ||
    unitKey === 'instantanee' ||
    unitKey === 'instantane'
  ) {
    return 'Instantané';
  }
  return formatMetaAmountUnit(s.duration.amount, s.duration.unit, DURATION_UNIT_LABELS);
}

export function spellComponentsLabel(
  s: Pick<Spell, 'components'>,
  detailed = false,
): string {
  const parts: string[] = [];
  if (s.components.v) parts.push(detailed ? 'V (verbale)' : 'V');
  if (s.components.s) parts.push(detailed ? 'S (somatique)' : 'S');
  if (s.components.m) {
    parts.push(detailed ? `M (${s.components.m})` : 'M');
  }
  return parts.join(', ') || '—';
}

/** Une ligne compacte pour cartes / boutons du wizard. */
export function spellStatsLine(s: Spell, detailedComponents = false): string {
  return [
    spellCastTimeLabel(s),
    spellRangeLabel(s),
    spellComponentsLabel(s, detailedComponents),
    spellDurationLabel(s),
  ]
    .filter((x) => x && x !== '—')
    .join(' · ');
}

export function spellLevelLabel(level: number): string {
  return level === 0 ? 'Tour de magie' : `Niveau ${level}`;
}
