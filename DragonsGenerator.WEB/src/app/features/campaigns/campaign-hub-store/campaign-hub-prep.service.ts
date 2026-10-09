import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { StoryBuilderService } from '@core/services/story-builder.service';
import {
  createNotebookPage,
  type CampaignData,
  type CampaignMember,
  type CampaignPregen,
  type EncounterGroup,
  type NotebookPage,
} from '@core/models/Campaign/campaign';
import type { CreatureRole, StoryCreatureSelection } from '@core/models/Story/story';
import { creatureTrackKey, storyEncounterGroups } from '@core/utils/campaign-hub-write.util';
import { buildEncountersFromPack } from '@core/utils/campaign-content-presets.util';
import * as hubView from '@core/utils/campaign-hub-view.util';
import type { CreatureCardFieldEvent } from '../campaign-detail/campaign-detail-prep-creatures/campaign-detail-prep-creatures';
import type { PregenPatchEvent } from '../campaign-detail/campaign-detail-prep-pregens/campaign-detail-prep-pregens';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignHubContentService } from './campaign-hub-content.service';
import { CampaignHubNavService } from './campaign-hub-nav.service';
import { CampaignHubSheetsService } from './campaign-hub-sheets.service';
import { CampaignHubPdfService } from './campaign-hub-pdf.service';
import { CampaignHubBootService } from './campaign-hub-boot.service';

/**
 * Préparation : scénario, créatures, rencontres, pré-tirés, carnet.
 * Persist = store uniquement.
 */
@Injectable()
export class CampaignHubPrepService {
  private readonly router = inject(Router);
  private readonly hub = inject(CampaignHubStore);
  private readonly content = inject(CampaignHubContentService);
  private readonly hubNav = inject(CampaignHubNavService);
  private readonly hubSheets = inject(CampaignHubSheetsService);
  private readonly hubPdf = inject(CampaignHubPdfService);
  private readonly boot = inject(CampaignHubBootService);
  private readonly storyBuilder = inject(StoryBuilderService);

  readonly activeNotebookPageId = signal<string | null>(null);
  readonly mapsStepSkipped = signal(false);
  private readonly draftNotebookPage = signal(createNotebookPage('Notes du MJ'));

  readonly notebookPages = computed((): NotebookPage[] => this.hub.campaign()?.data.notebookPages ?? []);

  readonly activeNotebookPage = computed((): NotebookPage => {
    const pages = this.notebookPages();
    const id = this.activeNotebookPageId();
    return pages.find((p) => p.id === id) ?? pages[0] ?? this.draftNotebookPage();
  });

  saveData(patch: Partial<CampaignData>): void {
    this.hub.saveData(patch);
  }

  saveTitle(title: string): void {
    this.hub.saveTitle(title);
  }

  generateEncountersFromStory(): void {
    const c = this.hub.campaign();
    if (!c || c.data.creatures.length === 0) return;
    const groups = storyEncounterGroups(c.data.creatures, this.boot.creatureXpMap());
    this.saveData({ encounters: [...c.data.encounters, ...groups] });
  }

  insertEncounterPack(packId: string): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    const added = buildEncountersFromPack(packId);
    if (!added.length) return;
    this.saveData({ encounters: [...(c.data.encounters ?? []), ...added] });
    this.hub.rosterFeedback.set(`${added.length} rencontre(s) ajoutée(s).`);
  }

  markDefeated(encounterId: string, creatureIndex: number): void {
    this.content.bumpEncounterDefeated(encounterId, creatureIndex, 1);
  }

  undoDefeated(encounterId: string, creatureIndex: number): void {
    this.content.bumpEncounterDefeated(encounterId, creatureIndex, -1);
  }

  distributeEncounterXp(encounter: EncounterGroup): void {
    const players = hubView.membersByRole(this.hub.campaign()?.members, 'player');
    this.content.awardEncounterXp(
      encounter,
      players.filter((p) => p.proposalStatus === 'approved'),
    );
  }

  patchEncounter(encId: string, patch: Partial<EncounterGroup>): void {
    this.content.patchEncounter(encId, patch);
  }

  openDungeonForEncounter(enc: EncounterGroup): void {
    this.hubNav.setTab('maps');
    this.hubNav.focusDungeonMapId.set(enc.dungeonMapId ?? null);
  }

  editScenario(): void {
    this.openStoryBuilder('full');
  }

  addCreaturesOnly(): void {
    this.openStoryBuilder('creatures-only');
  }

  creatureTrackKey(cr: StoryCreatureSelection): string {
    return creatureTrackKey(cr);
  }

  openCampaignBestiaryBook(index = 0): void {
    const c = this.hub.campaign();
    if (!c) return;
    void this.router.navigate(['/campaigns', c.id, 'bestiary'], { queryParams: { i: index } });
  }

  openCreatureInBook(cr: StoryCreatureSelection): void {
    const c = this.hub.campaign();
    if (!c) return;
    const index = (c.data.creatures ?? []).findIndex(
      (entry) => entry.creatureId === cr.creatureId && entry.customName === cr.customName,
    );
    this.openCampaignBestiaryBook(index >= 0 ? index : 0);
  }

  updateCreatureRole(cr: StoryCreatureSelection, role: CreatureRole): void {
    this.content.updateCreatureRole(cr, role);
  }

  updateCreatureCardField(
    cr: StoryCreatureSelection,
    field: 'voice' | 'desire' | 'fear' | 'secret' | 'noteStats',
    value: string,
  ): void {
    this.content.updateCreatureCardField(cr, field, value);
  }

  onCreatureCardField(event: CreatureCardFieldEvent): void {
    this.updateCreatureCardField(event.creature, event.field, event.value);
  }

  onPregenPatch(event: PregenPatchEvent): void {
    this.updatePregen(event.pregenId, event.patch);
  }

  dungeonMapOptions(): { id: string; name: string }[] {
    return (this.hub.campaign()?.data.dungeonMaps ?? []).map((m) => ({ id: m.id, name: m.name }));
  }

  bulkClassifyUnsorted(role: 'ally' | 'antagonist'): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    const unsorted = hubView.creaturesByRoleBucket(c.data.creatures, 'other');
    if (!unsorted.length) return;
    const label = role === 'ally' ? 'alliés' : 'adversaires';
    this.boot.askConfirm(
      'Classer les créatures',
      `Classer ${unsorted.length} créature(s) non classée(s) en ${label} ?`,
      () => this.content.applyBulkCreatureRole(unsorted, role),
      'Classer',
      false,
    );
  }

  onNotebookPageChange(page: NotebookPage): void {
    this.activeNotebookPageId.set(page.id);
  }

  onNotebookPagesChange(pages: NotebookPage[]): void {
    this.content.persistNotebookPages(pages);
  }

  ensureNotebookPages(): void {
    const id = this.content.ensureNotebookPages(this.activeNotebookPageId());
    if (id) this.activeNotebookPageId.set(id);
  }

  async generateAutoPregen(): Promise<void> {
    await this.content.generateAutoPregen();
  }

  async importPregenFromCharacter(characterId: string): Promise<void> {
    await this.content.importPregenFromCharacter(characterId);
  }

  async attachCharacterAsPregen(characterId: string): Promise<void> {
    await this.content.attachCharacterAsPregen(characterId, {
      onShowPregens: () => this.hubNav.setTab('pregens'),
    });
  }

  canAddPregen(): boolean {
    return this.content.canAddPregen();
  }

  pregenCapMessage(): string {
    return this.content.pregenCapMessage();
  }

  pregenCapLabel(): string {
    return this.content.pregenCapLabel();
  }

  updatePregen(pregenId: string, patch: Partial<CampaignPregen>): void {
    this.content.updatePregen(pregenId, patch);
  }

  markPregenReady(pregenId: string): void {
    this.content.markPregenReady(pregenId);
  }

  removePregen(pregenId: string): void {
    const c = this.hub.campaign();
    if (!c) return;
    const removed = (c.data.pregenCharacters ?? []).find((p) => p.id === pregenId);
    const name = removed?.characterName ?? 'ce pré-tiré';
    this.boot.askConfirm(
      'Supprimer le pré-tiré',
      `Supprimer « ${name} » de la campagne ?`,
      () => this.content.removePregenConfirmed(pregenId),
    );
  }

  runPregenUndo(): void {
    this.content.runPregenUndo();
  }

  assignPregen(pregen: CampaignPregen, member: CampaignMember): void {
    this.content.assignPregen(pregen, member, { onOk: () => this.boot.reload() });
  }

  claimPregen(pregenId: string): void {
    this.content.claimPregen(pregenId, { onOk: () => this.boot.reload() });
  }

  usePregenAtTable(pregenId: string): void {
    this.content.usePregenAtTable(pregenId, { onOk: () => this.boot.reload() });
  }

  printPregenHandout(pregen: CampaignPregen): void {
    this.hubSheets.printPregenHandout(pregen);
  }

  printPregenFullSheet(pregen: CampaignPregen): void {
    this.hubSheets.printPregenFullSheet(pregen);
  }

  viewPregenCharacter(pregen: CampaignPregen): void {
    this.hubSheets.viewPregenCharacter(pregen);
  }

  myAssignedPregens(): CampaignPregen[] {
    return this.hubSheets.myAssignedPregens();
  }

  readyPregensForPlayers(): CampaignPregen[] {
    return this.hubSheets.readyPregensForPlayers();
  }

  skipMapsStep(): void {
    const c = this.hub.campaign();
    this.mapsStepSkipped.set(true);
    if (!c) return;
    try {
      sessionStorage.setItem(`dg-campaign-skip-maps:${c.id}`, '1');
    } catch {
      /* ignore */
    }
  }

  openBestiaryFullscreen(): void {
    this.hubPdf.openBestiaryFullscreen();
  }

  loadPackPreview(): void {
    this.hubPdf.loadPackPreview();
  }

  loadBestiaryPreview(): void {
    this.hubPdf.loadBestiaryPreview();
  }

  private openStoryBuilder(mode: 'full' | 'creatures-only'): void {
    if (!this.hub.campaign()?.isOwner) return;
    this.hub.flushSoftPersist();
    this.boot.flushMaps();
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    this.storyBuilder.loadCampaignIntoBuilder(c, mode);
    void this.router.navigate(['/story/create']);
  }
}
