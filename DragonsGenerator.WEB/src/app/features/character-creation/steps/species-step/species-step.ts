// features/character-creation/steps/species-step/species-step.ts

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import type { LanguageSummary } from '@core/models/Languages/language-summary';

import { CommonModule } from '@angular/common';
import { DataService } from '@core/services/data.service';
import {
  CharacterBuilderService,
  SpeciesSelection,
} from '@core/services/character-builder.service';
import type { Species, Subspecies, Trait, CreationChoice } from '@core/models/Species/species';
import type { FeatureInstance, Size } from '@core/models/Character/character';
import { apiAsiToPartialScores, mergePartialScores, apiCodeToAbilityKey } from '@core/utils/ability-mapping';
import { ABILITY_KEY_TO_LABEL, ABILITY_IMPACT_DESC, type AbilityScores } from '@core/models/Character/character';

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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: {
    class: 'flex flex-1 flex-col min-h-0 w-full',
  },
})
export class SpeciesStep implements OnInit {
  private dataService = inject(DataService);
  readonly builder = inject(CharacterBuilderService);

  /** Carousel card width + gap (keep in sync with species-step.html). */
  readonly cardWidthPx = 320;
  readonly cardGapPx = 32;
  readonly cardStridePx = 352; // 320 + 32

  readonly allSpecies = signal<Species[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedSpeciesId = signal<string | null>(null);
  readonly selectedSubspeciesId = signal<string | null>(null);
  readonly choiceAnswers = signal<Map<string, string[]>>(new Map());
  readonly languageIdToName = signal<Map<string, string>>(new Map());

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
  /** Figé la phase pendant l'auto-avance (évite le flash retour aux peuples). */
  private readonly holdPhase = signal<Phase | null>(null);

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
    return this.allCreationChoices().filter((c) => this.isCardSelectableChoice(c));
  });

  readonly nextUnresolvedChoice = computed<CreationChoice | null>(() => {
    const answers = this.choiceAnswers();
    for (const choice of this.actionableChoices()) {
      const answer = answers.get(choice.id);
      const need = choice.choiceCount ?? 1;
      if (!answer || answer.length < need) return choice;
    }
    return null;
  });

  /** Progression du choix multi (ex. 1/2 caractéristiques). */
  readonly choiceProgressLabel = computed<string>(() => {
    const choice = this.nextUnresolvedChoice();
    if (!choice) return '';
    const need = choice.choiceCount ?? 1;
    if (need <= 1) return '';
    const have = this.choiceAnswers().get(choice.id)?.length ?? 0;
    return `${have} / ${need}`;
  });

  readonly currentPhase = computed<Phase>(() => {
    const held = this.holdPhase();
    if (held) return held;

    if (!this.selectedSpeciesId()) return 'species';
    if (this.requiresSubspecies() && !this.selectedSubspeciesId()) return 'subspecies';
    if (this.nextUnresolvedChoice()) return 'choice';
    // Selection finished — stay on species overview so Continuer / Changer work.
    return 'species';
  });

  readonly phaseTitle = computed<string>(() => {
    switch (this.currentPhase()) {
      case 'species':
        return 'Choisissez votre peuple';
      case 'subspecies':
        return `Choisissez votre lignée`;
      case 'choice':
        return (
          this.nextUnresolvedChoice()?.name ??
          this.lastActionableChoice()?.name ??
          'Faites votre choix'
        );
    }
  });

  readonly phaseSubtitle = computed<string>(() => {
    switch (this.currentPhase()) {
      case 'species':
        return "Faites défiler les peuples d'Eana et forgez votre destin.";
      case 'subspecies':
        return `${this.selectedSpecies()?.name} — sous-espèce`;
      case 'choice':
        return (
          this.nextUnresolvedChoice()?.desc ?? this.lastActionableChoice()?.desc ?? ''
        );
    }
  });

  // Modification ici pour renvoyer les codes Iconify
  getIconForSpecies(id: string): string {
    switch (id) {
      case 'sp-drakeide':
        return 'fluent-emoji:dragon-face';
      case 'sp-elfe':
        return 'fluent-emoji:bow-and-arrow';
      case 'sp-nain':
        return 'fluent-emoji:axe';
      case 'sp-humain':
        return 'fluent-emoji:shield';
      case 'sp-halfelin':
        return 'fluent-emoji:four-leaf-clover';
      case 'sp-melesse':
        return 'fluent-emoji:sparkles';
      case 'sp-merosi':
        return 'fluent-emoji:skull';
      case 'sp-tieffelin':
        return 'fluent-emoji:fire';
      case 'sp-gnome':
        return 'fluent-emoji:gear';
      default:
        return 'fluent-emoji:bust-in-silhouette';
    }
  }

  readonly currentCards = computed<CardOption[]>(() => {
    switch (this.currentPhase()) {
      case 'species':
        return this.allSpecies().map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: s.nameAlt.length > 0 ? s.nameAlt.join(', ') : undefined,
          desc: this.buildSpeciesCardDesc(s),
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
          icon: 'fluent-emoji:dna', // Modification Iconify
          badge: '—',
        }));
      case 'choice': {
        // Pendant holdPhase / sélection complète : garder la dernière carte visible
        const choice =
          this.nextUnresolvedChoice() ??
          this.lastActionableChoice();
        if (!choice) return [];
        const picked = new Set(this.choiceAnswers().get(choice.id) ?? []);
        return this.getChoiceOptions(choice).map((opt) => ({
          id: opt.id,
          title: opt.name,
          desc: opt.desc ?? choice.desc ?? '',
          stats: picked.has(opt.id)
            ? '✓ Sélectionné'
            : opt.damageType
              ? `${opt.damageType}${opt.areaShape ? ` · ${opt.areaShape} ${opt.areaLengthM}m` : ''}`
              : opt.note,
          icon: this.iconForChoiceOption(choice, opt.id),
          badge: picked.has(opt.id) ? 'OK' : '—',
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
    const choiceAsi = this.asiFromChoiceAnswers();
    return mergePartialScores(baseAsi, subAsi, choiceAsi);
  });

  /** Bonus issus des choix ability_score_increase (ex. Melesse +1/+1). */
  private asiFromChoiceAnswers(): Partial<AbilityScores> {
    const answers = this.choiceAnswers();
    const result: Partial<AbilityScores> = {};
    for (const choice of this.allCreationChoices()) {
      if (choice.type !== 'ability_score_increase') continue;
      const picks = answers.get(choice.id) ?? [];
      const value = choice.valuePerChoice ?? 1;
      for (const code of picks) {
        const key = apiCodeToAbilityKey(code);
        if (!key) continue;
        result[key] = (result[key] ?? 0) + value;
      }
    }
    return result;
  }

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

    const langMap = this.languageIdToName();
    const resolve = (s: string) => langMap.get(s) ?? s;

    // 1. Langues fixes de l'espèce (IDs dans le JSON → résoudre en noms)
    const langs = species.languages.fixed.map(resolve);
    if (sub?.languages?.fixed) langs.push(...sub.languages.fixed.map(resolve));

    // 2. Langues issues des creation choices
    const answers = this.choiceAnswers();
    for (const choice of this.allCreationChoices()) {
      if (choice.type === 'single_select' && Array.isArray(choice.options)) {
        const selectedIds = answers.get(choice.id);
        if (!selectedIds) continue;

        for (const raw of choice.options) {
          const opt = raw as Record<string, unknown>;
          const optId = opt['id'] as string;

          if (!selectedIds.includes(optId)) continue;

          // Cas 1 : l'option a un grants_language explicite
          if (opt['grants_language']) {
            langs.push(resolve(opt['grants_language'] as string));
          }
          // Cas 2 : l'option EST une langue (id commence par "lg-")
          else if (optId?.startsWith('lg-')) {
            langs.push((opt['name'] as string) ?? resolve(optId));
          }
        }
      }
    }

    return [...new Set(langs)];
  });

  readonly resistances = computed<string[]>(() => {
    const res: string[] = [];
    const answers = this.choiceAnswers();
    const lineageId =
      answers.get('choice-lignee-draconique')?.[0] ??
      answers.get('choice-heritage-draconique')?.[0];

    for (const trait of this.combinedTraits()) {
      const mech = trait.mechanics as Record<string, unknown> | undefined;
      if (!mech) continue;

      if (mech['damage_resistance']) {
        const dr = mech['damage_resistance'];
        if (Array.isArray(dr)) {
          for (const item of dr) {
            if (item === 'damage-from-lineage' || item === 'damage_from_lineage') {
              const dmg = this.resolveLineageDamageType(lineageId);
              if (dmg) res.push(dmg);
            } else if (typeof item === 'string') {
              res.push(item);
            }
          }
        }
      }

      if (Array.isArray(mech['resistances'])) {
        for (const item of mech['resistances'] as unknown[]) {
          if (item === 'damage-from-lineage' || item === 'damage_from_lineage') {
            const dmg = this.resolveLineageDamageType(lineageId);
            if (dmg) res.push(dmg);
          } else if (typeof item === 'string') {
            res.push(item);
          }
        }
      }

      if (mech['type'] === 'damage_resistance' && mech['damage_type_from'] === 'heritage_draconique') {
        const dmg = this.resolveLineageDamageType(lineageId);
        if (dmg) res.push(dmg);
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

  /** Finished local picks and ready to leave the step (or already saved). */
  readonly canContinue = computed(
    () => this.selectionComplete() && this.selectedSpeciesId() !== null,
  );

  ngOnInit(): void {
    this.loading.set(true);

    forkJoin({
      species: this.dataService.getSpecies(),
      languages: this.dataService.getLanguagesSummary(),
    }).subscribe({
      next: ({ species, languages }) => {
        this.allSpecies.set(species);

        const map = new Map<string, string>();
        languages.forEach((l) => map.set(l.id, l.name));
        this.languageIdToName.set(map);

        this.restoreFromBuilder();
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les données.');
        this.loading.set(false);
      },
    });
  }

  private restoreFromBuilder(): void {
    const current = this.builder.creation();
    if (!current.speciesId) return;

    this.selectedSpeciesId.set(current.speciesId);
    if (current.subspeciesId) this.selectedSubspeciesId.set(current.subspeciesId);

    const saved = current.speciesChoiceAnswers ?? {};
    const map = new Map<string, string[]>();
    for (const [k, v] of Object.entries(saved)) {
      if (Array.isArray(v) && v.length > 0) map.set(k, v);
    }
    this.choiceAnswers.set(map);

    // Center carousel on the saved species when overview is shown
    const idx = this.allSpecies().findIndex((s) => s.id === current.speciesId);
    if (idx >= 0) this.currentIndex.set(idx);
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

    if (targetIndex !== this.normalizedIndex()) {
      let diff = targetIndex - this.normalizedIndex();
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;
      this.currentIndex.update((i) => i + diff);
      return;
    }

    // Center card then (re)select — always re-run subspecies / lineage picks.
    const phaseBefore = this.currentPhase();

    this.transitioning.set(true);
    setTimeout(() => {
      switch (phaseBefore) {
        case 'species':
          // Re-picking the same species must also reset lineage / choices.
          this.selectedSubspeciesId.set(null);
          this.choiceAnswers.set(new Map());
          this.builder.clearSpecies();
          this.flippedCards.set(new Set());
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
            const need = choice.choiceCount ?? 1;
            this.choiceAnswers.update((map) => {
              const newMap = new Map(map);
              const prev = [...(newMap.get(choice.id) ?? [])];
              const idx = prev.indexOf(cardId);
              if (idx >= 0) {
                // Toggle off
                prev.splice(idx, 1);
              } else if (need <= 1) {
                newMap.set(choice.id, [cardId]);
                return newMap;
              } else if (prev.length < need) {
                prev.push(cardId);
              } else {
                // Remplace le plus ancien si plein
                prev.shift();
                prev.push(cardId);
              }
              newMap.set(choice.id, prev);
              return newMap;
            });
          }
          break;
        }
      }

      this.flippedCards.set(new Set());
      this.transitioning.set(false);

      if (this.selectionComplete()) {
        // Figé la phase actuelle avant confirm → évite le rollback visuel vers les peuples
        this.holdPhase.set(phaseBefore);
        this.confirmSelection();
        setTimeout(() => this.builder.nextStep(), 120);
      } else if (phaseBefore !== this.currentPhase()) {
        this.currentIndex.set(0);
      }
    }, 200);
  }

  clearSelection(): void {
    this.transitioning.set(true);
    setTimeout(() => {
      this.holdPhase.set(null);
      this.selectedSpeciesId.set(null);
      this.selectedSubspeciesId.set(null);
      this.choiceAnswers.set(new Map());
      this.builder.clearSpecies();
      this.flippedCards.set(new Set());
      this.currentIndex.set(0);
      this.transitioning.set(false);
    }, 200);
  }

  continueToNextStep(): void {
    if (!this.selectionComplete()) return;
    this.holdPhase.set(this.currentPhase());
    this.confirmSelection();
    this.builder.nextStep();
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
      .filter((c) => this.isOpenLanguageChoice(c))
      .reduce((sum, c) => sum + (c.choiceCount ?? 1), 0);

    const bonusSkillCount = this.allCreationChoices()
      .filter((c) => this.isDeferredSkillChoice(c))
      .reduce((sum, c) => sum + (c.choiceCount ?? 1), 0);

    const bonusToolCount = this.allCreationChoices()
      .filter((c) => this.isDeferredToolChoice(c))
      .reduce((sum, c) => sum + (c.choiceCount ?? 1), 0);

    const choiceAnswers: Record<string, string[]> = {};
    for (const [k, v] of this.choiceAnswers()) {
      choiceAnswers[k] = v;
    }

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
      bonusSkillCount,
      bonusToolCount,
      resistances: this.resistances(),
      hasDarkvision: (species.baseStats.darkvisionM ?? 0) > 0,
      darkvisionRadius: species.baseStats.darkvisionM ?? 0,
      choiceAnswers,
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
    const rawOptions = this.rawChoiceOptions(choice);
    const perPick =
      choice.type === 'ability_score_increase' ? `+${choice.valuePerChoice ?? 1}` : undefined;

    for (const raw of rawOptions) {
      if (typeof raw === 'string') {
        if (raw === 'any') continue;
        const abilityKey = apiCodeToAbilityKey(raw);
        const impact = abilityKey ? ABILITY_IMPACT_DESC[abilityKey] : undefined;
        const bump = perPick
          ? `Augmente de ${perPick.replace('+', '')}.`
          : undefined;
        result.push({
          id: raw,
          name: this.prettyOptionId(raw),
          desc: [bump, impact].filter(Boolean).join('\n\n') || undefined,
          note: perPick,
        });
        continue;
      }

      const opt = raw as Record<string, unknown>;
      const area =
        (opt['breath_area'] as Record<string, unknown> | undefined) ??
        (opt['area'] as Record<string, unknown> | undefined);

      result.push({
        id: opt['id'] as string,
        name: (opt['name'] as string) ?? this.prettyOptionId(String(opt['id'] ?? '')),
        desc: (opt['desc'] as string) ?? (opt['lore_note'] as string) ?? undefined,
        note: (opt['note'] as string) ?? perPick,
        damageType: (opt['damage_type'] as string) ?? undefined,
        areaShape: area?.['shape'] as string | undefined,
        areaLengthM: area?.['length_m'] as number | undefined,
        group: undefined,
      });
    }
    return result.filter((o) => !!o.id);
  }

  hasSubspeciesAsi(sub: Subspecies): boolean {
    return !!sub.abilityScoreIncrease && Object.keys(sub.abilityScoreIncrease).length > 0;
  }

  /** Card-pickable creation choices (not free-form "any language/skill"). */
  private isCardSelectableChoice(choice: CreationChoice): boolean {
    if (this.isOpenLanguageChoice(choice)) return false;
    if (this.isDeferredSkillChoice(choice)) return false;
    if (this.isDeferredToolChoice(choice)) return false;
    const opts = this.rawChoiceOptions(choice);
    if (opts.length === 0) return false;
    // Pool "any" seul → rien à afficher en cartes
    if (opts.every((o) => o === 'any')) return false;
    return true;
  }

  /** Dernier choix carte (pour garder l'UI pendant holdPhase). */
  private lastActionableChoice(): CreationChoice | null {
    const all = this.actionableChoices();
    return all.length > 0 ? all[all.length - 1]! : null;
  }

  /** Language picks deferred to the languages step (pool includes "any"). */
  private isOpenLanguageChoice(choice: CreationChoice): boolean {
    if (choice.type !== 'language' && choice.type !== 'language_select') return false;
    const opts = this.rawChoiceOptions(choice);
    return opts.length === 0 || opts.some((o) => o === 'any');
  }

  /** Compétences « any » (Polyvalence Melesse) → étape Savoirs. */
  private isDeferredSkillChoice(choice: CreationChoice): boolean {
    if (choice.type !== 'skill_proficiency' && choice.type !== 'skill') return false;
    const opts = this.rawChoiceOptions(choice);
    return opts.length === 0 || opts.some((o) => o === 'any');
  }

  /** Outils Polyvalence → étape Savoirs (catalogue concret). */
  private isDeferredToolChoice(choice: CreationChoice): boolean {
    return choice.type === 'tool_proficiency' || choice.type === 'tool';
  }

  private rawChoiceOptions(choice: CreationChoice): unknown[] {
    const opts = choice.options as unknown;
    if (Array.isArray(opts)) return opts;
    // JsonElement parfois sérialisé en objet { valueKind, ... } — rare
    return [];
  }

  private prettyOptionId(id: string): string {
    const ability = apiCodeToAbilityKey(id);
    if (ability) return ABILITY_KEY_TO_LABEL[ability];
    return id
      .replace(/^(tl|lg|drag|gen)-/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private iconForChoiceOption(choice: CreationChoice, optId: string): string {
    if (choice.type === 'ability_score_increase') {
      const icons: Record<string, string> = {
        str: 'fluent-emoji:flexed-biceps',
        dex: 'fluent-emoji:person-running',
        con: 'fluent-emoji:anatomical-heart',
        int: 'fluent-emoji:brain',
        wis: 'fluent-emoji:owl',
        cha: 'fluent-emoji:sparkles',
      };
      return icons[optId] ?? 'fluent-emoji:glowing-star';
    }
    return 'fluent-emoji:sparkles';
  }

  /** Texte verso de la carte espèce : résumé + traits / choix différés. */
  private buildSpeciesCardDesc(species: Species): string {
    const parts: string[] = [species.flavor.summary];
    if (species.traits.length) {
      parts.push(
        '\n\nTraits : ' +
          species.traits
            .map((t) => `${t.name} — ${t.desc}`)
            .join('\n\n'),
      );
    }
    const deferred = species.creationChoices.filter(
      (c) =>
        this.isDeferredSkillChoice(c) ||
        this.isDeferredToolChoice(c) ||
        this.isOpenLanguageChoice(c),
    );
    if (deferred.length) {
      parts.push(
        '\n\nÀ choisir plus loin : ' +
          deferred.map((c) => `${c.name} (${c.choiceCount ?? 1})`).join(', ') +
          '.',
      );
    }
    const asiChoices = species.creationChoices.filter((c) => c.type === 'ability_score_increase');
    if (asiChoices.length) {
      parts.push(
        '\n\n' +
          asiChoices
            .map((c) => `${c.name} : ${c.desc}`)
            .join('\n'),
      );
    }
    return parts.join('');
  }

  private resolveLineageDamageType(lineageOptionId: string | undefined): string | null {
    if (!lineageOptionId) return null;
    const species = this.selectedSpecies();
    const choice = species?.creationChoices.find(
      (c) => c.id === 'choice-lignee-draconique' || c.id === 'choice-heritage-draconique',
    );
    if (!choice) return null;
    for (const raw of this.rawChoiceOptions(choice)) {
      if (typeof raw !== 'object' || !raw) continue;
      const opt = raw as Record<string, unknown>;
      if (opt['id'] === lineageOptionId && typeof opt['damage_type'] === 'string') {
        return opt['damage_type'];
      }
    }
    return null;
  }

  // --- Fonction pour décaler visuellement les cartes à l'infini ---
  getWrapOffset(index: number): string {
    const total = this.currentCards().length;
    if (total === 0) return '0px';

    const wraps = Math.floor((this.currentIndex() - index + total / 2) / total);
    return `${wraps * total * this.cardStridePx}px`;
  }
}
