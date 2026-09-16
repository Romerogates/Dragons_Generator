import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { GuideAudience } from '../guide.types';
import type { GuideTopic } from '../guide-topics';
import type { GuideRulebookId } from '../guide-rulebooks';
import { GUIDE_CLASS_PLAYBOOKS } from '../guide-class-playbooks';

export interface GuideSidebarSection {
  groupId: string;
  groupLabel: string;
  topics: GuideTopic[];
}

@Component({
  selector: 'app-guide-sidebar',
  standalone: true,
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <aside
      class="guide-no-print flex flex-col shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800/90 bg-[#141820]
             lg:max-h-none lg:h-full lg:w-56 xl:w-64"
      [class.max-h-[42vh]]="navOpen()"
    >
      <div
        class="shrink-0 px-3 py-2.5 flex items-center gap-2 border-b border-slate-800/80 lg:flex-col lg:items-stretch lg:gap-3 lg:p-3"
      >
        <div class="flex-1 min-w-0 flex items-center gap-3 lg:block lg:space-y-3">
          <a
            routerLink="/"
            class="hidden lg:inline-flex text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-amber-400"
          >
            ← Accueil
          </a>
          <a routerLink="/guide" class="min-w-0 block" (click)="closeNavOnMobile()">
            <p class="text-base font-serif text-slate-100 hover:text-amber-100 truncate">Guide</p>
            <p class="hidden lg:block text-[10px] uppercase tracking-widest text-slate-500 mt-0.5">
              Sommaire
            </p>
          </a>
        </div>
        <button
          type="button"
          class="lg:hidden shrink-0 min-h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest
                 border border-slate-700 text-slate-300 hover:border-amber-600/50 hover:text-amber-200"
          [attr.aria-expanded]="navOpen()"
          (click)="navOpen.set(!navOpen())"
        >
          {{ navOpen() ? 'Fermer' : 'Sommaire' }}
        </button>
      </div>

      <div
        class="flex-col min-h-0 flex-1 lg:flex"
        [class.flex]="navOpen()"
        [class.hidden]="!navOpen()"
      >
        <div class="shrink-0 p-3 space-y-3 border-b border-slate-800/80">
          <a
            routerLink="/"
            class="lg:hidden inline-flex text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-amber-400"
            (click)="closeNavOnMobile()"
          >
            ← Accueil
          </a>
          <input
            type="search"
            placeholder="Rechercher…"
            class="w-full min-h-9 rounded-lg bg-[#0f1218] border border-slate-700 px-3 text-sm"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />
          <div class="flex flex-wrap gap-1">
            @for (a of audienceOptions; track a.id) {
              <button
                type="button"
                class="min-h-8 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                [class]="
                  audience() === a.id
                    ? 'border-amber-500/50 text-amber-200 bg-amber-950/30'
                    : 'border-slate-700 text-slate-500'
                "
                (click)="audience.set(a.id)"
              >
                {{ a.label }}
              </button>
            }
          </div>
        </div>

        <nav
          class="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar p-2 space-y-3"
          aria-label="Chapitres du guide"
        >
          <div>
            <p class="text-[9px] font-black uppercase tracking-widest text-slate-600 px-2 mb-1">MJ</p>
            <ul class="grid grid-cols-2 gap-0.5 lg:grid-cols-1">
              <li>
                <a
                  routerLink="/guide/mj-table"
                  class="block px-2 py-2 lg:py-1.5 rounded-md text-sm"
                  [class]="linkClass(activeRulebookId() === 'mj-table')"
                  (click)="closeNavOnMobile()"
                  >À la table</a
                >
              </li>
              <li>
                <a
                  routerLink="/guide/mj-en-ligne"
                  class="block px-2 py-2 lg:py-1.5 rounded-md text-sm"
                  [class]="linkClass(activeRulebookId() === 'mj-en-ligne')"
                  (click)="closeNavOnMobile()"
                  >En ligne</a
                >
              </li>
            </ul>
          </div>
          <div>
            <p class="text-[9px] font-black uppercase tracking-widest text-slate-600 px-2 mb-1">
              Joueur
            </p>
            <ul class="grid grid-cols-2 gap-0.5 lg:grid-cols-1">
              <li>
                <a
                  routerLink="/guide/joueur-table"
                  class="block px-2 py-2 lg:py-1.5 rounded-md text-sm"
                  [class]="linkClass(activeRulebookId() === 'joueur-table')"
                  (click)="closeNavOnMobile()"
                  >À la table</a
                >
              </li>
              <li>
                <a
                  routerLink="/guide/joueur-en-ligne"
                  class="block px-2 py-2 lg:py-1.5 rounded-md text-sm"
                  [class]="linkClass(activeRulebookId() === 'joueur-en-ligne')"
                  (click)="closeNavOnMobile()"
                  >En ligne</a
                >
              </li>
            </ul>
          </div>
          <div>
            <p class="text-[9px] font-black uppercase tracking-widest text-slate-600 px-2 mb-1">
              One-shot
            </p>
            <ul class="grid grid-cols-2 gap-0.5 lg:grid-cols-1">
              <li>
                <a
                  routerLink="/guide/oneshot"
                  class="block px-2 py-2 lg:py-1.5 rounded-md text-sm"
                  [class]="linkClass(activeRulebookId() === 'oneshot')"
                  (click)="closeNavOnMobile()"
                  >1 feuille</a
                >
              </li>
            </ul>
          </div>
          <div>
            <p class="text-[9px] font-black uppercase tracking-widest text-slate-600 px-2 mb-1">
              Par classe
            </p>
            <ul class="grid grid-cols-2 gap-0.5 lg:grid-cols-1">
              @for (pb of classPlaybooks; track pb.classId) {
                <li>
                  <a
                    [routerLink]="['/guide/classe', pb.classId]"
                    class="block px-2 py-2 lg:py-1.5 rounded-md text-sm truncate"
                    [class]="linkClass(activeClassId() === pb.classId)"
                    (click)="closeNavOnMobile()"
                  >
                    {{ pb.className }}
                  </a>
                </li>
              }
            </ul>
          </div>

          @if (searchEmpty()) {
            <p class="text-xs text-slate-500 px-2 py-2">Aucune fiche pour « {{ query().trim() }} »</p>
          } @else {
            @for (section of sections(); track section.groupId) {
              <div>
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-600 px-2 mb-1">
                  {{ section.groupLabel }}
                </p>
                <ul>
                  @for (topic of section.topics; track topic.id) {
                    <li>
                      <a
                        [routerLink]="['/guide', topic.id]"
                        class="block px-2 py-2 lg:py-1.5 rounded-md text-sm truncate"
                        [class]="linkClass(activeTopicId() === topic.id)"
                        (click)="closeNavOnMobile()"
                      >
                        {{ topic.title }}
                      </a>
                    </li>
                  }
                </ul>
              </div>
            }
          }
        </nav>
      </div>
    </aside>
  `,
})
export class GuideSidebar {
  readonly query = model('');
  readonly audience = model<GuideAudience | 'all'>('all');
  readonly sections = input.required<GuideSidebarSection[]>();
  readonly searchEmpty = input(false);
  readonly activeTopicId = input<string | null>(null);
  readonly activeRulebookId = input<GuideRulebookId | null>(null);
  readonly activeClassId = input<string | null>(null);

  /** Ouvert par défaut seulement sur grand écran (CSS) ; mobile = fermé pour laisser lire. */
  readonly navOpen = signal(false);

  readonly classPlaybooks = GUIDE_CLASS_PLAYBOOKS;

  readonly audienceOptions: { id: GuideAudience | 'all'; label: string }[] = [
    { id: 'all', label: 'Tout' },
    { id: 'dm', label: 'MJ' },
    { id: 'player', label: 'Joueur' },
  ];

  closeNavOnMobile(): void {
    this.navOpen.set(false);
  }

  linkClass(active: boolean): string {
    return active
      ? 'bg-amber-950/40 text-amber-100'
      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200';
  }
}
