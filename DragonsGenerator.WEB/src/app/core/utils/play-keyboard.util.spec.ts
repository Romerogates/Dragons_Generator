import {
  isButtonishPlayShortcutTarget,
  isEditablePlayShortcutTarget,
  mjTableShortcutFromKey,
  playShortcutBlockedByOverlay,
  shouldFlushPlayNotesOnViewChange,
} from './play-keyboard.util';

describe('play-keyboard.util', () => {
  it('maps Space / letters to MJ shortcuts', () => {
    expect(mjTableShortcutFromKey(' ')).toBe('space');
    expect(mjTableShortcutFromKey('Spacebar')).toBe('space');
    expect(mjTableShortcutFromKey('n')).toBe('n');
    expect(mjTableShortcutFromKey('z')).toBe('z');
    expect(mjTableShortcutFromKey('Escape')).toBeNull();
  });

  it('ignores editable fields and buttons', () => {
    const input = document.createElement('input');
    const area = document.createElement('textarea');
    const select = document.createElement('select');
    const btn = document.createElement('button');
    const div = document.createElement('div');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    expect(isEditablePlayShortcutTarget(null)).toBeFalse();
    expect(isEditablePlayShortcutTarget(input)).toBeTrue();
    expect(isEditablePlayShortcutTarget(area)).toBeTrue();
    expect(isEditablePlayShortcutTarget(select)).toBeTrue();
    expect(isEditablePlayShortcutTarget(editable)).toBeTrue();
    expect(isEditablePlayShortcutTarget(div)).toBeFalse();
    expect(isButtonishPlayShortcutTarget(null)).toBeFalse();
    expect(isButtonishPlayShortcutTarget(btn)).toBeTrue();
    expect(isButtonishPlayShortcutTarget(div)).toBeFalse();
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'button');
    const inner = document.createElement('span');
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    expect(isButtonishPlayShortcutTarget(inner)).toBeTrue();
    wrap.remove();
  });

  it('blocks shortcuts under dungeon fullscreen or handwritten notes', () => {
    expect(playShortcutBlockedByOverlay(null)).toBeFalse();
    const root = document.createElement('div');
    expect(playShortcutBlockedByOverlay(root)).toBeFalse();
    const shell = document.createElement('div');
    shell.className = 'dungeon-shell--fullscreen';
    root.appendChild(shell);
    expect(playShortcutBlockedByOverlay(root)).toBeTrue();
    root.replaceChildren();
    const notes = document.createElement('div');
    notes.setAttribute('aria-label', 'Notes à la main');
    root.appendChild(notes);
    expect(playShortcutBlockedByOverlay(root)).toBeTrue();
  });

  it('flushes notes only when leaving the notes view', () => {
    expect(shouldFlushPlayNotesOnViewChange('notes', 'combat')).toBeTrue();
    expect(shouldFlushPlayNotesOnViewChange('notes', 'notes')).toBeFalse();
    expect(shouldFlushPlayNotesOnViewChange('combat', 'resume')).toBeFalse();
  });
});
