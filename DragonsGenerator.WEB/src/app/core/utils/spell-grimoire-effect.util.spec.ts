import {
  buildGrimoireEffectSummary,
  layoutGrimoireEffect,
  normalizeSpellDescription,
  paginateGrimoireOverflow,
  planGrimoireTable,
  splitEffectForGrimoire,
} from './spell-grimoire-effect.util';
import type { Spell } from '@core/models/Spells/spell';
import type { SpellInstance } from '@core/models/Character/character';

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

  const inst = (name: string, summary: string, level = 1): SpellInstance => ({
    refId: `spl-${name}`,
    name,
    level,
    prepared: true,
    effectSummary: summary,
  });

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

  it('buildGrimoireEffectSummary handles spell without description', () => {
    const summary = buildGrimoireEffectSummary(mockSpell({ description: '' }));
    expect(summary).toBe('V,S | Instantanée');
  });

  it('buildGrimoireEffectSummary shortens hour duration', () => {
    const summary = buildGrimoireEffectSummary(
      mockSpell({ duration: { amount: 1, unit: 'heure' } }),
    );
    expect(summary).toContain('1 h');
    expect(summary).not.toContain('heure');
  });

  it('buildGrimoireEffectSummary shortens round and day durations', () => {
    const round = buildGrimoireEffectSummary(
      mockSpell({ duration: { amount: 2, unit: 'rounds' } }),
    );
    const day = buildGrimoireEffectSummary(
      mockSpell({ duration: { amount: 3, unit: 'jours' } }),
    );
    expect(round).toContain('2 rd');
    expect(day).toContain('3 j');
  });

  it('buildGrimoireEffectSummary keeps full first sentence (no 140 char cut)', () => {
    const summary = buildGrimoireEffectSummary(
      mockSpell({
        description: `${'Mot '.repeat(80)}.`,
      }),
    );
    expect(summary.endsWith('…')).toBeFalse();
    expect(summary.length).toBeGreaterThan(140);
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

  it('planGrimoireTable returns empty plan for no spells', () => {
    const split = (text: string) => [text];
    const plan = planGrimoireTable([], split, 80, 12);
    expect(plan.placements).toEqual([]);
    expect(plan.overflow).toEqual([]);
  });

  it('paginateGrimoireOverflow returns empty for no spells', () => {
    const split = (text: string) => [text];
    expect(paginateGrimoireOverflow([], split, 80, 12)).toEqual([]);
  });

  it('planGrimoireTable moves spells that exceed maxRows to overflow', () => {
    const split = (text: string) => (text.length > 10 ? [text.slice(0, 10), text.slice(10)] : [text]);
    const spells = [
      inst('A', 'V,S | Instantanée | Court.'),
      inst('B', 'V,S | Instantanée | Un texte volontairement long pour overflow.'),
      inst('C', 'V,S | Instantanée | Autre.'),
    ];
    const plan = planGrimoireTable(spells, split, 50, 3, 2);
    expect(plan.placements.length).toBe(1);
    expect(plan.overflow.map((s) => s.name)).toEqual(['B', 'C']);
  });

  it('paginateGrimoireOverflow splits overflow across pages', () => {
    const split = (text: string) => [text];
    const spells = [
      inst('A', 'V,S | Instantanée | A.'),
      inst('B', 'V,S | Instantanée | B.'),
      inst('C', 'V,S | Instantanée | C.'),
    ];
    const pages = paginateGrimoireOverflow(spells, split, 80, 2, 1);
    expect(pages.length).toBe(2);
    expect(pages[0].placements.length).toBe(2);
    expect(pages[1].placements.length).toBe(1);
  });

  it('paginateGrimoireOverflow never drops a spell that alone exceeds maxRows', () => {
    const split = (text: string) => text.split('|').map((p) => p.trim()).filter(Boolean);
    const huge = 'V,S | Instantanée | ' + Array.from({ length: 12 }, (_, i) => `Phrase ${i}.`).join(' ');
    const spells = [inst('Géant', huge), inst('Suivant', 'V,S | Instantanée | Court.')];
    const pages = paginateGrimoireOverflow(spells, split, 40, 2, 8);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    const names = pages.flatMap((p) => p.placements.map((x) => x.spell.name));
    expect(names).toContain('Géant');
    expect(names).toContain('Suivant');
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

  it('layoutGrimoireEffect handles whitespace-only summaries as header-only layout', () => {
    const split = (text: string) => [text];
    const layout = layoutGrimoireEffect('   ', split, 80);
    expect(layout.body).toBe('');
    expect(layout.headerLines.length).toBeGreaterThanOrEqual(1);
  });

  it('planGrimoireTable truncates an oversized first spell instead of dropping it', () => {
    const split = (text: string) => (text.length > 8 ? [text.slice(0, 8), text.slice(8)] : [text]);
    const huge = inst('Huge', 'V,S | Instantanée | ' + 'Mot '.repeat(20));
    const plan = planGrimoireTable([huge], split, 30, 1, 2);
    expect(plan.placements.length).toBe(1);
    expect(plan.overflow).toEqual([]);
  });

  it('buildGrimoireEffectSummary omits components when none are present', () => {
    const summary = buildGrimoireEffectSummary(
      mockSpell({
        components: { v: false, s: false, m: null },
        duration: { amount: null, unit: 'instantane' },
        description: 'Effet.',
      }),
    );
    expect(summary).toContain('Instantanée');
    expect(summary).toContain('Effet.');
    expect(summary).not.toContain('V,S');
  });
});
