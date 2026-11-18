import {
  clearAppCaches,
  clearUpdateSnooze,
  isUpdateSnoozed,
  PWA_UPDATE_SNOOZE_KEY,
  PWA_UPDATE_SNOOZE_MS,
  snoozeUpdate,
} from './pwa-update.util';

function memoryStore(seed: Record<string, string> = {}): Storage {
  const data = { ...seed };
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    key() {
      return null;
    },
    removeItem(key: string) {
      delete data[key];
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  } as Storage;
}

describe('pwa-update.util', () => {
  it('snoozes then expires', () => {
    const store = memoryStore();
    const now = 1_000_000;
    expect(isUpdateSnoozed(now, store)).toBeFalse();
    snoozeUpdate(now, store);
    expect(store.getItem(PWA_UPDATE_SNOOZE_KEY)).toBe(String(now + PWA_UPDATE_SNOOZE_MS));
    expect(isUpdateSnoozed(now + 10, store)).toBeTrue();
    expect(isUpdateSnoozed(now + PWA_UPDATE_SNOOZE_MS + 1, store)).toBeFalse();
    expect(store.getItem(PWA_UPDATE_SNOOZE_KEY)).toBeNull();
  });

  it('clears a corrupt snooze value', () => {
    const store = memoryStore({ [PWA_UPDATE_SNOOZE_KEY]: 'nope' });
    expect(isUpdateSnoozed(0, store)).toBeFalse();
    expect(store.getItem(PWA_UPDATE_SNOOZE_KEY)).toBeNull();
    clearUpdateSnooze(store);
  });

  it('treats missing storage as not snoozed', () => {
    expect(isUpdateSnoozed(0, null)).toBeFalse();
    snoozeUpdate(0, null);
    clearUpdateSnooze(null);
  });

  it('noops when cache APIs are missing', async () => {
    await expectAsync(clearAppCaches(null, null)).toBeResolved();
    await expectAsync(
      clearAppCaches(
        {} as Pick<ServiceWorkerContainer, 'getRegistrations'>,
        {} as Pick<CacheStorage, 'keys' | 'delete'>,
      ),
    ).toBeResolved();
  });

  it('unregisters workers and deletes caches', async () => {
    const unregister = jasmine.createSpy('unregister').and.resolveTo(true);
    const del = jasmine.createSpy('delete').and.resolveTo(true);
    await clearAppCaches(
      {
        getRegistrations: () =>
          Promise.resolve([{ unregister }]),
      },
      { keys: () => Promise.resolve(['ngsw:abc']), delete: del },
    );
    expect(unregister).toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith('ngsw:abc');
  });
});
