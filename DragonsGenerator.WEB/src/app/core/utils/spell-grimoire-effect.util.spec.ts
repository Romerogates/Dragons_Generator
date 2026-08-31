import {
  buildGrimoireEffectSummary,
  layoutGrimoireEffect,
  normalizeSpellDescription,
  splitEffectForGrimoire,
} from './spell-grimoire-effect.util';
import type { Spell } from '@core/models/Spells/spell';

describe('spell-grimoire-effect.util', () => {
  const mockSpell = (overrides: Partial<Spell> = {}): Spell =>
    ({
      id: 'spl-test',
      name: 'Test',
      level: 1,
      school: 'evocation',
      castingTime: { amount: 1, unit: 'action' },
      range: { amount: 9, unit: 'm' },
      duration: { amount: null, unit: 'instantane' },
      components: { v: true, s: true, m: null },
      isRitual: false,
      isConcentration: false,
      isCorrupted: false,
      description: 'Vous infligez des dégâts.',
      modularOptions: [],
      classes: ['cls-pretre'],
      ...overrides,
    }) as Spell;

  it('normalizeSpellDescription fixes truncated Vous', () => {
    expect(normalizeSpellDescription('ous poussez un cri.')).toBe('Vous poussez un cri.');
    expect(normalizeSpellDescription('D Jous modifiez.')).toBe('Vous modifiez.');
  });

  it('buildGrimoireEffectSummary uses Instantanée and first sentence', () => {
    const summary = buildGrimoireEffectSummary(mockSpell());
    expect(summary).toContain('V,S');
    expect(summary).toContain('Instantanée');
    expect(summary).toContain('Vous infligez des dégâts.');
  });

  it('splitEffectForGrimoire separates components, duration and description', () => {
    const split = splitEffectForGrimoire('V,S | Instantanée | Vous touchez une créature.');
    expect(split.header).toBe('V,S · Instantanée');
    expect(split.body).toBe('Vous touchez une créature.');
  });

  it('splitEffectForGrimoire handles two-part summaries', () => {
    const split = splitEffectForGrimoire('V,S · Instantanée | Vous touchez une créature.');
    expect(split.header).toBe('V,S · Instantanée');
    expect(split.body).toBe('Vous touchez une créature.');
  });

  it('buildGrimoireEffectSummary truncates very long summaries', () => {
    const summary = buildGrimoireEffectSummary(
      mockSpell({
        description: `${'Mot '.repeat(80)}.`,
      }),
    );
    expect(summary.endsWith('…')).toBeTrue();
    expect(summary.length).toBeLessThanOrEqual(140);
  });

  it('layoutGrimoireEffect counts wrapped lines for row allocation', () => {
    const split = (text: string, maxWidth: number) => {
      const maxChars = Math.max(8, Math.floor(maxWidth / 2));
      if (text.length <= maxChars) return [text];
      const idx = text.lastIndexOf(' ', maxChars);
      const breakAt = idx > 0 ? idx : maxChars;
      return [text.slice(0, breakAt).trim(), text.slice(breakAt).trim()].filter(Boolean);
    };

    const layout = layoutGrimoireEffect(
      'V,S | Instantanée | Vous poussez un hurlement audible sur une longue distance.',
      split,
      40,
    );
    expect(layout.rowsNeeded).toBeGreaterThan(1);
    expect(layout.bodyLines.length).toBeGreaterThan(0);
  });

  it('layoutGrimoireEffect uses compact single line for short effects', () => {
    const split = (text: string) => [text];
    const layout = layoutGrimoireEffect(
      'V,S | Instantanée | Vous touchez une créature.',
      split,
      80,
    );
    expect(layout.bodyLines).toEqual([]);
    expect(layout.rowsNeeded).toBe(1);
  });

  it('layoutGrimoireEffect handles header-only summary', () => {
    const split = (text: string) => [text];
    const layout = layoutGrimoireEffect('V,S · Instantanée', split, 80);
    expect(layout.bodyLines).toEqual([]);
    expect(layout.headerLines).toEqual(['V,S · Instantanée']);
  });

  it('buildGrimoireEffectSummary includes material component', () => {
    const summary = buildGrimoireEffectSummary(
      mockSpell({
        components: { v: true, s: true, m: 'une goutte de sang' },
        duration: { amount: 1, unit: 'minute' },
        description:
          'Jusqu\'à trois créatures de votre choix dans un rayon de 9 mètres doivent effectuer un jet de sauvegarde.',
      }),
    );
    expect(summary).toContain('M(une goutte de sang)');
    expect(summary).toContain('1 min');
  });
});
