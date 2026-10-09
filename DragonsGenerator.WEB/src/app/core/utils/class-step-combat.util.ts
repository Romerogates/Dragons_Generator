/** Styles de combat du wizard classe — hors Atlas. */

import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { labelForGameId } from './game-id-labels';

export interface ClassChoicePool {
  id?: string;
  name?: string;
  type?: string;
  pool?: string[];
}

export interface FeatureJsonLike {
  id: string;
  name?: string;
  desc?: string;
  level?: number;
  unlocks_at_level?: number;
  resolves_to_choice_pool?: string;
  mechanics?: {
    options?: { id?: string; name?: string; description?: string; desc?: string }[];
    [key: string]: unknown;
  };
}

export interface CombatStyleOption {
  id: string;
  name: string;
  desc: string;
}

export const COMBAT_STYLE_UNLOCK_LEVEL: Record<string, number> = {
  'cls-guerrier': 1,
  'cls-paladin': 2,
  'cls-rodeur': 2,
};

/** Fallback noms/descriptions si features_details absents. */
export const COMBAT_STYLE_FALLBACK: Record<string, CombatStyleOption> = {
  'style-archerie': {
    id: 'style-archerie',
    name: 'Archerie',
    desc: "Bonus de +2 aux jets d'attaque avec des armes à distance.",
  },
  'feat-style-archerie': {
    id: 'feat-style-archerie',
    name: 'Archerie',
    desc: "Bonus de +2 aux jets d'attaque avec des armes à distance.",
  },
  'style-armes-deux-mains': {
    id: 'style-armes-deux-mains',
    name: 'Armes à deux mains',
    desc: "Relancez les 1 et 2 sur les dés de dégâts d'une arme à deux mains ou polyvalente.",
  },
  'style-armes-a-deux-mains': {
    id: 'style-armes-a-deux-mains',
    name: 'Armes à deux mains',
    desc: "Relancez les 1 et 2 sur les dés de dégâts d'une arme à deux mains ou polyvalente.",
  },
  'feat-style-armes-deux-mains': {
    id: 'feat-style-armes-deux-mains',
    name: 'Armes à deux mains',
    desc: "Relancez les 1 et 2 sur les dés de dégâts d'une arme à deux mains ou polyvalente.",
  },
  'style-combat-deux-armes': {
    id: 'style-combat-deux-armes',
    name: 'Combat à deux armes',
    desc: 'Ajoutez votre modificateur de caractéristique aux dégâts de la seconde attaque.',
  },
  'feat-style-combat-deux-armes': {
    id: 'feat-style-combat-deux-armes',
    name: 'Combat à deux armes',
    desc: 'Ajoutez votre modificateur de caractéristique aux dégâts de la seconde attaque.',
  },
  'style-defense': {
    id: 'style-defense',
    name: 'Défense',
    desc: 'Bonus de +1 à la CA tant que vous portez une armure.',
  },
  'feat-style-defense': {
    id: 'feat-style-defense',
    name: 'Défense',
    desc: 'Bonus de +1 à la CA tant que vous portez une armure.',
  },
  'style-duel': {
    id: 'style-duel',
    name: 'Duel',
    desc: 'Bonus de +2 aux dégâts avec une arme de corps à corps tenue seule.',
  },
  'feat-style-duel': {
    id: 'feat-style-duel',
    name: 'Duel',
    desc: 'Bonus de +2 aux dégâts avec une arme de corps à corps tenue seule.',
  },
  'style-protection': {
    id: 'style-protection',
    name: 'Protection',
    desc: 'Imposez un désavantage à une attaque ciblant un allié à 1,50 m (bouclier requis).',
  },
  'feat-style-protection': {
    id: 'feat-style-protection',
    name: 'Protection',
    desc: 'Imposez un désavantage à une attaque ciblant un allié à 1,50 m (bouclier requis).',
  },
  'style-archerie-rodeur': {
    id: 'style-archerie-rodeur',
    name: 'Archerie',
    desc: "Bonus de +2 aux jets d'attaque avec des armes à distance.",
  },
  'style-combat-deux-armes-rodeur': {
    id: 'style-combat-deux-armes-rodeur',
    name: 'Combat à deux armes',
    desc: 'Ajoutez votre modificateur de caractéristique aux dégâts de la seconde attaque.',
  },
  'style-defense-rodeur': {
    id: 'style-defense-rodeur',
    name: 'Défense',
    desc: 'Bonus de +1 à la CA tant que vous portez une armure.',
  },
  'style-duel-rodeur': {
    id: 'style-duel-rodeur',
    name: 'Duel',
    desc: 'Bonus de +2 aux dégâts avec une arme de corps à corps tenue seule.',
  },
};

export function isFightingStylePool(pool: ClassChoicePool): boolean {
  const blob = `${pool.id ?? ''} ${pool.name ?? ''} ${pool.type ?? ''}`.toLowerCase();
  return (
    blob.includes('style-combat') ||
    blob.includes('combat-style') ||
    blob.includes('fighting_style') ||
    blob.includes('style de combat')
  );
}

export function asChoicePools(raw: unknown): ClassChoicePool[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is ClassChoicePool => !!p && typeof p === 'object');
}

export function asFeatureJsonList(raw: unknown): FeatureJsonLike[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is FeatureJsonLike => !!f && typeof f === 'object' && typeof (f as FeatureJsonLike).id === 'string',
  );
}

export function isConcreteCombatStyleId(id: string): boolean {
  if (!id) return false;
  if (id.includes('style-de-combat')) return false;
  if (id.includes('style-de-combat-supplementaire')) return false;
  return (
    id.startsWith('style-') ||
    id.startsWith('feat-style-') ||
    /style-(archerie|defense|duel|protection|armes|combat)/.test(id)
  );
}

export function isExtraCombatStyleFeature(id: string | undefined): boolean {
  const s = String(id ?? '');
  return s === 'feat-style-de-combat-supplementaire' || /combat-supplementaire|style.*supplementaire/i.test(s);
}

export function resolveAvailableCombatStyles(cls: CharacterClass | null): CombatStyleOption[] {
  if (!cls) return [];
  const pools = asChoicePools(cls.data['choice_pools']);
  const pool = pools.find((p) => isFightingStylePool(p));
  if (!pool?.pool?.length) return [];
  const details = asFeatureJsonList(cls.data.features_details);
  return pool.pool.map((id) => {
    const feat = details.find((f) => f.id === id);
    const fallback = COMBAT_STYLE_FALLBACK[id];
    const rawName = feat?.name ?? fallback?.name ?? labelForGameId(id);
    const name = rawName.replace(/^Style de combat\s*:\s*/i, '').trim();
    return {
      id,
      name,
      desc: feat?.desc || fallback?.desc || 'Style de combat martial.',
    };
  });
}

export function resolveCombatStyleUnlockLevel(cls: CharacterClass | null): number {
  if (!cls) return 99;
  if (COMBAT_STYLE_UNLOCK_LEVEL[cls.id]) return COMBAT_STYLE_UNLOCK_LEVEL[cls.id];
  const details = asFeatureJsonList(cls.data.features_details);
  const grant = details.find(
    (f) =>
      typeof f.resolves_to_choice_pool === 'string' &&
      /style|combat|fighting/i.test(f.resolves_to_choice_pool),
  );
  return grant?.level ?? 99;
}

export function resolveCombatStyleRequiredCount(opts: {
  requiresCombatStyle: boolean;
  targetLevel: number;
  subclassFeatures?: { id: string; level?: number }[];
  classFeaturesDetails?: unknown;
}): number {
  if (!opts.requiresCombatStyle) return 0;
  let n = 1;
  const extraSub = (opts.subclassFeatures ?? []).find((f) => isExtraCombatStyleFeature(f.id));
  if (extraSub && (extraSub.level ?? 10) <= opts.targetLevel) n = 2;
  const extraCls = asFeatureJsonList(opts.classFeaturesDetails).find((f) =>
    isExtraCombatStyleFeature(f.id),
  );
  const extraLvl = Number(extraCls?.unlocks_at_level ?? extraCls?.level ?? 10);
  if (extraCls && extraLvl <= opts.targetLevel) n = 2;
  return n;
}
