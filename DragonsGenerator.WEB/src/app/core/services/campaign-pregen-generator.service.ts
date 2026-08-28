import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DataService } from './data.service';
import { CharacterCloudService } from './character-cloud.service';
import type { CampaignDetail } from '@core/models/Campaign/campaign';
import type { Character } from '@core/models/Character/character';
import { pickRandom } from '@core/utils/pregen-random.util';

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

  /** Duplique un héros MJ complet — fiche jouable immédiatement après claim. */
  async generatePlayableDuplicate(
    campaign: CampaignDetail,
    sourceCharacterId: string,
    withAiStory = true,
  ): Promise<GeneratedPregenCharacter> {
    const res = await firstValueFrom(this.characters.get(sourceCharacterId));
    const source = structuredClone(res.data as Character);
    const copy = structuredClone(source) as Character;
    copy.id = '';
    copy.cloudSynced = false;
    copy.name = `${source.name || 'Héros'} (pré-tiré)`;

    const newId = await firstValueFrom(this.characters.save(copy));

    const speciesLabel = source.species.subspeciesLabel
      ? `${source.species.label} (${source.species.subspeciesLabel})`
      : source.species.label;
    const classLabel = source.classes.map((cl) => cl.classLabel).join(' / ') || '—';

    let publicHook = source.personality?.story?.trim() ?? '';
    let dmBackstory = publicHook;

    if (withAiStory) {
      try {
        const storyRes = await firstValueFrom(
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
      } catch {
        if (!publicHook) {
          publicHook = `${copy.name}, ${speciesLabel} ${classLabel}, prêt pour ${campaign.data.regionName || 'l\'aventure'}.`;
          dmBackstory = publicHook;
        }
      }
    }

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
