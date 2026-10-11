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
  template: `
    <div class="guide-no-print space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="search"
          placeholder="Rechercher…"
          class="w-full min-h-10 rounded-lg bg-[#0f1218] border border-slate-700 px-3 text-sm"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
        />
        <div class="flex flex-wrap gap-1 shrink-0">
          @for (a of audienceOptions; track a.id) {
            <button
              type="button"
              class="min-h-9 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
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

      @if (showOutline()) {
        <div class="rounded-xl border border-slate-800 bg-[#141820]">
          <button
            type="button"
            class="w-full min-h-11 px-4 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-amber-200"
            [attr.aria-expanded]="navOpen()"
            (click)="navOpen.set(!navOpen())"
          >
            Sommaire
            <span class="text-[9px]">{{ navOpen() ? '▴' : '▾' }}</span>
          </button>
          @if (navOpen()) {
            <nav class="border-t border-slate-800 p-3 space-y-3" aria-label="Chapitres du guide">
              <div>
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-600 px-1 mb-1">MJ</p>
                <ul class="grid grid-cols-2 gap-1">
                  <li>
                    <a
                      routerLink="/guide/mj-table"
                      class="block px-2 py-2 rounded-md text-sm"
                      [class]="linkClass(activeRulebookId() === 'mj-table')"
                      (click)="closeNavOnMobile()"
                      >À la table</a
                    >
                  </li>
                  <li>
                    <a
                      routerLink="/guide/mj-en-ligne"
                      class="block px-2 py-2 rounded-md text-sm"
                      [class]="linkClass(activeRulebookId() === 'mj-en-ligne')"
                      (click)="closeNavOnMobile()"
                      >En ligne</a
                    >
                  </li>
                </ul>
              </div>
              <div>
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-600 px-1 mb-1">
                  Joueur
                </p>
                <ul class="grid grid-cols-2 gap-1">
                  <li>
                    <a
                      routerLink="/guide/joueur-table"
                      class="block px-2 py-2 rounded-md text-sm"
                      [class]="linkClass(activeRulebookId() === 'joueur-table')"
                      (click)="closeNavOnMobile()"
                      >À la table</a
                    >
                  </li>
                  <li>
                    <a
                      routerLink="/guide/joueur-en-ligne"
                      class="block px-2 py-2 rounded-md text-sm"
                      [class]="linkClass(activeRulebookId() === 'joueur-en-ligne')"
                      (click)="closeNavOnMobile()"
                      >En ligne</a
                    >
                  </li>
                </ul>
              </div>
              <div>
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-600 px-1 mb-1">
                  One-shot
                </p>
                <ul>
                  <li>
                    <a
                      routerLink="/guide/oneshot"
                      class="block px-2 py-2 rounded-md text-sm"
                      [class]="linkClass(activeRulebookId() === 'oneshot')"
                      (click)="closeNavOnMobile()"
                      >1 feuille</a
                    >
                  </li>
                </ul>
              </div>
              <div>
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-600 px-1 mb-1">
                  Par classe
                </p>
                <ul class="grid grid-cols-2 gap-1">
                  @for (pb of classPlaybooks; track pb.classId) {
                    <li>
                      <a
                        [routerLink]="['/guide/classe', pb.classId]"
                        class="block px-2 py-2 rounded-md text-sm truncate"
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
                <p class="text-xs text-slate-500 px-1 py-2">Aucune fiche pour « {{ query().trim() }} »</p>
              } @else {
                @for (section of sections(); track section.groupId) {
                  <div>
                    <p class="text-[9px] font-black uppercase tracking-widest text-slate-600 px-1 mb-1">
                      {{ section.groupLabel }}
                    </p>
                    <ul class="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                      @for (topic of section.topics; track topic.id) {
                        <li>
                          <a
                            [routerLink]="['/guide', topic.id]"
                            class="block px-2 py-2 rounded-md text-sm truncate"
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
          }
        </div>
      }
    </div>
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
  /** Hub : filtres seuls. Pages : sommaire repliable (pas une 2e navbar). */
  readonly showOutline = input(true);

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
