// features/character-creation/steps/abilities-step/abilities-step.ts

import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import {
  ABILITY_KEYS,
  ABILITY_KEY_TO_LABEL,
  ABILITY_POINT_COSTS,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  type AbilityKey,
} from '@core/models/Character/character';

interface AbilityRow {
  key: AbilityKey;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-abilities-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './abilities-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbilitiesStep {
  readonly builder = inject(CharacterBuilderService);

  // === Icônes d'ambiance pour les caractéristiques ===
  getIconForAbility(key: AbilityKey): string {
    const icons: Record<AbilityKey, string> = {
      force: '💪',
      dexterite: '🤸',
      constitution: '🛡️',
      intelligence: '🧠',
      sagesse: '👁️',
      charisme: '🗣️',
    };

    return icons[key] || '✧';
  }

  readonly abilities: AbilityRow[] = ABILITY_KEYS.map((key) => ({
    key,
    label: ABILITY_KEY_TO_LABEL[key],
    icon: this.getIconForAbility(key),
  }));

  readonly pointCosts = ABILITY_POINT_COSTS;
  readonly minScore = MIN_ABILITY_SCORE;
  readonly maxScore = MAX_ABILITY_SCORE;

  // Pour la boucle de la légende des coûts
  readonly availableScores = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  getBaseScore(key: AbilityKey): number {
    return this.builder.creation().baseAbilities[key];
  }

  getRacialBonus(key: AbilityKey): number {
    return this.builder.creation().racialBonuses[key] ?? 0;
  }

  getFinalScore(key: AbilityKey): number {
    return this.builder.finalAbilities()[key];
  }

  getModifier(key: AbilityKey): number {
    return this.builder.abilityModifiers()[key];
  }

  getFormattedMod(key: AbilityKey): string {
    const mod = this.getModifier(key);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  getCost(score: number): number {
    return this.pointCosts[score] ?? 0;
  }

  canIncrement(key: AbilityKey): boolean {
    const current = this.getBaseScore(key);
    if (current >= this.maxScore) return false;
    const currentCost = this.getCost(current);
    const nextCost = this.getCost(current + 1);
    return this.builder.creation().pointsRemaining >= nextCost - currentCost;
  }

  canDecrement(key: AbilityKey): boolean {
    return this.getBaseScore(key) > this.minScore;
  }

  increment(key: AbilityKey): void {
    this.builder.incrementAbility(key);
  }

  decrement(key: AbilityKey): void {
    this.builder.decrementAbility(key);
  }

  reset(): void {
    this.builder.resetAbilities();
  }

  confirmSelection(): void {
    // Le joueur a réparti tous ses points, on passe à la suite.
    this.builder.nextStep();
  }

  prevStep(): void {
    // Permet de revenir à l'étape précédente
    this.builder.previousStep();
  }
}
