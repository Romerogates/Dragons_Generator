import type { CharacterCreation } from '@core/models/Character/character';
import { resolveSpellQuota, spellPickCount } from '../spell-quota.util';
import { asExtended } from './types';
import { racialSpellsComplete } from './racial';

function wizardClassLevel(c: CharacterCreation): number {
  if (c.classId === 'cls-magicien' || c.spellcastingKind === 'wizard') {
    return c.targetLevel || 1;
  }
  const secondary = (asExtended(c).secondaryClasses ?? []).find(
    (sc) => sc.classId === 'cls-magicien' || sc.spellcastingKind === 'wizard',
  );
  return secondary?.level ?? 0;
}

function wizardHighLevelPicksComplete(c: CharacterCreation): boolean {
  const level = wizardClassLevel(c);
  if (level < 17) return true;
  const details = c.spellcastingDetails as
    | { spellMastery?: unknown[]; signatureSpells?: unknown[] }
    | undefined;
  const masteryOk =
    (Array.isArray(details?.spellMastery) && details.spellMastery.length >= 2) ||
    (!!c.spellMasteryPicks?.['1'] && !!c.spellMasteryPicks?.['2']);
  if (!masteryOk) return false;
  if (level < 19) return true;
  return (
    (Array.isArray(details?.signatureSpells) && details.signatureSpells.length >= 2) ||
    (c.signatureSpellIds?.length ?? 0) >= 2
  );
}

function countSpellInstances(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

/**
 * Vérifie les quotas de sorts (repli kind si JSON classe absent).
 * Exposée pour les tests ; utilisée par l’étape Magie via isWizardStepValid.
 */
export function magicDetailsComplete(c: CharacterCreation): boolean {
  if (!racialSpellsComplete(c)) return false;
  const details = c.spellcastingDetails as
    | {
        cantrips?: unknown[];
        spells?: unknown[];
        deityId?: string;
        deity?: string;
        mysticArcanum?: { spellId?: string }[];
      }
    | undefined;
  const hasSecondaryCaster = (asExtended(c).secondaryClasses ?? []).some((sc) => sc.hasSpellcasting);
  if (!c.hasSpellcasting && !hasSecondaryCaster) {
    return true;
  }
  if (!details) return false;

  const cantripCount = countSpellInstances(details.cantrips);
  const spellCount = countSpellInstances(details.spells);

  if (c.hasSpellcasting && c.spellcastingKind) {
    const bonusCantrips = c.subclassId === 'subcls-cercle-de-la-terre' ? 1 : 0;
    const quota = resolveSpellQuota({
      cls: null,
      kind: c.spellcastingKind,
      classLevel: c.targetLevel || 1,
      bonusCantrips,
    });
    if (quota) {
      if (cantripCount < quota.cantrips) return false;
      const needSpells = spellPickCount(quota);
      if (needSpells > 0 && !quota.hasFullListAccess && spellCount < needSpells) return false;
    }
    if (c.spellcastingKind === 'cleric' && !(details.deityId || details.deity)) return false;
    if (c.spellcastingKind === 'warlock') {
      const level = c.targetLevel || 1;
      const arcanumLevels = [11, 13, 15, 17].filter((l) => level >= l);
      if (arcanumLevels.length) {
        const picks = Array.isArray(details.mysticArcanum) ? details.mysticArcanum : [];
        if (picks.filter((p) => !!p?.spellId).length < arcanumLevels.length) return false;
      }
    }
  }

  if (!wizardHighLevelPicksComplete(c)) return false;

  if (hasSecondaryCaster && !c.hasSpellcasting) {
    return cantripCount > 0 || spellCount > 0;
  }

  return cantripCount > 0 || spellCount > 0 || !!(details.deityId || details.deity);
}
