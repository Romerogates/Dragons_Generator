/**
 * Auto-complète les choix encore ouverts dans la forge (langues bonus, sorts, compétences),
 * en réutilisant les helpers de `character-auto-build.util`.
 */
import type { AbilityScores, CharacterCreation } from '@core/models/Character/character';
import type { Language } from '@core/models/Languages/language';
import type { Spell } from '@core/models/Spells/spell';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import {
  buildAutoSpellcastingDetails,
  pickBonusLanguages,
  pickRandomSubset,
} from './character-auto-build.util';

export interface AutoCompleteCatalogs {
  languages: Language[];
  spells: Spell[];
  classJson?: CharacterClass | null;
  abilityModifiers?: Partial<AbilityScores> | null;
}

export interface AutoCompleteResult {
  creation: CharacterCreation;
  filled: string[];
}

/** Complète langues bonus + sorts/compétences manquants sans écraser les choix déjà faits. */
export function autoCompleteRemainingCreation(
  creation: CharacterCreation,
  catalogs: AutoCompleteCatalogs,
): AutoCompleteResult {
  const next = structuredClone(creation) as CharacterCreation;
  const filled: string[] = [];

  const locked = new Set<string>([
    ...(next.speciesLanguages ?? []),
    ...(next.civilizationLanguages ?? []),
    ...(next.backgroundLanguages ?? []),
  ]);
  if (next.classId === 'cls-druide') locked.add('Langue des druides');
  if (next.classId === 'cls-roublard') locked.add('Argot des voleurs');

  const bonusNeeded = next.bonusLanguageCount ?? 0;
  const bonusPicked = (next.languages ?? []).filter((l) => !locked.has(l)).length;
  const langGap = Math.max(0, bonusNeeded - bonusPicked);
  if (langGap > 0 && catalogs.languages.length) {
    const extras = pickBonusLanguages(catalogs.languages, locked, langGap);
    if (extras.length) {
      next.languages = [...(next.languages ?? []), ...extras];
      filled.push('langues');
    }
  }

  if (next.hasSpellcasting && catalogs.classJson && catalogs.spells.length) {
    const details = (next.spellcastingDetails ?? {}) as {
      cantrips?: unknown[];
      spells?: unknown[];
      deityId?: string;
      deity?: string;
    };
    const auto = buildAutoSpellcastingDetails(
      catalogs.classJson,
      catalogs.spells,
      next.racialSpellGrants ?? [],
      next.speciesChoiceAnswers ?? {},
      catalogs.abilityModifiers ?? null,
      { level: next.targetLevel || 1, subclassId: next.subclassId },
    );
    if (auto) {
      const merged = { ...details };
      let changed = false;
      if ((!Array.isArray(details.cantrips) || details.cantrips.length === 0) && Array.isArray(auto['cantrips']) && (auto['cantrips'] as unknown[]).length) {
        merged.cantrips = auto['cantrips'] as unknown[];
        changed = true;
      }
      if ((!Array.isArray(details.spells) || details.spells.length === 0) && Array.isArray(auto['spells']) && (auto['spells'] as unknown[]).length) {
        merged.spells = auto['spells'] as unknown[];
        changed = true;
      }
      if (next.spellcastingKind === 'cleric' && !(details.deityId || details.deity) && (auto['deityId'] || auto['deity'])) {
        merged.deityId = (auto['deityId'] as string) ?? undefined;
        merged.deity = (auto['deity'] as string) ?? undefined;
        changed = true;
      }
      if (changed) {
        next.spellcastingDetails = merged;
        filled.push('magie');
      }
    }
  }

  const skillNeed = (next.skillChooseCount ?? 0) + (next.speciesBonusSkillCount ?? 0);
  const skillHave = next.selectedSkills?.length ?? 0;
  if (skillNeed > skillHave) {
    const pool = (next.skillOptions ?? []).filter((id) => !(next.selectedSkills ?? []).includes(id));
    const pick = pickRandomSubset(pool, skillNeed - skillHave);
    if (pick.length) {
      next.selectedSkills = [...(next.selectedSkills ?? []), ...pick];
      filled.push('compétences');
    }
  }

  return { creation: next, filled };
}
