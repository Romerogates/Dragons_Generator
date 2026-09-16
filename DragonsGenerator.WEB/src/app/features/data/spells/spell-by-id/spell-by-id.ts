import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { CodexDetailShell } from '@shared/components/codex-detail-shell/codex-detail-shell';
import { GameIdLabelPipe } from '@shared/pipes/game-id-label.pipe';
import { LightMarkdownPipe } from '@shared/pipes/light-markdown.pipe';
import { normalizeSpellDescription } from '@core/utils/spell-grimoire-effect.util';
import {
  spellCastTimeLabel,
  spellDurationLabel,
  spellLevelLabel,
  spellRangeLabel,
  spellSchoolLabel,
} from '@core/utils/spell-display.util';
import type { Spell } from '@core/models/Spells/spell';

@Component({
  selector: 'app-spell-by-id',
  standalone: true,
  imports: [RouterLink, GameIdLabelPipe, CodexDetailShell, LightMarkdownPipe],
  templateUrl: './spell-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class SpellById {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  protected error = signal<string | null>(null);
  protected notFound = signal(false);

  protected spell = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id') ?? '';
        this.error.set(null);
        this.notFound.set(false);
        return this.dataService.getSpellById(id).pipe(
          catchError((err) => {
            if (err?.status === 404) {
              this.notFound.set(true);
            } else {
              this.error.set('Les flux magiques sont perturbés. Impossible de lire ce sort.');
            }
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  protected formatDescription(description: string | null | undefined): string {
    return normalizeSpellDescription(description ?? '');
  }

  protected schoolLabel = spellSchoolLabel;
  protected levelLabel = spellLevelLabel;

  protected castTimeLabel(s: Spell): string {
    return spellCastTimeLabel(s);
  }

  protected rangeLabel(s: Spell): string {
    return spellRangeLabel(s);
  }

  protected durationLabel(s: Spell): string {
    return spellDurationLabel(s);
  }

  protected formatComponents(c: { v: boolean; s: boolean; m: string | null }): string {
    const parts: string[] = [];
    if (c.v) parts.push('V (verbale)');
    if (c.s) parts.push('S (somatique)');
    if (c.m) parts.push(`M (${c.m})`);
    return parts.length ? parts.join(' · ') : '—';
  }

  /** Associe une icône Iconify selon l'école de magie pour styliser l'en-tête */
  getSchoolIcon(school: string): string {
    const s = school.toLowerCase();
    if (s.includes('abjuration')) return 'fluent-emoji:shield';
    if (s.includes('évocation') || s.includes('evocation')) return 'fluent-emoji:collision';
    if (s.includes('nécromancie') || s.includes('necromancie')) return 'fluent-emoji:skull';
    if (s.includes('illusion')) return 'fluent-emoji:eye';
    if (s.includes('transmutation')) return 'fluent-emoji:butterfly';
    if (s.includes('divination')) return 'fluent-emoji:crystal-ball';
    if (s.includes('enchantement')) return 'fluent-emoji:sparkles';
    if (s.includes('invocation') || s.includes('conjuration')) return 'fluent-emoji:cyclone';
    return 'fluent-emoji:magic-wand';
  }
}
