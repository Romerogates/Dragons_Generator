import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
} from '@angular/core';

export type FullscreenEnterTone = 'amber' | 'emerald' | 'slate' | 'violet';

/**
 * Bouton d’entrée plein écran (icône maximize).
 * La sortie se fait ailleurs via Escape — pas de bouton Fermer ici.
 */
@Component({
  selector: 'app-fullscreen-enter-btn',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: {
    class: 'inline-flex',
  },
  template: `
    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border shadow-lg backdrop-blur-sm transition-colors"
      [class]="toneClasses()"
      (click)="enter.emit($event)"
      [attr.aria-label]="label()"
      [attr.title]="label()"
    >
      <iconify-icon icon="fluent:full-screen-maximize-24-regular" class="text-lg"></iconify-icon>
    </button>
  `,
})
export class FullscreenEnterBtn {
  readonly label = input('Plein écran');
  readonly tone = input<FullscreenEnterTone>('amber');
  readonly enter = output<MouseEvent>();

  toneClasses(): string {
    switch (this.tone()) {
      case 'emerald':
        return 'border-emerald-600/50 bg-[#0f1410]/85 text-emerald-300 hover:border-emerald-400 hover:text-emerald-200 hover:bg-[#1b2028]';
      case 'violet':
        return 'border-violet-600/50 bg-[#12101a]/85 text-violet-300 hover:border-violet-400 hover:text-violet-200 hover:bg-[#1b2028]';
      case 'slate':
        return 'border-slate-600/60 bg-[#0f1318]/85 text-slate-300 hover:border-slate-400 hover:text-slate-100 hover:bg-[#1b2028]';
      default:
        return 'border-amber-600/50 bg-[#0f1318]/85 text-amber-300 hover:border-amber-400 hover:text-amber-200 hover:bg-[#1b2028]';
    }
  }
}
