import { Injectable, inject } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { DataService } from './data.service';
import { CharacterCloudService } from './character-cloud.service';
import { CharacterAutoGeneratorService } from './character-auto-generator.service';
import type { CampaignDetail } from '@core/models/Campaign/campaign';
import type { Character } from '@core/models/Character/character';
import { pickRandom } from '@core/utils/pregen-random.util';
import { buildPregenPhysicalDescription } from '@core/utils/pregen-narrative.util';
import { AiGenerationProgressService } from './ai-generation-progress.service';
import { isAiGenerationAborted } from '@core/models/ai-generation.model';

export interface GeneratedPregenCharacter {
  characterId: string;
  characterName: string;
  speciesLabel: string;
  classLabel: string;
  publicHook: string;
  dmBackstory: string;
}

@Injectable({ providedIn: 'root' })
export class CampaignPregenGeneratorService {
  private readonly data = inject(DataService);
  private readonly characters = inject(CharacterCloudService);
  private readonly autoGenerator = inject(CharacterAutoGeneratorService);
  private readonly aiProgress = inject(AiGenerationProgressService);

  /** Génère un héros original niveau 1 — fiche complète, jouable après claim. */
  generateOriginalPlayable(campaign: CampaignDetail, withAiStory = true): Promise<GeneratedPregenCharacter> {
    return this.autoGenerator.generateOriginalPlayable(campaign, withAiStory);
  }

  /** Duplique un héros MJ complet — fiche jouable immédiatement après claim. */
  async generatePlayableDuplicate(
    campaign: CampaignDetail,
    sourceCharacterId: string,
    withAiStory = true,
  ): Promise<GeneratedPregenCharacter> {
    if (withAiStory) {
      if (this.aiProgress.active()) {
        throw { code: 'AI_GENERATION_BUSY', message: this.aiProgress.busyMessage() };
      }
      await this.aiProgress.begin('pregen-story');
      this.aiProgress.setStageLabel('Copie du personnage…');
    }
    try {
      return await this.generatePlayableDuplicateInner(campaign, sourceCharacterId, withAiStory);
    } catch (err) {
      if (withAiStory) {
        if (!isAiGenerationAborted(err)) this.aiProgress.cancel();
      }
      throw err;
    } finally {
      if (withAiStory && this.aiProgress.active() && !this.aiProgress.isAborted()) {
        this.aiProgress.complete();
      }
    }
  }

  private async generatePlayableDuplicateInner(
    campaign: CampaignDetail,
    sourceCharacterId: string,
    withAiStory: boolean,
  ): Promise<GeneratedPregenCharacter> {
    const wait = <T>(source: Observable<T>) =>
      withAiStory ? this.aiProgress.awaitWhileActive(source) : firstValueFrom(source);

    const res = await wait(this.characters.get(sourceCharacterId));
    if (withAiStory) this.aiProgress.throwIfAborted();
    const source = structuredClone(res.data as Character);
    const copy = structuredClone(source) as Character;
    copy.id = '';
    copy.cloudSynced = false;
    copy.name = `${source.name || 'Héros'} (pré-tiré)`;

    const newId = await wait(this.characters.save(copy));
    if (withAiStory) this.aiProgress.throwIfAborted();

    const speciesLabel = source.species.subspeciesLabel
      ? `${source.species.label} (${source.species.subspeciesLabel})`
      : source.species.label;
    const classLabel = source.classes.map((cl) => cl.classLabel).join(' / ') || '—';

    let publicHook = source.personality?.story?.trim() ?? '';
    let dmBackstory = publicHook;

    if (withAiStory) {
      try {
        this.aiProgress.setStageLabel('Génération IA du récit…');
        const storyRes = await this.aiProgress.awaitWhileActive(
          this.data.generateBackstory({
            name: copy.name,
            sex: source.personality?.sex ?? 'X',
            speciesName: source.species.label,
            subspeciesName: source.species.subspeciesLabel ?? undefined,
            civilizationName: source.civilization.label,
            className: classLabel,
            background: campaign.data.setting?.trim() || source.personality?.background || undefined,
            traits: source.personality?.traits || undefined,
            bonds: source.personality?.bonds || undefined,
            flaws: source.personality?.flaws || undefined,
            alignment: source.personality?.alignment || undefined,
          }),
        );
        dmBackstory = storyRes.story.trim();
        publicHook = dmBackstory.split(/[.!?]/)[0]?.trim() ?? dmBackstory.slice(0, 140);
      } catch (err) {
        if (isAiGenerationAborted(err)) throw err;
        if (!publicHook) {
          publicHook = `${copy.name}, ${speciesLabel} ${classLabel}, prêt pour ${campaign.data.regionName || 'l\'aventure'}.`;
          dmBackstory = publicHook;
        }
      }
    }

    if (!dmBackstory) {
      dmBackstory = `${copy.name} est un héros prêt pour ${campaign.data.regionName || "l'aventure"}.`;
      publicHook = dmBackstory;
    }

    copy.id = newId;
    copy.cloudSynced = true;
    copy.personality = {
      ...copy.personality,
      story: dmBackstory,
      description:
        copy.personality?.description?.trim() ||
        buildPregenPhysicalDescription(copy, speciesLabel, classLabel),
    };
    if (withAiStory) this.aiProgress.throwIfAborted();
    await wait(this.characters.save(copy, { updateExisting: true }));

    return {
      characterId: newId,
      characterName: copy.name,
      speciesLabel,
      classLabel,
      publicHook,
      dmBackstory,
    };
  }

  pickRandomCharacterId(characterIds: string[]): string | null {
    return pickRandom(characterIds);
  }
}
