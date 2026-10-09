import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type PlayDockTone = 'amber' | 'slate' | 'rose' | 'violet' | 'sky';

const TONE_CLASS: Record<PlayDockTone, string> = {
  amber: 'border-amber-700/50 bg-amber-950/30 hover:border-amber-500/60',
  slate: 'border-slate-700 bg-[#1b2028]/80 hover:border-slate-500',
  rose: 'border-rose-800/50 bg-rose-950/25 hover:border-rose-500/60',
  violet: 'border-violet-800/50 bg-violet-950/20 hover:border-violet-600/50',
  sky: 'border-sky-800/50 bg-sky-950/20 hover:border-sky-600/50',
};

const TITLE_CLASS: Record<PlayDockTone, string> = {
  amber: 'text-amber-300',
  slate: 'text-slate-300',
  rose: 'text-rose-300',
  violet: 'text-violet-300',
  sky: 'text-sky-300',
};

@Component({
  selector: 'app-play-dock-tile',
  standalone: true,
  template: `
    <button
      type="button"
      class="min-h-14 w-full px-4 py-3 rounded-xl text-left border flex flex-col gap-0.5"
      [class]="toneBox()"
      [attr.data-testid]="testId() || null"
      (click)="pressed.emit()"
    >
      <span class="block text-[10px] font-black uppercase tracking-widest" [class]="toneTitle()">{{
        title()
      }}</span>
      <span class="text-xs truncate" [class]="tone() === 'amber' ? 'text-slate-400' : 'text-slate-500'">{{
        detail()
      }}</span>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayDockTile {
  readonly title = input.required<string>();
  readonly detail = input.required<string>();
  readonly tone = input<PlayDockTone>('slate');
  readonly testId = input<string | null>(null);
  readonly pressed = output<void>();

  readonly toneBox = computed(() => TONE_CLASS[this.tone()]);
  readonly toneTitle = computed(() => TITLE_CLASS[this.tone()]);
}
