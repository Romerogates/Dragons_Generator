import {
  consumePendingForgeAction,
  nextLevelUpTarget,
  resolveForgeEntry,
  shouldFallbackAutoCompleteToGenerate,
  shouldStartLevelUp,
} from './forge-bootstrap.util';

describe('forge-bootstrap.util', () => {
  it('prioritizes edit, then draft, then mode prompt', () => {
    expect(
      resolveForgeEntry({
        hasEditData: true,
        hasPendingDraft: true,
        isEditMode: false,
        skipModePrompt: false,
      }),
    ).toBe('edit');
    expect(
      resolveForgeEntry({
        hasEditData: false,
        hasPendingDraft: true,
        isEditMode: false,
        skipModePrompt: false,
      }),
    ).toBe('draft');
    expect(
      resolveForgeEntry({
        hasEditData: false,
        hasPendingDraft: false,
        isEditMode: false,
        skipModePrompt: false,
      }),
    ).toBe('mode_prompt');
    expect(
      resolveForgeEntry({
        hasEditData: false,
        hasPendingDraft: false,
        isEditMode: true,
        skipModePrompt: false,
      }),
    ).toBe('blank');
    expect(
      resolveForgeEntry({
        hasEditData: false,
        hasPendingDraft: false,
        isEditMode: false,
        skipModePrompt: true,
      }),
    ).toBe('blank');
  });

  it('detects level-up query', () => {
    expect(shouldStartLevelUp(null)).toBeFalse();
    expect(shouldStartLevelUp('')).toBeFalse();
    expect(shouldStartLevelUp('tab=players')).toBeFalse();
    expect(shouldStartLevelUp('levelUp=1')).toBeTrue();
    expect(shouldStartLevelUp('?levelUp=1&characterId=x')).toBeTrue();
  });

  it('bumps level until 20', () => {
    expect(nextLevelUpTarget(3)).toBe(4);
    expect(nextLevelUpTarget(20)).toBe(20);
    expect(nextLevelUpTarget(19, 19)).toBe(19);
  });

  it('falls back auto-complete when species or class is missing', () => {
    expect(shouldFallbackAutoCompleteToGenerate({})).toBeTrue();
    expect(shouldFallbackAutoCompleteToGenerate({ speciesId: 'elf' })).toBeTrue();
    expect(shouldFallbackAutoCompleteToGenerate({ classId: 'fighter' })).toBeTrue();
    expect(
      shouldFallbackAutoCompleteToGenerate({ speciesId: 'elf', classId: 'fighter' }),
    ).toBeFalse();
  });

  it('consumes only generate/complete pending actions', () => {
    expect(consumePendingForgeAction(null)).toBeNull();
    expect(consumePendingForgeAction('generate')).toBe('generate');
    expect(consumePendingForgeAction('complete')).toBe('complete');
  });
});
