import type { FeatureInstance } from '@core/models/Character/character';
import { COMBAT_STYLE_FALLBACK, isConcreteCombatStyleId } from './class-step-combat.util';
import { labelForGameId } from './game-id-labels';

/** Choix d’ennemi juré / terrain (IDs stockés comme fausses aptitudes). */
export function isRangerChoiceFeatureId(refId: string | undefined): 'enemy' | 'terrain' | null {
  const id = refId ?? '';
  if (/^ennemi-/.test(id)) return 'enemy';
  if (/^terrain-/.test(id)) return 'terrain';
  return null;
}

export function formatFeatureSheetLabel(feat: Pick<FeatureInstance, 'name' | 'refId'>): string {
  const id = feat.refId ?? '';
  const style = COMBAT_STYLE_FALLBACK[id];
  if (style) return `Style : ${style.name}`;
  if (isConcreteCombatStyleId(id)) {
    const fallbackId = id.replace(/^feat-/, '');
    return `Style : ${COMBAT_STYLE_FALLBACK[fallbackId]?.name ?? labelForGameId(fallbackId)}`;
  }

  let name = (feat.name ?? '').trim();
  const styleMatch = name.match(/^Style\s*:\s*(.+)$/i);
  if (styleMatch) {
    const raw = styleMatch[1].trim();
    const fb = COMBAT_STYLE_FALLBACK[raw];
    return `Style : ${fb?.name ?? labelForGameId(raw)}`;
  }

  if (/^[a-z0-9]+(-[a-z0-9]+)+$/i.test(name)) return labelForGameId(name);
  return name || (id ? labelForGameId(id) : '');
}

/**
 * Fusionne les choix rôdeur (ennemi / terrain) dans l’aptitude parente
 * et humanise les styles de combat (évite les IDs bruts sur la fiche PDF).
 */
export function foldFeaturesForSheet(features: FeatureInstance[]): FeatureInstance[] {
  const enemies: string[] = [];
  const terrains: string[] = [];
  const rest: FeatureInstance[] = [];

  for (const f of features) {
    const kind = isRangerChoiceFeatureId(f.refId);
    if (kind === 'enemy') {
      enemies.push(labelForGameId((f.refId ?? '').replace(/^ennemi-/, '')));
      continue;
    }
    if (kind === 'terrain') {
      terrains.push(labelForGameId((f.refId ?? '').replace(/^terrain-/, '')));
      continue;
    }
    rest.push(f);
  }

  return rest.map((f) => {
    const id = f.refId ?? '';
    const base = formatFeatureSheetLabel(f);
    if (id === 'feat-ennemi-jure' && enemies.length) {
      return { ...f, name: `${base} : ${enemies.join(', ')}` };
    }
    if ((id === 'feat-explorateur-ne' || id.includes('explorateur-ne')) && terrains.length) {
      return { ...f, name: `${base} : ${terrains.join(', ')}` };
    }
    return { ...f, name: base };
  });
}
