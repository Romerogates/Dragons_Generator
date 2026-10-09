import { dungeonShareUrl } from '@core/utils/dungeon-library-shell.util';
import { LibraryDungeonEditor } from './library-dungeon-editor';

describe('LibraryDungeonEditor', () => {
  it('is the library editor shell around campaign dungeon maps', () => {
    expect(LibraryDungeonEditor).toBeDefined();
    expect(dungeonShareUrl('https://dragons.local', 'abc')).toContain('/dungeons/shared/abc');
  });
});
