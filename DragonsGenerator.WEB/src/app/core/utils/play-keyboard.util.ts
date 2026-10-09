import type { PlaySessionView } from './play-table.util';

/** Raccourcis MJ de la table (`campaign-play` → `handleMjShortcut`). */
export type MjTableShortcut = 'space' | 'n' | 'd' | 'f' | 's' | 'z';

export function isEditablePlayShortcutTarget(target: EventTarget | null): boolean {
  if (!target || typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false;
  }
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  return target.isContentEditable === true;
}

export function isButtonishPlayShortcutTarget(target: EventTarget | null): boolean {
  if (!target || typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLButtonElement) return true;
  return typeof target.closest === 'function' && !!target.closest('button, [role="button"]');
}

export function playShortcutBlockedByOverlay(root: ParentNode | null | undefined): boolean {
  if (!root || typeof root.querySelector !== 'function') return false;
  return !!(
    root.querySelector('.dungeon-shell--fullscreen') ||
    root.querySelector('[aria-label="Notes à la main"]')
  );
}

export function mjTableShortcutFromKey(key: string): MjTableShortcut | null {
  if (key === ' ' || key === 'Spacebar') return 'space';
  if (key === 'n' || key === 'd' || key === 'f' || key === 's' || key === 'z') return key;
  return null;
}

export function shouldFlushPlayNotesOnViewChange(
  from: PlaySessionView,
  to: PlaySessionView,
): boolean {
  return from === 'notes' && to !== 'notes';
}
