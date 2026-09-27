import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AiGenerationProgressService } from '@core/services/ai-generation-progress.service';

@Component({
  selector: 'app-ai-generation-progress-bar',
  standalone: true,
  template: `
    @if (progress.foregroundActive()) {
      <div
        class="rounded-xl border p-4 space-y-2.5 animate-fade-in"
        [class]="tone() === 'amber'
          ? 'border-amber-800/40 bg-amber-950/20'
          : 'border-violet-800/40 bg-violet-950/20'"
        role="status"
        aria-live="polite"
        data-testid="ai-generation-progress"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest">
          <span [class]="tone() === 'amber' ? 'text-amber-200' : 'text-violet-200'">
            {{ progress.stageLabel() }}
          </span>
          <span class="text-slate-500">{{ progress.providerLabel() }}</span>
        </div>
        <div class="h-2.5 bg-slate-900/80 rounded-full overflow-hidden border border-slate-800/80">
          <div
            class="h-full rounded-full transition-[width] duration-300 ease-out"
            [class]="tone() === 'amber' ? 'bg-amber-500' : 'bg-violet-500'"
            [style.width.%]="progress.progress()"
          ></div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <span class="text-slate-500 tabular-nums">{{ progress.progress() }}%</span>
          @if (progress.detail(); as d) {
            <span class="text-slate-500 italic">{{ d }}</span>
          }
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2 pt-0.5">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-slate-500 hover:text-slate-100 transition-colors"
            data-testid="ai-generation-background"
            (click)="progress.sendToBackground()"
          >
            Continuer en arrière-plan
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-red-900/50 bg-red-950/30 text-[10px] font-black uppercase tracking-widest text-red-300 hover:border-red-700/60 hover:text-red-200 transition-colors"
            data-testid="ai-generation-stop"
            (click)="progress.stop()"
          >
            Arrêter
          </button>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiGenerationProgressBar {
  readonly progress = inject(AiGenerationProgressService);
  readonly tone = input<'violet' | 'amber'>('violet');
}
