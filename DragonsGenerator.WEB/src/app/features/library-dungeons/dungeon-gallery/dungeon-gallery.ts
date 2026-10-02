import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DungeonCloudService } from '@core/services/dungeon-cloud.service';
import { dungeonMapToPngDataUrl } from '@core/utils/dungeon-render.util';

type GalleryItem = {
  token: string;
  name: string;
  ownerDisplayName: string;
  updatedAt: string;
};

const THUMB_CELL = 5;
const THUMB_CONCURRENCY = 3;

@Component({
  selector: 'app-dungeon-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="max-w-5xl mx-auto px-4 py-10 min-h-[80vh]">
      <header class="mb-8 border-b border-slate-800 pb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Communauté</p>
          <h1 class="text-3xl font-serif text-slate-100">Galerie de donjons</h1>
          <p class="text-sm text-slate-500 mt-1">
            Cartes partagées publiquement — ouvrez puis copiez dans Mes donjons.
          </p>
        </div>
        <a
          routerLink="/dungeons"
          class="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-amber-400"
          >← Mes donjons</a
        >
      </header>

      @if (!loading() && !error() && items().length) {
        <label class="block mb-6">
          <span class="sr-only">Filtrer la galerie</span>
          <input
            type="search"
            class="w-full max-w-md rounded-xl bg-[#1b2028] border border-slate-700 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-600/60 outline-none"
            placeholder="Rechercher (nom ou auteur)…"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            data-testid="gallery-search"
          />
        </label>
      }

      @if (loading()) {
        <p class="text-amber-400/80 animate-pulse text-sm">Chargement…</p>
      } @else if (error(); as err) {
        <p class="text-red-400 text-sm">{{ err }}</p>
      } @else if (!items().length) {
        <p class="text-slate-500 text-sm italic">
          Aucun donjon public pour l’instant. Activez « Lien public » dans l’éditeur.
        </p>
      } @else if (!filteredItems().length) {
        <p class="text-slate-500 text-sm italic">Aucun résultat pour « {{ searchQuery() }} ».</p>
      } @else {
        <ul class="grid sm:grid-cols-2 gap-4">
          @for (item of filteredItems(); track item.token) {
            <li
              class="rounded-2xl border border-slate-800 bg-[#1b2028] overflow-hidden flex flex-col"
              data-testid="gallery-card"
            >
              <div class="aspect-[4/3] bg-[#0a0c10] relative overflow-hidden">
                @if (thumbUrls()[item.token]; as thumb) {
                  <img
                    [src]="thumb"
                    [alt]="item.name"
                    class="w-full h-full object-cover opacity-90"
                    loading="lazy"
                  />
                } @else {
                  <div class="absolute inset-0 animate-pulse bg-slate-900/80" aria-hidden="true"></div>
                }
              </div>
              <div class="p-5 flex flex-col gap-3 flex-1">
                <div>
                  <h2 class="font-serif text-lg text-amber-100">{{ item.name }}</h2>
                  <p class="text-[10px] uppercase tracking-widest text-slate-500 mt-1">
                    {{ item.ownerDisplayName }} · {{ item.updatedAt | date: 'short' }}
                  </p>
                </div>
                <a
                  [routerLink]="['/dungeons/shared', item.token]"
                  class="inline-flex self-start px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-amber-600 text-white hover:bg-amber-500"
                >
                  Voir / copier
                </a>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class DungeonGalleryPage implements OnInit, OnDestroy {
  private readonly cloud = inject(DungeonCloudService);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<GalleryItem[]>([]);
  readonly searchQuery = signal('');
  readonly thumbUrls = signal<Record<string, string>>({});

  readonly filteredItems = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.items();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.ownerDisplayName.toLowerCase().includes(q),
    );
  });

  private readonly thumbCache = new Map<string, string>();
  private thumbQueue: GalleryItem[] = [];
  private thumbInFlight = 0;
  private destroyed = false;

  ngOnInit(): void {
    this.cloud.listGallery().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
        this.enqueueThumbs(list);
      },
      error: () => {
        this.error.set('Impossible de charger la galerie.');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.thumbQueue = [];
  }

  private enqueueThumbs(list: GalleryItem[]): void {
    this.thumbQueue = [...list];
    this.pumpThumbs();
  }

  private pumpThumbs(): void {
    while (!this.destroyed && this.thumbInFlight < THUMB_CONCURRENCY && this.thumbQueue.length) {
      const item = this.thumbQueue.shift()!;
      const cacheKey = `${item.token}:${item.updatedAt}`;
      const cached = this.thumbCache.get(cacheKey);
      if (cached) {
        this.thumbUrls.update((m) => ({ ...m, [item.token]: cached }));
        continue;
      }
      this.thumbInFlight++;
      this.cloud.getSharedDungeon(item.token).subscribe({
        next: (detail) => {
          if (this.destroyed) return;
          try {
            const url = dungeonMapToPngDataUrl(detail.data, THUMB_CELL, {
              showRoomNumbers: false,
              vignette: true,
            });
            this.thumbCache.set(cacheKey, url);
            this.thumbUrls.update((m) => ({ ...m, [item.token]: url }));
          } catch {
            /* ignore broken geometry */
          }
        },
        error: () => {
          /* skip thumb */
        },
        complete: () => {
          this.thumbInFlight = Math.max(0, this.thumbInFlight - 1);
          this.pumpThumbs();
        },
      });
    }
  }
}
