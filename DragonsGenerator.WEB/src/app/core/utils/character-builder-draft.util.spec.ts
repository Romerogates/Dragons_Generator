import {
  CHARACTER_BUILDER_STORAGE_KEY,
  builderDraftStorageKey,
  clearBuilderDraftStorage,
  isMeaningfulBuilderDraft,
  purgeLegacyBuilderDraftKeys,
  readBuilderDraftFromStorage,
  writeBuilderDraftToStorage,
} from './character-builder-draft.util';
import { INITIAL_CREATION_STATE } from '../models/Character/character-builder.types';

describe('character-builder-draft.util', () => {
  it('keys brouillon forge vs édition', () => {
    expect(builderDraftStorageKey(null)).toBe(CHARACTER_BUILDER_STORAGE_KEY);
    expect(builderDraftStorageKey('abc')).toBe(`${CHARACTER_BUILDER_STORAGE_KEY}_edit_abc`);
  });

  it('détecte un brouillon utile', () => {
    expect(isMeaningfulBuilderDraft({ ...INITIAL_CREATION_STATE }, 1)).toBe(false);
    expect(isMeaningfulBuilderDraft({ ...INITIAL_CREATION_STATE, speciesId: 'sp-1' }, 1)).toBe(true);
    expect(isMeaningfulBuilderDraft({ ...INITIAL_CREATION_STATE }, 2)).toBe(true);
  });

  it('écrit et relit un brouillon', () => {
    const store: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    } as Storage;
    writeBuilderDraftToStorage(storage, CHARACTER_BUILDER_STORAGE_KEY, { ...INITIAL_CREATION_STATE }, 1, null);
    expect(store[CHARACTER_BUILDER_STORAGE_KEY]).toBeUndefined();
    writeBuilderDraftToStorage(
      storage,
      CHARACTER_BUILDER_STORAGE_KEY,
      { ...INITIAL_CREATION_STATE, name: 'Lira' },
      1,
      null,
    );
    const read = readBuilderDraftFromStorage(storage);
    expect(read?.creation.name).toBe('Lira');
    expect(read?.currentStep).toBe(1);
  });

  it('ignore JSON invalide ou brouillon vide', () => {
    const store: Record<string, string> = { [CHARACTER_BUILDER_STORAGE_KEY]: '{not-json' };
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    } as Storage;
    expect(readBuilderDraftFromStorage(storage)).toBeNull();
    store[CHARACTER_BUILDER_STORAGE_KEY] = JSON.stringify({ currentStep: 1 });
    expect(readBuilderDraftFromStorage(storage)).toBeNull();
    store['dragon_character_builder_v5'] = 'x';
    store['dragon_character_builder_v4'] = 'y';
    purgeLegacyBuilderDraftKeys(storage);
    expect(store['dragon_character_builder_v5']).toBeUndefined();
    clearBuilderDraftStorage(storage, 'id-1');
    expect(store[CHARACTER_BUILDER_STORAGE_KEY]).toBeUndefined();
  });
});
