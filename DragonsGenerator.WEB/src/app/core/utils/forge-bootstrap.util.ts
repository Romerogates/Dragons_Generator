/** Entrée forge : brouillon / édition / pré-tiré, level-up, auto-complétion. */

export type PendingForgeAction = 'generate' | 'complete';

export type ForgeEntryKind = 'edit' | 'draft' | 'mode_prompt' | 'blank';

export function resolveForgeEntry(opts: {
  hasEditData: boolean;
  hasPendingDraft: boolean;
  isEditMode: boolean;
  skipModePrompt: boolean;
}): ForgeEntryKind {
  if (opts.hasEditData) return 'edit';
  if (opts.hasPendingDraft && !opts.isEditMode) return 'draft';
  if (!opts.skipModePrompt && !opts.isEditMode) return 'mode_prompt';
  return 'blank';
}

export function shouldStartLevelUp(search: string | null | undefined): boolean {
  if (!search) return false;
  const q = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(q).get('levelUp') === '1';
}

export function nextLevelUpTarget(current: number, max = 20): number {
  return current < max ? current + 1 : current;
}

export function shouldFallbackAutoCompleteToGenerate(creation: {
  speciesId?: string | null;
  classId?: string | null;
}): boolean {
  return !creation.speciesId || !creation.classId;
}

export function consumePendingForgeAction(
  action: PendingForgeAction | null,
): PendingForgeAction | null {
  return action === 'generate' || action === 'complete' ? action : null;
}
