import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  untracked,
  viewChild,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CampaignLiveService } from '@core/services/campaign-live.service';
import { DataService } from '@core/services/data.service';
import {
  atlasAlreadyHasCiv,
  atlasAlreadyHasName,
} from '@core/utils/campaign-hub-write.util';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import { CampaignHubStore } from '../campaign-hub-store/campaign-hub.store';
import { CampaignHubSyncService } from '../campaign-hub-store/campaign-hub-sync.service';
import { CampaignHubMembersService } from '../campaign-hub-store/campaign-hub-members.service';
import { CampaignHubContentService } from '../campaign-hub-store/campaign-hub-content.service';
import { CampaignHubPdfService } from '../campaign-hub-store/campaign-hub-pdf.service';
import { CampaignHubSheetsService } from '../campaign-hub-store/campaign-hub-sheets.service';
import { CampaignHubNavService } from '../campaign-hub-store/campaign-hub-nav.service';
import { CampaignHubBootService } from '../campaign-hub-store/campaign-hub-boot.service';
import { CampaignHubRosterService } from '../campaign-hub-store/campaign-hub-roster.service';
import { CampaignHubTableService } from '../campaign-hub-store/campaign-hub-table.service';
import { CampaignHubPrepService } from '../campaign-hub-store/campaign-hub-prep.service';
import { CampaignHubViewService } from '../campaign-hub-store/campaign-hub-view.service';
import { CampaignDetailTabs } from './campaign-detail-tabs';
import { CampaignDetailOverlays } from './campaign-detail-overlays';

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CampaignDetailTabs,
    CampaignDetailOverlays,
  ],
  templateUrl: './campaign-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    CampaignHubStore,
    CampaignHubSyncService,
    CampaignHubMembersService,
    CampaignHubContentService,
    CampaignHubPdfService,
    CampaignHubSheetsService,
    CampaignHubNavService,
    CampaignHubBootService,
    CampaignHubRosterService,
    CampaignHubTableService,
    CampaignHubPrepService,
    CampaignHubViewService,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailPage implements OnInit, OnDestroy {
  readonly hub = inject(CampaignHubStore);
  readonly hubSync = inject(CampaignHubSyncService);
  readonly hubNav = inject(CampaignHubNavService);
  readonly boot = inject(CampaignHubBootService);
  readonly roster = inject(CampaignHubRosterService);
  readonly table = inject(CampaignHubTableService);
  readonly prep = inject(CampaignHubPrepService);
  readonly vm = inject(CampaignHubViewService);
  private live = inject(CampaignLiveService);
  private data = inject(DataService);
  private sessionDock = inject(CampaignSessionDockService);
  private readonly tabs = viewChild(CampaignDetailTabs);

  /** Picker Atlas (+ Lieu) : civilisations Codex + Autre. */
  readonly atlasPinPickerOpen = signal(false);
  readonly atlasCivOptions = signal<{ id: string; name: string }[]>([]);
  readonly atlasCivsLoading = signal(false);
  readonly atlasPinFilter = signal('');
  readonly atlasCustomName = signal('');
  readonly atlasShowCustom = signal(false);

  readonly atlasRegionOption = computed(() => {
    const c = this.hub.campaign();
    if (!c) return null;
    const id = c.data.regionId?.trim();
    const name = c.data.regionName?.trim();
    if (!id || !name) return null;
    const pinned = (c.data.atlasPins ?? []).some((p) => p.civId === id);
    if (pinned) return null;
    return { id, name };
  });

  readonly atlasFilteredCivs = computed(() => {
    const q = this.atlasPinFilter().trim().toLowerCase();
    const regionId = this.hub.campaign()?.data.regionId ?? null;
    const pinned = new Set(
      (this.hub.campaign()?.data.atlasPins ?? [])
        .map((p) => p.civId)
        .filter((id): id is string => !!id),
    );
    return this.atlasCivOptions()
      .filter((civ) => civ.id !== regionId && !pinned.has(civ.id))
      .filter((civ) => !q || civ.name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });

  constructor() {
    this.boot.configure({
      flushMaps: () => this.tabs()?.flushPendingSave(),
      attachPregen: (id) => this.prep.attachCharacterAsPregen(id),
      openLevelUp: () => this.roster.openLevelUpFromXp(),
      mjUi: (c) => this.vm.mjUi(c),
    });
    this.hubNav.configure({
      campaign: () => this.hub.campaign(),
      flushMaps: () => this.boot.flushMaps(),
      loadActivity: () => this.table.loadActivity(),
      onHandoutsOpened: () => {
        if (this.vm.hubPdf.pdfPreviewKind() === 'bestiary' && this.hub.campaign()!.data.creatures.length) {
          this.prep.loadBestiaryPreview();
        } else {
          this.prep.loadPackPreview();
        }
      },
      ensureNotebook: () => this.prep.ensureNotebookPages(),
    });
    this.hub.configure({
      isSupportInspect: () => this.vm.isSupportInspect(),
      onPersisted: () => this.hubSync.maybeLoadActivity(),
      isOverviewTab: () => this.hubNav.tab() === 'overview',
      onCampaignLoaded: (c) => this.boot.afterCampaignLoaded(c),
    });
    effect(() => {
      const c = this.hub.campaign();
      untracked(() => this.sessionDock.bindCampaign(c));
    });
    effect(() => {
      this.live.connected();
      const c = this.hub.campaign();
      untracked(() => this.hubSync.tuneSoftPollInterval(c));
    });
    effect(() => {
      const live = this.sessionDock.liveCampaign();
      const cur = this.hub.campaign();
      if (!live || !cur || live.id !== cur.id || live === cur) return;
      untracked(() => this.hub.campaign.set(live));
    });
    effect(() => {
      const id = this.hub.campaign()?.id;
      if (!id) return;
      untracked(() => {
        try {
          this.prep.mapsStepSkipped.set(
            sessionStorage.getItem(`dg-campaign-skip-maps:${id}`) === '1',
          );
        } catch {
          this.prep.mapsStepSkipped.set(false);
        }
      });
    });
    effect(() => {
      const c = this.hub.campaign();
      if (!c?.isOwner || this.vm.isSupportInspect()) return;
      const activeId = c.data.activeSessionId;
      if (!activeId) return;
      if ((c.data.sessions ?? []).some((s) => s.id === activeId)) return;
      untracked(() => {
        this.prep.saveData({ activeSessionId: null });
        this.sessionDock.bindCampaign({
          ...c,
          data: { ...c.data, activeSessionId: null },
        });
      });
    });
  }

  ngOnInit(): void {
    this.boot.start();
  }

  ngOnDestroy(): void {
    this.boot.destroy();
  }

  @HostListener('document:click')
  onDocumentClickCloseAtlasPicker(): void {
    if (this.atlasPinPickerOpen()) this.closeAtlasPinPicker();
  }

  @HostListener('document:keydown.escape')
  onEscapeCloseAtlasPicker(): void {
    if (this.atlasPinPickerOpen()) this.closeAtlasPinPicker();
  }

  toggleAtlasPinPicker(ev: Event): void {
    ev.stopPropagation();
    if (this.atlasPinPickerOpen()) {
      this.closeAtlasPinPicker();
      return;
    }
    this.atlasPinPickerOpen.set(true);
    this.atlasPinFilter.set('');
    this.atlasCustomName.set('');
    this.atlasShowCustom.set(false);
    this.ensureAtlasCivsLoaded();
  }

  closeAtlasPinPicker(): void {
    this.atlasPinPickerOpen.set(false);
    this.atlasShowCustom.set(false);
    this.atlasCustomName.set('');
    this.atlasPinFilter.set('');
  }

  private ensureAtlasCivsLoaded(): void {
    if (this.atlasCivOptions().length || this.atlasCivsLoading()) return;
    this.atlasCivsLoading.set(true);
    this.data.getCivilisationsSummary().subscribe({
      next: (list) => {
        this.atlasCivOptions.set(
          (list ?? [])
            .filter((civ) => !!civ?.id && !!civ?.name)
            .map((civ) => ({ id: civ.id, name: civ.name })),
        );
        this.atlasCivsLoading.set(false);
      },
      error: () => {
        this.atlasCivOptions.set([]);
        this.atlasCivsLoading.set(false);
      },
    });
  }

  addAtlasPinFromCiv(civId: string, name: string): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    const id = civId.trim();
    const label = name.trim();
    if (!id || !label) return;
    if (atlasAlreadyHasCiv(c.data.atlasPins, id)) {
      this.closeAtlasPinPicker();
      return;
    }
    this.hub.pushAtlasPin({
      id: crypto.randomUUID?.() ?? `pin-${Date.now()}`,
      name: label,
      civId: id,
      note: '',
    });
    this.closeAtlasPinPicker();
  }

  addAtlasPinCustom(): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    const name = this.atlasCustomName().trim();
    if (!name) return;
    if (atlasAlreadyHasName(c.data.atlasPins, name)) {
      this.closeAtlasPinPicker();
      return;
    }
    this.hub.pushAtlasPin({
      id: crypto.randomUUID?.() ?? `pin-${Date.now()}`,
      name,
      civId: c.data.regionId ?? null,
      note: '',
    });
    this.closeAtlasPinPicker();
  }

  removeAtlasPin(pinId: string): void {
    this.hub.removeAtlasPin(pinId);
  }
}
