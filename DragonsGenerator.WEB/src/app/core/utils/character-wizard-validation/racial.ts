import type { CharacterCreation } from '@core/models/Character/character';

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
