// features/character-creation/steps/class-step/class-step.ts

import {
  Component,
  OnInit,
  afterNextRender,
  inject,
  Injector,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../../core/services/data.service';
import { CharacterBuilderService } from '../../../../core/services/character-builder.service';
import type { CharacterClass } from '../../../../core/models/CharacterClasses/character-class';
import { normalizeCharacterClasses } from '@core/utils/class-data.adapter';
import { subclassUnlockLevel } from '@core/utils/character-class-features.util';
import { getClassIcon } from '@core/utils/class-icons';
import { formatGameIds, labelForGameId } from '@core/utils/game-id-labels';
import { metamagicLabel } from '@core/data/metamagic-labels.data';
import { resolveFeatureUses } from '@core/utils/feature-uses.util';
import { animalTotemEmoji, animalTotemIconify } from '@core/utils/animal-totem-icon.util';
import { extractProgressionChoices, type ProgressionChoiceDef } from '@core/utils/progression-choices.util';
import type { Ability, FeatureInstance, SpellcastingKind } from '../../../../core/models/Character/character';
import { MulticlassPanel } from './multiclass-panel/multiclass-panel';
import { ForgeFlipCard } from '../forge-flip-card/forge-flip-card';
import {
  buildClassProgressionChoicesFromWizard,
  buildClassSelectionFromWizard,
} from './class-step-apply.util';
import { CLASS_SPELLCASTING, resolveClassSpellcasting } from '@core/utils/class-spellcasting.util';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import {
  asFeatureJsonList,
  isConcreteCombatStyleId,
  resolveAvailableCombatStyles,
  resolveCombatStyleRequiredCount,
  resolveCombatStyleUnlockLevel,
  type CombatStyleOption,
} from '@core/utils/class-step-combat.util';
import {
  classStepCarouselTargetId,
  classStepPhaseSubtitle,
  classStepPhaseTitle,
  classStepSelectionComplete,
  resolveClassStepPhase,
  splitClassChoiceAnswers,
  toggleCappedPick,
  wrapCarouselIndex,
  wrapCarouselOffsetPx,
  type ClassStepPhase,
} from '@core/utils/class-step-flow.util';
import {
  type ClassStepCardOption as CardOption,
  type FeatureJson,
  type SubChoice,
  type SubclassOption,
  type SubclassesConfig,
} from './class-step.types';
import {
  carouselIndexFromScroll,
  carouselScrollDeltaToIndex,
  toggleFlipId,
} from '@core/utils/forge-carousel.util';

type Phase = ClassStepPhase;

// ============================================================================
// CONSTANTES
// ============================================================================

// ============================================================================
// COMPOSANT
// ============================================================================

@Component({
  selector: 'app-class-step',
  standalone: true,
  imports: [CommonModule, MulticlassPanel, ConfirmDialog, ForgeFlipCard],
  templateUrl: './class-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: {
    class: 'flex flex-1 flex-col min-h-0 w-full',
  },
})
export class ClassStep implements OnInit {
  private dataService = inject(DataService);
  private readonly injector = inject(Injector);
  readonly builder = inject(CharacterBuilderService);

  readonly showDownstreamResetConfirm = signal(false);
  private pendingClassPickId: string | null = null;
  private pendingClearSelection = false;

  private readonly carouselViewport = viewChild<ElementRef<HTMLElement>>('carouselViewport');
  private scrollRaf = 0;
  private suppressScrollSync = false;

  readonly cardWidthPx = 320;
  readonly cardGapPx = 32;
  readonly cardStridePx = 352;

  // === State de la classe ===
  readonly allClasses = signal<CharacterClass[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly selectedClassId = signal<string | null>(null);
  readonly selectedSubclassId = signal<string | null>(null);
  /** Styles de combat choisis (1, ou 2 pour Champion niv.10+). */
  readonly selectedCombatStyleIds = signal<string[]>([]);
  /** Réponses aux sub_choices (plusieurs options possibles par pool). */
  readonly subChoiceAnswers = signal<Map<string, string[]>>(new Map());
  /** Réponses aux choix de progression (ennemi, terrain, métamagie, pacte, etc.). */
  readonly progChoiceAnswers = signal<Map<string, string[]>>(new Map());

  // === State du Carrousel 3D ===
  readonly currentIndex = signal(0);
  readonly flippedCards = signal<Set<string>>(new Set());
  readonly transitioning = signal(false);
  /** Figé la phase pendant la confirmation pour éviter un flash de cartes. */
  private readonly holdPhase = signal<Phase | null>(null);
  /** Pool de progression en relecture (conquêtes replaceable, correction d’astuces…). */
  readonly focusedProgChoiceId = signal<string | null>(null);

  // === Computed ===
  readonly selectedClass = computed<CharacterClass | null>(() => {
    const id = this.selectedClassId();
    return id ? (this.allClasses().find((c) => c.id === id) ?? null) : null;
  });

  readonly subclassesConfig = computed<SubclassesConfig | null>(() => {
    const cls = this.selectedClass();
    if (!cls?.data.subclasses) return null;
    const raw = cls.data.subclasses;
    const list = Array.isArray(raw) ? raw : (raw.options ?? []);
    return {
      name: '',
      options: list.map((o) => ({
        id: o.id,
        name: o.name ?? o.id,
        desc: o.desc ?? '',
        features: (o.features ?? []).map((f) => ({
          id: f.id,
          name: f.name ?? '',
          desc: f.desc ?? '',
          level: f.level ?? 1,
        })),
        sub_choices: o.sub_choices?.map((sc) => ({
          id: sc.id ?? '',
          type: sc.type ?? '',
          count: sc.count ?? 1,
          level_required: sc.level_required ?? 1,
          label: sc.label ?? '',
          options: (sc.options ?? []).map(String),
          option_labels: sc.option_labels,
          option_descs: sc.option_descs,
        })),
      })),
      level_unlocked: subclassUnlockLevel(raw),
    };
  });

  readonly targetLevel = computed(() => this.builder.targetLevel());

  readonly requiresSubclass = computed(() => {
    const config = this.subclassesConfig();
    return config !== null && config.level_unlocked <= this.targetLevel();
  });

  readonly subclassOptions = computed<SubclassOption[]>(() => {
    if (!this.requiresSubclass()) return [];
    return this.subclassesConfig()?.options ?? [];
  });

  readonly selectedSubclass = computed<SubclassOption | null>(() => {
    const subId = this.selectedSubclassId();
    if (!subId) return null;
    return this.subclassOptions().find((s) => s.id === subId) ?? null;
  });

  readonly activeSubChoices = computed<SubChoice[]>(() => {
    const sub = this.selectedSubclass();
    if (!sub?.sub_choices) return [];
    return sub.sub_choices.filter((sc) => sc.level_required <= this.targetLevel());
  });

  readonly nextUnresolvedSubChoice = computed<SubChoice | null>(() => {
    for (const sc of this.activeSubChoices()) {
      const picked = this.subChoiceAnswers().get(sc.id) ?? [];
      if (picked.length < (sc.count || 1)) return sc;
    }
    return null;
  });

  /** Choix de progression ≤20 (hors deferred expertise/ASI). */
  readonly activeProgChoices = computed<ProgressionChoiceDef[]>(() => {
    const cls = this.selectedClass();
    if (!cls) return [];
    const answers = this.progChoiceAnswers();
    const prelim = extractProgressionChoices(cls, this.targetLevel());
    let pactBoonId: string | null = null;
    for (const c of prelim) {
      if (c.type === 'pact_boon') {
        const picks = answers.get(c.id) ?? [];
        if (picks[0]) pactBoonId = picks[0];
        break;
      }
    }
    return extractProgressionChoices(cls, this.targetLevel(), undefined, { pactBoonId }).filter(
      (c) => !c.deferred,
    );
  });

  readonly nextUnresolvedProgChoice = computed<ProgressionChoiceDef | null>(() => {
    for (const pc of this.activeProgChoices()) {
      const picked = this.progChoiceAnswers().get(pc.id) ?? [];
      if (picked.length < (pc.count || 1)) return pc;
    }
    return null;
  });

  /** Styles de combat tirés des choice_pools de la classe (guerrier / paladin / rôdeur). */
  readonly availableCombatStyles = computed<CombatStyleOption[]>(() =>
    resolveAvailableCombatStyles(this.selectedClass()),
  );

  readonly combatStyleUnlockLevel = computed(() =>
    resolveCombatStyleUnlockLevel(this.selectedClass()),
  );

  readonly requiresCombatStyle = computed(
    () =>
      this.availableCombatStyles().length > 0 &&
      this.combatStyleUnlockLevel() <= this.targetLevel(),
  );

  /** Nombre de styles à choisir (2 si aptitude Champion « style supplémentaire » ≤ niveau). */
  readonly combatStyleRequiredCount = computed(() =>
    resolveCombatStyleRequiredCount({
      requiresCombatStyle: this.requiresCombatStyle(),
      targetLevel: this.targetLevel(),
      subclassFeatures: this.selectedSubclass()?.features,
      classFeaturesDetails: this.selectedClass()?.data?.features_details,
    }),
  );

  readonly combatStylesComplete = computed(
    () => this.selectedCombatStyleIds().length >= this.combatStyleRequiredCount(),
  );

  // --- GESTION DES PHASES ---
  readonly currentPhase = computed<Phase>(() =>
    resolveClassStepPhase({
      holdPhase: this.holdPhase(),
      classId: this.selectedClassId(),
      subclassId: this.selectedSubclassId(),
      requiresSubclass: this.requiresSubclass(),
      requiresCombatStyle: this.requiresCombatStyle(),
      selectedStyleCount: this.selectedCombatStyleIds().length,
      requiredStyleCount: this.combatStyleRequiredCount(),
      hasUnresolvedSubChoice: !!this.nextUnresolvedSubChoice(),
      hasUnresolvedProgChoice: !!this.nextUnresolvedProgChoice(),
      focusedProgChoice: !!this.focusedProgChoiceId() && this.activeProgChoices().length > 0,
    }),
  );

  /** Pool de sous-classe affiché (en cours ou dernier choisi en relecture). */
  private subChoiceForDisplay(): SubChoice | null {
    return this.nextUnresolvedSubChoice() ?? this.activeSubChoices().at(-1) ?? null;
  }

  /** Pool de progression affiché (en cours, focus relecture, ou dernier). */
  readonly displayedProgChoice = computed<ProgressionChoiceDef | null>(() => {
    const unresolved = this.nextUnresolvedProgChoice();
    if (unresolved) return unresolved;
    const focusedId = this.focusedProgChoiceId();
    if (focusedId) {
      const hit = this.activeProgChoices().find((c) => c.id === focusedId);
      if (hit) return hit;
    }
    return this.activeProgChoices().at(-1) ?? null;
  });

  private progChoiceForDisplay(): ProgressionChoiceDef | null {
    return this.displayedProgChoice();
  }

  /** Relecture / correction d’un pool déjà rempli (ex. conquête replaceable). */
  focusProgChoice(choiceId: string): void {
    if (!this.activeProgChoices().some((c) => c.id === choiceId)) return;
    this.focusedProgChoiceId.set(choiceId);
    this.holdPhase.set(null);
    this.flippedCards.set(new Set());
    this.currentIndex.set(0);
  }

  readonly phaseTitle = computed<string>(() => {
    const sub = this.nextUnresolvedSubChoice();
    const prog = this.progChoiceForDisplay();
    return classStepPhaseTitle({
      phase: this.currentPhase(),
      subclassConfigName: this.subclassesConfig()?.name,
      subChoiceLabel: sub?.label,
      subChoicePicked: sub ? (this.subChoiceAnswers().get(sub.id)?.length ?? 0) : 0,
      subChoiceNeed: sub?.count,
      progChoiceLabel: prog?.label,
      progChoicePicked: prog ? (this.progChoiceAnswers().get(prog.id)?.length ?? 0) : 0,
      progChoiceNeed: prog?.count,
    });
  });

  readonly phaseSubtitle = computed<string>(() =>
    classStepPhaseSubtitle({
      phase: this.currentPhase(),
      className: this.selectedClass()?.name,
      combatStyleNeed: this.combatStyleRequiredCount(),
      combatStylePicked: this.selectedCombatStyleIds().length,
    }),
  );

  // --- GESTION DES CARTES ---
  readonly currentCards = computed<CardOption[]>(() => {
    switch (this.currentPhase()) {
      case 'class':
        return this.allClasses().map((c) => ({
          id: c.id,
          title: c.name,
          desc: this.getClassDescription(c),
          stats: `Sauvegardes : ${c.data.proficiencies?.saving_throws?.join(', ') ?? '—'}`,
          badge: `Dés de vie : 1d${c.data.hit_die}`,
          icon: this.getIconForClass(c.id),
        }));

      case 'subclass':
        return this.subclassOptions().map((sub) => ({
          id: sub.id,
          title: sub.name,
          desc: sub.desc ?? '',
          stats: `Niveau d'obtention : ${this.subclassesConfig()?.level_unlocked ?? '—'}`,
          badge: 'Voie',
          icon: 'fluent-emoji:crystal-ball',
        }));

      case 'combat_style': {
        const picked = new Set(this.selectedCombatStyleIds());
        return this.availableCombatStyles().map((style) => ({
          id: style.id,
          title: style.name,
          desc: style.desc,
          badge: picked.has(style.id) ? 'Sélectionné' : 'Style',
          icon: 'fluent-emoji:crossed-swords',
        }));
      }

      case 'sub_choice': {
        const choice = this.subChoiceForDisplay();
        if (!choice) return [];
        const picked = new Set(this.subChoiceAnswers().get(choice.id) ?? []);
        return choice.options.map((opt) => {
          const title = this.getSubChoiceLabel(choice.type, opt, choice.option_labels);
          const isTotem = choice.type === 'animal_totem';
          return {
            id: opt,
            title,
            desc: this.getSubChoiceDescription(
              opt,
              choice.type,
              choice.option_labels?.[opt],
              choice.option_descs?.[opt],
            ),
            badge: picked.has(opt) ? 'Sélectionné' : 'Option',
            icon: isTotem
              ? animalTotemIconify(opt, title)
              : choice.type === 'dragon_ancestry'
                ? 'fluent-emoji:dragon'
                : choice.type === 'fielon_lord'
                  ? 'fluent-emoji:smiling-face-with-horns'
                  : choice.type === 'feature_option'
                    ? 'fluent-emoji:crossed-swords'
                    : 'fluent-emoji:sparkles',
            emoji: isTotem ? animalTotemEmoji(opt, title) : undefined,
          };
        });
      }

      case 'prog_choice': {
        const choice = this.progChoiceForDisplay();
        if (!choice) return [];
        const picked = new Set(this.progChoiceAnswers().get(choice.id) ?? []);
        const takenElsewhere = this.idsTakenInOtherProgChoices(choice.id);
        return choice.options
          .filter((opt) => picked.has(opt.id) || !takenElsewhere.has(opt.id))
          .map((opt) => ({
            id: opt.id,
            title: opt.name,
            desc: opt.desc || this.getSubChoiceDescription(opt.id),
            badge: picked.has(opt.id) ? 'Sélectionné' : 'Option',
            icon: 'fluent-emoji:sparkles',
          }));
      }
    }
  });

  readonly selectionComplete = computed(() =>
    classStepSelectionComplete({
      hasClass: !!this.selectedClass(),
      requiresCombatStyle: this.requiresCombatStyle(),
      combatStylesComplete: this.combatStylesComplete(),
      requiresSubclass: this.requiresSubclass(),
      hasSubclass: !!this.selectedSubclass(),
      unresolvedSubChoice: !!this.nextUnresolvedSubChoice(),
      unresolvedProgChoice: !!this.nextUnresolvedProgChoice(),
    }),
  );

  /** Re-applique les aptitudes si le niveau change alors que la classe est déjà choisie. */
  private lastAppliedLevel: number | null = null;
  private readonly _resyncOnLevel = effect(() => {
    const level = this.targetLevel();
    const ready = this.selectionComplete();
    const hasClass = !!this.builder.creation().classId;
    if (!ready || !hasClass) return;
    if (this.lastAppliedLevel === level) return;
    this.lastAppliedLevel = level;
    this.applySelectionToBuilder();
  });

  ngOnInit(): void {
    this.loadClasses();
  }

  private restoreFromBuilder(): void {
    const current = this.builder.creation();
    if (current.classId) {
      this.selectedClassId.set(current.classId);
      if (current.subclassId) this.selectedSubclassId.set(current.subclassId);
      const styleFeats = (current.classFeatures ?? []).filter((f) =>
        isConcreteCombatStyleId(f.refId ?? ''),
      );
      if (styleFeats.length) {
        this.selectedCombatStyleIds.set(styleFeats.map((f) => f.refId!).filter(Boolean));
      }
    }

    const answers = current.classChoiceAnswers ?? {};
    const { sub, prog } = splitClassChoiceAnswers(
      answers,
      new Set(this.activeSubChoices().map((sc) => sc.id)),
    );
    if (sub.size) this.subChoiceAnswers.set(sub);
    if (prog.size) this.progChoiceAnswers.set(prog);

    this.syncCarouselIndexFromSelection();
  }

  private syncCarouselIndexFromSelection(): void {
    const cards = this.currentCards();
    if (!cards.length) {
      this.currentIndex.set(0);
      return;
    }
    const targetId = this.resolveCarouselTargetId();
    if (!targetId) {
      this.currentIndex.set(0);
      return;
    }
    const idx = cards.findIndex((c) => c.id === targetId);
    this.currentIndex.set(idx >= 0 ? idx : 0);
  }

  private resolveCarouselTargetId(): string | null {
    const subChoice =
      this.nextUnresolvedSubChoice() ??
      this.activeSubChoices()[this.activeSubChoices().length - 1];
    const progChoice =
      this.nextUnresolvedProgChoice() ??
      this.activeProgChoices()[this.activeProgChoices().length - 1];
    const subPicks = subChoice ? this.subChoiceAnswers().get(subChoice.id) : undefined;
    const progPicks = progChoice ? this.progChoiceAnswers().get(progChoice.id) : undefined;
    return classStepCarouselTargetId({
      phase: this.currentPhase(),
      classId: this.selectedClassId(),
      subclassId: this.selectedSubclassId(),
      combatStyleIds: this.selectedCombatStyleIds(),
      subChoiceLastPick: subPicks?.[subPicks.length - 1] ?? null,
      progChoiceLastPick: progPicks?.[progPicks.length - 1] ?? null,
    });
  }

  // === CARROUSEL LOGIC ===
  private useScrollCarousel(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
  }

  onCarouselScroll(): void {
    if (this.suppressScrollSync) return;
    cancelAnimationFrame(this.scrollRaf);
    this.scrollRaf = requestAnimationFrame(() => this.syncIndexFromScroll());
  }

  private syncIndexFromScroll(): void {
    const viewport = this.carouselViewport()?.nativeElement;
    if (!viewport) return;
    const best = carouselIndexFromScroll(viewport);
    if (best !== this.currentIndex()) this.currentIndex.set(best);
  }

  private scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth'): void {
    const total = this.currentCards().length;
    if (total <= 0) return;
    const safe = ((index % total) + total) % total;
    this.currentIndex.set(safe);

    const viewport = this.carouselViewport()?.nativeElement;
    if (!viewport) return;
    const delta = carouselScrollDeltaToIndex(viewport, safe);
    if (delta == null) return;

    this.suppressScrollSync = true;
    viewport.scrollBy({ left: delta, behavior });
    window.setTimeout(
      () => {
        this.suppressScrollSync = false;
        this.syncIndexFromScroll();
      },
      behavior === 'smooth' ? 320 : 40,
    );
  }

  /** Recale index + scroll mobile après changement de phase / choix précédent. */
  private scheduleCarouselRestore(): void {
    this.syncCarouselIndexFromSelection();
    // Évite un currentIndex hors plage (desktop nextCard incrémente sans modulo).
    this.currentIndex.set(this.normalizedIndex());
    if (!this.useScrollCarousel()) return;
    afterNextRender(
      () => this.scrollToIndex(this.normalizedIndex(), 'instant'),
      { injector: this.injector },
    );
  }

  getWrapOffset(index: number): string {
    return wrapCarouselOffsetPx(index, this.currentIndex(), this.currentCards().length, this.cardStridePx);
  }

  normalizedIndex(): number {
    return wrapCarouselIndex(this.currentIndex(), this.currentCards().length);
  }

  nextCard(): void {
    const total = this.currentCards().length;
    if (!total) return;
    if (this.useScrollCarousel()) {
      this.scrollToIndex((this.normalizedIndex() + 1) % total);
      return;
    }
    this.currentIndex.update((i) => i + 1);
  }

  prevCard(): void {
    const total = this.currentCards().length;
    if (!total) return;
    if (this.useScrollCarousel()) {
      this.scrollToIndex((this.normalizedIndex() - 1 + total) % total);
      return;
    }
    this.currentIndex.update((i) => i - 1);
  }

  scrollToCardIndex(index: number): void {
    this.scrollToIndex(index);
  }

  onRightClick(event: Event, cardId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.flippedCards.update((set) => toggleFlipId(set, cardId));
  }

  // === LOGIQUE DE CLIC ===
  pickCard(cardId: string): void {
    const index = this.currentCards().findIndex((c) => c.id === cardId);

    // Si on a cliqué sur une carte sur le côté, on la centre d'abord
    if (index !== this.normalizedIndex()) {
      if (this.useScrollCarousel()) {
        this.scrollToIndex(index);
      } else {
        let diff = index - this.normalizedIndex();
        const total = this.currentCards().length;
        if (diff > total / 2) diff -= total;
        if (diff < -total / 2) diff += total;
        this.currentIndex.update((i) => i + diff);
      }
      return;
    }

    const phaseBeforeClick = this.currentPhase();

    switch (phaseBeforeClick) {
      case 'class':
        if (
          this.selectedClassId() !== cardId &&
          this.hasDownstreamAfterClass()
        ) {
          this.pendingClassPickId = cardId;
          this.pendingClearSelection = false;
          this.showDownstreamResetConfirm.set(true);
          return;
        }
        if (this.selectedClassId() !== cardId) {
          this.selectedSubclassId.set(null);
          this.selectedCombatStyleIds.set([]);
          this.subChoiceAnswers.set(new Map());
          this.progChoiceAnswers.set(new Map());
          this.builder.clearClass();
          this.lastAppliedLevel = null;
        }
        this.holdPhase.set(null);
        this.selectedClassId.set(cardId);
        break;
      case 'subclass':
        if (this.selectedSubclassId() !== cardId) {
          this.subChoiceAnswers.set(new Map());
        }
        this.holdPhase.set(null);
        this.selectedSubclassId.set(cardId);
        break;
      case 'combat_style':
        this.holdPhase.set(null);
        this.selectedCombatStyleIds.update((ids) =>
          toggleCappedPick(ids, cardId, this.combatStyleRequiredCount()),
        );
        break;
      case 'sub_choice': {
        const choice = this.nextUnresolvedSubChoice();
        if (choice) {
          this.holdPhase.set(null);
          this.subChoiceAnswers.update((m) => {
            const newMap = new Map(m);
            newMap.set(choice.id, toggleCappedPick(newMap.get(choice.id) ?? [], cardId, choice.count || 1));
            return newMap;
          });
        }
        break;
      }
      case 'prog_choice': {
        const choice = this.progChoiceForDisplay();
        if (choice) {
          this.holdPhase.set(null);
          this.focusedProgChoiceId.set(choice.id);
          this.progChoiceAnswers.update((m) => {
            const newMap = new Map(m);
            newMap.set(choice.id, toggleCappedPick(newMap.get(choice.id) ?? [], cardId, choice.count || 1));
            return this.trimInvalidProgPicks(newMap);
          });
        }
        break;
      }
    }

    this.flippedCards.set(new Set());

    if (this.selectionComplete()) {
      this.holdPhase.set(phaseBeforeClick);
      // Appliquer sans avancer : laisse le panneau multiclass utilisable ;
      // l’utilisateur clique « Forger cette voie » pour passer à l’étape suivante.
      if (!this.applySelectionToBuilder()) {
        this.holdPhase.set(null);
        return;
      }
      this.lastAppliedLevel = this.targetLevel();
    } else if (phaseBeforeClick !== this.currentPhase()) {
      this.scheduleCarouselRestore();
    }
  }

  clearSelection(): void {
    if (this.hasDownstreamAfterClass()) {
      this.pendingClearSelection = true;
      this.pendingClassPickId = null;
      this.showDownstreamResetConfirm.set(true);
      return;
    }
    this.doClearSelection();
  }

  private hasDownstreamAfterClass(): boolean {
    const c = this.builder.creation();
    return (
      (c.selectedSkills?.length ?? 0) > 0 ||
      (c.selectedEquipment?.length ?? 0) > 0 ||
      !!(c.name && c.name.trim()) ||
      (c.asiChoices?.length ?? 0) > 0
    );
  }

  confirmDownstreamReset(): void {
    this.showDownstreamResetConfirm.set(false);
    if (this.pendingClearSelection) {
      this.pendingClearSelection = false;
      this.doClearSelection();
      return;
    }
    const id = this.pendingClassPickId;
    this.pendingClassPickId = null;
    if (!id) return;
    this.selectedSubclassId.set(null);
    this.selectedCombatStyleIds.set([]);
    this.subChoiceAnswers.set(new Map());
    this.progChoiceAnswers.set(new Map());
    this.builder.clearClass();
    this.lastAppliedLevel = null;
    this.holdPhase.set(null);
    this.selectedClassId.set(id);
  }

  cancelDownstreamReset(): void {
    this.showDownstreamResetConfirm.set(false);
    this.pendingClassPickId = null;
    this.pendingClearSelection = false;
  }

  private doClearSelection(): void {
    this.holdPhase.set(null);
    this.flippedCards.set(new Set());
    this.currentIndex.set(0);
    this.clearClassSelectionLocal();
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  /**
   * Remonte d’un cran dans la pile de choix (prog → sous-choix → sous-classe → style → classe).
   * Sur Atavisme / voie sans sélection, doit bien revenir au carrousel des classes
   * (sinon le bouton « Choix précédent » ne faisait rien pour l’Ensorceleur).
   */
  prevPhase(): void {
    this.holdPhase.set(null);
    this.flippedCards.set(new Set());
    this.focusedProgChoiceId.set(null);
    if (this.currentPhase() === 'class') return;

    // 1) Progression (métamagie, invocations…) : annuler le pool affiché / le dernier rempli.
    const progChoice = this.displayedProgChoice() ?? this.activeProgChoices().at(-1);
    if (progChoice && this.progChoiceAnswers().has(progChoice.id)) {
      this.progChoiceAnswers.update((m) => {
        const next = new Map(m);
        next.delete(progChoice.id);
        return this.trimInvalidProgPicks(next);
      });
      this.scheduleCarouselRestore();
      return;
    }

    // 2) Sous-choix de sous-classe (ancestralité draconique, totem…)
    //    ou phase sub_choice en cours → revenir au carrousel de voie.
    if (this.subChoiceAnswers().size > 0 || this.currentPhase() === 'sub_choice') {
      this.subChoiceAnswers.set(new Map());
      this.progChoiceAnswers.set(new Map());
      this.selectedSubclassId.set(null);
      this.scheduleCarouselRestore();
      return;
    }

    // 3) Sous-classe / voie déjà sélectionnée → la retirer.
    if (this.selectedSubclassId()) {
      this.selectedSubclassId.set(null);
      this.subChoiceAnswers.set(new Map());
      this.progChoiceAnswers.set(new Map());
      this.scheduleCarouselRestore();
      return;
    }

    // 4) Styles de combat (du plus récent au plus ancien).
    const styles = this.selectedCombatStyleIds();
    if (styles.length > 0) {
      this.selectedCombatStyleIds.set(styles.slice(0, -1));
      this.scheduleCarouselRestore();
      return;
    }

    // 5) Dernier cran (ex. Atavisme Ensorceleur / Domaine Prêtre sans choix) → classes.
    this.clearClassSelectionLocal();
    this.scheduleCarouselRestore();
  }

  /** Efface la sélection de classe locale + builder (sans dialogue aval). */
  private clearClassSelectionLocal(): void {
    this.selectedClassId.set(null);
    this.selectedSubclassId.set(null);
    this.selectedCombatStyleIds.set([]);
    this.subChoiceAnswers.set(new Map());
    this.progChoiceAnswers.set(new Map());
    this.focusedProgChoiceId.set(null);
    this.lastAppliedLevel = null;
    this.builder.clearClass();
  }

  readonly canGoPrevPhase = computed(
    () => this.currentPhase() !== 'class' && !!this.selectedClassId(),
  );

  // === CONFIRMATION ===
  confirmSelection(): void {
    if (!this.applySelectionToBuilder()) {
      this.holdPhase.set(null);
      return;
    }
    this.lastAppliedLevel = this.targetLevel();
    setTimeout(() => {
      this.builder.nextStep();
      this.holdPhase.set(null);
    }, 150);
  }

  /** Construit et pousse la sélection de classe vers le builder (sans avancer d'étape). */
  applySelectionToBuilder(): boolean {
    try {
      const cls = this.selectedClass();
      if (!cls || !this.selectionComplete()) return false;
      const input = {
        cls,
        subclass: this.selectedSubclass(),
        targetLevel: this.targetLevel(),
        proficiencyBonus: this.builder.proficiencyBonus(),
        featureDetails: this.featureDetailsOf(cls),
        subChoices: this.activeSubChoices(),
        subChoiceAnswers: this.subChoiceAnswers(),
        combatStyleIds: this.selectedCombatStyleIds(),
        combatStyles: this.availableCombatStyles(),
        combatStyleUnlockLevel: this.combatStyleUnlockLevel(),
        progChoices: this.activeProgChoices(),
        progChoiceAnswers: this.progChoiceAnswers(),
        spellInfo: this.resolveSpellcasting(cls),
        resolveOptionFeature: (id: string) => this.resolveOptionFeature(id),
      };
      this.builder.setClass(buildClassSelectionFromWizard(input), {
        preserveProgress: !!this.builder.creation().classId,
      });
      this.builder.setClassProgressionChoices(buildClassProgressionChoicesFromWizard(input));
      return true;
    } catch (err) {
      console.error('[class-step] applySelectionToBuilder failed', err);
      return false;
    }
  }

  private resolveSpellcasting(
    cls: CharacterClass,
  ): { kind: SpellcastingKind; ability: Ability } | null {
    return (
      resolveClassSpellcasting(cls.id, this.targetLevel(), this.selectedSubclassId()) ??
      (cls.data.spellcasting ? this.inferSpellcasting(cls) : null)
    );
  }

  // === HELPERS ===
  private loadClasses(): void {
    this.loading.set(true);
    this.dataService.getClasses().subscribe({
      next: (classes) => {
        this.allClasses.set(normalizeCharacterClasses(classes));
        this.restoreFromBuilder();
        this.scheduleCarouselRestore();
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les classes.');
        this.loading.set(false);
      },
    });
  }

  getIconForClass(id: string): string {
    return getClassIcon(id);
  }

  getClassDescription(cls: CharacterClass): string {
    const spell =
      CLASS_SPELLCASTING[cls.id] || cls.data.spellcasting
        ? 'Maîtrise les arts arcaniques ou divins. '
        : 'Spécialiste des aptitudes martiales ou physiques. ';
    const weaponList = Array.isArray(cls.data.proficiencies?.weapons)
      ? cls.data.proficiencies.weapons
      : typeof cls.data.proficiencies?.weapons === 'string' && cls.data.proficiencies.weapons
        ? [cls.data.proficiencies.weapons]
        : [];
    const weapons = weaponList.length
      ? `Manie : ${
          weaponList.length > 2
            ? 'Diverses armes martiales et courantes'
            : formatGameIds(weaponList)
        }.`
      : '';
    return `${spell}${weapons}`;
  }

  private inferSpellcasting(
    cls: CharacterClass,
  ): { kind: SpellcastingKind; ability: Ability } | null {
    const abilityRaw = cls.data.spellcasting?.ability;
    const abilityKey = typeof abilityRaw === 'string' ? abilityRaw : '';
    const abilityMap: Record<string, Ability> = {
      cha: 'Charisme',
      wis: 'Sagesse',
      int: 'Intelligence',
    };
    const ability = abilityKey ? abilityMap[abilityKey.toLowerCase()] : undefined;
    const kind = CLASS_SPELLCASTING[cls.id]?.kind;
    if (kind && ability) return { kind, ability };
    return null;
  }

  /** Icône fluent-emoji approximative selon le nom de la bête totem. */
  animalTotemIcon(label: string): string {
    return animalTotemIconify(label);
  }

  getSubChoiceLabel(
    choiceType: string,
    value: string,
    optionLabels?: Record<string, string>,
  ): string {
    if (optionLabels?.[value]) return optionLabels[value];
    if (value.startsWith('meta-')) return metamagicLabel(value);
    const fromFeatures = this.resolveOptionFeature(value);
    if (fromFeatures?.name) {
      return fromFeatures.name.replace(/^Style de combat\s*:\s*/i, '').trim();
    }
    if (/^(ennemi|enemy|terrain|dragon|skill)-/.test(value)) {
      const labeled = labelForGameId(value);
      if (labeled && labeled !== value) return labeled;
    }
    const labeled = labelForGameId(value);
    if (labeled && labeled !== value) return labeled;
    const pretty = value
      .replace(/^feat-/, '')
      .replace(/^style-/, '')
      .replace(/-/g, ' ');
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  }

  getSubChoiceDescription(
    value: string,
    choiceType?: string,
    optionLabel?: string,
    optionDesc?: string,
  ): string {
    if (optionDesc) return optionDesc;
    if (value.startsWith('meta-')) {
      return `Option de métamagie : ${metamagicLabel(value)}.`;
    }
    if (choiceType === 'dragon_ancestry' || /^dragon-/.test(value)) {
      const name = optionLabel ?? this.getSubChoiceLabel('dragon_ancestry', value);
      return `Ancêtre draconique : ${name}. Détermine votre affinité élémentaire et votre résistance.`;
    }
    if (choiceType === 'fielon_lord' || value.startsWith('lord-')) {
      const name = optionLabel ?? this.getSubChoiceLabel('fielon_lord', value);
      return `Seigneur fiélon : ${name}. Détermine votre liste de sorts élargie et votre patron.`;
    }
    if (choiceType === 'arcane_school' || /^(abjuration|divination|enchantement|evocation|illusion|invocation|necromancie|transmutation)$/.test(value)) {
      const name = this.getSubChoiceLabel(choiceType ?? 'arcane_school', value);
      return `École de magie : ${name}. Spécialisation arcanique du magicien.`;
    }
    if (choiceType === 'terrain_type') {
      const name = this.getSubChoiceLabel('terrain_type', value);
      return `Terrain d'initiation : ${name}. Influence les sorts bonus du cercle druidique.`;
    }
    if (choiceType === 'animal_totem' || value.startsWith('beast-')) {
      const name = optionLabel ?? this.getSubChoiceLabel('animal_totem', value);
      return `Animal totem : ${name}. Esprit gardien du Cercle des Esprits.`;
    }
    return (
      this.resolveOptionFeature(value)?.desc ||
      'Une option conférant des capacités uniques à votre personnage.'
    );
  }

  private featureDetailsOf(cls: CharacterClass | null | undefined): FeatureJson[] {
    return asFeatureJsonList(cls?.data.features_details) as FeatureJson[];
  }

  private resolveOptionFeature(id: string): FeatureJson | undefined {
    const fromClass = this.featureDetailsOf(this.selectedClass()).find((f) => f.id === id);
    if (fromClass) return fromClass;
    return this.selectedSubclass()?.features.find((f) => f.id === id);
  }

  /** IDs déjà choisis dans d'autres pools feature_selection (ex. astuces lettré). */
  private idsTakenInOtherProgChoices(exceptChoiceId: string): Set<string> {
    const taken = new Set<string>();
    const featureChoiceIds = new Set(
      this.activeProgChoices()
        .filter((c) => c.type === 'feature_selection')
        .map((c) => c.id),
    );
    if (!featureChoiceIds.has(exceptChoiceId)) return taken;
    for (const [id, picks] of this.progChoiceAnswers()) {
      if (id === exceptChoiceId || !featureChoiceIds.has(id)) continue;
      for (const p of picks) taken.add(p);
    }
    return taken;
  }

  /** Après changement de pacte : retire les invocations / options devenues invalides. */
  private trimInvalidProgPicks(answers: Map<string, string[]>): Map<string, string[]> {
    const cls = this.selectedClass();
    if (!cls) return answers;

    let pactBoonId: string | null = null;
    const prelim = extractProgressionChoices(cls, this.targetLevel());
    for (const c of prelim) {
      if (c.type === 'pact_boon') {
        pactBoonId = answers.get(c.id)?.[0] ?? null;
        break;
      }
    }

    const choices = extractProgressionChoices(cls, this.targetLevel(), undefined, {
      pactBoonId,
    }).filter((c) => !c.deferred);
    let changed = false;
    const newMap = new Map(answers);

    // Dédup global feature_selection (lettré astuces, etc.)
    const seenFeatureIds = new Set<string>();
    for (const c of choices) {
      if (c.type !== 'feature_selection') continue;
      const picks = [...(newMap.get(c.id) ?? [])];
      const kept: string[] = [];
      for (const p of picks) {
        if (seenFeatureIds.has(p)) {
          changed = true;
          continue;
        }
        seenFeatureIds.add(p);
        kept.push(p);
      }
      if (kept.length !== picks.length) newMap.set(c.id, kept);
    }

    for (const c of choices) {
      const picks = newMap.get(c.id) ?? [];
      if (picks.length === 0) continue;
      const valid = new Set(c.options.map((o) => o.id));
      let trimmed = picks.filter((id) => valid.has(id));
      // Dédup inter-pools uniquement pour feature_selection (astuces lettré…)
      if (c.type === 'feature_selection') {
        const takenElsewhere = new Set<string>();
        for (const other of choices) {
          if (other.id === c.id || other.type !== 'feature_selection') continue;
          for (const p of newMap.get(other.id) ?? []) takenElsewhere.add(p);
        }
        trimmed = trimmed.filter((id) => !takenElsewhere.has(id));
      }
      if (trimmed.length !== picks.length) {
        newMap.set(c.id, trimmed);
        changed = true;
      }
    }
    return changed ? newMap : answers;
  }

  /**
   * @deprecated Utiliser resolveFeatureUses (feature-uses.util) — conservé pour compat.
   */
  private buildFeatureUses(
    feat: FeatureJson,
    cls: CharacterClass,
    level: number,
  ): FeatureInstance['uses'] | undefined {
    return resolveFeatureUses(feat, cls, level, this.builder.proficiencyBonus());
  }
}
