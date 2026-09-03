import type { CharacterCreation } from '@core/models/Character/character';

export interface WizardStepValidationContext {
  needsMagicStep: boolean;
}

/** Tous les sorts raciaux requis ont été choisis (étape Magie). */
export function racialSpellsComplete(
  c: Pick<CharacterCreation, 'racialSpellGrants' | 'speciesChoiceAnswers'>,
): boolean {
  const grants = c.racialSpellGrants ?? [];
  if (!grants.length) return true;
  const answers = c.speciesChoiceAnswers ?? {};
  return grants.every((g) => {
    const pick = answers[g.choiceId]?.[0];
    return !!pick && pick !== 'any_wizard_cantrip';
  });
}

function asiChoicesComplete(c: CharacterCreation): boolean {
  const slots = c.asiChoices ?? [];
  if (slots.length === 0) return true;
  return slots.every((s) => {
    if (s.mode === 'feat') return !!s.featId;
    if (s.mode === 'plus2') return !!s.primary;
    return !!s.primary && !!s.secondary && s.primary !== s.secondary;
  });
}

function languagesStepComplete(c: CharacterCreation): boolean {
  if (c.languages.length === 0) return false;
  const bonusNeeded = c.bonusLanguageCount ?? 0;
  if (bonusNeeded <= 0) return true;
  const locked = new Set<string>([
    ...(c.speciesLanguages ?? []),
    ...(c.civilizationLanguages ?? []),
    ...(c.backgroundLanguages ?? []),
  ]);
  // Langues de classe verrouillées côté UI (Druide / Roublard)
  if (c.classId === 'cls-druide') locked.add('Langue des druides');
  if (c.classId === 'cls-roublard') locked.add('Argot des voleurs');
  const bonusPicked = c.languages.filter((l) => !locked.has(l)).length;
  return bonusPicked >= bonusNeeded;
}

function classStepComplete(c: CharacterCreation): boolean {
  // setClass() pose hitDie > 0 ; classId seul peut rester d'un état partiel
  return c.classId !== null && (c.hitDie ?? 0) > 0;
}

function skillsStepComplete(c: CharacterCreation): boolean {
  if (!c.classId) return false;
  const needed =
    (c.skillChooseCount ?? 0) + (c.speciesBonusSkillCount ?? 0);
  if ((c.selectedSkills?.length ?? 0) < needed) return false;
  // Historique preset : au moins les compétences BG si choose attendu — on exige
  // que setProficiencies ait été appelé (selectedSkills peuplé OU skillChooseCount 0)
  if (needed === 0 && (c.selectedSkills?.length ?? 0) === 0 && (c.skillChooseCount ?? 0) === 0) {
    // Classes sans skill choose (rare) : OK si la classe est posée
    return true;
  }
  return true;
}

export function isWizardStepValid(
  step: number,
  c: CharacterCreation,
  ctx: WizardStepValidationContext,
): boolean {
  switch (step) {
    case 1:
      return c.speciesId !== null;
    case 2:
      return c.civilizationId !== null;
    case 3:
      return c.backgroundId !== null;
    case 4:
      return classStepComplete(c);
    case 5:
      return c.pointsRemaining === 0 && asiChoicesComplete(c);
    case 6:
      return skillsStepComplete(c);
    case 7:
      return c.selectedEquipment.length > 0;
    case 8:
      return languagesStepComplete(c);
    case 9:
      if (ctx.needsMagicStep) {
        if (!racialSpellsComplete(c)) return false;
        if (c.hasSpellcasting) {
          const details = c.spellcastingDetails as Record<string, unknown> | undefined;
          return !!details && Object.keys(details).length > 0;
        }
        const details = c.spellcastingDetails as { cantrips?: unknown[] } | undefined;
        return !!(details?.cantrips?.length);
      }
      return c.name.trim().length > 0;
    case 10:
      if (ctx.needsMagicStep) return c.name.trim().length > 0;
      return true;
    case 11:
      return true;
    default:
      return false;
  }
}
