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
import {
  asiLevelsForClass,
  countAsiSlots,
  multiclassPrerequisiteLabel,
  multiclassPrerequisitesMet,
} from '@core/utils/progression-choices.util';
import {
  featAsiAbilityOptions,
  featAsiNeedsAbilityChoice,
  featNeedsResistanceChoice,
  featResistanceOptions,
  featIsFlexiblePoints,
  featFlexiblePointsTotal,
  talentSpendsTotalCost,
  isTalentSpendComplete,
  TALENT_SPEND_COST,
  TALENT_SPEND_LABEL,
  type RawFeatData,
  type TalentSpend,
  type TalentSpendType,
} from '@core/utils/feat-benefits.util';
import { resistanceLabel } from '@core/utils/equipment-display.util';
import { apiCodeToAbilityKey } from '@core/utils/ability-mapping';
import type { Spell } from '@core/models/Spells/spell';

interface AbilityRow {
  key: AbilityKey;
  label: string;
  icon: string;
}

type AsiMode = 'plus2' | 'plus1plus1' | 'feat';

interface AsiSlotUi {
  level: number;
  /** Classe d'origine du palier (multiclassage) ; absent = classe primaire. */
  classId?: string | null;
  className?: string | null;
  mode: AsiMode;
  primary: AbilityKey | null;
  secondary: AbilityKey | null;
  featId: string | null;
  featAbilityChoice: AbilityKey | null;
  featResistanceChoice: string | null;
  featTalentSpends: TalentSpend[];
}

/** Ordre d'affichage des types de dépenses du don "Talent" (4 points flexibles). */
const TALENT_SPEND_TYPES: TalentSpendType[] = [
  'skill',
  'tool',
  'weapon',
  'languages_common',
  'saving_throw',
  'language_exotic',
  'ability_score',
  'armor',
  'expertise',
  'attack_bonus',
  'cantrips',
];

const ARMOR_TIER_LABEL: Record<'ar-light' | 'ar-medium' | 'ar-heavy', string> = {
  'ar-light': 'Armures légères',
  'ar-medium': 'Armures intermédiaires',
  'ar-heavy': 'Armures lourdes',
};

const ATTACK_CATEGORY_LABEL: Record<'wp-cat-simple' | 'wp-cat-martial', string> = {
  'wp-cat-simple': 'Armes courantes',
  'wp-cat-martial': 'Armes de guerre',
};

interface FeatUi {
  id: string;
  name: string;
  description: string;
  raw: RawFeatData;
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
  readonly feats = signal<FeatUi[]>([]);
  readonly classJson = signal<any>(null);
  /** JSON des classes de multiclassage, indexé par classId (pour leurs propres paliers ASI/prérequis). */
  readonly secondaryClassJsonById = signal<Map<string, any>>(new Map());

  /** Catalogues chargés pour les sous-choix du don "Talent" (4 points flexibles). */
  readonly talentSkillCatalog = signal<{ id: string; name: string }[]>([]);
  readonly talentToolCatalog = signal<{ id: string; name: string }[]>([]);
  readonly talentWeaponCatalog = signal<{ id: string; name: string }[]>([]);
  readonly talentCantripCatalog = signal<{ id: string; name: string }[]>([]);
  private readonly spellsById = signal<Map<string, Spell>>(new Map());

  private readonly featsById = computed(() => new Map(this.feats().map((f) => [f.id, f.raw])));

  readonly classSpellcastingAbility = computed<AbilityKey | null>(() => {
    const cls = this.classJson();
    const code = cls?.data?.spellcasting?.ability;
    return typeof code === 'string' ? apiCodeToAbilityKey(code) : null;
  });

  getFeat(id: string | null): FeatUi | null {
    if (!id) return null;
    return this.feats().find((f) => f.id === id) ?? null;
  }

  activeSlotNeedsAbilityChoice(): boolean {
    const feat = this.getFeat(this.activeSlot()?.featId ?? null);
    return featAsiNeedsAbilityChoice(feat?.raw);
  }

  activeSlotAbilityOptions(): AbilityKey[] {
    const feat = this.getFeat(this.activeSlot()?.featId ?? null);
    return featAsiAbilityOptions(feat?.raw);
  }

  selectFeatAbilityChoice(key: AbilityKey): void {
    this.patchActiveSlot({ featAbilityChoice: key });
  }

  activeSlotNeedsResistanceChoice(): boolean {
    const feat = this.getFeat(this.activeSlot()?.featId ?? null);
    return featNeedsResistanceChoice(feat?.raw);
  }

  activeSlotResistanceOptions(): { id: string; label: string }[] {
    const feat = this.getFeat(this.activeSlot()?.featId ?? null);
    return featResistanceOptions(feat?.raw);
  }

  resistanceOptionLabel(id: string): string {
    return resistanceLabel(id);
  }

  selectFeatResistanceChoice(id: string): void {
    this.patchActiveSlot({ featResistanceChoice: id });
  }

  // --- Don "Talent" (système à 4 points flexibles) ---------------------------------------------

  readonly talentSpendTypes = TALENT_SPEND_TYPES;
  readonly talentSpendCost = TALENT_SPEND_COST;
  readonly talentSpendLabel = TALENT_SPEND_LABEL;
  readonly armorTierLabel = ARMOR_TIER_LABEL;
  readonly attackCategoryLabel = ATTACK_CATEGORY_LABEL;
  readonly armorTiers: Array<'ar-light' | 'ar-medium' | 'ar-heavy'> = ['ar-light', 'ar-medium', 'ar-heavy'];
  readonly attackCategories: Array<'wp-cat-simple' | 'wp-cat-martial'> = ['wp-cat-simple', 'wp-cat-martial'];

  setTalentArmorTier(spendId: string, tier: 'ar-light' | 'ar-medium' | 'ar-heavy'): void {
    this.updateTalentSpend(spendId, { armorTier: tier });
  }

  setTalentAttackCategory(spendId: string, cat: 'wp-cat-simple' | 'wp-cat-martial'): void {
    this.updateTalentSpend(spendId, { attackCategory: cat });
  }

  activeSlotIsTalent(): boolean {
    const feat = this.getFeat(this.activeSlot()?.featId ?? null);
    return featIsFlexiblePoints(feat?.raw);
  }

  talentPointsTotal(): number {
    const feat = this.getFeat(this.activeSlot()?.featId ?? null);
    return featFlexiblePointsTotal(feat?.raw);
  }

  talentSpends(): TalentSpend[] {
    return this.activeSlot()?.featTalentSpends ?? [];
  }

  talentPointsSpent(): number {
    return talentSpendsTotalCost(this.talentSpends());
  }

  talentPointsRemaining(): number {
    return this.talentPointsTotal() - this.talentPointsSpent();
  }

  canAddTalentSpend(type: TalentSpendType): boolean {
    return this.talentPointsRemaining() >= (TALENT_SPEND_COST[type] ?? 0);
  }

  isTalentSpendOk(spend: TalentSpend): boolean {
    return isTalentSpendComplete(spend);
  }

  talentAllSpent(): boolean {
    return this.talentPointsRemaining() === 0;
  }

  talentAllComplete(): boolean {
    return this.talentAllSpent() && this.talentSpends().every((s) => isTalentSpendComplete(s));
  }

  addTalentSpend(type: TalentSpendType): void {
    if (!this.canAddTalentSpend(type)) return;
    const spend: TalentSpend = { id: `talent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type };
    this.patchActiveSlot({ featTalentSpends: [...this.talentSpends(), spend] });
  }

  removeTalentSpend(id: string): void {
    this.patchActiveSlot({ featTalentSpends: this.talentSpends().filter((s) => s.id !== id) });
  }

  updateTalentSpend(id: string, patch: Partial<TalentSpend>): void {
    this.patchActiveSlot({
      featTalentSpends: this.talentSpends().map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }

  toggleTalentCantrip(id: string, spellId: string): void {
    const spend = this.talentSpends().find((s) => s.id === id);
    if (!spend) return;
    const current = spend.cantripIds ?? [];
    if (current.includes(spellId)) {
      this.updateTalentSpend(id, { cantripIds: current.filter((c) => c !== spellId) });
    } else if (current.length < 2) {
      this.updateTalentSpend(id, { cantripIds: [...current, spellId] });
    }
  }

  abilityLabel(key: AbilityKey): string {
    return ABILITY_KEY_TO_LABEL[key];
  }

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

  readonly primaryAsiLevels = computed(() => {
    const cls = this.classJson();
    if (!cls) return this.builder.targetLevel() >= 4 ? [4] : [];
    return asiLevelsForClass(cls, this.builder.targetLevel());
  });

  /**
   * Paliers ASI COMBINÉS : ceux de la classe primaire (sur `targetLevel`, comportement inchangé)
   * PLUS ceux de chaque classe de multiclassage — calculés sur LEUR PROPRE niveau, pas le niveau
   * total du personnage (RAW : Guerrier 5/Magicien 3 ne donne pas les paliers ASI du Magicien
   * niveau 3 s'il n'atteint pas encore ses propres seuils).
   */
  readonly combinedAsiLevels = computed<
    { level: number; classId: string | null; className: string | null }[]
  >(() => {
    const primaryId = this.builder.creation().classId;
    const primary = this.primaryAsiLevels().map((level) => ({
      level,
      classId: primaryId,
      className: null,
    }));
    const secondary = this.builder.secondaryClasses().flatMap((sc) => {
      const cls = this.secondaryClassJsonById().get(sc.classId);
      if (!cls) return [];
      return asiLevelsForClass(cls, sc.level).map((level) => ({
        level,
        classId: sc.classId,
        className: sc.className,
      }));
    });
    return [...primary, ...secondary];
  });

  readonly asiSlotCount = computed(() => this.combinedAsiLevels().length);

  /** @deprecated conservé pour compat template existant — utiliser `combinedAsiLevels`. */
  readonly asiLevels = computed(() => this.combinedAsiLevels().map((l) => l.level));

  readonly needsAsi = computed(() => this.asiSlotCount() > 0);

  /** Classes de multiclassage dont les prérequis de caractéristiques (RAW) ne sont pas respectés
   * par les scores finaux actuels — bloque la confirmation de l'étape. */
  readonly multiclassBlockers = computed<{ className: string; label: string | null }[]>(() => {
    const abilities = this.builder.finalAbilities();
    const blockers: { className: string; label: string | null }[] = [];
    const secondaries = this.builder.secondaryClasses();
    if (secondaries.length) {
      const primary = this.classJson();
      if (primary && !multiclassPrerequisitesMet(primary, abilities)) {
        blockers.push({
          className: this.builder.creation().className ?? primary.name,
          label: multiclassPrerequisiteLabel(primary),
        });
      }
    }
    for (const sc of secondaries) {
      const cls = this.secondaryClassJsonById().get(sc.classId);
      if (!cls) continue;
      if (!multiclassPrerequisitesMet(cls, abilities)) {
        blockers.push({ className: sc.className, label: multiclassPrerequisiteLabel(cls) });
      }
    }
    return blockers;
  });

  readonly activeSlot = computed(() => this.asiSlots()[this.activeSlotIndex()] ?? null);

  readonly asiComplete = computed(() => {
    if (!this.needsAsi()) return true;
    const slots = this.asiSlots();
    if (slots.length < this.asiSlotCount()) return false;
    return slots.every((s) => {
      if (s.mode === 'feat') {
        if (!s.featId) return false;
        const feat = this.getFeat(s.featId);
        if (featIsFlexiblePoints(feat?.raw)) {
          const total = featFlexiblePointsTotal(feat?.raw);
          const spends = s.featTalentSpends ?? [];
          if (talentSpendsTotalCost(spends) !== total) return false;
          return spends.every((sp) => isTalentSpendComplete(sp));
        }
        if (featAsiNeedsAbilityChoice(feat?.raw) && !s.featAbilityChoice) return false;
        if (featNeedsResistanceChoice(feat?.raw) && !s.featResistanceChoice) return false;
        return true;
      }
      if (s.mode === 'plus2') return !!s.primary;
      return !!s.primary && !!s.secondary && s.primary !== s.secondary;
    });
  });

  readonly canConfirm = computed(
    () =>
      this.builder.creation().pointsRemaining === 0 &&
      this.asiComplete() &&
      this.multiclassBlockers().length === 0,
  );

  constructor() {
    effect(() => {
      const levels = this.combinedAsiLevels();
      const current = this.asiSlots();
      const sameKey = (a: { level: number; classId?: string | null }, b: { level: number; classId?: string | null }) =>
        a.level === b.level && (a.classId ?? null) === (b.classId ?? null);
      if (levels.length === 0) {
        if (current.length) this.asiSlots.set([]);
        return;
      }
      if (current.length === levels.length && current.every((s, i) => sameKey(s, levels[i]))) {
        return;
      }
      const next = levels.map((entry, i) => {
        const prev = current.find((s) => sameKey(s, entry)) ?? current[i];
        return (
          prev ?? {
            level: entry.level,
            classId: entry.classId,
            className: entry.className,
            mode: 'plus2' as AsiMode,
            primary: null,
            secondary: null,
            featId: null,
            featAbilityChoice: null,
            featResistanceChoice: null,
            featTalentSpends: [],
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
    for (const sc of this.builder.secondaryClasses()) {
      this.dataService.getClassById(sc.classId).subscribe({
        next: (cls) => {
          const map = new Map(this.secondaryClassJsonById());
          map.set(sc.classId, cls);
          this.secondaryClassJsonById.set(map);
        },
      });
    }
    this.dataService.getFeats().subscribe({
      next: (list: any[]) => {
        this.feats.set(
          (list ?? []).map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description ?? f.data?.description ?? '',
            raw: (f.data ?? {}) as RawFeatData,
          })),
        );
      },
    });

    // Catalogues pour les sous-choix du don "Talent" (4 points flexibles).
    this.dataService.getSkills().subscribe({
      next: (list) => this.talentSkillCatalog.set((list ?? []).map((s) => ({ id: s.id, name: s.name }))),
    });
    this.dataService.getEquipments().subscribe({
      next: (items: any[]) => {
        this.talentToolCatalog.set(
          (items ?? [])
            .filter((e) => String(e.type ?? '').toUpperCase() === 'TOOL')
            .map((e) => ({ id: e.id, name: e.name })),
        );
        this.talentWeaponCatalog.set(
          (items ?? [])
            .filter((e) => String(e.type ?? '').toUpperCase() === 'WEAPON')
            .map((e) => ({ id: e.id, name: e.name })),
        );
      },
    });
    this.dataService.getSpells().subscribe({
      next: (list) => {
        const map = new Map<string, Spell>();
        (list ?? []).forEach((s) => map.set(s.id, s));
        this.spellsById.set(map);
        this.talentCantripCatalog.set(
          (list ?? []).filter((s) => s.level === 0).map((s) => ({ id: s.id, name: s.name })),
        );
      },
    });

    const c = this.builder.creation();
    if (c.asiChoices?.length) {
      this.asiSlots.set(
        c.asiChoices.map((s) => ({
          level: s.level,
          classId: s.classId ?? null,
          mode: s.mode,
          primary: s.primary ?? null,
          secondary: s.secondary ?? null,
          featId: s.featId ?? null,
          featAbilityChoice: s.featAbilityChoice ?? null,
          featResistanceChoice: s.featResistanceChoice ?? null,
          featTalentSpends: s.featTalentSpends ?? [],
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
        featAbilityChoice: null,
        featResistanceChoice: null,
        featTalentSpends: [],
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
        featAbilityChoice: null,
        featResistanceChoice: null,
        featTalentSpends: [],
      })),
    );
  }

  selectAsiSlot(index: number): void {
    this.activeSlotIndex.set(index);
  }

  setAsiMode(mode: AsiMode): void {
    this.patchActiveSlot({
      mode,
      primary: null,
      secondary: null,
      featId: null,
      featAbilityChoice: null,
      featResistanceChoice: null,
      featTalentSpends: [],
    });
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
    this.patchActiveSlot({
      featId: id,
      featAbilityChoice: null,
      featResistanceChoice: null,
      featTalentSpends: [],
    });
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
      classId: s.classId ?? null,
      mode: s.mode,
      primary: s.primary,
      secondary: s.secondary,
      featId: s.featId,
      featAbilityChoice: s.featAbilityChoice,
      featResistanceChoice: s.featResistanceChoice,
      featTalentSpends: s.featTalentSpends,
    }));
    const featDetailsById: Record<string, { name: string; desc: string }> = {};
    for (const f of this.feats()) featDetailsById[f.id] = { name: f.name, desc: f.description };
    this.builder.setAsiChoices(slots, {
      feats: this.featsById(),
      spellcastingAbility: this.classSpellcastingAbility(),
      featDetailsById,
      spells: this.spellsById(),
    });
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
