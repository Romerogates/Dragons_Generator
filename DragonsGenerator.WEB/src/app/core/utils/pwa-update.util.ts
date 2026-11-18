export const PWA_UPDATE_SNOOZE_KEY = 'dg-pwa-update-snooze';
export const PWA_UPDATE_SNOOZE_MS = 60 * 60 * 1000;

type KvStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function isUpdateSnoozed(now = Date.now(), storage?: KvStorage | null): boolean {
  const store = storage === undefined ? localStorageOrNull() : storage;
  if (!store) return false;
  const raw = store.getItem(PWA_UPDATE_SNOOZE_KEY);
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until)) {
    store.removeItem(PWA_UPDATE_SNOOZE_KEY);
    return false;
  }
  if (until <= now) {
    store.removeItem(PWA_UPDATE_SNOOZE_KEY);
    return false;
  }
  return true;
}

export function snoozeUpdate(now = Date.now(), storage?: KvStorage | null): void {
  const store = storage === undefined ? localStorageOrNull() : storage;
  store?.setItem(PWA_UPDATE_SNOOZE_KEY, String(now + PWA_UPDATE_SNOOZE_MS));
}

export function clearUpdateSnooze(storage?: KvStorage | null): void {
  const store = storage === undefined ? localStorageOrNull() : storage;
  store?.removeItem(PWA_UPDATE_SNOOZE_KEY);
}

export async function clearAppCaches(
  serviceWorker?:
    | Pick<ServiceWorkerContainer, 'getRegistrations'>
    | { getRegistrations(): Promise<{ unregister(): Promise<boolean> }[]> }
    | null,
  cacheStorage?: Pick<CacheStorage, 'keys' | 'delete'> | null,
): Promise<void> {
  const sw = serviceWorker ?? (typeof navigator === 'undefined' ? null : navigator.serviceWorker);
  const cachesApi = cacheStorage ?? (typeof caches === 'undefined' ? null : caches);
  if (sw?.getRegistrations) {
    const regs = await sw.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if (cachesApi?.keys) {
    const keys = await cachesApi.keys();
    await Promise.all(keys.map((k) => cachesApi.delete(k)));
  }
}

function localStorageOrNull(): KvStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}
