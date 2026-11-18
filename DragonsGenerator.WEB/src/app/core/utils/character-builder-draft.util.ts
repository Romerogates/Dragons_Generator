import type { CharacterBuildEditingRef } from './character-build.util';
import {
  INITIAL_CREATION_STATE,
  type ExtendedCharacterCreation,
} from '../models/Character/character-builder.types';

export const CHARACTER_BUILDER_STORAGE_KEY = 'dragon_character_builder_v6';
const LEGACY_DRAFT_KEYS = ['dragon_character_builder_v5', 'dragon_character_builder_v4'] as const;

export function builderDraftStorageKey(editingId: string | null | undefined): string {
  return editingId ? `${CHARACTER_BUILDER_STORAGE_KEY}_edit_${editingId}` : CHARACTER_BUILDER_STORAGE_KEY;
}

/** Brouillon utile : niveau > 1, étape > 1, ou tout champ identité/build. */
export function isMeaningfulBuilderDraft(creation: ExtendedCharacterCreation, step: number): boolean {
  return (
    step > 1 ||
    (creation.targetLevel ?? 1) > 1 ||
    !!creation.speciesId ||
    !!creation.classId ||
    !!creation.civilizationId ||
    !!creation.backgroundId ||
    !!(creation.name && creation.name.trim())
  );
}

export function purgeLegacyBuilderDraftKeys(storage: Storage): void {
  for (const key of LEGACY_DRAFT_KEYS) {
    storage.removeItem(key);
  }
}

export function clearBuilderDraftStorage(storage: Storage, editingId: string | null | undefined): void {
  storage.removeItem(CHARACTER_BUILDER_STORAGE_KEY);
  if (editingId) storage.removeItem(`${CHARACTER_BUILDER_STORAGE_KEY}_edit_${editingId}`);
}

export interface StoredBuilderDraft {
  creation: ExtendedCharacterCreation;
  currentStep: number;
  editing?: CharacterBuildEditingRef | null;
}

export function readBuilderDraftFromStorage(storage: Storage): StoredBuilderDraft | null {
  const raw = storage.getItem(CHARACTER_BUILDER_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      creation?: ExtendedCharacterCreation;
      currentStep?: number;
      editing?: CharacterBuildEditingRef | null;
    };
    if (!parsed?.creation) return null;
    const step = Number(parsed.currentStep) || 1;
    const creation = {
      ...structuredClone(INITIAL_CREATION_STATE),
      ...parsed.creation,
    };
    if (!isMeaningfulBuilderDraft(creation, step)) return null;
    return { creation, currentStep: Math.max(1, Math.min(step, 20)), editing: parsed.editing };
  } catch {
    return null;
  }
}

export function writeBuilderDraftToStorage(
  storage: Storage,
  key: string,
  creation: ExtendedCharacterCreation,
  step: number,
  editing: CharacterBuildEditingRef | null,
): void {
  if (!isMeaningfulBuilderDraft(creation, step)) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(
    key,
    JSON.stringify({
      creation,
      currentStep: step,
      savedAt: Date.now(),
      editing,
    }),
  );
}
