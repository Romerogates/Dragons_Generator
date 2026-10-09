import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CampaignPregenGeneratorService } from '@core/services/campaign-pregen-generator.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { AiGenerationProgressService } from '@core/services/ai-generation-progress.service';
import { isAiGenerationAborted } from '@core/models/ai-generation.model';
import type { Character } from '@core/models/Character/character';
import {
  createCampaignPregenEntry,
  createNotebookPage,
  encounterTotalXp,
  type CampaignMember,
  type CampaignPregen,
  type EncounterGroup,
  type NotebookPage,
} from '@core/models/Campaign/campaign';
import { maxCampaignPregens } from '@core/constants/character-limits';
import type { CreatureRole, StoryCreatureSelection } from '@core/models/Story/story';
import {
  bumpEncounterCreatureDefeated,
  creatureTrackKey,
  splitEncounterXp,
  withBulkCreatureRole,
  withCreatureCardField,
  withCreatureRole,
  withMappedEncounter,
  type CreatureCardPersistField,
} from '@core/utils/campaign-hub-write.util';
import { notebookPersistPatch, resolveNotebookEnsure } from '@core/utils/notebook.util';
import {
  CampaignHubStore,
  type CampaignHubSyncHooks,
  type CampaignPregenAttachHooks,
} from './campaign-hub.store';

/**
 * Pré-tirés, rencontres, créatures, carnet. Persist = store.saveData uniquement.
 */
@Injectable()
export class CampaignHubContentService {
  private readonly hub = inject(CampaignHubStore);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly pregenGenerator = inject(CampaignPregenGeneratorService);
  private readonly characters = inject(CharacterCloudService);
  private readonly aiProgress = inject(AiGenerationProgressService);

  private pregenUndo: (() => void) | null = null;
  private pregenUndoTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.hub.registerTeardown(() => {
      if (this.pregenUndoTimer) {
        clearTimeout(this.pregenUndoTimer);
        this.pregenUndoTimer = null;
      }
      this.pregenUndo = null;
    });
  }

  awardEncounterXp(encounter: EncounterGroup, approved: { id: string }[]): void {
    const c = this.hub.campaign();
    if (!c || !c.isOwner || encounter.xpAwarded) return;
    if (this.hub.awardingXpId()) return;
    const split = splitEncounterXp(encounterTotalXp(encounter), approved.length);
    if (!split.ok) {
      if (split.reason === 'no-players') {
        this.hub.error.set('Aucun joueur avec un personnage approuvé.');
      }
      return;
    }

    this.hub.awardingXpId.set(encounter.id);
    this.hub.error.set(null);
    let completed = 0;
    let failed = 0;
    for (const player of approved) {
      this.campaigns.awardXp(c.id, player.id, split.share).subscribe({
        next: () => {
          completed++;
          if (completed + failed === approved.length) {
            this.hub.awardingXpId.set(null);
            if (failed === 0) {
              const encounters = c.data.encounters.map((e) =>
                e.id === encounter.id ? { ...e, xpAwarded: true } : e,
              );
              this.hub.saveData({ encounters });
            } else {
              this.hub.error.set(
                `XP partiellement envoyée (${completed}/${approved.length}). Réessayez.`,
              );
            }
          }
        },
        error: () => {
          failed++;
          if (completed + failed === approved.length) {
            this.hub.awardingXpId.set(null);
            this.hub.error.set(
              `Échec XP (${completed}/${approved.length} OK). Vérifiez la connexion.`,
            );
          }
        },
      });
    }
  }

  patchEncounter(encId: string, patch: Partial<EncounterGroup>): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    this.hub.saveData({
      encounters: withMappedEncounter(c.data.encounters, encId, patch),
    });
  }

  bumpEncounterDefeated(encounterId: string, creatureIndex: number, delta: 1 | -1): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    this.hub.saveData({
      encounters: bumpEncounterCreatureDefeated(c.data.encounters, encounterId, creatureIndex, delta),
    });
  }

  persistNotebookPages(pages: NotebookPage[]): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    this.hub.saveData(notebookPersistPatch(pages, c.data.notes || ''));
  }

  ensureNotebookPages(activeId: string | null): string | null {
    const c = this.hub.campaign();
    if (!c?.isOwner) return activeId;
    const resolved = resolveNotebookEnsure(
      c.data.notebookPages,
      c.data.notes,
      createNotebookPage('Notes du MJ'),
    );
    if (resolved.persist) this.hub.saveData({ notebookPages: resolved.pages });
    if (activeId && resolved.pages.some((p) => p.id === activeId)) return activeId;
    return resolved.activeId;
  }

  async generateAutoPregen(): Promise<void> {
    const c = this.hub.campaign();
    if (!c?.isOwner || this.hub.generatingAutoPregen()) return;
    if (!this.canAddPregen()) {
      this.hub.pregenFeedback.set(this.pregenCapMessage());
      return;
    }
    if (this.aiProgress.active()) {
      this.hub.pregenFeedback.set(this.aiProgress.busyMessage());
      return;
    }

    this.hub.generatingAutoPregen.set(true);
    this.hub.pregenFeedback.set(null);
    const campaignId = c.id;
    try {
      const generated = await this.pregenGenerator.generateOriginalPlayable(c, true);
      const latest = this.hub.campaign();
      if (!latest || latest.id !== campaignId) return;
      const entry = createCampaignPregenEntry(
        generated.characterId,
        generated.characterName,
        generated.speciesLabel,
        generated.classLabel,
      );
      entry.publicHook = generated.publicHook;
      entry.dmBackstory = generated.dmBackstory;
      entry.status = 'ready';
      this.hub.saveData({
        pregenCharacters: [...(latest.data.pregenCharacters ?? []), entry],
      });
    } catch (err) {
      if (isAiGenerationAborted(err)) return;
      this.hub.pregenFeedback.set('Génération impossible. Réessayez dans quelques instants.');
    } finally {
      this.hub.generatingAutoPregen.set(false);
    }
  }

  async importPregenFromCharacter(characterId: string): Promise<void> {
    const c = this.hub.campaign();
    if (!c?.isOwner || this.hub.importingPregen()) return;
    if (!this.canAddPregen()) {
      this.hub.pregenFeedback.set(this.pregenCapMessage());
      return;
    }
    this.hub.importingPregen.set(true);
    this.hub.pregenFeedback.set(null);
    try {
      const generated = await this.pregenGenerator.generatePlayableDuplicate(c, characterId, false);
      const entry = createCampaignPregenEntry(
        generated.characterId,
        generated.characterName,
        generated.speciesLabel,
        generated.classLabel,
      );
      entry.publicHook = generated.publicHook;
      entry.dmBackstory = generated.dmBackstory;
      entry.status = 'ready';
      this.hub.saveData({
        pregenCharacters: [...(c.data.pregenCharacters ?? []), entry],
      });
    } catch {
      this.hub.pregenFeedback.set('Impossible d’importer ce personnage.');
    } finally {
      this.hub.importingPregen.set(false);
    }
  }

  async attachCharacterAsPregen(
    characterId: string,
    hooks?: CampaignPregenAttachHooks,
  ): Promise<void> {
    const c = this.hub.campaign();
    if (!c?.isOwner || !characterId || this.hub.importingPregen()) return;

    const existing = (c.data.pregenCharacters ?? []).some((p) => p.characterId === characterId);
    if (existing) {
      hooks?.onShowPregens?.();
      this.hub.pregenFeedback.set('Ce héros est déjà dans le pool de pré-tirés.');
      return;
    }
    if (!this.canAddPregen()) {
      hooks?.onShowPregens?.();
      this.hub.pregenFeedback.set(this.pregenCapMessage());
      return;
    }

    this.hub.importingPregen.set(true);
    this.hub.pregenFeedback.set(null);
    try {
      const res = await firstValueFrom(this.characters.get(characterId));
      const ch = { ...(res.data as Character), id: characterId, isPregenPool: true };
      await firstValueFrom(this.characters.save(ch, { updateExisting: true }));
      const speciesLabel = ch.species?.subspeciesLabel
        ? `${ch.species.label} (${ch.species.subspeciesLabel})`
        : (ch.species?.label ?? '—');
      const classLabel = (ch.classes ?? []).map((cl) => cl.classLabel).join(' / ') || '—';
      const entry = createCampaignPregenEntry(ch.id, ch.name || 'Héros', speciesLabel, classLabel);
      const story = ch.personality?.story?.trim() ?? '';
      entry.publicHook = story.split(/[.!?]/)[0]?.trim() || story.slice(0, 140);
      entry.dmBackstory = story;
      entry.status = 'ready';
      this.hub.saveData({
        pregenCharacters: [...(c.data.pregenCharacters ?? []), entry],
      });
      hooks?.onShowPregens?.();
      this.hub.pregenFeedback.set(`${ch.name} ajouté aux pré-tirés — prêt pour la table.`);
    } catch {
      this.hub.pregenFeedback.set('Impossible d’ajouter ce personnage aux pré-tirés.');
      hooks?.onShowPregens?.();
    } finally {
      this.hub.importingPregen.set(false);
    }
  }

  canAddPregen(): boolean {
    const c = this.hub.campaign();
    if (!c) return false;
    const count = c.data.pregenCharacters?.length ?? 0;
    return count < maxCampaignPregens(this.playerCount());
  }

  pregenCapMessage(): string {
    const cap = maxCampaignPregens(this.playerCount());
    return `Plafond atteint : ${cap} pré-tirés max (10 + ${this.playerCount()} joueur(s)).`;
  }

  pregenCapLabel(): string {
    const c = this.hub.campaign();
    const count = c?.data.pregenCharacters?.length ?? 0;
    const cap = maxCampaignPregens(this.playerCount());
    return `${count} / ${cap}`;
  }

  updatePregen(pregenId: string, patch: Partial<CampaignPregen>): void {
    const c = this.hub.campaign();
    if (!c) return;
    const pregens = (c.data.pregenCharacters ?? []).map((p) =>
      p.id === pregenId ? { ...p, ...patch } : p,
    );
    this.hub.saveData({ pregenCharacters: pregens });
  }

  markPregenReady(pregenId: string): void {
    this.updatePregen(pregenId, { status: 'ready' });
  }

  removePregenConfirmed(pregenId: string): void {
    const c = this.hub.campaign();
    if (!c) return;
    const removed = (c.data.pregenCharacters ?? []).find((p) => p.id === pregenId);
    const name = removed?.characterName ?? 'ce pré-tiré';
    const previous = [...(c.data.pregenCharacters ?? [])];
    this.hub.saveData({
      pregenCharacters: previous.filter((p) => p.id !== pregenId),
    });
    this.hub.pregenFeedback.set(`« ${name} » retiré — Annuler dans les 10 s.`);
    if (this.pregenUndoTimer) clearTimeout(this.pregenUndoTimer);
    this.pregenUndo = () => {
      this.hub.saveData({ pregenCharacters: previous });
      this.hub.pregenFeedback.set('Pré-tiré restauré.');
      this.pregenUndo = null;
      this.hub.pregenUndoAvailable.set(false);
    };
    this.hub.pregenUndoAvailable.set(true);
    this.pregenUndoTimer = setTimeout(() => {
      this.pregenUndo = null;
      this.hub.pregenUndoAvailable.set(false);
      this.hub.pregenFeedback.set(null);
      this.pregenUndoTimer = null;
    }, 10_000);
  }

  runPregenUndo(): void {
    this.pregenUndo?.();
    this.hub.pregenUndoAvailable.set(false);
    if (this.pregenUndoTimer) {
      clearTimeout(this.pregenUndoTimer);
      this.pregenUndoTimer = null;
    }
  }

  assignPregen(pregen: CampaignPregen, member: CampaignMember, hooks?: CampaignHubSyncHooks): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    this.campaigns.assignPregen(c.id, pregen.id, member.userId, member.displayName).subscribe({
      next: () => hooks?.onOk?.(),
      error: () => this.hub.error.set('Assignation impossible.'),
    });
  }

  claimPregen(pregenId: string, hooks?: CampaignHubSyncHooks): void {
    const c = this.hub.campaign();
    if (!c) return;
    this.hub.pregenFeedback.set(null);
    this.campaigns.claimPregen(c.id, pregenId).subscribe({
      next: () => {
        this.hub.pregenFeedback.set('Copie ajoutée dans Mes héros (la table n’a pas changé).');
        hooks?.onOk?.();
      },
      error: () => this.hub.pregenFeedback.set('Impossible de copier ce personnage dans Mes héros.'),
    });
  }

  usePregenAtTable(pregenId: string, hooks?: CampaignHubSyncHooks): void {
    const c = this.hub.campaign();
    if (!c) return;
    this.hub.pregenFeedback.set(null);
    this.campaigns.usePregenAtTable(c.id, pregenId).subscribe({
      next: () => {
        this.hub.pregenFeedback.set('Pré-tiré lié à la table — sans copie dans Mes héros.');
        hooks?.onOk?.();
      },
      error: () => this.hub.pregenFeedback.set('Impossible d’utiliser ce pré-tiré à la table.'),
    });
  }

  updateCreatureRole(cr: StoryCreatureSelection, role: CreatureRole): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    this.hub.saveData({ creatures: withCreatureRole(c.data.creatures ?? [], cr, role) });
  }

  updateCreatureCardField(
    cr: StoryCreatureSelection,
    field: CreatureCardPersistField,
    value: string,
  ): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    this.hub.saveData({ creatures: withCreatureCardField(c.data.creatures ?? [], cr, field, value) });
  }

  applyBulkCreatureRole(unsorted: StoryCreatureSelection[], role: 'ally' | 'antagonist'): void {
    const c = this.hub.campaign();
    if (!c?.isOwner || !unsorted.length) return;
    const keys = new Set(unsorted.map((cr) => creatureTrackKey(cr)));
    this.hub.saveData({ creatures: withBulkCreatureRole(c.data.creatures ?? [], keys, role) });
  }

  private playerCount(): number {
    return (this.hub.campaign()?.members ?? []).filter((m) => m.role === 'player').length;
  }
}
