import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ABILITY_KEY_TO_LABEL,
  ABILITY_KEYS,
  formatModifier,
  type AbilityKey,
  type Character,
  type SpellInstance,
} from '@core/models/Character/character';
import { visibleClassResources } from '@core/utils/class-resource-labels';
import {
  spellcastingDisplayLines,
  spellcastingFocusLabel,
} from '@core/utils/character-spellcasting-display.util';
import { labelForGameId } from '@core/utils/game-id-labels';

@Component({
  selector: 'app-character-play-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-play-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterPlayView {
  readonly character = input.required<Character>();

  readonly abilityKeys = ABILITY_KEYS;
  readonly abilityLabel = ABILITY_KEY_TO_LABEL;

  readonly classLine = computed(() => {
    const c = this.character();
    return (c.classes ?? [])
      .map((cls) =>
        cls.subclassLabel
          ? `${cls.classLabel} ${cls.subclassLabel} ${cls.level}`
          : `${cls.classLabel} ${cls.level}`,
      )
      .join(' / ');
  });

  readonly resourceChips = computed(() => visibleClassResources(this.character().classResources));

  readonly saveSet = computed(() => new Set(this.character().proficiencies?.savingThrows ?? []));

  readonly skillList = computed(() => {
    const p = this.character().proficiencies;
    const expertise = new Set(p?.expertiseSkills ?? []);
    return (p?.skills ?? []).map((id) => ({
      id,
      label: labelForGameId(id),
      expertise: expertise.has(id),
    }));
  });

  readonly toolLabels = computed(() =>
    (this.character().proficiencies?.tools ?? []).map((id) => labelForGameId(id)),
  );

  readonly languageLabels = computed(() =>
    (this.character().proficiencies?.languages ?? []).map((id) => labelForGameId(id)),
  );

  readonly spellsByLevel = computed(() => {
    const groups = new Map<number, SpellInstance[]>();
    for (const spell of this.character().knownSpells ?? []) {
      const list = groups.get(spell.level) ?? [];
      list.push(spell);
      groups.set(spell.level, list);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([level, spells]) => ({ level, spells }));
  });

  readonly spellcastingLines = computed(() =>
    spellcastingDisplayLines(this.character().spellcasting),
  );

  readonly focusLabel = computed(() =>
    spellcastingFocusLabel(this.character().spellcasting?.focus ?? null),
  );

  score(key: AbilityKey): number {
    return this.character().abilities?.[key] ?? 10;
  }

  mod(key: AbilityKey): string {
    return formatModifier(this.character().abilityModifiers?.[key] ?? 0);
  }

  isSave(key: AbilityKey): boolean {
    return this.saveSet().has(this.abilityLabel[key]);
  }
}
