import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import {
  DungeonCloudService,
  MAX_DUNGEONS_PER_USER,
  type CloudDungeonSummary,
} from '@core/services/dungeon-cloud.service';
import { generateDungeonMap } from '@core/utils/dungeon-generator.util';

@Component({
  selector: 'app-library-dungeons',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './library-dungeons.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LibraryDungeons implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cloud = inject(DungeonCloudService);
  private readonly router = inject(Router);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly dungeons = signal<CloudDungeonSummary[]>([]);
  readonly maxDungeons = MAX_DUNGEONS_PER_USER;
  readonly deleteTarget = signal<CloudDungeonSummary | null>(null);
  readonly deleting = signal(false);

  canCreateMore(): boolean {
    return this.dungeons().length < MAX_DUNGEONS_PER_USER;
  }

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.loading.set(false);
      return;
    }
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.cloud.list().subscribe({
      next: (list) => {
        this.dungeons.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger la bibliothèque.');
        this.loading.set(false);
      },
    });
  }

  createDungeon(): void {
    if (!this.canCreateMore() || this.creating()) return;
    this.creating.set(true);
    this.error.set(null);
    const map = generateDungeonMap(
      {
        gridWidth: 48,
        gridHeight: 48,
        roomCount: 10,
        corridorDensity: 50,
        theme: 'generic',
      },
      { name: 'Nouveau donjon' },
    );
    this.cloud.create(map, map.name).subscribe({
      next: (created) => {
        this.creating.set(false);
        void this.router.navigate(['/dungeons', created.id]);
      },
      error: () => {
        this.creating.set(false);
        this.error.set('Création impossible (limite ou réseau).');
      },
    });
  }

  askDelete(d: CloudDungeonSummary): void {
    this.deleteTarget.set(d);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const d = this.deleteTarget();
    if (!d || this.deleting()) return;
    this.deleting.set(true);
    this.cloud.delete(d.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.dungeons.update((list) => list.filter((x) => x.id !== d.id));
      },
      error: () => {
        this.deleting.set(false);
        this.error.set('Suppression impossible.');
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
