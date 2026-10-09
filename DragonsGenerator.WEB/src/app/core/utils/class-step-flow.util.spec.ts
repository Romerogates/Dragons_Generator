import {
  classStepCarouselTargetId,
  classStepPhaseSubtitle,
  classStepPhaseTitle,
  classStepSelectionComplete,
  resolveClassStepPhase,
  splitClassChoiceAnswers,
  toggleCappedPick,
  wrapCarouselIndex,
} from './class-step-flow.util';

describe('class-step-flow.util', () => {
  it('walks class → style → subclass → remaining style → choices', () => {
    const base = {
      holdPhase: null as null,
      classId: 'cls-g',
      subclassId: null as string | null,
      requiresSubclass: true,
      requiresCombatStyle: true,
      selectedStyleCount: 0,
      requiredStyleCount: 2,
      hasUnresolvedSubChoice: false,
      hasUnresolvedProgChoice: false,
      focusedProgChoice: false,
    };
    expect(resolveClassStepPhase({ ...base, classId: null })).toBe('class');
    expect(resolveClassStepPhase(base)).toBe('combat_style');
    expect(resolveClassStepPhase({ ...base, selectedStyleCount: 1 })).toBe('subclass');
    expect(
      resolveClassStepPhase({ ...base, selectedStyleCount: 1, subclassId: 'sub' }),
    ).toBe('combat_style');
    expect(
      resolveClassStepPhase({
        ...base,
        selectedStyleCount: 2,
        subclassId: 'sub',
        hasUnresolvedSubChoice: true,
      }),
    ).toBe('sub_choice');
    expect(
      resolveClassStepPhase({
        ...base,
        selectedStyleCount: 2,
        subclassId: 'sub',
        hasUnresolvedProgChoice: true,
      }),
    ).toBe('prog_choice');
    expect(resolveClassStepPhase({ ...base, holdPhase: 'subclass' })).toBe('subclass');
    expect(
      resolveClassStepPhase({
        ...base,
        requiresSubclass: false,
        requiresCombatStyle: false,
        selectedStyleCount: 0,
        requiredStyleCount: 0,
      }),
    ).toBe('class');
    expect(
      resolveClassStepPhase({
        ...base,
        requiresCombatStyle: false,
        requiredStyleCount: 0,
        selectedStyleCount: 0,
        subclassId: 'sub',
        focusedProgChoice: true,
      }),
    ).toBe('prog_choice');
  });

  it('toggles capped picks and wraps carousel index', () => {
    expect(toggleCappedPick([], 'a', 1)).toEqual(['a']);
    expect(toggleCappedPick(['a'], 'a', 1)).toEqual([]);
    expect(toggleCappedPick(['a'], 'b', 2)).toEqual(['a', 'b']);
    expect(toggleCappedPick(['a', 'b'], 'c', 2)).toEqual(['b', 'c']);
    expect(wrapCarouselIndex(5, 3)).toBe(2);
    expect(wrapCarouselIndex(-1, 3)).toBe(2);
    expect(wrapCarouselIndex(0, 0)).toBe(0);
  });

  it('computes completion, titles, and restore maps', () => {
    expect(
      classStepSelectionComplete({
        hasClass: false,
        requiresCombatStyle: false,
        combatStylesComplete: true,
        requiresSubclass: false,
        hasSubclass: false,
        unresolvedSubChoice: false,
        unresolvedProgChoice: false,
      }),
    ).toBeFalse();
    expect(
      classStepSelectionComplete({
        hasClass: true,
        requiresCombatStyle: true,
        combatStylesComplete: false,
        requiresSubclass: false,
        hasSubclass: false,
        unresolvedSubChoice: false,
        unresolvedProgChoice: false,
      }),
    ).toBeFalse();
    expect(
      classStepSelectionComplete({
        hasClass: true,
        requiresCombatStyle: false,
        combatStylesComplete: true,
        requiresSubclass: true,
        hasSubclass: true,
        unresolvedSubChoice: false,
        unresolvedProgChoice: false,
      }),
    ).toBeTrue();
    expect(classStepPhaseTitle({ phase: 'class' })).toBe('La Vocation');
    expect(classStepPhaseTitle({ phase: 'subclass' })).toBe('Spécialisation');
    expect(
      classStepPhaseTitle({
        phase: 'sub_choice',
        subChoiceLabel: 'Totem',
        subChoiceNeed: 2,
        subChoicePicked: 1,
      }),
    ).toBe('Totem (1/2)');
    expect(classStepPhaseTitle({ phase: 'prog_choice' })).toBe('Faites votre choix');
    expect(classStepPhaseSubtitle({ phase: 'combat_style', combatStyleNeed: 2, combatStylePicked: 1 })).toContain(
      '2 styles',
    );
    expect(classStepPhaseSubtitle({ phase: 'class' })).toContain('classe');
    const split = splitClassChoiceAnswers({ a: ['1'], b: ['2'], empty: [] }, new Set(['a']));
    expect([...split.sub.keys()]).toEqual(['a']);
    expect([...split.prog.keys()]).toEqual(['b']);
    expect(
      classStepCarouselTargetId({
        phase: 'combat_style',
        classId: 'c',
        subclassId: null,
        combatStyleIds: ['s1', 's2'],
        subChoiceLastPick: null,
        progChoiceLastPick: null,
      }),
    ).toBe('s2');
    expect(
      classStepCarouselTargetId({
        phase: 'class',
        classId: 'c',
        subclassId: 's',
        combatStyleIds: [],
        subChoiceLastPick: 'x',
        progChoiceLastPick: 'y',
      }),
    ).toBe('c');
    expect(
      classStepCarouselTargetId({
        phase: 'subclass',
        classId: 'c',
        subclassId: null,
        combatStyleIds: [],
        subChoiceLastPick: null,
        progChoiceLastPick: null,
      }),
    ).toBe('c');
    expect(classStepPhaseTitle({ phase: 'subclass', subclassConfigName: 'Voie' })).toBe('Voie');
    expect(classStepPhaseTitle({ phase: 'sub_choice', subChoiceLabel: 'École', subChoiceNeed: 1 })).toBe(
      'École',
    );
    expect(
      classStepPhaseTitle({
        phase: 'prog_choice',
        progChoiceLabel: 'Astuces',
        progChoiceNeed: 2,
        progChoicePicked: 0,
      }),
    ).toBe('Astuces (0/2)');
    expect(classStepPhaseSubtitle({ phase: 'subclass', className: 'Mage' })).toContain('Mage');
    expect(classStepPhaseSubtitle({ phase: 'sub_choice' })).toContain('sous-classe');
    expect(classStepPhaseSubtitle({ phase: 'prog_choice' })).toContain('progression');
    expect(classStepPhaseSubtitle({ phase: 'combat_style', combatStyleNeed: 1 })).toContain('approche');
    expect(
      classStepSelectionComplete({
        hasClass: true,
        requiresCombatStyle: false,
        combatStylesComplete: true,
        requiresSubclass: true,
        hasSubclass: false,
        unresolvedSubChoice: false,
        unresolvedProgChoice: false,
      }),
    ).toBeFalse();
    expect(
      classStepSelectionComplete({
        hasClass: true,
        requiresCombatStyle: false,
        combatStylesComplete: true,
        requiresSubclass: false,
        hasSubclass: false,
        unresolvedSubChoice: true,
        unresolvedProgChoice: false,
      }),
    ).toBeFalse();
    expect(
      classStepCarouselTargetId({
        phase: 'sub_choice',
        classId: 'c',
        subclassId: 's',
        combatStyleIds: [],
        subChoiceLastPick: 'totem',
        progChoiceLastPick: null,
      }),
    ).toBe('totem');
    expect(
      classStepCarouselTargetId({
        phase: 'prog_choice',
        classId: 'c',
        subclassId: 's',
        combatStyleIds: [],
        subChoiceLastPick: null,
        progChoiceLastPick: 'meta',
      }),
    ).toBe('meta');
    expect(splitClassChoiceAnswers({ z: undefined }, new Set()).prog.size).toBe(0);
  });
});
