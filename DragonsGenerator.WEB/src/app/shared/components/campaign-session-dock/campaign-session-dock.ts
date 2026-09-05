import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import { AuthService } from '@core/services/auth.service';
import { DiceRollComponent } from '@shared/components/dice-roll/dice-roll';
import { CampaignPlayPanel } from '../../../features/campaigns/campaign-play-panel/campaign-play-panel';
import type { CampaignDetail } from '@core/models/Campaign/campaign';
import { sessionModeLabel } from '../../../features/campaigns/campaign-detail/campaign-session.util';

type DockTab = 'live' | 'table' | 'dice';

@Component({
  selector: 'app-campaign-session-dock',
  standalone: true,
  imports: [CommonModule, DiceRollComponent, CampaignPlayPanel],
  templateUrl: './campaign-session-dock.html',
  styleUrl: './campaign-session-dock.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignSessionDockComponent implements OnInit {
  readonly dock = inject(CampaignSessionDockService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly tab = signal<DockTab>('live');

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly showFab = computed(() => {
    if (!this.dock.isVisible()) return false;
    const id = this.dock.campaignId();
    const url = this.currentUrl();
    if (id && url.includes(`/campaigns/${id}/play`)) return false;
    return true;
  });

  readonly campaign = computed(() => this.dock.liveCampaign());
  readonly activeSession = computed(() => {
    const c = this.campaign();
    const sid = c?.data.activeSessionId;
    if (!c || !sid) return null;
    return c.data.sessions.find((s) => s.id === sid) ?? null;
  });

  readonly combat = computed(() => this.activeSession()?.activeCombat ?? null);
  readonly recentLog = computed(() => this.dock.recentLog());
  readonly damageLines = computed(() =>
    this.recentLog().filter((l) => /dégât|degat|PV|hp|vaincu|touch/i.test(l)).slice(0, 6),
  );

  readonly modeLabel = computed(() => {
    const s = this.activeSession();
    return s ? sessionModeLabel(s.mode) : '';
  });

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (!this.showFab()) this.dock.close();
      });
  }

  toggle(): void {
    this.dock.toggle();
  }

  close(): void {
    this.dock.close();
  }

  setTab(t: DockTab): void {
    this.tab.set(t);
  }

  openFullscreen(): void {
    const id = this.dock.campaignId();
    if (!id) return;
    this.dock.close();
    void this.router.navigate(['/campaigns', id, 'play']);
  }

  openCampaign(): void {
    const id = this.dock.campaignId();
    if (!id) return;
    this.dock.close();
    void this.router.navigate(['/campaigns', id]);
  }

  onCampaignChange(detail: CampaignDetail): void {
    this.dock.patchLiveCampaign(detail);
  }
}
