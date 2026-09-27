import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AiGenerationProgressService } from '@core/services/ai-generation-progress.service';

/** Global pill + toast while a generation runs in the background. */
@Component({
  selector: 'app-ai-generation-dock',
  standalone: true,
  template: `
    <div
      class="pointer-events-none fixed bottom-20 right-0 left-0 lg:left-auto lg:bottom-4 lg:right-4 z-[70] flex flex-col items-end gap-2 p-3 lg:p-0"
    >
      @if (progress.toastMessage(); as toast) {
        <div
          class="pointer-events-auto max-w-sm rounded-xl border border-emerald-800/50 bg-emerald-950/95 px-4 py-3 text-sm text-emerald-100 shadow-lg animate-fade-in"
          role="status"
          data-testid="ai-generation-toast"
        >
          <div class="flex items-start gap-3">
            <span class="flex-1 font-medium">{{ toast }}</span>
            <button
              type="button"
              class="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 hover:text-emerald-200"
              (click)="progress.dismissToast()"
            >
              OK
            </button>
          </div>
        </div>
      }

      @if (progress.active() && progress.background()) {
        <div
          class="pointer-events-auto flex items-center gap-2 rounded-full border border-violet-800/50 bg-[var(--dg-surface)]/95 backdrop-blur-md pl-3 pr-1.5 py-1.5 shadow-lg"
          role="status"
          data-testid="ai-generation-background-pill"
        >
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60"></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-violet-500"></span>
          </span>
          <button
            type="button"
            class="text-[10px] font-black uppercase tracking-widest text-violet-200 hover:text-violet-100"
            (click)="progress.restoreForeground()"
          >
            Génération en cours… {{ progress.progress() }}%
          </button>
          <button
            type="button"
            class="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-red-300 hover:bg-red-950/40"
            data-testid="ai-generation-pill-stop"
            (click)="progress.stop()"
          >
            Arrêter
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiGenerationDock {
  readonly progress = inject(AiGenerationProgressService);
}
