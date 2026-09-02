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
import {
  CharacterBuilderService,
  ClassSelection,
} from '../../../../core/services/character-builder.service';
import type { CharacterClass } from '../../../../core/models/CharacterClasses/character-class';
import { normalizeCharacterClasses } from '@core/utils/class-data.adapter';
import { getClassIcon } from '@core/utils/class-icons';
import { formatGameIds, labelForGameId } from '@core/utils/game-id-labels';
import { metamagicLabel } from '@core/data/metamagic-labels.data';
import {
  resolveFeatureUses,
  extractScalarResources,
  extractSpellSlotsFromResources,
  extractPactSlotsFromResources,
} from '@core/utils/feature-uses.util';
import { annotateAuraDesc } from '@core/utils/aura-range.util';
import {
  extractProgressionChoices,
  classBonusLanguageCount,
  type ProgressionChoiceDef,
} from '@core/utils/progression-choices.util';
import type {
  Ability,
  FeatureInstance,
  SpellcastingKind,
} from '../../../../core/models/Character/character';

// ============================================================================
// TYPES
// ============================================================================

interface CardOption {
  id: string;
  title: string;
  subtitle?: string;
  desc: string;
  stats?: string;
  badge?: string;
  icon: string;
}
interface FeatureJson {
  id: string;
  name: string;
  level: number;
  desc: string;
  rechargeType?: 'unlimited' | 'short_rest' | 'long_rest' | 'special';
  recharge?: string;
  uses?:
    | number
    | {
        formula?: string;
        base?: number;
        source_column?: string;
        null_means_unlimited?: boolean;
        upgrades?: { at_level: number; value: number }[];
      };
  mechanics?: {
    points_formula?: string;
    uses_key?: string;
    upgrades?: { at_level: number; uses?: number; value?: number }[];
  };
  resolves_to_choice_pool?: string;
}

type Phase = 'class' | 'subclass' | 'combat_style' | 'sub_choice' | 'prog_choice';

interface SubclassesConfig {
  name: string;
  level_unlocked: number;
  options: SubclassOption[];
}

interface SubclassOption {
  id: string;
  name: string;
  desc: string;
  features: FeatureJson[];
  sub_choices?: SubChoice[];
  [key: string]: unknown;
}

interface SubChoice {
  id: string;
  type: string;
  count: number;
  level_required: number;
  label: string;
  options: string[];
}

interface CombatStyleOption {
  id: string;
  name: string;
  desc: string;
}

/** Niveau d'obtention du style de combat par classe (fallback si absent des features). */
const COMBAT_STYLE_UNLOCK_LEVEL: Record<string, number> = {
  'cls-guerrier': 1,
  'cls-paladin': 2,
  'cls-rodeur': 2,
};

/** Fallback noms/descriptions si features_details absents. */
const COMBAT_STYLE_FALLBACK: Record<string, CombatStyleOption> = {
  'style-archerie': {
    id: 'style-archerie',
    name: 'Archerie',
    desc: "Bonus de +2 aux jets d'attaque avec des armes à distance.",
  },
  'feat-style-archerie': {
    id: 'feat-style-archerie',
    name: 'Archerie',
    desc: "Bonus de +2 aux jets d'attaque avec des armes à distance.",
  },
  'style-armes-deux-mains': {
    id: 'style-armes-deux-mains',
    name: 'Armes à deux mains',
    desc: "Relancez les 1 et 2 sur les dés de dégâts d'une arme à deux mains ou polyvalente.",
  },
  'style-armes-a-deux-mains': {
    id: 'style-armes-a-deux-mains',
    name: 'Armes à deux mains',
    desc: "Relancez les 1 et 2 sur les dés de dégâts d'une arme à deux mains ou polyvalente.",
  },
  'feat-style-armes-deux-mains': {
    id: 'feat-style-armes-deux-mains',
    name: 'Armes à deux mains',
    desc: "Relancez les 1 et 2 sur les dés de dégâts d'une arme à deux mains ou polyvalente.",
  },
  'style-combat-deux-armes': {
    id: 'style-combat-deux-armes',
    name: 'Combat à deux armes',
    desc: 'Ajoutez votre modificateur de caractéristique aux dégâts de la seconde attaque.',
  },
  'feat-style-combat-deux-armes': {
    id: 'feat-style-combat-deux-armes',
    name: 'Combat à deux armes',
    desc: 'Ajoutez votre modificateur de caractéristique aux dégâts de la seconde attaque.',
  },
  'style-defense': {
    id: 'style-defense',
    name: 'Défense',
    desc: 'Bonus de +1 à la CA tant que vous portez une armure.',
  },
  'feat-style-defense': {
    id: 'feat-style-defense',
    name: 'Défense',
    desc: 'Bonus de +1 à la CA tant que vous portez une armure.',
  },
  'style-duel': {
    id: 'style-duel',
    name: 'Duel',
    desc: 'Bonus de +2 aux dégâts avec une arme de corps à corps tenue seule.',
  },
  'feat-style-duel': {
    id: 'feat-style-duel',
    name: 'Duel',
    desc: 'Bonus de +2 aux dégâts avec une arme de corps à corps tenue seule.',
  },
  'style-protection': {
    id: 'style-protection',
    name: 'Protection',
    desc: 'Imposez un désavantage à une attaque ciblant un allié à 1,50 m (bouclier requis).',
  },
  'feat-style-protection': {
    id: 'feat-style-protection',
    name: 'Protection',
    desc: 'Imposez un désavantage à une attaque ciblant un allié à 1,50 m (bouclier requis).',
  },
  'style-archerie-rodeur': {
    id: 'style-archerie-rodeur',
    name: 'Archerie',
    desc: "Bonus de +2 aux jets d'attaque avec des armes à distance.",
  },
  'style-combat-deux-armes-rodeur': {
    id: 'style-combat-deux-armes-rodeur',
    name: 'Combat à deux armes',
    desc: 'Ajoutez votre modificateur de caractéristique aux dégâts de la seconde attaque.',
  },
  'style-defense-rodeur': {
    id: 'style-defense-rodeur',
    name: 'Défense',
    desc: 'Bonus de +1 à la CA tant que vous portez une armure.',
  },
  'style-duel-rodeur': {
    id: 'style-duel-rodeur',
    name: 'Duel',
    desc: 'Bonus de +2 aux dégâts avec une arme de corps à corps tenue seule.',
  },
};

function isFightingStylePool(pool: { id?: string; name?: string; type?: string }): boolean {
  const blob = `${pool.id ?? ''} ${pool.name ?? ''} ${pool.type ?? ''}`.toLowerCase();
  return (
    blob.includes('style-combat') ||
    blob.includes('combat-style') ||
    blob.includes('fighting_style') ||
    blob.includes('style de combat')
  );
}

function isConcreteCombatStyleId(id: string): boolean {
  if (!id) return false;
  if (id.includes('style-de-combat')) return false;
  if (id.includes('style-de-combat-supplementaire')) return false;
  return (
    id.startsWith('style-') ||
    id.startsWith('feat-style-') ||
    /style-(archerie|defense|duel|protection|armes|combat)/.test(id)
  );
}

// ============================================================================
// CONSTANTES
// ============================================================================

const CLASS_SPELLCASTING: Record<string, { kind: SpellcastingKind; ability: Ability } | null> = {
  'cls-barbare': null,
  'cls-barde': { kind: 'bard', ability: 'Charisme' },
  'cls-druide': { kind: 'druid', ability: 'Sagesse' },
  'cls-ensorceleur': { kind: 'sorcerer', ability: 'Charisme' },
  'cls-guerrier': null,
  'cls-lettre': null,
  'cls-magicien': { kind: 'wizard', ability: 'Intelligence' },
  'cls-moine': null,
  'cls-paladin': { kind: 'paladin', ability: 'Charisme' },
  'cls-pretre': { kind: 'cleric', ability: 'Sagesse' },
  'cls-rodeur': { kind: 'ranger', ability: 'Sagesse' },
  'cls-roublard': null,
  'cls-sorcier': { kind: 'warlock', ability: 'Charisme' },
};

/** Niveau à partir duquel l'incantation de classe est active. */
const SPELLCASTING_FROM_LEVEL: Record<string, number> = {
  'cls-paladin': 2,
  'cls-rodeur': 2,
};

// ============================================================================
// COMPOSANT
// ============================================================================

@Component({
  selector: 'app-class-step',
  standalone: true,
  imports: [CommonModule],
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

  // === Computed ===
  readonly selectedClass = computed<CharacterClass | null>(() => {
    const id = this.selectedClassId();
    return id ? (this.allClasses().find((c) => c.id === id) ?? null) : null;
  });

  readonly subclassesConfig = computed<SubclassesConfig | null>(() => {
    const cls = this.selectedClass();
    if (!cls?.data.subclasses) return null;
    const raw = cls.data.subclasses as unknown as SubclassesConfig & {
      unlocked_at_level?: number;
    };
    return {
      ...raw,
      level_unlocked: raw.level_unlocked ?? raw.unlocked_at_level ?? 3,
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
  readonly availableCombatStyles = computed<CombatStyleOption[]>(() => {
    const cls = this.selectedClass();
    if (!cls) return [];
    const data = cls.data as Record<string, unknown>;
    const pools = (data['choice_pools'] as any[]) ?? [];
    const pool = pools.find((p) => isFightingStylePool(p));
    if (!pool?.pool?.length) return [];

    const details = (cls.data.features_details ?? []) as FeatureJson[];
    return (pool.pool as string[]).map((id) => {
      const feat = details.find((f) => f.id === id);
      const fallback = COMBAT_STYLE_FALLBACK[id];
      const rawName = feat?.name ?? fallback?.name ?? id;
      const name = rawName.replace(/^Style de combat\s*:\s*/i, '').trim();
      return {
        id,
        name,
        desc: feat?.desc || fallback?.desc || 'Style de combat martial.',
      };
    });
  });

  readonly combatStyleUnlockLevel = computed(() => {
    const cls = this.selectedClass();
    if (!cls) return 99;
    if (COMBAT_STYLE_UNLOCK_LEVEL[cls.id]) return COMBAT_STYLE_UNLOCK_LEVEL[cls.id];
    const details = (cls.data.features_details ?? []) as FeatureJson[];
    const grant = details.find(
      (f) =>
        typeof f.resolves_to_choice_pool === 'string' &&
        /style|combat|fighting/i.test(f.resolves_to_choice_pool),
    );
    return grant?.level ?? 99;
  });

  readonly requiresCombatStyle = computed(
    () =>
      this.availableCombatStyles().length > 0 &&
      this.combatStyleUnlockLevel() <= this.targetLevel(),
  );

  /** Nombre de styles à choisir (2 si aptitude Champion « style supplémentaire » ≤ niveau). */
  readonly combatStyleRequiredCount = computed(() => {
    if (!this.requiresCombatStyle()) return 0;
    let n = 1;
    const lvl = this.targetLevel();
    const sub = this.selectedSubclass();
    const extraSub = sub?.features?.find(
      (f: any) =>
        f.id === 'feat-style-de-combat-supplementaire' ||
        /combat-supplementaire|style.*supplementaire/i.test(String(f.id)),
    );
    if (extraSub && (extraSub.level ?? 10) <= lvl) n = 2;
    const cls = this.selectedClass();
    const extraCls = (cls?.data?.features_details ?? []).find(
      (f: any) =>
        f.id === 'feat-style-de-combat-supplementaire' ||
        /combat-supplementaire|style.*supplementaire/i.test(String(f.id ?? '')),
    ) as { unlocks_at_level?: number; level?: number } | undefined;
    const extraLvl = Number(extraCls?.['unlocks_at_level'] ?? extraCls?.level ?? 10);
    if (extraCls && extraLvl <= lvl) n = 2;
    return n;
  });

  readonly combatStylesComplete = computed(
    () => this.selectedCombatStyleIds().length >= this.combatStyleRequiredCount(),
  );

  // --- GESTION DES PHASES ---
  readonly currentPhase = computed<Phase>(() => {
    const held = this.holdPhase();
    if (held) return held;

    if (!this.selectedClassId()) return 'class';
    // Style de combat avant sous-classe (souvent niv.1–2 vs sous-classe niv.3+)
    // sauf 2e style Champion qui arrive après sous-classe
    if (this.requiresCombatStyle() && this.selectedCombatStyleIds().length === 0)
      return 'combat_style';
    if (this.requiresSubclass() && !this.selectedSubclassId()) return 'subclass';
    if (
      this.requiresCombatStyle() &&
      this.selectedCombatStyleIds().length < this.combatStyleRequiredCount()
    )
      return 'combat_style';
    if (this.nextUnresolvedSubChoice()) return 'sub_choice';
    if (this.nextUnresolvedProgChoice()) return 'prog_choice';

    if (this.requiresSubclass() && this.selectedSubclassId()) return 'subclass';
    if (this.requiresCombatStyle()) return 'combat_style';
    return 'class';
  });

  /** Pool de sous-classe affiché (en cours ou dernier choisi en relecture). */
  private subChoiceForDisplay(): SubChoice | null {
    return this.nextUnresolvedSubChoice() ?? this.activeSubChoices().at(-1) ?? null;
  }

  /** Pool de progression affiché (en cours ou dernier choisi en relecture). */
  private progChoiceForDisplay(): ProgressionChoiceDef | null {
    return this.nextUnresolvedProgChoice() ?? this.activeProgChoices().at(-1) ?? null;
  }

  readonly phaseTitle = computed<string>(() => {
    switch (this.currentPhase()) {
      case 'class':
        return 'La Vocation';
      case 'subclass':
        return this.subclassesConfig()?.name ?? 'Spécialisation';
      case 'combat_style':
        return 'Style de Combat';
      case 'sub_choice': {
        const choice = this.nextUnresolvedSubChoice();
        if (!choice) return 'Faites votre choix';
        const picked = this.subChoiceAnswers().get(choice.id)?.length ?? 0;
        const need = choice.count || 1;
        return need > 1 ? `${choice.label} (${picked}/${need})` : choice.label;
      }
      case 'prog_choice': {
        const choice = this.nextUnresolvedProgChoice();
        if (!choice) return 'Faites votre choix';
        const picked = this.progChoiceAnswers().get(choice.id)?.length ?? 0;
        const need = choice.count || 1;
        return need > 1 ? `${choice.label} (${picked}/${need})` : choice.label;
      }
    }
  });

  readonly phaseSubtitle = computed<string>(() => {
    switch (this.currentPhase()) {
      case 'class':
        return 'Choisissez la classe qui dictera vos talents et votre destinée.';
      case 'subclass':
        return `Affinez les pouvoirs de votre ${this.selectedClass()?.name}.`;
      case 'combat_style':
        return this.combatStyleRequiredCount() > 1
          ? `Choisissez ${this.combatStyleRequiredCount()} styles (${this.selectedCombatStyleIds().length}/${this.combatStyleRequiredCount()}).`
          : 'Sélectionnez votre approche martiale de prédilection.';
      case 'sub_choice':
        return 'Cette option personnalisera les aptitudes de votre sous-classe.';
      case 'prog_choice':
        return 'Choisissez les options de progression débloquées par votre classe.';
    }
  });

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
        return choice.options.map((opt) => ({
          id: opt,
          title: this.getSubChoiceLabel(choice.type, opt),
          desc: this.getSubChoiceDescription(opt, choice.type),
          badge: picked.has(opt) ? 'Sélectionné' : 'Option',
          icon: choice.type === 'dragon_ancestry' ? 'fluent-emoji:dragon' : 'fluent-emoji:sparkles',
        }));
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

  readonly selectionComplete = computed(() => {
    if (!this.selectedClass()) return false;
    if (this.requiresCombatStyle() && !this.combatStylesComplete()) return false;
    if (this.requiresSubclass() && !this.selectedSubclass()) return false;
    for (const sc of this.activeSubChoices()) {
      const picked = this.subChoiceAnswers().get(sc.id) ?? [];
      if (picked.length < (sc.count || 1)) return false;
    }
    for (const pc of this.activeProgChoices()) {
      const picked = this.progChoiceAnswers().get(pc.id) ?? [];
      if (picked.length < (pc.count || 1)) return false;
    }
    return true;
  });

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
    const subChoiceIds = new Set(this.activeSubChoices().map((sc) => sc.id));
    const progMap = new Map<string, string[]>();
    const subMap = new Map<string, string[]>();
    for (const [k, v] of Object.entries(answers)) {
      if (!Array.isArray(v) || v.length === 0) continue;
      if (subChoiceIds.has(k)) subMap.set(k, v);
      else progMap.set(k, v);
    }
    if (subMap.size) this.subChoiceAnswers.set(subMap);
    if (progMap.size) this.progChoiceAnswers.set(progMap);

    this.syncCarouselIndexFromSelection();
  }

  private syncCarouselIndexFromSelection(): void {
    const cards = this.currentCards();
    if (!cards.length) return;
    const targetId = this.resolveCarouselTargetId();
    if (!targetId) return;
    const idx = cards.findIndex((c) => c.id === targetId);
    if (idx >= 0) this.currentIndex.set(idx);
  }

  private resolveCarouselTargetId(): string | null {
    switch (this.currentPhase()) {
      case 'class':
        return this.selectedClassId();
      case 'subclass':
        return this.selectedSubclassId() ?? this.selectedClassId();
      case 'combat_style': {
        const styles = this.selectedCombatStyleIds();
        return styles[styles.length - 1] ?? null;
      }
      case 'sub_choice': {
        const choice =
          this.nextUnresolvedSubChoice() ??
          this.activeSubChoices()[this.activeSubChoices().length - 1];
        if (!choice) return null;
        const picks = this.subChoiceAnswers().get(choice.id);
        return picks?.[picks.length - 1] ?? null;
      }
      case 'prog_choice': {
        const choice =
          this.nextUnresolvedProgChoice() ??
          this.activeProgChoices()[this.activeProgChoices().length - 1];
        if (!choice) return null;
        const picks = this.progChoiceAnswers().get(choice.id);
        return picks?.[picks.length - 1] ?? null;
      }
      default:
        return this.selectedClassId();
    }
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

    const viewportCenter =
      viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;

    viewport.querySelectorAll<HTMLElement>('[data-carousel-index]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      const dist = Math.abs(mid - viewportCenter);
      if (dist < bestDist) {
        bestDist = dist;
        best = Number(el.dataset['carouselIndex'] ?? 0);
      }
    });

    if (best !== this.currentIndex()) {
      this.currentIndex.set(best);
    }
  }

  private scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth'): void {
    const total = this.currentCards().length;
    if (total <= 0) return;
    const safe = ((index % total) + total) % total;
    this.currentIndex.set(safe);

    const viewport = this.carouselViewport()?.nativeElement;
    const card = viewport?.querySelector<HTMLElement>(`[data-carousel-index="${safe}"]`);
    if (!viewport || !card) return;

    const viewportRect = viewport.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const delta =
      cardRect.left + cardRect.width / 2 - (viewportRect.left + viewport.clientWidth / 2);

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

  private scheduleCarouselRestore(): void {
    if (!this.useScrollCarousel()) return;
    this.syncCarouselIndexFromSelection();
    afterNextRender(
      () => this.scrollToIndex(this.normalizedIndex(), 'instant'),
      { injector: this.injector },
    );
  }

  getWrapOffset(index: number): string {
    const total = this.currentCards().length;
    if (total === 0) return '0px';
    const wraps = Math.floor((this.currentIndex() - index + total / 2) / total);
    return `${wraps * total * this.cardStridePx}px`;
  }

  normalizedIndex(): number {
    const total = this.currentCards().length;
    if (total === 0) return 0;
    return ((this.currentIndex() % total) + total) % total;
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

  onRightClick(event: Event, cardId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.flippedCards.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(cardId)) newSet.delete(cardId);
      else newSet.add(cardId);
      return newSet;
    });
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
        this.selectedCombatStyleIds.update((ids) => {
          const need = this.combatStyleRequiredCount();
          const prev = [...ids];
          const idx = prev.indexOf(cardId);
          if (idx >= 0) {
            prev.splice(idx, 1);
            return prev;
          }
          if (need <= 1) return [cardId];
          if (prev.length < need) return [...prev, cardId];
          prev.shift();
          prev.push(cardId);
          return prev;
        });
        break;
      case 'sub_choice': {
        const choice = this.nextUnresolvedSubChoice();
        if (choice) {
          this.holdPhase.set(null);
          this.subChoiceAnswers.update((m) => {
            const newMap = new Map(m);
            const need = choice.count || 1;
            const prev = [...(newMap.get(choice.id) ?? [])];
            const idx = prev.indexOf(cardId);
            if (idx >= 0) {
              prev.splice(idx, 1);
            } else if (need <= 1) {
              newMap.set(choice.id, [cardId]);
              return newMap;
            } else if (prev.length < need) {
              prev.push(cardId);
            } else {
              prev.shift();
              prev.push(cardId);
            }
            newMap.set(choice.id, prev);
            return newMap;
          });
        }
        break;
      }
      case 'prog_choice': {
        const choice = this.nextUnresolvedProgChoice();
        if (choice) {
          this.holdPhase.set(null);
          this.progChoiceAnswers.update((m) => {
            const newMap = new Map(m);
            const need = choice.count || 1;
            const prev = [...(newMap.get(choice.id) ?? [])];
            const idx = prev.indexOf(cardId);
            if (idx >= 0) {
              prev.splice(idx, 1);
            } else if (need <= 1) {
              newMap.set(choice.id, [cardId]);
              return this.trimInvalidProgPicks(newMap);
            } else if (prev.length < need) {
              prev.push(cardId);
            } else {
              prev.shift();
              prev.push(cardId);
            }
            newMap.set(choice.id, prev);
            return this.trimInvalidProgPicks(newMap);
          });
        }
        break;
      }
    }

    this.flippedCards.set(new Set());

    if (this.selectionComplete()) {
      this.holdPhase.set(phaseBeforeClick);
      this.confirmSelection();
    } else if (phaseBeforeClick !== this.currentPhase()) {
      this.currentIndex.set(0);
    }
  }

  clearSelection(): void {
    this.holdPhase.set(null);
    this.selectedClassId.set(null);
    this.selectedSubclassId.set(null);
    this.selectedCombatStyleIds.set([]);
    this.subChoiceAnswers.set(new Map());
    this.progChoiceAnswers.set(new Map());
    this.lastAppliedLevel = null;
    this.builder.clearClass();
    this.flippedCards.set(new Set());
    this.currentIndex.set(0);
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  /** Revient au sous-choix précédent (atavisme, dragon, métamagie…) sans quitter l'étape classe. */
  prevPhase(): void {
    this.holdPhase.set(null);
    this.flippedCards.set(new Set());
    const phase = this.currentPhase();

    if (phase === 'prog_choice') {
      const choice = this.nextUnresolvedProgChoice() ?? this.activeProgChoices().at(-1);
      if (choice) {
        this.progChoiceAnswers.update((m) => {
          const next = new Map(m);
          next.delete(choice.id);
          return this.trimInvalidProgPicks(next);
        });
      }
      this.syncCarouselIndexFromSelection();
      return;
    }

    if (phase === 'sub_choice' || (phase === 'subclass' && this.subChoiceAnswers().size > 0)) {
      this.subChoiceAnswers.set(new Map());
      this.selectedSubclassId.set(null);
      this.syncCarouselIndexFromSelection();
      return;
    }

    if (phase === 'subclass') {
      this.selectedSubclassId.set(null);
      this.subChoiceAnswers.set(new Map());
      this.syncCarouselIndexFromSelection();
      return;
    }

    if (phase === 'combat_style') {
      this.selectedCombatStyleIds.set([]);
      this.syncCarouselIndexFromSelection();
    }
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
  private applySelectionToBuilder(): boolean {
    try {
      const cls = this.selectedClass();
      if (!cls || !this.selectionComplete()) return false;

      const sub = this.selectedSubclass();
      const spellInfo = this.resolveSpellcasting(cls);
      const prof = cls.data.proficiencies;

      const features: FeatureInstance[] = [];
      const targetLevel = this.targetLevel();
      const progression = (cls.data.progression ?? []) as {
        level: number;
        features?: string[];
        resources?: Record<string, unknown>;
      }[];
      const profBonus = this.builder.proficiencyBonus();

      for (const prog of progression) {
        if (prog.level < 1 || prog.level > targetLevel) continue;
        for (const id of prog.features ?? []) {
          const feat = cls.data.features_details?.find((f: any) => f.id === id) as
            | FeatureJson
            | undefined;
          if (!feat) continue;
          // Remplacé par le style concret choisi
          if (
            feat.resolves_to_choice_pool ||
            /style-de-combat(?!-supplementaire)/i.test(feat.id) ||
            feat.id.includes('style-de-combat-guerrier') ||
            feat.id.includes('style-de-combat-paladin') ||
            feat.id.includes('style-de-combat-rodeur') ||
            feat.id === 'feat-style-de-combat-guerrier'
          ) {
            continue;
          }
          if (features.some((f) => f.refId === feat.id)) continue;
          features.push({
            refId: feat.id,
            name: feat.name,
            desc: annotateAuraDesc(feat as any, targetLevel),
            source: 'class',
            sourceDetail: `${cls.name} ${prog.level}`,
            level: prog.level,
            uses: resolveFeatureUses(feat, cls, targetLevel, profBonus),
          });
        }
      }

      if (sub) {
        sub.features
          .filter((f) => f.level <= targetLevel)
          .forEach((feat) => {
            if (feat.resolves_to_choice_pool) return;
            if (features.some((f) => f.refId === feat.id)) return;
            features.push({
              refId: feat.id,
              name: feat.name,
              desc: annotateAuraDesc(feat as any, targetLevel),
              source: 'subclass',
              sourceDetail: `${sub.name} ${feat.level}`,
              level: feat.level,
              uses: resolveFeatureUses(feat, cls, targetLevel, profBonus),
            });
          });

        // Injecte les options de sub_choices sélectionnées (coups bas, école, etc.)
        for (const sc of this.activeSubChoices()) {
          const picks = this.subChoiceAnswers().get(sc.id) ?? [];
          for (const pickId of picks) {
            const fromSub = sub.features.find((f) => f.id === pickId);
            const fromClass = (cls.data.features_details ?? []).find(
              (f: any) => f.id === pickId,
            ) as FeatureJson | undefined;
            const feat = fromSub ?? fromClass;
            if (!feat || features.some((f) => f.refId === feat.id)) continue;
            features.push({
              refId: feat.id,
              name: feat.name,
              desc: annotateAuraDesc(feat as any, targetLevel),
              source: 'subclass',
              sourceDetail: `${sub.name} · ${sc.label}`,
              level: feat.level || sc.level_required,
              uses: resolveFeatureUses(feat, cls, targetLevel, profBonus),
            });
          }
        }
      }

      for (const styleId of this.selectedCombatStyleIds()) {
        const combatStyle = this.availableCombatStyles().find((s) => s.id === styleId);
        if (!combatStyle) continue;
        features.push({
          refId: combatStyle.id,
          name: `Style : ${combatStyle.name}`,
          desc: combatStyle.desc,
          source: 'class',
          sourceDetail: `${cls.name} ${this.combatStyleUnlockLevel()}`,
          level: this.combatStyleUnlockLevel(),
        });
      }

      const progAtLevel = progression.find((p) => p.level === targetLevel);
      const classProgressionResources = extractScalarResources(progAtLevel?.resources);
      const pactSlots = extractPactSlotsFromResources(progAtLevel?.resources);
      const classSpellSlots =
        pactSlots.length > 0
          ? pactSlots
          : extractSpellSlotsFromResources(progAtLevel?.resources);
      const langBonus = classBonusLanguageCount(cls, targetLevel);

      const data = cls.data as Record<string, unknown>;
      const selection: ClassSelection = {
        classId: cls.id,
        className: cls.name,
        subclassId: sub?.id,
        subclassName: sub?.name,
        hitDie: cls.data.hit_die,
        hpAtLevel1:
          typeof data['hp_at_level_1'] === 'number' ? data['hp_at_level_1'] : cls.data.hit_die,
        hpPerLevelAverage:
          typeof data['hp_per_level_average'] === 'number'
            ? data['hp_per_level_average']
            : Math.floor(cls.data.hit_die / 2) + 1,
        hasSpellcasting: spellInfo !== null,
        spellcastingKind: spellInfo?.kind ?? null,
        spellcastingAbility: spellInfo?.ability ?? null,
        savingThrows: (prof.saving_throws ?? []) as Ability[],
        armorProficiencies: prof.armor ?? [],
        weaponProficiencies: prof.weapons ?? [],
        toolProficiencies: Array.isArray(prof.tools) ? prof.tools : [],
        skillOptions: Array.isArray(prof.skills?.options) ? prof.skills.options : [],
        skillChooseCount: prof.skills?.count ?? 0,
        classFeatures: features,
        startingEquipmentSlots: cls.data.starting_equipment ?? [],
        classProgressionResources,
        classBonusLanguageCount: langBonus,
        classSpellSlots,
      };

      this.builder.setClass(selection, { preserveProgress: !!this.builder.creation().classId });

      const classChoiceAnswers: Record<string, string[]> = {};
      const metamagic: string[] = [];
      const invocations: string[] = [];
      let pactBoon: string | null = null;
      const extraFeatures: FeatureInstance[] = [];

      for (const sc of this.activeSubChoices()) {
        const picks = this.subChoiceAnswers().get(sc.id) ?? [];
        if (picks.length) classChoiceAnswers[sc.id] = picks;
      }

      for (const choice of this.activeProgChoices()) {
        const picks = this.progChoiceAnswers().get(choice.id) ?? [];
        classChoiceAnswers[choice.id] = picks;

        if (choice.type === 'metamagic') metamagic.push(...picks);
        if (choice.type === 'invocation') invocations.push(...picks);
        if (choice.type === 'pact_boon' && picks[0]) pactBoon = picks[0];

        for (const pickId of picks) {
          if (extraFeatures.some((f) => f.refId === pickId)) continue;
          const opt = choice.options.find((o) => o.id === pickId);
          const feat = this.resolveOptionFeature(pickId);
          extraFeatures.push({
            refId: pickId,
            name: feat?.name ?? opt?.name ?? pickId,
            desc: feat?.desc ?? opt?.desc ?? '',
            source: 'class',
            sourceDetail: `${cls.name} · ${choice.label}`,
            level: feat?.level ?? 1,
            uses: feat ? resolveFeatureUses(feat, cls, targetLevel, profBonus) : undefined,
          });
        }

        for (const fid of choice.fixedFeatureIds ?? []) {
          if (extraFeatures.some((f) => f.refId === fid)) continue;
          const feat = this.resolveOptionFeature(fid);
          extraFeatures.push({
            refId: fid,
            name: feat?.name ?? fid,
            desc: feat?.desc ?? '',
            source: 'class',
            sourceDetail: `${cls.name} · ${choice.label}`,
            level: feat?.level ?? 1,
            uses: feat ? resolveFeatureUses(feat, cls, targetLevel, profBonus) : undefined,
          });
        }
      }

      this.builder.setClassProgressionChoices({
        classChoiceAnswers,
        metamagicOptions: metamagic,
        eldritchInvocations: invocations,
        pactBoon,
        extraFeatures,
      });

      return true;
    } catch (err) {
      console.error('[class-step] applySelectionToBuilder failed', err);
      return false;
    }
  }

  private resolveSpellcasting(
    cls: CharacterClass,
  ): { kind: SpellcastingKind; ability: Ability } | null {
    const fromLevel = SPELLCASTING_FROM_LEVEL[cls.id] ?? 1;
    if (this.targetLevel() < fromLevel) return null;
    return (
      CLASS_SPELLCASTING[cls.id] ??
      ((cls.data as any).spellcasting ? this.inferSpellcasting(cls) : null)
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
      CLASS_SPELLCASTING[cls.id] || (cls.data as any).spellcasting
        ? 'Maîtrise les arts arcaniques ou divins. '
        : 'Spécialiste des aptitudes martiales ou physiques. ';
    const weapons = cls.data.proficiencies?.weapons?.length
      ? `Manie : ${
          cls.data.proficiencies.weapons.length > 2
            ? 'Diverses armes martiales et courantes'
            : formatGameIds(cls.data.proficiencies.weapons)
        }.`
      : '';
    return `${spell}${weapons}`;
  }

  private inferSpellcasting(
    cls: CharacterClass,
  ): { kind: SpellcastingKind; ability: Ability } | null {
    const abilityRaw = (cls.data as any).spellcasting?.ability as string | undefined;
    const abilityMap: Record<string, Ability> = {
      cha: 'Charisme',
      wis: 'Sagesse',
      int: 'Intelligence',
    };
    const ability = abilityRaw ? abilityMap[abilityRaw.toLowerCase()] : undefined;
    const kind = CLASS_SPELLCASTING[cls.id]?.kind;
    if (kind && ability) return { kind, ability };
    return null;
  }

  getSubChoiceLabel(choiceType: string, value: string): string {
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

  getSubChoiceDescription(value: string, choiceType?: string): string {
    if (value.startsWith('meta-')) {
      return `Option de métamagie : ${metamagicLabel(value)}.`;
    }
    if (choiceType === 'dragon_ancestry' || /^dragon-/.test(value)) {
      const name = this.getSubChoiceLabel('dragon_ancestry', value);
      return `Ancêtre draconique : ${name}. Détermine votre affinité élémentaire et votre résistance.`;
    }
    return (
      this.resolveOptionFeature(value)?.desc ||
      'Une option conférant des capacités uniques à votre personnage.'
    );
  }

  private resolveOptionFeature(id: string): FeatureJson | undefined {
    const cls = this.selectedClass();
    const fromClass = (cls?.data.features_details ?? []).find((f: any) => f.id === id) as
      | FeatureJson
      | undefined;
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
