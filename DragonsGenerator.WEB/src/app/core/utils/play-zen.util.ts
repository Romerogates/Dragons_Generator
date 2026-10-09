const PLAY_ZEN_STORAGE_KEY = 'dragons_play_zen_mode';

export function playZenStorageKey(): string {
  return PLAY_ZEN_STORAGE_KEY;
}

export function readPlayZenMode(storage: Pick<Storage, 'getItem'> | null | undefined): boolean {
  try {
    return !!storage && storage.getItem(PLAY_ZEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writePlayZenMode(
  on: boolean,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined,
): void {
  try {
    if (!storage) return;
    if (on) storage.setItem(PLAY_ZEN_STORAGE_KEY, '1');
    else storage.removeItem(PLAY_ZEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
