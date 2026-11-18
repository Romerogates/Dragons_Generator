import type { CharacterCreation } from '@core/models/Character/character';
import type { ExtendedCharacterCreation } from '@core/models/Character/character-builder.types';

export interface WizardStepValidationContext {
  needsMagicStep: boolean;
}

export function asExtended(c: CharacterCreation): ExtendedCharacterCreation {
  return c as ExtendedCharacterCreation;
}
