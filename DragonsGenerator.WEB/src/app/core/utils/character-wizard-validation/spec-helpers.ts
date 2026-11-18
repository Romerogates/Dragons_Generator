import type { CharacterCreation } from '@core/models/Character/character';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';

export const base = INITIAL_CREATION_STATE as CharacterCreation;

export const WIZARD_CANTRIPS = ['sp-c1', 'sp-c2', 'sp-c3'];
export const WIZARD_SPELLS = ['sp-s1', 'sp-s2', 'sp-s3', 'sp-s4', 'sp-s5', 'sp-s6'];
export const CLERIC_CANTRIPS = ['sp-c1', 'sp-c2', 'sp-c3'];

