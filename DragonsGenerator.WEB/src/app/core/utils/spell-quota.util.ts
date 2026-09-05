import type { AbilityScores, SpellcastingKind } from '@core/models/Character/character';

/** Quotas de sorts pour l’étape Magie / auto-build. */
export interface SpellQuota {
  cantrips: number;
  /** Sorts choisis définitivement (known casters). */
  knownSpells: number;
  /** Sorts dans le grimoire (magicien). */
  grimoireSpells: number;
  /** Sorts à préparer (prêtre / druide / paladin). */
  preparedSpells: number;
  isPrepared: boolean;
  hasFullListAccess: boolean;
  modeLabel: string;
}

/** Repli minimal si le JSON classe est absent ou incomplet. */
const SPELL_QUOTA_FALLBACK: Record<string, SpellQuota> = {
  wizard: {
    cantrips: 3,
    knownSpells: 0,
    grimoireSpells: 6,
    preparedSpells: 0,
    isPrepared: true,
    hasFullListAccess: false,
    modeLabel: 'Grimoire (sorts copiés)',
  },
  bard: {
    cantrips: 2,
    knownSpells: 4,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: false,
    hasFullListAccess: false,
    modeLabel: 'Sorts connus',
  },
  druid: {
    cantrips: 2,
    knownSpells: 0,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: true,
    hasFullListAccess: true,
    modeLabel: 'Sorts préparés',
  },
  sorcerer: {
    cantrips: 4,
    knownSpells: 2,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: false,
    hasFullListAccess: false,
    modeLabel: 'Sorts connus',
  },
  cleric: {
    cantrips: 3,
    knownSpells: 0,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: true,
    hasFullListAccess: true,
    modeLabel: 'Sorts préparés',
  },
  warlock: {
    cantrips: 2,
    knownSpells: 2,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: false,
    hasFullListAccess: false,
    modeLabel: 'Sorts connus',
  },
  paladin: {
    cantrips: 0,
    knownSpells: 0,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: true,
    hasFullListAccess: true,
    modeLabel: 'Sorts préparés (serment)',
  },
  ranger: {
    cantrips: 0,
    knownSpells: 0,
    grimoireSpells: 0,
    preparedSpells: 0,
    isPrepared: false,
    hasFullListAccess: false,
    modeLabel: 'Sorts connus (niv. 2+)',
  },
};

const ABILITY_CODE_TO_KEY: Record<string, keyof AbilityScores> = {
  str: 'force',
  force: 'force',
  dex: 'dexterite',
  dexterite: 'dexterite',
  con: 'constitution',
  constitution: 'constitution',
  int: 'intelligence',
  intelligence: 'intelligence',
  wis: 'sagesse',
  sagesse: 'sagesse',
  cha: 'charisme',
  charisme: 'charisme',
};

export interface ResolveSpellQuotaInput {
  /** Objet classe (API) ou `{ data: ... }`. */
  cls: unknown;
  kind: SpellcastingKind | string | null | undefined;
  classLevel: number;
  abilityModifiers?: Partial<AbilityScores> | null;
  /** Bonus cantrips hors JSON (ex. Cercle de la Terre). */
  bonusCantrips?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function classData(cls: unknown): Record<string, unknown> | null {
  const root = asRecord(cls);
  if (!root) return null;
  return asRecord(root['data']) ?? root;
}

function progressionAtLevel(
  data: Record<string, unknown>,
  level: number,
): Record<string, unknown> | null {
  const progression = data['progression'];
  if (!Array.isArray(progression)) return null;
  const exact = progression.find((p) => asRecord(p)?.['level'] === level);
  if (exact) return asRecord(exact);
  const fallback = progression.find((p) => asRecord(p)?.['level'] === 1);
  return fallback ? asRecord(fallback) : null;
}

/** Évalue `prepared_formula` du JSON (ex. `wis_mod + class_level`, `cha_mod + floor(paladin_level / 2)`). */
export function evaluatePreparedFormula(
  formula: string | null | undefined,
  classLevel: number,
  abilityModifiers?: Partial<AbilityScores> | null,
): number | null {
  if (!formula || typeof formula !== 'string') return null;
  let expr = formula.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!expr) return null;

  expr = expr.replace(
    /floor\(\s*(?:[a-z]+_)?level\s*\/\s*(\d+)\s*\)/g,
    (_m, denom: string) => String(Math.floor(classLevel / Number(denom))),
  );
  expr = expr.replace(/(?:[a-z]+_)?level\b/g, String(classLevel));
  expr = expr.replace(/([a-z]+)_mod\b/g, (_m, code: string) => {
    const key = ABILITY_CODE_TO_KEY[code];
    const mod = key ? (abilityModifiers?.[key] ?? 0) : 0;
    return String(mod);
  });

  if (!/^[+\-\d\s]+$/.test(expr)) return null;
  const parts = expr.match(/[+-]?\s*\d+/g);
  if (!parts?.length) return null;
  return parts.reduce((sum, part) => sum + Number(part.replace(/\s/g, '')), 0);
}

function preparedMinimum(spellcasting: Record<string, unknown>): number {
  const raw =
    spellcasting['prepared_minimum'] ??
    spellcasting['minimum_prepared'] ??
    spellcasting['preparedMinimum'];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 1;
}

/**
 * Quotas de sorts depuis `progression[].resources` + `spellcasting` du JSON classe.
 * Repli kind uniquement si le JSON manque.
 */
export function resolveSpellQuota(input: ResolveSpellQuotaInput): SpellQuota | null {
  const kind = input.kind;
  if (!kind) return null;
  const fallback = SPELL_QUOTA_FALLBACK[kind] ?? null;
  const data = classData(input.cls);
  const spellcasting = asRecord(data?.['spellcasting']) ?? {};
  const prog = data ? progressionAtLevel(data, input.classLevel) : null;
  const resources = asRecord(prog?.['resources']) ?? {};
  const castingType = String(spellcasting['type'] ?? '').toLowerCase();
  const grimoire = asRecord(spellcasting['grimoire']);
  const hasGrimoireBlock = !!grimoire;

  let grimoireSpells = 0;
  if (hasGrimoireBlock) {
    const initial =
      typeof grimoire!['initial_spells'] === 'number' ? grimoire!['initial_spells'] : null;
    const perLevel =
      typeof grimoire!['spells_per_level_up'] === 'number'
        ? grimoire!['spells_per_level_up']
        : 2;
    if (initial !== null) {
      grimoireSpells = initial + Math.max(0, (input.classLevel - 1) * perLevel);
    } else if (fallback) {
      grimoireSpells = fallback.grimoireSpells;
    }
  } else if ((fallback?.grimoireSpells ?? 0) > 0) {
    grimoireSpells = fallback!.grimoireSpells;
  }

  const usesGrimoire = grimoireSpells > 0;
  const hasFullListAccess =
    castingType === 'prepared' && !usesGrimoire
      ? true
      : castingType === 'known' || usesGrimoire
        ? false
        : (fallback?.hasFullListAccess ?? false);
  const isPreparedCaster =
    castingType === 'prepared' || usesGrimoire || (fallback?.isPrepared ?? false);

  const cantripsFromJson =
    typeof resources['cantrips_known'] === 'number' ? resources['cantrips_known'] : null;
  const knownFromJson =
    typeof resources['spells_known'] === 'number' ? resources['spells_known'] : null;

  let preparedSpells = 0;
  if (hasFullListAccess) {
    const fromFormula = evaluatePreparedFormula(
      typeof spellcasting['prepared_formula'] === 'string'
        ? spellcasting['prepared_formula']
        : null,
      input.classLevel,
      input.abilityModifiers,
    );
    if (fromFormula !== null) {
      preparedSpells = Math.max(preparedMinimum(spellcasting), fromFormula);
    } else if (fallback) {
      const abilityCode =
        typeof spellcasting['ability'] === 'string' ? spellcasting['ability'] : null;
      const key = abilityCode ? ABILITY_CODE_TO_KEY[abilityCode.toLowerCase()] : null;
      const mod = key ? (input.abilityModifiers?.[key] ?? 0) : 0;
      const levelTerm =
        kind === 'paladin' ? Math.floor(input.classLevel / 2) : input.classLevel;
      preparedSpells = Math.max(1, mod + levelTerm);
    }
  }

  const cantrips =
    (cantripsFromJson ?? fallback?.cantrips ?? 0) + Math.max(0, input.bonusCantrips ?? 0);
  const knownSpells =
    usesGrimoire || hasFullListAccess ? 0 : (knownFromJson ?? fallback?.knownSpells ?? 0);

  let modeLabel = fallback?.modeLabel ?? 'Sorts';
  if (usesGrimoire) modeLabel = 'Grimoire (sorts copiés)';
  else if (hasFullListAccess) modeLabel = `Sorts préparés (${preparedSpells} au choix)`;
  else if (knownSpells > 0) modeLabel = 'Sorts connus';
  else if (kind === 'ranger') modeLabel = 'Sorts connus (niv. 2+)';
  else if (kind === 'paladin') modeLabel = 'Sorts préparés (serment)';

  if (!data && !fallback) return null;

  return {
    cantrips,
    knownSpells,
    grimoireSpells: usesGrimoire ? grimoireSpells : 0,
    preparedSpells,
    isPrepared: isPreparedCaster,
    hasFullListAccess,
    modeLabel,
  };
}

/** Nombre de sorts niv.1+ à choisir dans le wizard (known | grimoire | préparés). */
export function spellPickCount(quota: SpellQuota): number {
  return quota.knownSpells || quota.grimoireSpells || quota.preparedSpells;
}
