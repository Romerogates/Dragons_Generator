import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { DataService } from '@core/services/data.service';
import {
  ABILITY_KEYS,
  ABILITY_KEY_TO_LABEL,
  ABILITY_POINT_COSTS,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  type AbilityKey,
  type AsiChoiceSlot,
} from '@core/models/Character/character';
import { asiLevelsForClass, countAsiSlots } from '@core/utils/progression-choices.util';

interface AbilityRow {
  key: AbilityKey;
  label: string;
  icon: string;
}

type AsiMode = 'plus2' | 'plus1plus1' | 'feat';

interface AsiSlotUi {
  level: number;
  mode: AsiMode;
  primary: AbilityKey | null;
  secondary: AbilityKey | null;
  featId: string | null;
}

@Component({
  selector: 'app-abilities-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './abilities-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AbilitiesStep implements OnInit {
  readonly builder = inject(CharacterBuilderService);
  private readonly dataService = inject(DataService);

  readonly activeSlotIndex = signal(0);
  readonly asiSlots = signal<AsiSlotUi[]>([]);
  readonly feats = signal<{ id: string; name: string; description: string }[]>([]);
  readonly classJson = signal<any>(null);

  getIconForAbility(key: AbilityKey): string {
    const icons: Record<AbilityKey, string> = {
      force: 'fluent-emoji:flexed-biceps',
      dexterite: 'fluent-emoji:person-cartwheeling',
      constitution: 'fluent-emoji:shield',
      intelligence: 'fluent-emoji:brain',
      sagesse: 'fluent-emoji:eye',
      charisme: 'fluent-emoji:speaking-head',
    };
    return icons[key] || 'fluent-emoji:sparkles';
  }

  readonly abilities: AbilityRow[] = ABILITY_KEYS.map((key) => ({
    key,
    label: ABILITY_KEY_TO_LABEL[key],
    icon: this.getIconForAbility(key),
  }));

  readonly pointCosts = ABILITY_POINT_COSTS;
  readonly minScore = MIN_ABILITY_SCORE;
  readonly maxScore = MAX_ABILITY_SCORE;
  readonly availableScores = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  readonly asiSlotCount = computed(() => {
    const cls = this.classJson();
    if (!cls) return this.builder.targetLevel() >= 4 ? 1 : 0;
    return countAsiSlots(cls, this.builder.targetLevel());
  });

  readonly asiLevels = computed(() => {
    const cls = this.classJson();
    if (!cls) return this.builder.targetLevel() >= 4 ? [4] : [];
    return asiLevelsForClass(cls, this.builder.targetLevel());
  });

  readonly needsAsi = computed(() => this.asiSlotCount() > 0);

  readonly activeSlot = computed(() => this.asiSlots()[this.activeSlotIndex()] ?? null);

  readonly asiComplete = computed(() => {
    if (!this.needsAsi()) return true;
    const slots = this.asiSlots();
    if (slots.length < this.asiSlotCount()) return false;
    return slots.every((s) => {
      if (s.mode === 'feat') return !!s.featId;
      if (s.mode === 'plus2') return !!s.primary;
      return !!s.primary && !!s.secondary && s.primary !== s.secondary;
    });
  });

  readonly canConfirm = computed(
    () => this.builder.creation().pointsRemaining === 0 && this.asiComplete(),
  );

  constructor() {
    effect(() => {
      const levels = this.asiLevels();
      const current = this.asiSlots();
      if (levels.length === 0) {
        if (current.length) this.asiSlots.set([]);
        return;
      }
      if (
        current.length === levels.length &&
        current.every((s, i) => s.level === levels[i])
      ) {
        return;
      }
      const next = levels.map((level, i) => {
        const prev = current.find((s) => s.level === level) ?? current[i];
        return (
          prev ?? {
            level,
            mode: 'plus2' as AsiMode,
            primary: null,
            secondary: null,
            featId: null,
          }
        );
      });
      this.asiSlots.set(next);
      if (this.activeSlotIndex() >= next.length) this.activeSlotIndex.set(0);
    });
  }

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const classId = this.builder.creation().classId;
    if (classId) {
      this.dataService.getClassById(classId).subscribe({
        next: (cls) => this.classJson.set(cls),
      });
    }
    this.dataService.getFeats().subscribe({
      next: (list: any[]) => {
        this.feats.set(
          (list ?? []).map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description ?? f.data?.description ?? '',
          })),
        );
      },
    });

    const c = this.builder.creation();
    if (c.asiChoices?.length) {
      this.asiSlots.set(
        c.asiChoices.map((s) => ({
          level: s.level,
          mode: s.mode,
          primary: s.primary ?? null,
          secondary: s.secondary ?? null,
          featId: s.featId ?? null,
        })),
      );
    } else if (c.selectedFeatId || Object.keys(c.asiBonuses ?? {}).length) {
      // Migration ancien format mono-ASI
      const slot: AsiSlotUi = {
        level: 4,
        mode: 'plus2',
        primary: null,
        secondary: null,
        featId: null,
      };
      if (c.selectedFeatId) {
        slot.mode = 'feat';
        slot.featId = c.selectedFeatId;
      } else {
        const entries = ABILITY_KEYS.filter((k) => (c.asiBonuses?.[k] ?? 0) > 0);
        if (entries.length === 1 && (c.asiBonuses?.[entries[0]] ?? 0) === 2) {
          slot.mode = 'plus2';
          slot.primary = entries[0];
        } else if (entries.length >= 2) {
          slot.mode = 'plus1plus1';
          slot.primary = entries[0];
          slot.secondary = entries[1];
        }
      }
      this.asiSlots.set([slot]);
    }
  }

  getBaseScore(key: AbilityKey): number {
    return this.builder.creation().baseAbilities[key];
  }

  getRacialBonus(key: AbilityKey): number {
    return this.builder.creation().racialBonuses[key] ?? 0;
  }

  getAsiBonus(key: AbilityKey): number {
    return this.builder.creation().asiBonuses?.[key] ?? 0;
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
    this.builder.setAsiChoices([]);
    this.asiSlots.update((slots) =>
      slots.map((s) => ({
        ...s,
        mode: 'plus2' as AsiMode,
        primary: null,
        secondary: null,
        featId: null,
      })),
    );
  }

  selectAsiSlot(index: number): void {
    this.activeSlotIndex.set(index);
  }

  setAsiMode(mode: AsiMode): void {
    this.patchActiveSlot({ mode, primary: null, secondary: null, featId: null });
  }

  selectAsiPrimary(key: AbilityKey): void {
    const slot = this.activeSlot();
    if (!slot) return;
    if (slot.mode === 'plus1plus1' && slot.secondary === key) {
      this.patchActiveSlot({ primary: key, secondary: null });
    } else {
      this.patchActiveSlot({ primary: key });
    }
  }

  selectAsiSecondary(key: AbilityKey): void {
    const slot = this.activeSlot();
    if (!slot || key === slot.primary) return;
    this.patchActiveSlot({ secondary: key });
  }

  selectFeat(id: string): void {
    this.patchActiveSlot({ featId: id });
  }

  private patchActiveSlot(patch: Partial<AsiSlotUi>): void {
    const idx = this.activeSlotIndex();
    this.asiSlots.update((slots) => {
      const copy = [...slots];
      if (!copy[idx]) return slots;
      copy[idx] = { ...copy[idx], ...patch };
      return copy;
    });
    this.applyAsiPreview();
  }

  private applyAsiPreview(): void {
    const slots: AsiChoiceSlot[] = this.asiSlots().map((s) => ({
      level: s.level,
      mode: s.mode,
      primary: s.primary,
      secondary: s.secondary,
      featId: s.featId,
    }));
    this.builder.setAsiChoices(slots);
  }

  confirmSelection(): void {
    if (!this.canConfirm()) return;
    this.applyAsiPreview();
    this.builder.nextStep();
  }

  prevStep(): void {
    this.builder.previousStep();
  }
}
