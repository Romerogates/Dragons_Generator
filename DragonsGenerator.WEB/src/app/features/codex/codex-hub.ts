import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CODEX_NAV_LINKS } from '@core/config/codex-nav';
import { CodexSearchService } from '@core/services/codex-search.service';

@Component({
  selector: 'app-codex-hub',
  standalone: true,
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="w-full min-h-screen bg-[#171b22] text-slate-200 pb-20 animate-fade-in">
      <div class="max-w-5xl mx-auto px-4 pt-10 pb-6">
        <p class="text-[10px] font-black uppercase tracking-widest text-emerald-500/80 mb-2">
          Référentiel Eana
        </p>
        <h1 class="text-3xl md:text-4xl font-serif text-slate-50 mb-2">Codex</h1>
        <p class="text-sm text-slate-400 max-w-xl leading-relaxed mb-6">
          Parcourez les archives — espèces, classes, sorts, bestiaire et le reste du grimoire.
        </p>

        <label class="block mb-8">
          <span class="sr-only">Rechercher dans le Codex</span>
          <input
            type="search"
            class="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm
                   text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            placeholder="Rechercher une entrée (ex. gobelin, boule de feu…)"
            [ngModel]="query()"
            (ngModelChange)="onQuery($event)"
            data-testid="codex-hub-search"
          />
        </label>

        @if (entryHits().length) {
          <div class="mb-8">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">Entrées</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              @for (hit of entryHits(); track hit.path) {
                <a
                  [routerLink]="hit.path"
                  class="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:border-emerald-500/40 transition-colors"
                >
                  <span class="block text-sm font-bold text-slate-100">{{ hit.label }}</span>
                  <span class="block text-xs text-slate-500 mt-0.5">{{ hit.category }}</span>
                </a>
              }
            </div>
          </div>
        }

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          @for (link of filtered(); track link.path) {
            <a
              [routerLink]="link.path"
              class="group rounded-xl border border-slate-800 bg-slate-900/40 p-4
                     hover:border-emerald-500/40 hover:bg-emerald-950/20 transition-colors min-h-[5.5rem]"
            >
              <span class="text-2xl block mb-2" aria-hidden="true">
                <iconify-icon noobserver [icon]="link.icon"></iconify-icon>
              </span>
              <span class="block text-sm font-bold text-slate-100 group-hover:text-emerald-300">
                {{ link.label }}
              </span>
              <span class="block text-xs text-slate-500 mt-1 leading-relaxed">{{ link.blurb }}</span>
            </a>
          } @empty {
            <p class="text-sm text-slate-500 col-span-full">Aucun catalogue pour « {{ query() }} ».</p>
          }
        </div>
      </div>
    </div>
  `,
})
export class CodexHubPage {
  private readonly search = inject(CodexSearchService);
  readonly query = signal('');
  readonly filtered = computed(() => this.search.sections(this.query()));
  readonly entryHits = computed(() => this.search.entries(this.query()));
  readonly all = CODEX_NAV_LINKS;

  constructor() {
    this.search.ensureIndex();
  }

  onQuery(value: string): void {
    this.query.set(value);
    if (value.trim()) this.search.ensureIndex();
  }
}
