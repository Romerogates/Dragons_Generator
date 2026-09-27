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

@Component({
  selector: 'app-dungeon-shared',
  standalone: true,
  imports: [CommonModule, RouterLink, CampaignDungeonMaps],
  templateUrl: './dungeon-shared.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DungeonSharedPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cloud = inject(DungeonCloudService);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly ownerName = signal('');
  readonly dungeonName = signal('');
  readonly shellCampaign = signal<CampaignDetail | null>(null);
  readonly focusMapId = signal<string | null>(null);
  readonly importState = signal<'idle' | 'saving' | 'done' | 'error'>('idle');

  private token = '';

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token')?.trim();
    if (!token) {
      void this.router.navigate(['/dungeons']);
      return;
    }
    this.token = token;
    this.cloud.getSharedDungeon(token).subscribe({
      next: (detail) => {
        this.ownerName.set(detail.ownerDisplayName);
        this.dungeonName.set(detail.name);
        const map: CampaignDungeonMap = {
          ...detail.data,
          id: detail.id,
          name: detail.name || detail.data.name || 'Donjon',
        };
        this.focusMapId.set(detail.id);
        this.shellCampaign.set({
          id: `shared-${detail.id}`,
          title: 'Donjon partagé',
          data: { ...emptyCampaignData(), dungeonMaps: [map] } satisfies CampaignData,
          role: 'player',
          isOwner: false,
          updatedAt: detail.updatedAt,
          members: [],
        });
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Lien invalide ou révoqué.');
        this.loading.set(false);
      },
    });
  }

  importCopy(): void {
    if (!this.auth.isLoggedIn()) {
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: `/dungeons/shared/${this.token}` },
      });
      return;
    }
    this.importState.set('saving');
    this.cloud.importFromShare(this.token).subscribe({
      next: (created) => {
        this.importState.set('done');
        void this.router.navigate(['/dungeons', created.id]);
      },
      error: () => this.importState.set('error'),
    });
  }
}
