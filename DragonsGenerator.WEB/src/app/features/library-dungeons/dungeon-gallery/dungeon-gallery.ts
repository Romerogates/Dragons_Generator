import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DungeonCloudService } from '@core/services/dungeon-cloud.service';

@Component({
  selector: 'app-dungeon-gallery',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="max-w-5xl mx-auto px-4 py-10 min-h-[80vh]">
      <header class="mb-8 border-b border-slate-800 pb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Communauté</p>
          <h1 class="text-3xl font-serif text-slate-100">Galerie de donjons</h1>
          <p class="text-sm text-slate-500 mt-1">Cartes partagées publiquement — ouvrez puis copiez dans Mes donjons.</p>
        </div>
        <a routerLink="/dungeons" class="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-amber-400"
          >← Mes donjons</a
        >
      </header>

      @if (loading()) {
        <p class="text-amber-400/80 animate-pulse text-sm">Chargement…</p>
      } @else if (error(); as err) {
        <p class="text-red-400 text-sm">{{ err }}</p>
      } @else if (!items().length) {
        <p class="text-slate-500 text-sm italic">Aucun donjon public pour l’instant. Activez « Lien public » dans l’éditeur.</p>
      } @else {
        <ul class="grid sm:grid-cols-2 gap-4">
          @for (item of items(); track item.token) {
            <li class="rounded-2xl border border-slate-800 bg-[#1b2028] p-5 flex flex-col gap-3">
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
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class DungeonGalleryPage implements OnInit {
  private readonly cloud = inject(DungeonCloudService);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<
    { token: string; name: string; ownerDisplayName: string; updatedAt: string }[]
  >([]);

  ngOnInit(): void {
    this.cloud.listGallery().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger la galerie.');
        this.loading.set(false);
      },
    });
  }
}
