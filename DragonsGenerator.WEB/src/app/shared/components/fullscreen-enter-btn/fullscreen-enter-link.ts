import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FullscreenEnterTone } from './fullscreen-enter-btn';

/**
 * Lien d’entrée plein écran (même icône) — pour routes `/play`, etc.
 */
@Component({
  selector: 'app-fullscreen-enter-link',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'inline-flex' },
  template: `
    <a
      [routerLink]="link()"
      [queryParams]="queryParams()"
      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border shadow-lg backdrop-blur-sm transition-colors"
      [class]="toneClasses()"
      [attr.aria-label]="label()"
      [attr.title]="label()"
    >
      <iconify-icon icon="fluent:full-screen-maximize-24-regular" class="text-lg"></iconify-icon>
    </a>
  `,
})
export class FullscreenEnterLink {
  readonly link = input.required<string | readonly string[]>();
  readonly queryParams = input<Record<string, string> | null>(null);
  readonly label = input('Plein écran');
  readonly tone = input<FullscreenEnterTone>('emerald');

  toneClasses(): string {
    switch (this.tone()) {
      case 'amber':
        return 'border-amber-600/50 bg-[#0f1318]/85 text-amber-300 hover:border-amber-400 hover:text-amber-200 hover:bg-[#1b2028]';
      case 'violet':
        return 'border-violet-600/50 bg-[#12101a]/85 text-violet-300 hover:border-violet-400 hover:text-violet-200 hover:bg-[#1b2028]';
      case 'slate':
        return 'border-slate-600/60 bg-[#0f1318]/85 text-slate-300 hover:border-slate-400 hover:text-slate-100 hover:bg-[#1b2028]';
      default:
        return 'border-emerald-600/50 bg-[#0f1410]/85 text-emerald-300 hover:border-emerald-400 hover:text-emerald-200 hover:bg-[#1b2028]';
    }
  }
}
