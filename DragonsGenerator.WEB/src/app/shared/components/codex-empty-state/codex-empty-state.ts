import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-codex-empty-state',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div
      class="col-span-full flex flex-col items-center justify-center gap-3 py-16 px-4 text-center"
      role="status"
    >
      <p class="text-slate-300 font-serif text-lg">{{ title() }}</p>
      <p class="text-slate-500 text-sm max-w-md leading-relaxed">{{ message() }}</p>
      @if (ctaLabel() && ctaRoute()) {
        <a
          [routerLink]="ctaRoute()!"
          class="mt-2 min-h-11 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-700/50 text-amber-300 hover:border-amber-500/60"
        >
          {{ ctaLabel() }}
        </a>
      }
      @if (clearFiltersLabel()) {
        <button
          type="button"
          class="min-h-11 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-800 text-slate-200 hover:bg-slate-700"
          (click)="clearFilters.emit()"
        >
          {{ clearFiltersLabel() }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodexEmptyState {
  readonly title = input('Rien ici pour l’instant');
  readonly message = input(
    'Aucun élément ne correspond. Essayez d’autres filtres, ou ouvrez le Guide pour démarrer.',
  );
  readonly ctaLabel = input<string | null>(null);
  readonly ctaRoute = input<string | null>(null);
  readonly clearFiltersLabel = input<string | null>(null);
  readonly clearFilters = output<void>();
}
