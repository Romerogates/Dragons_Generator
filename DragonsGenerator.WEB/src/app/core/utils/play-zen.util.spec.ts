import { playZenStorageKey, readPlayZenMode, writePlayZenMode } from './play-zen.util';

describe('play-zen.util', () => {
  it('reads zen from storage', () => {
    expect(readPlayZenMode(null)).toBeFalse();
    expect(readPlayZenMode({ getItem: () => null })).toBeFalse();
    expect(readPlayZenMode({ getItem: () => '1' })).toBeTrue();
    expect(readPlayZenMode({ getItem: () => '0' })).toBeFalse();
  });

  it('treats throwing storage as off', () => {
    expect(
      readPlayZenMode({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBeFalse();
  });

  it('writes or clears the zen key', () => {
    const store: Record<string, string> = {};
    const storage = {
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    };
    writePlayZenMode(true, storage);
    expect(store[playZenStorageKey()]).toBe('1');
    writePlayZenMode(false, storage);
    expect(store[playZenStorageKey()]).toBeUndefined();
  });

  it('ignores missing or throwing writers', () => {
    writePlayZenMode(true, null);
    writePlayZenMode(true, {
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
  });
});
