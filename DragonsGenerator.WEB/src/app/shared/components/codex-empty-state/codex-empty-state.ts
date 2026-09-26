import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-codex-empty-state',
  standalone: true,
  imports: [RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div
      class="col-span-full flex flex-col items-center justify-center gap-3 py-12 px-6 text-center bg-[#1b2028] border border-dashed border-slate-700 rounded-3xl shadow-inner"
      role="status"
    >
      @if (icon()) {
        <span class="text-5xl mb-2 opacity-80 drop-shadow-lg" aria-hidden="true">
          <iconify-icon [attr.icon]="icon()"></iconify-icon>
        </span>
      }
      <h2 class="text-xl font-bold text-slate-200 font-serif tracking-widest uppercase">
        {{ title() }}
      </h2>
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
  /** Iconify id (ex. fluent-emoji:scroll) — même langage que Pages / Parchemins vierges. */
  readonly icon = input<string | null>('fluent-emoji:scroll');
  readonly ctaLabel = input<string | null>(null);
  readonly ctaRoute = input<string | null>(null);
  readonly clearFiltersLabel = input<string | null>(null);
  readonly clearFilters = output<void>();
}
