// features/character-creation/steps/species-step/species-step.ts

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '@core/services/data.service';
import {
  CharacterBuilderService,
  SpeciesSelection,
} from '@core/services/character-builder.service';
import type { Species, Subspecies, Trait, CreationChoice } from '@core/models/Species/species';
import type { FeatureInstance, Size } from '@core/models/Character/character';
import { apiAsiToPartialScores, mergePartialScores } from '@core/utils/ability-mapping';
import { ABILITY_KEY_TO_LABEL, type AbilityScores } from '@core/models/Character/character';

interface CardOption {
  id: string;
  title: string;
  subtitle?: string;
  desc: string;
  stats?: string;
  badge?: string;
  icon: string;
}

type Phase = 'species' | 'subspecies' | 'choice';

interface ChoiceOptionView {
  id: string;
  name: string;
  desc?: string;
  note?: string;
  damageType?: string;
  areaShape?: string;
  areaLengthM?: number;
  group?: string;
}

@Component({
  selector: 'app-species-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './species-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeciesStep implements OnInit {
  private dataService = inject(DataService);
  readonly builder = inject(CharacterBuilderService);

  readonly allSpecies = signal<Species[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedSpeciesId = signal<string | null>(null);
  readonly selectedSubspeciesId = signal<string | null>(null);
  readonly choiceAnswers = signal<Map<string, string[]>>(new Map());

  // --- CARROUSEL & 3D ---
  readonly currentIndex = signal(0);

  readonly normalizedIndex = computed(() => {
    const total = this.currentCards().length;
    if (total === 0) return 0;
    // Permet d'avoir toujours un index entre 0 et total - 1, même si currentIndex est négatif
    return ((this.currentIndex() % total) + total) % total;
  });

  readonly flippedCards = signal<Set<string>>(new Set());
  readonly transitioning = signal(false);
  private restoringState = true;

  readonly selectedSpecies = computed<Species | null>(() => {
    const id = this.selectedSpeciesId();
    return id ? (this.allSpecies().find((s) => s.id === id) ?? null) : null;
  });

  readonly playableSubspecies = computed<Subspecies[]>(() => {
    const species = this.selectedSpecies();
    return species ? species.subspecies.filter((sub) => sub.playable) : [];
  });

  readonly requiresSubspecies = computed(() => this.playableSubspecies().length > 0);

  readonly selectedSubspecies = computed<Subspecies | null>(() => {
    const subId = this.selectedSubspeciesId();
    return subId ? (this.playableSubspecies().find((s) => s.id === subId) ?? null) : null;
  });

  readonly allCreationChoices = computed<CreationChoice[]>(() => {
    const species = this.selectedSpecies();
    const sub = this.selectedSubspecies();
    if (!species) return [];
    const choices = [...species.creationChoices];
    if (sub?.creationChoices) choices.push(...sub.creationChoices);
    return choices;
  });

  readonly actionableChoices = computed<CreationChoice[]>(() => {
    return this.allCreationChoices().filter((c) => c.type === 'single_select');
  });

  readonly nextUnresolvedChoice = computed<CreationChoice | null>(() => {
    const answers = this.choiceAnswers();
    for (const choice of this.actionableChoices()) {
      const answer = answers.get(choice.id);
      if (!answer || answer.length < (choice.choiceCount ?? 1)) return choice;
    }
    return null;
  });

  readonly currentPhase = computed<Phase>(() => {
    if (!this.selectedSpeciesId()) return 'species';
    if (this.requiresSubspecies() && !this.selectedSubspeciesId()) return 'subspecies';
    if (this.nextUnresolvedChoice()) return 'choice';
    return 'species';
  });

  readonly phaseTitle = computed<string>(() => {
    switch (this.currentPhase()) {
      case 'species':
        return 'Choisissez votre peuple';
      case 'subspecies':
        return `Choisissez votre lignée`;
      case 'choice':
        return this.nextUnresolvedChoice()?.name ?? 'Faites votre choix';
    }
  });

  readonly phaseSubtitle = computed<string>(() => {
    switch (this.currentPhase()) {
      case 'species':
        return "Faites défiler les peuples d'Eana et forgez votre destin.";
      case 'subspecies':
        return `${this.selectedSpecies()?.name} — sous-espèce`;
      case 'choice':
        return this.nextUnresolvedChoice()?.desc ?? '';
    }
  });

  getIconForSpecies(id: string): string {
    switch (id) {
      case 'sp-drakeide':
        return '🐉';
      case 'sp-elfe':
        return '🏹';
      case 'sp-nain':
        return '🪓';
      case 'sp-humain':
        return '🛡️';
      case 'sp-halfelin':
        return '🍀';
      case 'sp-melesse':
        return '✨';
      case 'sp-merosi':
        return '💀';
      case 'sp-tieffelin':
        return '🔥';
      case 'sp-gnome':
        return '⚙️';
      default:
        return '👤';
    }
  }

  readonly currentCards = computed<CardOption[]>(() => {
    switch (this.currentPhase()) {
      case 'species':
        return this.allSpecies().map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: s.nameAlt.length > 0 ? s.nameAlt.join(', ') : undefined,
          desc: s.flavor.summary,
          stats: this.getCardSummary(s),
          badge: s.baseStats.size,
          icon: this.getIconForSpecies(s.id),
        }));
      case 'subspecies':
        return this.playableSubspecies().map((sub) => ({
          id: sub.id,
          title: sub.name,
          desc: sub.flavor ?? '',
          stats: this.hasSubspeciesAsi(sub)
            ? this.formatApiAsi(sub.abilityScoreIncrease)
            : undefined,
          icon: '🧬',
          badge: '—',
        }));
      case 'choice': {
        const choice = this.nextUnresolvedChoice();
        if (!choice) return [];
        return this.getChoiceOptions(choice).map((opt) => ({
          id: opt.id,
          title: opt.name,
          desc: opt.desc ?? '',
          stats: opt.damageType
            ? `${opt.damageType}${opt.areaShape ? ` · ${opt.areaShape} ${opt.areaLengthM}m` : ''}`
            : opt.note,
          icon: '✨',
          badge: '—',
        }));
      }
    }
  });

  readonly combinedAsi = computed<Partial<AbilityScores>>(() => {
    const species = this.selectedSpecies();
    const sub = this.selectedSubspecies();
    if (!species) return {};
    const baseAsi = apiAsiToPartialScores(species.baseStats.abilityScoreIncrease);
    const subAsi = sub ? apiAsiToPartialScores(sub.abilityScoreIncrease) : {};
    return mergePartialScores(baseAsi, subAsi);
  });

  readonly combinedTraits = computed<Trait[]>(() => {
    const species = this.selectedSpecies();
    const sub = this.selectedSubspecies();
    if (!species) return [];
    const traits = [...species.traits];
    if (sub?.traits) traits.push(...sub.traits);
    return traits;
  });

  readonly combinedFixedLanguages = computed<string[]>(() => {
    const species = this.selectedSpecies();
    const sub = this.selectedSubspecies();
    if (!species) return [];
    const langs = [...species.languages.fixed];
    if (sub?.languages?.fixed) langs.push(...sub.languages.fixed);
    const answers = this.choiceAnswers();
    for (const choice of this.allCreationChoices()) {
      if (choice.type === 'single_select' && Array.isArray(choice.options)) {
        const selectedIds = answers.get(choice.id);
        if (selectedIds) {
          for (const raw of choice.options) {
            const opt = raw as Record<string, unknown>;
            if (selectedIds.includes(opt['id'] as string) && opt['grants_language']) {
              langs.push(opt['grants_language'] as string);
            }
          }
        }
      }
    }
    return [...new Set(langs)];
  });

  readonly resistances = computed<string[]>(() => {
    const res: string[] = [];
    for (const trait of this.combinedTraits()) {
      const mech = trait.mechanics as any;
      if (!mech) continue;
      if (mech.damage_resistance) {
        if (Array.isArray(mech.damage_resistance)) res.push(...mech.damage_resistance);
      }
      if (mech.type === 'damage_resistance' && mech.damage_type_from === 'heritage_draconique') {
        const answers = this.choiceAnswers();
        const heritageAnswer = answers.get('choice-heritage-draconique');
        if (heritageAnswer?.[0]) {
          const species = this.selectedSpecies();
          const heritageChoice = species?.creationChoices.find(
            (c) => c.id === 'choice-heritage-draconique',
          );
          if (heritageChoice && Array.isArray(heritageChoice.options)) {
            const selectedOption = heritageChoice.options.find(
              (o: any) => o.id === heritageAnswer[0],
            );
            if (selectedOption?.damage_type) res.push(selectedOption.damage_type);
          }
        }
      }
    }
    return [...new Set(res)];
  });

  readonly selectionComplete = computed(() => {
    const species = this.selectedSpecies();
    if (!species) return false;
    if (this.requiresSubspecies() && !this.selectedSubspecies()) return false;
    const answers = this.choiceAnswers();
    for (const choice of this.actionableChoices()) {
      const answer = answers.get(choice.id);
      if (!answer || answer.length < (choice.choiceCount ?? 1)) return false;
    }
    return true;
  });

  readonly isConfirmed = computed(() => {
    const builderSpeciesId = this.builder.creation().speciesId;
    return builderSpeciesId === this.selectedSpeciesId() && builderSpeciesId !== null;
  });

  constructor() {
    effect(() => {
      const complete = this.selectionComplete();
      const confirmed = this.isConfirmed();
      if (complete && !confirmed && !this.restoringState) {
        this.confirmSelection();
        this.builder.nextStep();
      }
    });
  }

  ngOnInit(): void {
    this.loadSpecies();
    const current = this.builder.creation();
    if (current.speciesId) {
      this.selectedSpeciesId.set(current.speciesId);
      if (current.subspeciesId) this.selectedSubspeciesId.set(current.subspeciesId);
    }
    setTimeout(() => {
      this.restoringState = false;
    }, 500);
  }

  // --- MÉTHODES CARROUSEL (Boucle infinie) ---
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

  private loadSpecies(): void {
    this.loading.set(true);
    this.dataService.getSpecies().subscribe({
      next: (species) => {
        this.allSpecies.set(species);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les espèces.');
        this.loading.set(false);
      },
    });
  }

  onRightClick(event: Event, cardId: string): void {
    event.preventDefault();
    this.flippedCards.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  }

  pickCard(cardId: string): void {
    const total = this.currentCards().length;
    const targetIndex = this.currentCards().findIndex((c) => c.id === cardId);

    // On calcule la distance la plus courte pour tourner le carrousel
    if (targetIndex !== this.normalizedIndex()) {
      let diff = targetIndex - this.normalizedIndex();
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;
      this.currentIndex.update((i) => i + diff);
      return;
    }

    this.transitioning.set(true);
    setTimeout(() => {
      switch (this.currentPhase()) {
        case 'species':
          if (this.selectedSpeciesId() !== cardId) {
            this.selectedSubspeciesId.set(null);
            this.choiceAnswers.set(new Map());
            this.builder.clearSpecies();
            this.flippedCards.set(new Set());
          }
          this.selectedSpeciesId.set(cardId);
          break;
        case 'subspecies':
          if (this.selectedSubspeciesId() !== cardId) {
            const speciesChoiceIds = new Set(
              this.selectedSpecies()?.creationChoices.map((c) => c.id) ?? [],
            );
            this.choiceAnswers.update((map) => {
              const newMap = new Map(map);
              for (const key of newMap.keys()) {
                if (!speciesChoiceIds.has(key)) newMap.delete(key);
              }
              return newMap;
            });
            this.flippedCards.set(new Set());
          }
          this.selectedSubspeciesId.set(cardId);
          break;
        case 'choice': {
          const choice = this.nextUnresolvedChoice();
          if (choice) {
            this.choiceAnswers.update((map) => {
              const newMap = new Map(map);
              newMap.set(choice.id, [cardId]);
              return newMap;
            });
          }
          break;
        }
      }
      this.transitioning.set(false);
    }, 250);
  }

  clearSelection(): void {
    this.transitioning.set(true);
    setTimeout(() => {
      this.selectedSpeciesId.set(null);
      this.selectedSubspeciesId.set(null);
      this.choiceAnswers.set(new Map());
      this.builder.clearSpecies();
      this.flippedCards.set(new Set());
      this.currentIndex.set(0);
      this.transitioning.set(false);
    }, 200);
  }

  confirmSelection(): void {
    const species = this.selectedSpecies();
    if (!species || !this.selectionComplete()) return;
    const sub = this.selectedSubspecies();
    const asi = this.combinedAsi();
    const traits: FeatureInstance[] = this.combinedTraits().map((t) => ({
      refId: t.id,
      name: t.name,
      desc: t.desc,
      source: sub && sub.traits.some((st) => st.id === t.id) ? 'subspecies' : 'species',
      sourceDetail: sub && sub.traits.some((st) => st.id === t.id) ? sub.name : species.name,
      mechanics: t.mechanics,
    }));
    const bonusLangCount = this.allCreationChoices()
      .filter((c) => c.type === 'language_select')
      .reduce((sum, c) => sum + (c.choiceCount ?? 1), 0);

    const selection: SpeciesSelection = {
      speciesId: species.id,
      speciesName: species.name,
      subspeciesId: sub?.id ?? null,
      subspeciesName: sub?.name ?? null,
      racialBonuses: asi,
      traits,
      speed: species.baseStats.speedM,
      size: (species.baseStats.size ?? 'M') as Size,
      languages: this.combinedFixedLanguages(),
      bonusLanguageCount: bonusLangCount,
      resistances: this.resistances(),
      hasDarkvision: (species.baseStats.darkvisionM ?? 0) > 0,
      darkvisionRadius: species.baseStats.darkvisionM ?? 0,
    };

    this.builder.setSpecies(selection);
  }

  getCardSummary(species: Species): string {
    const parts: string[] = [];
    const asi = this.formatApiAsi(species.baseStats.abilityScoreIncrease);
    if (asi !== 'Aucun') parts.push(asi);
    parts.push(`${species.baseStats.speedM}m`);
    if (species.baseStats.darkvisionM > 0) parts.push(`Vision ${species.baseStats.darkvisionM}m`);
    return parts.join(' · ');
  }

  formatAsi(asi: Record<string, number>): string {
    return Object.entries(asi)
      .filter(([, v]) => v !== 0)
      .map(([code, value]) => {
        const label = (ABILITY_KEY_TO_LABEL as any)[code] ?? code;
        return `${label} ${value > 0 ? '+' : ''}${value}`;
      })
      .join(', ');
  }

  formatApiAsi(asi: Record<string, number> | null | undefined): string {
    if (!asi) return 'Aucun';
    return this.formatAsi(apiAsiToPartialScores(asi));
  }

  getChoiceOptions(choice: CreationChoice): ChoiceOptionView[] {
    const result: ChoiceOptionView[] = [];
    if (Array.isArray(choice.options)) {
      for (const raw of choice.options) {
        const opt = raw as Record<string, unknown>;
        result.push({
          id: opt['id'] as string,
          name: opt['name'] as string,
          desc: (opt['desc'] as string) ?? undefined,
          note: (opt['note'] as string) ?? undefined,
          damageType: (opt['damage_type'] as string) ?? undefined,
          areaShape: (opt['area'] as Record<string, unknown>)?.['shape'] as string | undefined,
          areaLengthM: (opt['area'] as Record<string, unknown>)?.['length_m'] as number | undefined,
          group: undefined,
        });
      }
    }
    return result;
  }

  hasSubspeciesAsi(sub: Subspecies): boolean {
    return !!sub.abilityScoreIncrease && Object.keys(sub.abilityScoreIncrease).length > 0;
  }

  // --- Fonction pour décaler visuellement les cartes à l'infini ---
  getWrapOffset(index: number): string {
    const total = this.currentCards().length;
    if (total === 0) return '0px';

    // On calcule combien de fois la carte doit "faire le tour"
    const wraps = Math.floor((this.currentIndex() - index + total / 2) / total);
    // 256px (largeur carte w-64) + 32px (gap-8) = 288px
    return `${wraps * total * 288}px`;
  }
}
