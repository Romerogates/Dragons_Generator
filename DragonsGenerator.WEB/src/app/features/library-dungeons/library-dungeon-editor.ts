import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CampaignDungeonMaps } from '@features/campaigns/campaign-dungeon-maps/campaign-dungeon-maps';
import {
  CampaignData,
  CampaignDetail,
  emptyCampaignData,
} from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import { DungeonCloudService } from '@core/services/dungeon-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { Subject, debounceTime, switchMap, of, catchError } from 'rxjs';

@Component({
  selector: 'app-library-dungeon-editor',
  standalone: true,
  imports: [CommonModule, RouterLink, CampaignDungeonMaps],
  templateUrl: './library-dungeon-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryDungeonEditor implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cloud = inject(DungeonCloudService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly shellCampaign = signal<CampaignDetail | null>(null);
  readonly focusMapId = signal<string | null>(null);
  readonly readOnly = signal(false);

  private cloudId = '';
  private save$ = new Subject<CampaignDungeonMap>();

  readonly isLoggedIn = this.auth.isLoggedIn;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const friendId = this.route.snapshot.queryParamMap.get('friend');
    if (!id) {
      void this.router.navigate(['/dungeons']);
      return;
    }
    this.cloudId = id;

    this.save$
      .pipe(
        debounceTime(600),
        switchMap((map) => {
          if (this.readOnly()) return of(null);
          this.saveState.set('saving');
          return this.cloud.update(this.cloudId, map, map.name).pipe(
            catchError(() => {
              this.saveState.set('error');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        if (res) this.saveState.set('saved');
      });

    if (friendId) {
      this.readOnly.set(true);
      this.cloud.getFriendDungeon(friendId, id).subscribe({
        next: (detail) => this.applyDetail(detail.id, detail.name, detail.data),
        error: () => {
          this.error.set('Donjon inaccessible.');
          this.loading.set(false);
        },
      });
      return;
    }

    if (!this.auth.isLoggedIn()) {
      this.loading.set(false);
      this.error.set('Connexion requise.');
      return;
    }

    this.cloud.get(id).subscribe({
      next: (detail) => this.applyDetail(detail.id, detail.name, detail.data),
      error: () => {
        this.error.set('Donjon introuvable.');
        this.loading.set(false);
      },
    });
  }

  private applyDetail(id: string, name: string, raw: CampaignDungeonMap): void {
    const map: CampaignDungeonMap = {
      ...raw,
      id,
      name: name || raw.name || 'Donjon',
    };
    this.focusMapId.set(id);
    this.shellCampaign.set(this.buildShell(map));
    this.loading.set(false);
  }

  private buildShell(map: CampaignDungeonMap): CampaignDetail {
    const data: CampaignData = {
      ...emptyCampaignData(),
      dungeonMaps: [map],
    };
    return {
      id: `library-${this.cloudId}`,
      title: 'Bibliothèque',
      data,
      role: 'dm',
      isOwner: !this.readOnly(),
      updatedAt: new Date().toISOString(),
      members: [],
    };
  }

  onDataChange(patch: Partial<CampaignData>): void {
    if (this.readOnly()) return;
    const current = this.shellCampaign();
    if (!current) return;
    const maps = patch.dungeonMaps ?? current.data.dungeonMaps ?? [];
    const next: CampaignDetail = {
      ...current,
      data: { ...current.data, ...patch, dungeonMaps: maps },
      updatedAt: new Date().toISOString(),
    };
    this.shellCampaign.set(next);
    const map = maps.find((m) => m.id === this.cloudId) ?? maps[0];
    if (map) this.save$.next({ ...map, id: this.cloudId });
  }
}
