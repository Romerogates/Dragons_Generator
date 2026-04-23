// features/character-creation/steps/class-step/class-step.ts

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../../core/services/data.service';
import {
  CharacterBuilderService,
  ClassSelection,
} from '../../../../core/services/character-builder.service';
import type { CharacterClass } from '../../../../core/models/CharacterClasses/character-class';
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

type Phase = 'class' | 'subclass' | 'combat_style' | 'sub_choice';

interface SubclassesConfig {
  name: string;
  level_unlocked: number;
  options: SubclassOption[];
}

interface SubclassOption {
  id: string;
  name: string;
  desc: string;
  features: { id: string; name: string; level: number; desc: string }[];
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
  'cls-paladin': null,
  'cls-pretre': { kind: 'cleric', ability: 'Sagesse' },
  'cls-rodeur': null,
  'cls-roublard': null,
  'cls-sorcier': { kind: 'warlock', ability: 'Charisme' },
};

const COMBAT_STYLES: CombatStyleOption[] = [
  {
    id: 'style-archerie',
    name: 'Archerie',
    desc: "Bonus de +2 aux jets d'attaque avec des armes à distance.",
  },
  {
    id: 'style-armes-deux-mains',
    name: 'Armes à deux mains',
    desc: "Relancez les 1 et 2 sur les dés de dégâts d'une arme à deux mains ou polyvalente.",
  },
  {
    id: 'style-combat-deux-armes',
    name: 'Combat à deux armes',
    desc: 'Ajoutez votre modificateur de caractéristique aux dégâts de la seconde attaque.',
  },
  {
    id: 'style-defense',
    name: 'Défense',
    desc: 'Bonus de +1 à la CA tant que vous portez une armure.',
  },
  {
    id: 'style-duel',
    name: 'Duel',
    desc: 'Bonus de +2 aux dégâts avec une arme de corps à corps tenue seule.',
  },
  {
    id: 'style-protection',
    name: 'Protection',
    desc: 'Imposez un désavantage à une attaque ciblant un allié à 1,50 m (bouclier requis).',
  },
];

// ============================================================================
// COMPOSANT
// ============================================================================

@Component({
  selector: 'app-class-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './class-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassStep implements OnInit {
  private dataService = inject(DataService);
  readonly builder = inject(CharacterBuilderService);

  // === State de la classe ===
  readonly allClasses = signal<CharacterClass[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly selectedClassId = signal<string | null>(null);
  readonly selectedSubclassId = signal<string | null>(null);
  readonly selectedCombatStyleId = signal<string | null>(null);
  readonly subChoiceAnswers = signal<Map<string, string>>(new Map());

  // === State du Carrousel 3D ===
  readonly currentIndex = signal(0);
  readonly flippedCards = signal<Set<string>>(new Set());
  readonly transitioning = signal(false);

  readonly combatStyles = COMBAT_STYLES;

  // === Computed ===
  readonly selectedClass = computed<CharacterClass | null>(() => {
    const id = this.selectedClassId();
    return id ? (this.allClasses().find((c) => c.id === id) ?? null) : null;
  });

  readonly subclassesConfig = computed<SubclassesConfig | null>(() => {
    const cls = this.selectedClass();
    if (!cls?.data.subclasses) return null;
    return cls.data.subclasses as unknown as SubclassesConfig;
  });

  readonly requiresSubclass = computed(() => {
    const config = this.subclassesConfig();
    return config !== null && config.level_unlocked <= 1;
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
    return sub.sub_choices.filter((sc) => sc.level_required <= 1);
  });

  readonly nextUnresolvedSubChoice = computed<SubChoice | null>(() => {
    for (const sc of this.activeSubChoices()) {
      if (!this.subChoiceAnswers().has(sc.id)) return sc;
    }
    return null;
  });

  readonly requiresCombatStyle = computed(() => this.selectedClassId() === 'cls-guerrier');

  // --- GESTION DES PHASES ---
  readonly currentPhase = computed<Phase>(() => {
    if (!this.selectedClassId()) return 'class';
    if (this.requiresSubclass() && !this.selectedSubclassId()) return 'subclass';
    if (this.requiresCombatStyle() && !this.selectedCombatStyleId()) return 'combat_style';
    if (this.nextUnresolvedSubChoice()) return 'sub_choice';

    // Si tout est fini, on affiche le dernier choix pour que ça ait l'air propre
    if (this.activeSubChoices().length > 0) return 'sub_choice';
    if (this.requiresCombatStyle()) return 'combat_style';
    if (this.requiresSubclass()) return 'subclass';
    return 'class';
  });

  readonly phaseTitle = computed<string>(() => {
    switch (this.currentPhase()) {
      case 'class':
        return 'La Vocation';
      case 'subclass':
        return this.subclassesConfig()?.name ?? 'Spécialisation';
      case 'combat_style':
        return 'Style de Combat';
      case 'sub_choice':
        return this.nextUnresolvedSubChoice()?.label ?? 'Faites votre choix';
    }
  });

  readonly phaseSubtitle = computed<string>(() => {
    switch (this.currentPhase()) {
      case 'class':
        return 'Choisissez la classe qui dictera vos talents et votre destinée.';
      case 'subclass':
        return `Affinez les pouvoirs de votre ${this.selectedClass()?.name}.`;
      case 'combat_style':
        return 'Sélectionnez votre approche martiale de prédilection.';
      case 'sub_choice':
        return 'Cette option personnalisera les aptitudes de votre sous-classe.';
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
          stats: `Sauvegardes : ${c.data.proficiencies.saving_throws?.join(', ')}`,
          badge: `Dés de vie : 1d${c.data.hit_die}`,
          icon: this.getIconForClass(c.id),
        }));

      case 'subclass':
        return this.subclassOptions().map((sub) => ({
          id: sub.id,
          title: sub.name,
          desc: sub.desc ?? '',
          stats: `Niveau d'obtention : 1`,
          badge: 'Voie',
          icon: '🔮',
        }));

      case 'combat_style':
        return this.combatStyles.map((style) => ({
          id: style.id,
          title: style.name,
          desc: style.desc,
          badge: 'Style',
          icon: '⚔️',
        }));

      case 'sub_choice': {
        const choice = this.nextUnresolvedSubChoice();
        if (!choice) return [];
        return choice.options.map((opt) => ({
          id: opt,
          title: this.getSubChoiceLabel(choice.type, opt),
          desc: 'Une option conférant des capacités uniques à votre personnage.',
          badge: 'Option',
          icon: '✨',
        }));
      }
    }
  });

  readonly selectionComplete = computed(() => {
    if (!this.selectedClass()) return false;
    if (this.requiresSubclass() && !this.selectedSubclass()) return false;
    if (this.requiresCombatStyle() && !this.selectedCombatStyleId()) return false;
    for (const sc of this.activeSubChoices()) {
      if (!this.subChoiceAnswers().has(sc.id)) return false;
    }
    return true;
  });

  ngOnInit(): void {
    this.loadClasses();
    const current = this.builder.creation();
    if (current.classId) {
      this.selectedClassId.set(current.classId);
      if (current.subclassId) this.selectedSubclassId.set(current.subclassId);
    }
  }

  // === CARROUSEL LOGIC ===
  getWrapOffset(index: number): string {
    const total = this.currentCards().length;
    if (total === 0) return '0px';
    const wraps = Math.floor((this.currentIndex() - index + total / 2) / total);
    return `${wraps * total * 288}px`;
  }

  normalizedIndex(): number {
    const total = this.currentCards().length;
    if (total === 0) return 0;
    return ((this.currentIndex() % total) + total) % total;
  }

  nextCard(): void {
    if (this.currentCards().length > 0) {
      this.currentIndex.update((i) => i + 1);
    }
  }

  prevCard(): void {
    if (this.currentCards().length > 0) {
      this.currentIndex.update((i) => i - 1);
    }
  }

  onRightClick(event: Event, cardId: string): void {
    event.preventDefault();
    this.flippedCards.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(cardId)) newSet.delete(cardId);
      else newSet.add(cardId);
      return newSet;
    });
  }

  // === LOGIQUE DE CLIC ULTRA-RAPIDE ===
  pickCard(cardId: string): void {
    const index = this.currentCards().findIndex((c) => c.id === cardId);

    // Si on a cliqué sur une carte sur le côté, on la centre d'abord
    if (index !== this.normalizedIndex()) {
      let diff = index - this.normalizedIndex();
      const total = this.currentCards().length;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;
      this.currentIndex.update((i) => i + diff);
      return;
    }

    const phaseBeforeClick = this.currentPhase();

    // Application instantanée des choix (plus de timeout pour la logique interne)
    switch (phaseBeforeClick) {
      case 'class':
        if (this.selectedClassId() !== cardId) {
          this.selectedSubclassId.set(null);
          this.selectedCombatStyleId.set(null);
          this.subChoiceAnswers.set(new Map());
          this.builder.clearClass();
        }
        this.selectedClassId.set(cardId);
        break;
      case 'subclass':
        if (this.selectedSubclassId() !== cardId) {
          this.subChoiceAnswers.set(new Map());
        }
        this.selectedSubclassId.set(cardId);
        break;
      case 'combat_style':
        this.selectedCombatStyleId.set(cardId);
        break;
      case 'sub_choice': {
        const choice = this.nextUnresolvedSubChoice();
        if (choice) {
          this.subChoiceAnswers.update((m) => {
            const newMap = new Map(m);
            newMap.set(choice.id, cardId);
            return newMap;
          });
        }
        break;
      }
    }

    this.flippedCards.set(new Set());

    // Si la sélection est terminée
    if (this.selectionComplete()) {
      this.confirmSelection();
    } else {
      // On reset l'animation de slide *seulement* si on passe à une nouvelle phase
      if (phaseBeforeClick !== this.currentPhase()) {
        this.currentIndex.set(0);
      }
    }
  }

  clearSelection(): void {
    this.selectedClassId.set(null);
    this.selectedSubclassId.set(null);
    this.selectedCombatStyleId.set(null);
    this.subChoiceAnswers.set(new Map());
    this.builder.clearClass();
    this.flippedCards.set(new Set());
    this.currentIndex.set(0);
  }

  // === CONFIRMATION INSTANTANÉE ===
  confirmSelection(): void {
    const cls = this.selectedClass();
    if (!cls || !this.selectionComplete()) return;

    const sub = this.selectedSubclass();
    const spellInfo = CLASS_SPELLCASTING[cls.id] ?? null;
    const prof = cls.data.proficiencies;

    const features: FeatureInstance[] = [];
    const prog = cls.data.progression.find((p) => p.level === 1);
    if (prog?.features) {
      prog.features.forEach((id) => {
        const feat = cls.data.features_details?.find((f) => f.id === id);
        if (feat)
          features.push({
            refId: feat.id,
            name: feat.name,
            desc: feat.desc,
            source: 'class',
            sourceDetail: `${cls.name} 1`,
            level: 1,
          });
      });
    }

    if (sub) {
      sub.features
        .filter((f) => f.level <= 1)
        .forEach((feat) => {
          features.push({
            refId: feat.id,
            name: feat.name,
            desc: feat.desc,
            source: 'subclass',
            sourceDetail: `${sub.name} 1`,
            level: 1,
          });
        });
    }

    const combatStyle = COMBAT_STYLES.find((s) => s.id === this.selectedCombatStyleId());
    if (combatStyle) {
      features.push({
        refId: combatStyle.id,
        name: `Style : ${combatStyle.name}`,
        desc: combatStyle.desc,
        source: 'class',
        sourceDetail: `${cls.name} 1`,
        level: 1,
      });
    }

    const selection: ClassSelection = {
      classId: cls.id,
      className: cls.name,
      subclassId: sub?.id,
      subclassName: sub?.name,
      hitDie: cls.data.hit_die,
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
    };

    this.builder.setClass(selection);

    // Passe à l'étape suivante instantanément (léger délai pour laisser le builder se mettre à jour)
    setTimeout(() => {
      this.builder.nextStep();
    }, 150);
  }

  // === HELPERS ===
  private loadClasses(): void {
    this.loading.set(true);
    this.dataService.getClasses().subscribe({
      next: (classes) => {
        this.allClasses.set(classes);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les classes.');
        this.loading.set(false);
      },
    });
  }

  getIconForClass(id: string): string {
    const icons: Record<string, string> = {
      'cls-barbare': '🪓',
      'cls-barde': '🪕',
      'cls-druide': '🌿',
      'cls-ensorceleur': '✨',
      'cls-guerrier': '⚔️',
      'cls-lettre': '📚',
      'cls-magicien': '📖',
      'cls-moine': '🥋',
      'cls-paladin': '🛡️',
      'cls-pretre': '⚕️',
      'cls-rodeur': '🏹',
      'cls-roublard': '🗡️',
      'cls-sorcier': '👁️',
    };
    return icons[id] || '👤';
  }

  getClassDescription(cls: CharacterClass): string {
    const spell = CLASS_SPELLCASTING[cls.id]
      ? 'Maîtrise les arts arcaniques ou divins. '
      : 'Spécialiste des aptitudes martiales ou physiques. ';
    const weapons = cls.data.proficiencies.weapons?.length
      ? `Manie : ${cls.data.proficiencies.weapons.length > 2 ? 'Diverses armes martiales et courantes' : cls.data.proficiencies.weapons.join(', ')}.`
      : '';
    return `${spell}${weapons}`;
  }

  getSubChoiceLabel(choiceType: string, value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ');
  }
}
