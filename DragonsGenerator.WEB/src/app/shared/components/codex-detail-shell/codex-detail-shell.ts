import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

/**
 * Coquille plein écran pour les fiches Codex (bestiaire, sorts, …).
 * Conserve la route `/:id` pour deep links ; Fermer = history.back() ou fallback catalogue.
 */
@Component({
  selector: 'app-codex-detail-shell',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-[85] flex flex-col bg-[#0a0d13] text-slate-300 animate-fade-in"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
    >
      <header
        class="shrink-0 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-[#12161c]/95 px-3 py-2.5 backdrop-blur-sm"
      >
        <button
          type="button"
          class="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-slate-700 bg-[#1b2028] px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-slate-500 hover:text-white"
          (click)="close()"
          aria-label="Fermer la fiche"
        >
          Fermer
        </button>
        <div class="min-w-0 flex-1 text-center px-2">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">Codex</p>
          <p class="text-sm font-serif truncate" [class]="accentTextClass()">{{ title() }}</p>
        </div>
        <a
          [routerLink]="backLink()"
          class="min-h-11 inline-flex items-center rounded-xl border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200"
        >
          {{ backLabel() }}
        </a>
      </header>

      <div class="flex-1 overflow-y-auto overscroll-contain">
        <div class="max-w-5xl mx-auto px-4 py-8 pb-24">
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class CodexDetailShell implements OnInit, OnDestroy {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Titre affiché dans la barre (nom de la fiche). */
  readonly title = input('Fiche');
  /** Route de secours / lien catalogue (ex. /creatures). */
  readonly backLink = input('/creatures');
  readonly backLabel = input('Catalogue');
  /** Accent Tailwind text color token: red | fuchsia | sky | amber | emerald | violet | orange */
  readonly accent = input<
    'red' | 'fuchsia' | 'sky' | 'amber' | 'emerald' | 'violet' | 'orange' | 'slate'
  >('slate');

  private previousOverflow = '';
  private onKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.close();
    }
  };

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      this.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', this.onKeydown);
    }
    this.destroyRef.onDestroy(() => this.restoreBody());
  }

  ngOnDestroy(): void {
    this.restoreBody();
  }

  accentTextClass(): string {
    switch (this.accent()) {
      case 'red':
        return 'text-red-300';
      case 'fuchsia':
        return 'text-fuchsia-300';
      case 'sky':
        return 'text-sky-300';
      case 'amber':
        return 'text-amber-300';
      case 'emerald':
        return 'text-emerald-300';
      case 'violet':
        return 'text-violet-300';
      case 'orange':
        return 'text-orange-300';
      default:
        return 'text-slate-200';
    }
  }

  close(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl(this.backLink());
  }

  private restoreBody(): void {
    if (typeof document === 'undefined') return;
    document.removeEventListener('keydown', this.onKeydown);
    document.body.style.overflow = this.previousOverflow;
  }
}
