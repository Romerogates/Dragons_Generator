import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Spell } from '@core/models/Spells/spell';
import { normalizeSpellDescription } from '@core/utils/spell-grimoire-effect.util';
import { spellSchoolLabel } from '@core/utils/spell-display.util';
import { GameIdLabelPipe } from '@shared/pipes/game-id-label.pipe';

@Component({
  selector: 'app-spell-book-page',
  standalone: true,
  imports: [RouterLink, GameIdLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spell-book-page.html',
  styleUrl: './spell-book-page.scss',
})
export class SpellBookPage {
  readonly spell = input.required<Spell>();

  protected readonly schoolLabel = spellSchoolLabel;
  protected readonly cleanDescription = computed(() =>
    normalizeSpellDescription(this.spell().description ?? ''),
  );

  protected formatMeta(meta: { amount: number | string | null; unit: string | null }): string {
    if (meta.amount === null && meta.unit === null) return '—';
    if (meta.amount === null) return meta.unit ?? '—';
    if (meta.unit === null) return String(meta.amount);
    return `${meta.amount} ${meta.unit}`;
  }

  protected formatComponents(c: { v: boolean; s: boolean; m: string | null }): string {
    const parts: string[] = [];
    if (c.v) parts.push('V (verbale)');
    if (c.s) parts.push('S (somatique)');
    if (c.m) parts.push(`M (${c.m})`);
    return parts.length ? parts.join(' · ') : '—';
  }

  protected levelLabel(level: number): string {
    return level === 0 ? 'Tour de magie' : `Niveau ${level}`;
  }
}
