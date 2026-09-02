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
      return c.classId !== null;
    case 5:
      return c.pointsRemaining >= 0;
    case 6:
      return true;
    case 7:
      return true;
    case 8:
      return c.languages.length > 0;
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
