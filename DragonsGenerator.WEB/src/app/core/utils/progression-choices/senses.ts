import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import {
  type SubclassFeatureLike,
  dedupeSubclassFeatures,
  featureUnlockLevel,
  progressionData,
  toStringArray,
} from './shared';

export interface ClassBonusSenses {
  darkvisionRadius: number;
  hasBlindsight: boolean;
  blindsightRadius: number;
}

const EMPTY_CLASS_SENSES: ClassBonusSenses = {
  darkvisionRadius: 0,
  hasBlindsight: false,
  blindsightRadius: 0,
};

/** Lit vision dans le noir / vision aveugle sur une feature ou une option de choix brute. */
function readSenseGrant(obj: Record<string, unknown> | undefined | null): {
  darkvision: number;
  blindsight: number;
} {
  let darkvision = 0;
  let blindsight = 0;
  if (!obj) return { darkvision, blindsight };
  const dv = Number(obj['darkvision_radius_m']);
  if (Number.isFinite(dv) && dv > 0) darkvision = dv;
  const bs = Number(obj['blindsight_radius_m']);
  if (Number.isFinite(bs) && bs > 0) blindsight = bs;
  if (obj['sense_type'] === 'blindsight') {
    const range = Number(obj['range_m']);
    if (Number.isFinite(range) && range > 0) blindsight = Math.max(blindsight, range);
  }
  return { darkvision, blindsight };
}

/**
 * Vision dans le noir / vision aveugle fixes accordées par la classe racine ou la sous-classe
 * (ex. Rôdeur "Perception sauvage" niv. 18 → vision aveugle 9 m, Rôdeur Ombre urbaine "Ombre
 * mouvante" niv. 7 → vision dans le noir 18 m, Roublard "Perception aveugle" niv. 14 → vision
 * aveugle 3 m). Les options de choix imbriquées (ex. Rôdeur "Œil des profondeurs" niv. 15) ne
 * sont comptées que si leur id figure dans `selectedFeatureIds` (picks du joueur).
 */
export function classBonusSenses(
  cls: CharacterClass,
  subclassId: string | null | undefined,
  level: number,
  selectedFeatureIds: string[] = [],
): ClassBonusSenses {
  const data = progressionData(cls);
  const selected = new Set(selectedFeatureIds);
  let darkvisionRadius = 0;
  let blindsightRadius = 0;

  const scan = (feat: Record<string, unknown> | undefined | null) => {
    if (!feat) return;
    if (featureUnlockLevel(feat) > level) return;
    const mech = (feat['mechanics'] ?? {}) as Record<string, unknown>;
    const g = readSenseGrant(mech);
    darkvisionRadius = Math.max(darkvisionRadius, g.darkvision);
    blindsightRadius = Math.max(blindsightRadius, g.blindsight);

    const options = mech['options'];
    if (Array.isArray(options)) {
      for (const opt of options) {
        if (!opt || typeof opt !== 'object') continue;
        const o = opt as Record<string, unknown>;
        const optId = typeof o['id'] === 'string' ? o['id'] : undefined;
        if (optId && !selected.has(optId)) continue;
        const og = readSenseGrant(o);
        darkvisionRadius = Math.max(darkvisionRadius, og.darkvision);
        blindsightRadius = Math.max(blindsightRadius, og.blindsight);
      }
    }
  };

  const rootFeats = (data.features_details ?? []) as Record<string, unknown>[];
  for (const feat of rootFeats) scan(feat);

  if (subclassId) {
    const subs = data.subclasses as
      | { options?: { id?: string; features?: SubclassFeatureLike[]; features_details?: SubclassFeatureLike[] }[] }
      | undefined;
    const options = Array.isArray(subs) ? subs : (subs?.options ?? []);
    const sub = options.find((o) => o?.id === subclassId);
    if (sub) {
      for (const feat of dedupeSubclassFeatures(sub)) scan(feat as Record<string, unknown>);
    }
  }

  if (darkvisionRadius === 0 && blindsightRadius === 0) return EMPTY_CLASS_SENSES;
  return {
    darkvisionRadius,
    hasBlindsight: blindsightRadius > 0,
    blindsightRadius,
  };
}

/** Jets de sauvegarde accordés par une feature de la classe RACINE (ex. Esprit fuyant, Roublard niv. 15). */
export function classRootSavingThrowGrants(cls: CharacterClass, level: number): string[] {
  const data = progressionData(cls);
  const feats = (data.features_details ?? []) as SubclassFeatureLike[];
  const codes = new Set<string>();
  for (const feat of feats) {
    const featLevel = featureUnlockLevel(feat);
    if (featLevel > level) continue;
    const mech = feat.mechanics ?? {};
    const saveGrant = feat['grants_saving_throw_proficiency'] ?? mech['grants_saving_throw_proficiency'];
    for (const code of toStringArray(saveGrant)) codes.add(code.toLowerCase());
  }
  return [...codes];
}
