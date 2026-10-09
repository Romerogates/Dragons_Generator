import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type PlayEmptyTone = 'sky' | 'violet';

@Component({
  selector: 'app-play-empty-hint',
  standalone: true,
  template: `
    <div
      class="rounded-2xl border border-dashed text-center space-y-2"
      [class]="
        tone() === 'sky'
          ? 'border-sky-900/50 bg-sky-950/15 p-6 space-y-3'
          : 'border-violet-800/40 bg-violet-950/15 p-5'
      "
    >
      @if (kicker()) {
        <p
          class="text-[10px] font-black uppercase tracking-widest"
          [class]="tone() === 'sky' ? 'text-sky-400' : 'text-violet-400'"
        >
          {{ kicker() }}
        </p>
      }
      <p class="text-sm text-slate-300">{{ title() }}</p>
      <p class="text-xs text-slate-500">{{ detail() }}</p>
      <ng-content />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayEmptyHint {
  readonly tone = input<PlayEmptyTone>('violet');
  readonly kicker = input<string | null>(null);
  readonly title = input.required<string>();
  readonly detail = input.required<string>();
}
