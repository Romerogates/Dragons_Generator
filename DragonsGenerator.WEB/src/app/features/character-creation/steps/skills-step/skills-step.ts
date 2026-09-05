// features/character-creation/steps/skills-step/skills-step.ts

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService } from '../../../../core/services/character-builder.service';
import { type AbilityKey, EquipmentSlot } from '../../../../core/models/Character/character';
import {
  buildSkillMap,
  normalizeSkillId,
  prettifySkillId,
  resolveSkillInfo,
  type SkillInfo,
} from '@core/utils/skill.utils';
import { labelForGameId } from '@core/utils/game-id-labels';
import { resolveEquipmentRefId } from '@core/utils/equipment.utils';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Equipment } from '@core/models/Equipments/equipment';
import type { BackgroundToolRef, BackgroundSkillChoice } from '@core/models/Backgrounds/background';
import {
  extractExpertiseChoices,
  extractWeaponProficiencyChoices,
  extractToolProficiencyChoices,
  extractSubclassSkillProficiencyChoices,
  subclassBonusProficiencies,
  type SubclassSkillChoicePool,
} from '@core/utils/progression-choices.util';

export type { SkillInfo };

// ============================================================================
// TYPES
// ============================================================================

interface ToolCatalogEntry {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
}

interface ToolCatalogGroup {
  label: string;
  icon: string;
  items: ToolCatalogEntry[];
}

interface BgToolChoiceOption {
  key: string;
  label: string;
  category: string | null;
  selected: boolean;
}

interface BgToolChoiceGroup {
  groupIndex: number;
  chooseCount: number;
  note?: string;
  options: BgToolChoiceOption[];
}

/** Groupe `tools.choose` tel que renvoyé par l’API (camelCase ou snake_case). */
interface BgToolChooseGroupRaw {
  chooseCount?: number;
  choose_count?: number;
  count?: number;
  note?: string;
  options?: unknown[];
  category_options?: unknown[];
  categoryOptions?: unknown[];
}

/** Option d’outil brute avant `normalizeToolOption`. */
type RawToolOption =
  | string
  | BackgroundToolRef
  | {
      type?: string;
      id?: string;
      any?: boolean;
      category?: string;
    };

@Component({
  selector: 'app-skills-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './skills-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SkillsStep implements OnInit {
  readonly builder = inject(CharacterBuilderService);

  private readonly dataService = inject(DataService);

  readonly skillMap = signal<Record<string, SkillInfo>>({});
  readonly toolCatalog = signal<ToolCatalogEntry[]>([]);
  readonly weaponCatalog = signal<{ id: string; name: string; costPo: number }[]>([]);

  // === ÉTATS LOCAUX ===
  readonly selectedClassSkills = signal<string[]>([]);
  readonly selectedBgSkills = signal<string[]>([]);
  readonly selectedBgTools = signal<string[]>([]);
  /** Compétences d'espèce (Polyvalence, etc.). */
  readonly selectedSpeciesSkills = signal<string[]>([]);
  /** Outils d'espèce. */
  readonly selectedSpeciesTools = signal<string[]>([]);
  /** Catégorie d'outil d'historique en cours d'expansion (instrument / gameSet…). */
  readonly expandedBgToolCategory = signal<string | null>(null);
  /** Compétences choisies pour l'expertise (roublard / barde / lettré). */
  readonly selectedExpertise = signal<string[]>([]);
  /** Armes/outils de classe différés (ex. Lettré). */
  readonly classWeaponAnswers = signal<Map<string, string[]>>(new Map());
  readonly classToolAnswers = signal<Map<string, string[]>>(new Map());
  /** Choix imbriqués de sous-classe (skill_proficiency / skill_or_tool_proficiency). */
  readonly subclassSkillChoiceAnswers = signal<Map<string, string[]>>(new Map());
  readonly classJson = signal<CharacterClass | null>(null);
  /** Compétences choisies au titre des maîtrises réduites de multiclassage (Barde/Rôdeur/Roublard...). */
  readonly selectedSecondaryClassSkills = signal<string[]>([]);

  // Pour les historiques personnalisés
  readonly customSkillInput = signal<string>('');

  ngOnInit(): void {
    const c = this.builder.creation();
    const classCount = c.skillChooseCount || 0;
    const speciesSkillCount = c.speciesBonusSkillCount || 0;
    const allSkills = (c.selectedSkills ?? []).map(normalizeSkillId);
    // Confirm order: [...classSkills, ...speciesSkills]
    if (speciesSkillCount > 0 && allSkills.length > classCount) {
      this.selectedClassSkills.set(allSkills.slice(0, classCount));
      this.selectedSpeciesSkills.set(allSkills.slice(classCount, classCount + speciesSkillCount));
    } else {
      this.selectedClassSkills.set(allSkills);
      this.selectedSpeciesSkills.set([]);
    }

    this.selectedBgSkills.set([...c.backgroundSkills]);
    const speciesToolCount = c.speciesBonusToolCount || 0;
    const allTools = [...(c.backgroundTools ?? [])];
    // Confirm order: [...bgTools, ...speciesTools]
    if (speciesToolCount > 0 && allTools.length >= speciesToolCount) {
      this.selectedBgTools.set(allTools.slice(0, allTools.length - speciesToolCount));
      this.selectedSpeciesTools.set(allTools.slice(-speciesToolCount));
    } else {
      this.selectedBgTools.set(allTools);
      this.selectedSpeciesTools.set([]);
    }
    this.selectedExpertise.set([...(c.expertiseSkills ?? [])]);
    const weaponMap = new Map<string, string[]>();
    const toolMap = new Map<string, string[]>();
    for (const [k, v] of Object.entries(c.classChoiceAnswers ?? {})) {
      if (!Array.isArray(v) || !v.length) continue;
      if (k.includes('weapons') || k.includes('weapon')) weaponMap.set(k, v);
      else if (k.includes('tools') || k.includes('tool')) toolMap.set(k, v);
    }
    this.classWeaponAnswers.set(weaponMap);
    this.classToolAnswers.set(toolMap);
    this.selectedSecondaryClassSkills.set([...(c.secondaryClassSelectedSkills ?? [])]);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.dataService.getSkills().subscribe({
      next: (skills) => this.skillMap.set(buildSkillMap(skills)),
    });

    if (c.classId) {
      this.dataService.getClassById(c.classId).subscribe({
        next: (cls) => {
          this.classJson.set(cls);
          // Retire les compétences/expertises fixes de sous-classe des listes restaurées
          // (elles sont ré-appliquées automatiquement à la confirmation, pas un choix).
          const fixedSkills = new Set(this.subclassFixedSkills());
          if (fixedSkills.size) {
            this.selectedClassSkills.update((arr) => arr.filter((id) => !fixedSkills.has(normalizeSkillId(id))));
            this.selectedSpeciesSkills.update((arr) => arr.filter((id) => !fixedSkills.has(normalizeSkillId(id))));
          }
          const fixedExpertise = new Set(this.subclassFixedExpertise());
          if (fixedExpertise.size) {
            this.selectedExpertise.update((arr) => arr.filter((id) => !fixedExpertise.has(normalizeSkillId(id))));
          }
          // Restaure les choix imbriqués de sous-classe (ex. Rôdeur Ombre urbaine, Lettré, Paladin Corbeau)
          const nestedMap = new Map<string, string[]>();
          for (const pool of this.subclassSkillChoicePools()) {
            const saved = (c.classChoiceAnswers ?? {})[pool.id];
            if (Array.isArray(saved) && saved.length) nestedMap.set(pool.id, [...saved]);
          }
          this.subclassSkillChoiceAnswers.set(nestedMap);
        },
      });
    }

    this.dataService.getEquipments().subscribe({
      next: (items: Equipment[]) => {
        this.toolCatalog.set(
          items
            .filter((e) => {
              const t = String(e.type ?? '').toUpperCase();
              return t === 'TOOL' || t === 'VEHICLE';
            })
            .map((e) => ({
              id: e.id,
              name: e.name,
              type: String(e.type ?? '').toUpperCase(),
              subtype: e.subtype ? String(e.subtype).toLowerCase() : null,
            })),
        );
        this.weaponCatalog.set(
          items
            .filter((e) => String(e.type ?? '').toUpperCase() === 'WEAPON')
            .map((e) => ({
              id: e.id,
              name: e.name,
              costPo: Number(e.cost?.v ?? 0) || 0,
            })),
        );
      },
    });
  }

  // === COMPÉTENCES DE CLASSE ===
  readonly classSkillChooseCount = computed(() => this.builder.creation().skillChooseCount || 0);

  readonly classSkillOptions = computed(() => {
    const options = this.builder.creation().skillOptions;
    if (
      !options ||
      options.length === 0 ||
      options.some((o) => o === 'any' || o === 'any-skills')
    ) {
      return Object.values(this.skillMap());
    }
    return options
      .map((id) => resolveSkillInfo(id, this.skillMap()))
      .filter((s): s is SkillInfo => !!s);
  });

  readonly classSkillsRemaining = computed(() =>
    Math.max(0, this.classSkillChooseCount() - this.selectedClassSkills().length),
  );

  toggleClassSkill(skillId: string): void {
    const id = normalizeSkillId(skillId);
    const current = this.selectedClassSkills().map(normalizeSkillId);
    if (current.includes(id)) {
      this.selectedClassSkills.update((arr) => arr.filter((x) => normalizeSkillId(x) !== id));
    } else if (
      current.length < this.classSkillChooseCount() &&
      !this.selectedBgSkills().map(normalizeSkillId).includes(id) &&
      !this.selectedSpeciesSkills().map(normalizeSkillId).includes(id)
    ) {
      this.selectedClassSkills.update((arr) => [...arr, id]);
    }
  }

  // === COMPÉTENCES DE MULTICLASSAGE (maîtrises RÉDUITES, ex. Barde/Rôdeur/Roublard +1) ===
  readonly secondaryClassSkillChooseCount = computed(() =>
    this.builder.secondaryClasses().reduce((sum, sc) => sum + (sc.skillChooseCount || 0), 0),
  );

  readonly secondaryClassSkillOptions = computed(() => {
    const secondaries = this.builder.secondaryClasses();
    if (secondaries.some((sc) => sc.skillOptions.includes('any'))) {
      return Object.values(this.skillMap());
    }
    const ids = new Set(secondaries.flatMap((sc) => sc.skillOptions));
    return [...ids].map((id) => resolveSkillInfo(id, this.skillMap())).filter((s): s is SkillInfo => !!s);
  });

  readonly secondaryClassSkillsRemaining = computed(() =>
    Math.max(0, this.secondaryClassSkillChooseCount() - this.selectedSecondaryClassSkills().length),
  );

  toggleSecondaryClassSkill(skillId: string): void {
    const id = normalizeSkillId(skillId);
    const current = this.selectedSecondaryClassSkills().map(normalizeSkillId);
    if (current.includes(id)) {
      this.selectedSecondaryClassSkills.update((arr) => arr.filter((x) => normalizeSkillId(x) !== id));
    } else if (
      current.length < this.secondaryClassSkillChooseCount() &&
      !this.selectedClassSkills().map(normalizeSkillId).includes(id) &&
      !this.selectedBgSkills().map(normalizeSkillId).includes(id) &&
      !this.selectedSpeciesSkills().map(normalizeSkillId).includes(id)
    ) {
      this.selectedSecondaryClassSkills.update((arr) => [...arr, id]);
    }
  }

  /** Bonus fixes (armure/armes/compétences/expertise/outils/langues) accordés par le domaine/sous-classe. */
  readonly subclassBonus = computed(() => {
    const cls = this.classJson();
    if (!cls) {
      return {
        armor: [] as string[],
        weapons: [] as string[],
        skills: [] as string[],
        expertise: [] as string[],
        tools: [] as string[],
        languages: [] as string[],
        savingThrows: [] as string[],
        bonusLanguages: 0,
        requiredExoticLanguages: 0,
        conditionalSkills: [] as string[],
      };
    }
    return subclassBonusProficiencies(
      cls,
      this.builder.creation().subclassId,
      this.builder.targetLevel(),
    );
  });

  /** Compétences déjà connues avant application des bonus fixes de sous-classe (pour la logique « déjà maîtrisé »). */
  private readonly knownSkillsBeforeSubclassBonus = computed(() => {
    const conditional = new Set(this.subclassBonus().conditionalSkills.map(normalizeSkillId));
    return new Set(
      [...this.selectedClassSkills(), ...this.selectedBgSkills(), ...this.selectedSpeciesSkills()]
        .map(normalizeSkillId)
        .filter((id) => !conditional.has(id)),
    );
  });

  /** Compétences accordées automatiquement par le domaine/sous-classe (non un choix). */
  readonly subclassFixedSkills = computed(() => {
    const bonus = this.subclassBonus();
    const conditional = new Set(bonus.conditionalSkills.map(normalizeSkillId));
    const known = this.knownSkillsBeforeSubclassBonus();
    return bonus.skills
      .map(normalizeSkillId)
      .filter((id) => !(conditional.has(id) && known.has(id)));
  });

  /** Expertise accordée automatiquement par le domaine/sous-classe (non un choix). */
  readonly subclassFixedExpertise = computed(() => {
    const bonus = this.subclassBonus();
    const conditional = new Set(bonus.conditionalSkills.map(normalizeSkillId));
    const known = this.knownSkillsBeforeSubclassBonus();
    const fromConditional = bonus.skills.map(normalizeSkillId).filter((id) => conditional.has(id) && known.has(id));
    return [...new Set([...bonus.expertise.map(normalizeSkillId), ...fromConditional])];
  });

  /** Choix de compétences/outils imbriqués dans une feature de sous-classe (Rôdeur Ombre urbaine, Lettré…). */
  readonly subclassSkillChoicePools = computed<SubclassSkillChoicePool[]>(() => {
    const cls = this.classJson();
    if (!cls) return [];
    const pools = extractSubclassSkillProficiencyChoices(
      cls,
      this.builder.targetLevel(),
      this.builder.creation().subclassId,
    );
    // Pool ouvert (ex. Barde Conteurs "Maîtrises supplémentaires") : `poolIds` arrive vide du
    // util pur (pas d'accès au catalogue) ; on l'étend ici vers toutes les compétences connues.
    const allSkillIds = Object.keys(this.skillMap());
    return pools.map((p) => (p.isOpenPool ? { ...p, poolIds: allSkillIds } : p));
  });

  readonly subclassSkillChoiceNeeded = computed(() =>
    this.subclassSkillChoicePools().reduce((sum, p) => sum + p.count, 0),
  );

  readonly subclassSkillChoicePicked = computed(() =>
    [...this.subclassSkillChoiceAnswers().values()].reduce((sum, ids) => sum + ids.length, 0),
  );

  readonly subclassSkillChoiceRemaining = computed(() =>
    Math.max(0, this.subclassSkillChoiceNeeded() - this.subclassSkillChoicePicked()),
  );

  /** Libellé lisible pour une option de pool imbriqué (compétence ou outil). */
  subclassChoiceOptionLabel(id: string): string {
    return id.startsWith('tl-') ? this.getToolName(id) : this.prettifySkill(id);
  }

  isSubclassSkillChoiceOptionSelected(poolId: string, optionId: string): boolean {
    return (this.subclassSkillChoiceAnswers().get(poolId) ?? []).includes(optionId);
  }

  toggleSubclassSkillChoiceOption(poolId: string, optionId: string): void {
    const pool = this.subclassSkillChoicePools().find((p) => p.id === poolId);
    if (!pool) return;
    this.subclassSkillChoiceAnswers.update((map) => {
      const next = new Map(map);
      const prev = [...(next.get(poolId) ?? [])];
      const idx = prev.indexOf(optionId);
      if (idx >= 0) {
        prev.splice(idx, 1);
      } else if (prev.length < pool.count) {
        prev.push(optionId);
      }
      next.set(poolId, prev);
      return next;
    });
  }

  // === COMPÉTENCES D'HISTORIQUE ===
  readonly bgProf = computed(() => this.builder.creation().backgroundProficiencies);
  readonly isCustomBg = computed(() => this.builder.creation().backgroundPreset === false);

  readonly bgSkillChooseCount = computed(() => {
    const skills = this.bgProf()?.skills as
      | (BackgroundSkillChoice & { choose_count?: number })
      | undefined;
    const fromProf = skills?.chooseCount ?? skills?.choose_count;
    if (this.isCustomBg()) return fromProf ?? 2;
    return fromProf ?? 0;
  });

  readonly bgFixedSkills = computed(() => {
    const fixed = this.bgProf()?.skills?.fixed ?? [];
    return (fixed as string[]).map(normalizeSkillId);
  });

  readonly bgSkillOptions = computed(() => {
    if (this.isCustomBg()) return Object.values(this.skillMap());
    const fixed = new Set(this.bgFixedSkills());
    const opts = this.bgProf()?.skills?.options;
    let list: SkillInfo[];
    if (!opts || opts === 'any' || (Array.isArray(opts) && opts.includes('any'))) {
      list = Object.values(this.skillMap());
    } else {
      list = (opts as string[])
        .map((id: string) => resolveSkillInfo(id, this.skillMap()))
        .filter((s: SkillInfo | undefined): s is SkillInfo => !!s);
    }
    return list.filter((s) => !fixed.has(normalizeSkillId(s.id)));
  });

  readonly bgChosenCount = computed(() => {
    const fixed = new Set(this.bgFixedSkills());
    return this.selectedBgSkills().filter((id) => !fixed.has(normalizeSkillId(id))).length;
  });

  readonly bgSkillsRemaining = computed(() =>
    Math.max(0, this.bgSkillChooseCount() - this.bgChosenCount()),
  );

  toggleBgSkill(skillId: string): void {
    const id = normalizeSkillId(skillId);
    if (this.bgFixedSkills().includes(id)) return;

    const fixed = new Set(this.bgFixedSkills());
    const current = this.selectedBgSkills().map(normalizeSkillId);
    const chosen = current.filter((x) => !fixed.has(x));

    if (current.includes(id)) {
      this.selectedBgSkills.update((arr) => arr.filter((x) => normalizeSkillId(x) !== id));
    } else if (
      chosen.length < this.bgSkillChooseCount() &&
      !this.selectedClassSkills().map(normalizeSkillId).includes(id) &&
      !this.selectedSpeciesSkills().map(normalizeSkillId).includes(id)
    ) {
      this.selectedBgSkills.update((arr) => [...arr, id]);
    }
  }

  addCustomBgSkill(): void {
    const skill = this.customSkillInput().trim();
    if (!skill) return;
    if (this.selectedBgSkills().length >= this.bgSkillChooseCount()) return;
    if (this.selectedBgSkills().includes(skill) || this.selectedClassSkills().includes(skill))
      return;
    this.selectedBgSkills.update((arr) => [...arr, skill]);
    this.customSkillInput.set('');
  }

  removeCustomBgSkill(skill: string): void {
    this.selectedBgSkills.update((arr) => arr.filter((x) => x !== skill));
  }

  // === OUTILS D'HISTORIQUE ===
  readonly bgToolChoiceGroups = computed((): BgToolChoiceGroup[] => {
    if (this.isCustomBg()) return [];

    const groups: BgToolChoiceGroup[] = [];

    // Maîtrises fixes qui sont des catégories → il faut choisir l'objet concret
    const fixed = this.bgProf()?.tools?.fixed ?? [];
    for (const raw of fixed) {
      const ref = this.normalizeToolOption(raw);
      if (!ref?.any) continue;
      const key = this.toolRefKey(ref);
      groups.push({
        groupIndex: groups.length,
        chooseCount: 1,
        note: 'Maîtrise d’historique (choix concret)',
        options: [
          {
            key,
            label: this.prettifyTool(ref),
            category: String(ref.type),
            selected: this.isBgGroupOptionSatisfied(key, ref),
          },
        ],
      });
    }

    let choose = this.bgProf()?.tools?.choose || [];
    if (choose && !Array.isArray(choose)) choose = [choose];
    for (const group of choose as BgToolChooseGroupRaw[]) {
      groups.push({
        groupIndex: groups.length,
        chooseCount: group.chooseCount || group.choose_count || group.count || 1,
        note: group.note,
        options: (group.options || group.category_options || group.categoryOptions || []).map(
          (opt): BgToolChoiceOption => {
            const ref = this.normalizeToolOption(opt);
            const key = this.toolRefKey(ref);
            return {
              key,
              label: this.prettifyTool(ref),
              category: ref.any ? String(ref.type) : null,
              selected: this.isBgGroupOptionSatisfied(key, ref),
            };
          },
        ),
      });
    }

    return groups;
  });

  /** L'option de catégorie est satisfaite si un outil concret de cette catégorie est choisi. */
  private isBgGroupOptionSatisfied(key: string, ref: BackgroundToolRef): boolean {
    const selected = this.selectedBgTools();
    if (selected.includes(key)) return true;
    if (!ref?.any) return false;
    const cat = String(ref.type);
    return selected.some((id) => this.toolBelongsToCategory(id, cat));
  }

  private normalizeToolOption(opt: unknown): BackgroundToolRef {
    if (typeof opt === 'string') {
      const id = opt.toLowerCase();
      if (id === 'tool' || id === 'artisan') return { type: 'tool', any: true };
      if (id === 'instrument') return { type: 'instrument', any: true };
      if (id === 'game_set' || id === 'gameset' || id === 'jeu') return { type: 'gameSet', any: true };
      if (id === 'vehicle' || id === 'vehicule') return { type: 'vehicle', any: true };
      if (id === 'tl-outils-dalchimiste') return { type: 'tool', id: 'tl-necessaire-dalchimiste' };
      return { type: 'tool', id: opt };
    }

    if (!opt || typeof opt !== 'object') {
      return { type: 'tool', any: true };
    }

    const raw = opt as RawToolOption & object;

    // Déjà normalisé (BackgroundToolRef)
    if (
      'any' in raw &&
      raw.any === true &&
      'type' in raw &&
      typeof raw.type === 'string' &&
      (raw.type === 'tool' ||
        raw.type === 'instrument' ||
        raw.type === 'gameSet' ||
        raw.type === 'vehicle')
    ) {
      return { type: raw.type, any: true };
    }
    if ('type' in raw && raw.type === 'tool_category') {
      const cat = String(
        ('category' in raw ? raw.category : undefined) ??
          ('id' in raw ? raw.id : undefined) ??
          '',
      ).toLowerCase();
      if (cat.includes('instrument')) return { type: 'instrument', any: true };
      if (cat.includes('game') || cat === 'jeu') return { type: 'gameSet', any: true };
      if (cat.includes('vehic')) return { type: 'vehicle', any: true };
      return { type: 'tool', any: true };
    }
    if (
      'type' in raw &&
      (raw.type === 'instrument' || raw.type === 'gameSet' || raw.type === 'vehicle')
    ) {
      const id = String(('id' in raw ? raw.id : undefined) ?? '');
      if (!id || id.startsWith('tl-vehicules') || id === 'tl-materiel-de-jeu') {
        return { type: raw.type, any: true };
      }
      return { type: raw.type, id: String(raw.id), any: false };
    }
    if ('id' in raw && raw.id) {
      const oid = String(raw.id);
      if (oid === 'tl-outils-dalchimiste') {
        return { type: 'tool', id: 'tl-necessaire-dalchimiste' };
      }
      return { type: 'tool', id: oid };
    }
    return { type: 'tool', any: true };
  }

  /** Libellé de groupe catalogue pour une catégorie wizard. */
  private categoryGroupLabel(category: string): string | null {
    const map: Record<string, string> = {
      instrument: 'Instruments de musique',
      gameSet: 'Matériel de jeu',
      game_set: 'Matériel de jeu',
      vehicle: 'Véhicules',
      vehicule: 'Véhicules',
      tool: "Outils d'artisan",
      artisan: "Outils d'artisan",
    };
    return map[category] ?? null;
  }

  /** Clic sur une option d'historique : catégorie → expand, sinon toggle direct. */
  onBgToolOptionClick(opt: BgToolChoiceOption, group: BgToolChoiceGroup): void {
    if (opt.category) {
      // Déjà un outil concret de cette catégorie ? → désélection
      const concrete = this.selectedBgTools().find((id) =>
        this.toolBelongsToCategory(id, opt.category!),
      );
      if (concrete) {
        this.selectedBgTools.update((arr) => arr.filter((x) => x !== concrete));
        this.expandedBgToolCategory.set(null);
        return;
      }
      this.expandedBgToolCategory.set(
        this.expandedBgToolCategory() === opt.category ? null : opt.category,
      );
      return;
    }
    this.expandedBgToolCategory.set(null);
    this.toggleBgTool(opt.key, group);
  }

  toggleBgTool(toolKey: string, group: BgToolChoiceGroup): void {
    const current = this.selectedBgTools();
    if (current.includes(toolKey)) {
      this.selectedBgTools.update((arr) => arr.filter((x) => x !== toolKey));
    } else {
      const selectedInGroup = this.countSelectedInBgGroup(group);
      if (selectedInGroup < group.chooseCount) {
        this.selectedBgTools.update((arr) => [...arr, toolKey]);
      }
    }
  }

  /** Choisit un outil concret pour la catégorie expandée (Notable, Reclus, etc.). */
  pickConcreteBgTool(toolId: string, category: string, group: BgToolChoiceGroup): void {
    const withoutCat = this.selectedBgTools().filter(
      (id) => !this.toolBelongsToCategory(id, category) && id !== `${category}-any`,
    );
    const otherCount = withoutCat.filter((id) =>
      group.options.some(
        (o) =>
          o.key === id || (o.category && this.toolBelongsToCategory(id, o.category)),
      ),
    ).length;

    const alreadyHasCat = this.selectedBgTools().some((id) =>
      this.toolBelongsToCategory(id, category),
    );
    if (otherCount >= group.chooseCount && !alreadyHasCat) return;

    this.selectedBgTools.set([...withoutCat, toolId]);
    this.expandedBgToolCategory.set(null);
  }

  private countSelectedInBgGroup(group: BgToolChoiceGroup): number {
    const selected = this.selectedBgTools();
    let count = 0;
    for (const opt of group.options) {
      if (selected.includes(opt.key)) {
        count++;
        continue;
      }
      const category = opt.category;
      if (category && selected.some((id) => this.toolBelongsToCategory(id, category))) {
        count++;
      }
    }
    return count;
  }

  toolBelongsToCategory(toolId: string, category: string): boolean {
    const label = this.categoryGroupLabel(category);
    if (!label) return false;
    const group = this.toolGroups().find((g) => g.label === label);
    return !!group?.items.some((t) => t.id === toolId);
  }

  toolsForExpandedCategory(): { id: string; name: string }[] {
    const cat = this.expandedBgToolCategory();
    if (!cat) return [];
    const label = this.categoryGroupLabel(cat);
    if (!label) return [];
    return this.toolGroups().find((g) => g.label === label)?.items ?? [];
  }

  // Historique Custom : 2 outils max par défaut
  readonly customBgToolMax = computed(() => 2);
  readonly customBgToolsRemaining = computed(() =>
    Math.max(0, this.customBgToolMax() - this.selectedBgTools().length),
  );

  // === BONUS ESPÈCE (Polyvalence Melesse, etc.) ===
  readonly speciesBonusSkillCount = computed(
    () => this.builder.creation().speciesBonusSkillCount || 0,
  );
  readonly speciesBonusToolCount = computed(
    () => this.builder.creation().speciesBonusToolCount || 0,
  );
  readonly speciesSkillsRemaining = computed(() =>
    Math.max(0, this.speciesBonusSkillCount() - this.selectedSpeciesSkills().length),
  );
  readonly speciesToolsRemaining = computed(() =>
    Math.max(0, this.speciesBonusToolCount() - this.selectedSpeciesTools().length),
  );

  /** Pool concret d'outils défini côté API pour ce choix d'espèce (ex. Nain : brasseur/forgeron/maçon). */
  readonly speciesBonusToolPoolIds = computed(() => this.builder.creation().speciesBonusToolPoolIds ?? []);
  /** Libellé du choix (ex. "Maîtrise d'outils artisan", "Pilote") ; repli sur "Polyvalence" si absent. */
  readonly speciesBonusToolChoiceLabel = computed(
    () => this.builder.creation().speciesBonusToolChoiceLabel || 'Polyvalence',
  );

  readonly speciesSkillOptions = computed(() => Object.values(this.skillMap()));

  toggleSpeciesSkill(skillId: string): void {
    const id = normalizeSkillId(skillId);
    const current = this.selectedSpeciesSkills().map(normalizeSkillId);
    if (current.includes(id)) {
      this.selectedSpeciesSkills.update((arr) => arr.filter((x) => normalizeSkillId(x) !== id));
      return;
    }
    if (current.length >= this.speciesBonusSkillCount()) return;
    if (
      this.selectedClassSkills().map(normalizeSkillId).includes(id) ||
      this.selectedBgSkills().map(normalizeSkillId).includes(id)
    ) {
      return;
    }
    this.selectedSpeciesSkills.update((arr) => [...arr, id]);
  }

  toggleSpeciesTool(toolId: string): void {
    const current = this.selectedSpeciesTools();
    if (current.includes(toolId)) {
      this.selectedSpeciesTools.update((arr) => arr.filter((x) => x !== toolId));
    } else if (current.length < this.speciesBonusToolCount()) {
      this.selectedSpeciesTools.update((arr) => [...arr, toolId]);
    }
  }

  // === CATALOGUE D'OUTILS GROUPÉS ===

  readonly toolGroups = computed((): ToolCatalogGroup[] => {
    const catalog = this.toolCatalog();
    if (catalog.length === 0) return [];

    const instruments = catalog.filter(
      (t) =>
        t.type === 'TOOL' &&
        (t.subtype === 'instrument' ||
          [
            'tl-bombarde',
            'tl-cor',
            'tl-cornemuse',
            'tl-dulcimer',
            'tl-flute',
            'tl-flute-de-pan',
            'tl-luth',
            'tl-lyre',
            'tl-tambour',
            'tl-viole',
          ].includes(t.id)),
    );
    const games = catalog.filter(
      (t) =>
        t.type === 'TOOL' &&
        (t.subtype === 'gaming_set' ||
          ['tl-des', 'tl-echecs', 'tl-go', 'tl-jeu-de-cartes', 'tl-osselets'].includes(t.id)),
    );
    const vehicles = catalog.filter((t) => t.type === 'VEHICLE');
    const artisan = catalog.filter((t) => {
      if (t.type !== 'TOOL') return false;
      if (t.subtype === 'artisan_tool') return true;
      // Fallback si subtype manquant : outils hors instruments / jeux / kits spéciaux
      if (t.subtype) return false;
      return (
        !instruments.some((i) => i.id === t.id) &&
        !games.some((g) => g.id === t.id) &&
        !['tl-outils-de-voleur', 'tl-necessaire-dempoisonneur'].includes(t.id)
      );
    });

    return [
      { label: "Outils d'artisan", icon: 'fluent-emoji:hammer-and-wrench', items: artisan },
      { label: 'Instruments de musique', icon: 'fluent-emoji:violin', items: instruments },
      { label: 'Matériel de jeu', icon: 'fluent-emoji:game-die', items: games },
      { label: 'Véhicules', icon: 'fluent-emoji:horse', items: vehicles },
    ].filter((g) => g.items.length > 0);
  });

  /** Correspondance entre les jetons de catégorie de véhicules (ex. Gnome des roches/Mélesse
   * "Pilote") et le `subtype` réel des véhicules au catalogue (voir `subcategory` en JSON API). */
  private static readonly VEHICLE_CATEGORY_SUBTYPES: Record<string, string> = {
    'tl-vehicules-terrestres': 'land',
    'tl-vehicules-maritimes': 'water',
    'tl-vehicules-aeriens': 'air',
  };

  /** Correspondance entre jetons de catégorie abstraits d'outils (espèce/classe — ex. Mélesse
   * "Polyvalence" `tl-instrument-de-musique`/`tl-outils-artisan`, Moine `tl-cat-outils-artisan`/
   * `tl-cat-instrument-musique`, Barde `category-musical-instruments`) et le libellé de groupe du
   * catalogue (voir `toolGroups()`) dont il faut prendre tous les items. */
  private static readonly TOOL_POOL_GROUP_LABELS: Record<string, string> = {
    'tl-instrument-de-musique': 'Instruments de musique',
    'tl-cat-instrument-musique': 'Instruments de musique',
    'category-musical-instruments': 'Instruments de musique',
    'tl-outils-artisan': "Outils d'artisan",
    'tl-cat-outils-artisan': "Outils d'artisan",
    'category-tools': "Outils d'artisan",
    'tl-materiel-de-jeu': 'Matériel de jeu',
    'tl-category-materiel-de-jeu': 'Matériel de jeu',
    'category-gaming-sets': 'Matériel de jeu',
  };

  /** Étend un pool brut d'ids/jetons abstraits d'un `choice_pool` d'outils (véhicules par
   * sous-type, catégories d'outils par groupe catalogue, alias/coquilles d'ids concrets) en
   * identifiants concrets du catalogue réellement affichables. Utilisé pour les choix d'espèce
   * (ex. Gnome des roches/Mélesse "Pilote"/"Polyvalence") et de classe (ex. Moine, Barde,
   * Magicien) afin d'éviter le repli silencieux sur tout le catalogue quand un jeton ne matche
   * aucun id littéral. */
  private expandToolPoolIds(poolIds: string[]): Set<string> {
    const catalog = this.toolCatalog();
    const groups = this.toolGroups();
    const expanded = new Set<string>();
    for (const raw of poolIds) {
      const vehicleSubtype = SkillsStep.VEHICLE_CATEGORY_SUBTYPES[raw];
      if (vehicleSubtype) {
        catalog
          .filter((t) => t.type === 'VEHICLE' && t.subtype === vehicleSubtype)
          .forEach((t) => expanded.add(t.id));
        continue;
      }
      const groupLabel = SkillsStep.TOOL_POOL_GROUP_LABELS[raw];
      if (groupLabel) {
        groups.find((g) => g.label === groupLabel)?.items.forEach((t) => expanded.add(t.id));
        continue;
      }
      expanded.add(resolveEquipmentRefId(raw));
    }
    return expanded;
  }

  /**
   * Groupes d'outils affichés pour le choix d'espèce différé. Restreint au pool concret défini
   * côté API (ex. Nain : nécessaire de brasseur/outils de forgeron/outils de maçon ; Gnome des
   * roches/Mélesse "Pilote"/"Polyvalence" : véhicules par sous-type, instruments, outils
   * d'artisan, une fois les jetons de catégorie développés en identifiants concrets) quand ce
   * pool matche des entrées réelles du catalogue. Repli sur le catalogue complet si le pool est
   * vide ou ne matche vraiment rien.
   */
  readonly speciesToolGroups = computed(() => {
    const poolIds = this.expandToolPoolIds(this.speciesBonusToolPoolIds());
    if (poolIds.size === 0) return this.toolGroups();
    const filtered = this.toolGroups()
      .map((g) => ({ ...g, items: g.items.filter((t) => poolIds.has(t.id)) }))
      .filter((g) => g.items.length > 0);
    return filtered.length > 0 ? filtered : this.toolGroups();
  });

  isToolSelected(toolId: string): boolean {
    return this.selectedBgTools().includes(toolId) || this.selectedSpeciesTools().includes(toolId);
  }

  toggleCustomBgTool(toolId: string): void {
    const current = this.selectedBgTools();
    if (current.includes(toolId)) {
      this.selectedBgTools.update((arr) => arr.filter((x) => x !== toolId));
    } else if (current.length < this.customBgToolMax()) {
      this.selectedBgTools.update((arr) => [...arr, toolId]);
    }
  }

  // === VALIDATION ===
  readonly expertiseChoices = computed(() => {
    const cls = this.classJson();
    if (!cls) return [];
    return extractExpertiseChoices(cls, this.builder.targetLevel());
  });

  readonly expertiseNeeded = computed(() =>
    this.expertiseChoices().reduce((sum, c) => sum + (c.count || 0), 0),
  );

  /** Compétences déjà maîtrisées (classe + historique + espèce) pour l'expertise. */
  readonly expertiseCandidates = computed(() => {
    const map = this.skillMap();
    const ids = [
      ...this.selectedClassSkills(),
      ...this.selectedBgSkills(),
      ...this.selectedSpeciesSkills(),
      ...this.builder.creation().backgroundSkills,
    ].map(normalizeSkillId);
    const unique = [...new Set(ids)].filter(Boolean);
    return unique.map((id) => {
      const info = resolveSkillInfo(id, map);
      return {
        id,
        label: info?.label ?? prettifySkillId(id, map),
      };
    });
  });

  isExpertiseSelected(skillId: string): boolean {
    const id = normalizeSkillId(skillId);
    return this.selectedExpertise().some((s) => normalizeSkillId(s) === id);
  }

  readonly expertiseRemaining = computed(() =>
    Math.max(0, this.expertiseNeeded() - this.selectedExpertise().length),
  );

  readonly classWeaponChoices = computed(() => {
    const cls = this.classJson();
    if (!cls) return [];
    return extractWeaponProficiencyChoices(
      cls,
      this.builder.targetLevel(),
      undefined,
      this.builder.creation().subclassId,
    );
  });

  readonly classToolChoices = computed(() => {
    const cls = this.classJson();
    if (!cls) return [];
    return extractToolProficiencyChoices(
      cls,
      this.builder.targetLevel(),
      undefined,
      this.builder.creation().subclassId,
    );
  });

  /**
   * Options d'outils affichées pour le choix de classe (ex. Moine `tl-cat-outils-artisan`/
   * `tl-cat-instrument-musique`/`tl-outils-de-la-ferme`, Barde `category-musical-instruments`,
   * Magicien `tl-necessaire-calligraphe`/`-alchimiste`/`-cartographe`). Restreint au pool réel
   * une fois les jetons de catégorie développés (voir `expandToolPoolIds`) ; repli sur le
   * catalogue complet si le choix n'a pas de pool concret ou ne matche rien.
   */
  readonly classToolOptions = computed(() => {
    const choice = this.classToolChoices()[0];
    const poolIds = ((choice?.meta?.['poolIds'] as unknown[]) ?? []).map(String);
    if (poolIds.length === 0) return this.toolCatalog();
    const expanded = this.expandToolPoolIds(poolIds);
    if (expanded.size === 0) return this.toolCatalog();
    const filtered = this.toolCatalog().filter((t) => expanded.has(t.id));
    return filtered.length > 0 ? filtered : this.toolCatalog();
  });

  readonly displayedClassTools = computed(() => {
    const filtered = this.classToolOptions();
    return filtered.length ? filtered : this.toolCatalog();
  });

  readonly classWeaponsNeeded = computed(() =>
    this.classWeaponChoices().reduce((sum, c) => sum + (c.count || 0), 0),
  );

  readonly classToolsNeeded = computed(() =>
    this.classToolChoices().reduce((sum, c) => sum + (c.count || 0), 0),
  );

  readonly classWeaponsPicked = computed(() =>
    [...this.classWeaponAnswers().values()].reduce((sum, ids) => sum + ids.length, 0),
  );

  readonly classToolsPicked = computed(() =>
    [...this.classToolAnswers().values()].reduce((sum, ids) => sum + ids.length, 0),
  );

  readonly classWeaponsRemaining = computed(() =>
    Math.max(0, this.classWeaponsNeeded() - this.classWeaponsPicked()),
  );

  readonly classToolsRemaining = computed(() =>
    Math.max(0, this.classToolsNeeded() - this.classToolsPicked()),
  );

  readonly classWeaponOptions = computed(() => {
    const maxPrice = this.classWeaponChoices()[0]?.meta?.['maxPricePo'] as number | undefined;
    const base = new Set(this.builder.creation().weaponProficiencies ?? []);
    return this.weaponCatalog()
      .filter((w) => {
        if (base.has(w.id)) return false;
        if (maxPrice != null && w.costPo > maxPrice) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  isClassWeaponSelected(weaponId: string): boolean {
    for (const ids of this.classWeaponAnswers().values()) {
      if (ids.includes(weaponId)) return true;
    }
    return false;
  }

  isClassToolSelected(toolId: string): boolean {
    for (const ids of this.classToolAnswers().values()) {
      if (ids.includes(toolId)) return true;
    }
    return false;
  }

  toggleClassWeapon(weaponId: string): void {
    const choice = this.classWeaponChoices()[0];
    if (!choice) return;
    this.classWeaponAnswers.update((map) => {
      const next = new Map(map);
      const prev = [...(next.get(choice.id) ?? [])];
      const idx = prev.indexOf(weaponId);
      if (idx >= 0) {
        prev.splice(idx, 1);
      } else if (prev.length < choice.count) {
        prev.push(weaponId);
      }
      next.set(choice.id, prev);
      return next;
    });
  }

  toggleClassTool(toolId: string): void {
    const choice = this.classToolChoices()[0];
    if (!choice) return;
    this.classToolAnswers.update((map) => {
      const next = new Map(map);
      const prev = [...(next.get(choice.id) ?? [])];
      const idx = prev.indexOf(toolId);
      if (idx >= 0) {
        prev.splice(idx, 1);
      } else if (prev.length < choice.count) {
        prev.push(toolId);
      }
      next.set(choice.id, prev);
      return next;
    });
  }

  toggleExpertise(skillId: string): void {
    const id = normalizeSkillId(skillId);
    const current = this.selectedExpertise().map(normalizeSkillId);
    if (current.includes(id)) {
      this.selectedExpertise.update((arr) => arr.filter((x) => normalizeSkillId(x) !== id));
    } else if (current.length < this.expertiseNeeded()) {
      this.selectedExpertise.update((arr) => [...arr, id]);
    }
  }

  readonly isSelectionComplete = computed(() => {
    if (this.classSkillsRemaining() > 0) return false;
    if (this.bgSkillsRemaining() > 0) return false;
    if (this.speciesSkillsRemaining() > 0) return false;
    if (this.speciesToolsRemaining() > 0) return false;
    if (this.expertiseRemaining() > 0) return false;
    if (this.classWeaponsRemaining() > 0) return false;
    if (this.classToolsRemaining() > 0) return false;
    if (this.subclassSkillChoiceRemaining() > 0) return false;
    if (this.secondaryClassSkillsRemaining() > 0) return false;

    if (this.isCustomBg()) {
      if (this.customBgToolsRemaining() > 0) return false;
    } else {
      for (const group of this.bgToolChoiceGroups()) {
        if (this.countSelectedInBgGroup(group) < group.chooseCount) return false;
      }
    }
    return true;
  });

  // === HELPERS & REGROUPEMENT POUR L'AFFICHAGE ===
  isSkillSelected(skillId: string): boolean {
    const id = normalizeSkillId(skillId);
    return (
      this.selectedClassSkills().some((s) => normalizeSkillId(s) === id) ||
      this.selectedBgSkills().some((s) => normalizeSkillId(s) === id) ||
      this.selectedSpeciesSkills().some((s) => normalizeSkillId(s) === id)
    );
  }
  getSelectedConcreteToolLabel(category: string | null, fallback: string): string {
    if (!category) return fallback;
    const id = this.selectedBgTools().find((t) => this.toolBelongsToCategory(t, category));
    return id ? this.getToolName(id) : fallback;
  }

  getModifierForSkill(skillId: string): string {
    const info = resolveSkillInfo(skillId, this.skillMap());
    if (!info) return '+0';
    const abilityKey = this.abilityLabelToKey(info.ability);
    if (!abilityKey) return '+0';

    const mod = this.builder.abilityModifiers()[abilityKey] ?? 0;
    const prof = this.isSkillSelected(skillId) ? 2 : 0;
    const total = mod + prof;
    return total >= 0 ? `+${total}` : `${total}`;
  }

  private abilityLabelToKey(label: string): AbilityKey | null {
    const reverseMap: Record<string, AbilityKey> = {
      Force: 'force',
      Dextérité: 'dexterite',
      Constitution: 'constitution',
      Intelligence: 'intelligence',
      Sagesse: 'sagesse',
      Charisme: 'charisme',
    };
    return reverseMap[label] ?? null;
  }

  prettifySkill(id: string): string {
    return prettifySkillId(id, this.skillMap());
  }

  prettifyTool(ref: BackgroundToolRef | { id: string; type?: BackgroundToolRef['type']; any?: boolean }): string {
    if (ref?.any) {
      return labelForGameId(ref.type ?? 'tool');
    }
    if (ref?.id) return labelForGameId(ref.id);
    return labelForGameId(ref?.type);
  }

  toolRefKey(ref: BackgroundToolRef): string {
    if (ref.id) return ref.id;
    return `${ref.type}-any`;
  }

  getToolName(toolId: string): string {
    const found = this.toolCatalog().find((t) => t.id === toolId);
    if (found) return found.name;
    return this.prettifyTool({ type: 'tool', id: toolId });
  }

  // === NAVIGATION ET SAUVEGARDE ===
  confirmSelection(): void {
    if (!this.isSelectionComplete()) return;
    const c = this.builder.creation();
    const bgProf = c.backgroundProficiencies as
      | (NonNullable<typeof c.backgroundProficiencies> & {
          equipment?: { fromToolProficiency?: boolean; from_tool_proficiency?: boolean };
        })
      | null
      | undefined;
    const isCustom = c.backgroundPreset === false;

    // 1. Génération des slots d'équipement liés aux outils d'historique
    const givesToolsAsEq =
      bgProf?.equipment?.fromToolProficiency ||
      bgProf?.equipment?.from_tool_proficiency ||
      isCustom;
    const bgSlots: EquipmentSlot[] = [];
    let slotIndex = 200; // On commence à 200 pour éviter toute collision avec l'équipement fixe (100) ou de classe (1)

    if (givesToolsAsEq) {
      // Les catégories (any) sont déjà résolues dans selectedBgTools → ne pas re-pousser les placeholders.
      const fixedConcrete = (bgProf?.tools?.fixed ?? [])
        .filter((t): t is BackgroundToolRef & { id: string } => !!t && !t.any && !!t.id)
        .map((t) => t.id);
      const toolsToGive = [...new Set([...fixedConcrete, ...this.selectedBgTools()])];

      for (const tool of toolsToGive) {
        if (!tool || tool.includes('language')) continue; // Les langues ne sont pas du matériel physique

        if (tool === 'instrument-any' || tool === 'instrument') {
          bgSlots.push({
            slot: slotIndex++,
            description: 'Instrument de musique (Maîtrise)',
            alternatives: [[{ id: 'category-musical-instruments', qty: 1 }]],
          });
        } else if (tool === 'gameSet-any' || tool === 'game_set-any' || tool === 'game_set') {
          bgSlots.push({
            slot: slotIndex++,
            description: 'Matériel de jeu (Maîtrise)',
            alternatives: [[{ id: 'category-gaming-sets', qty: 1 }]],
          });
        } else if (tool === 'tool-any' || tool === 'tool' || tool === 'artisan-any') {
          bgSlots.push({
            slot: slotIndex++,
            description: "Outil d'artisan (Maîtrise)",
            alternatives: [[{ id: 'category-tools', qty: 1 }]],
          });
        } else if (tool === 'vehicle-any' || tool === 'vehicle' || tool === 'vehicule-any') {
          bgSlots.push({
            slot: slotIndex++,
            description: 'Véhicule (Maîtrise)',
            alternatives: [[{ id: 'category-vehicles', qty: 1 }]],
          });
        } else {
          bgSlots.push({
            slot: slotIndex++,
            description: this.getToolName(tool) || 'Outil',
            fixed: [{ id: tool, qty: 1 }],
          });
        }
      }
    }

    // 1.5 Répartition des choix imbriqués de sous-classe (compétences/outils + expertise conditionnelle)
    const nestedPicks = [...this.subclassSkillChoiceAnswers().values()].flat();
    const nestedToolPicks = nestedPicks.filter((id) => id.startsWith('tl-'));
    const nestedSkillPicks = nestedPicks
      .filter((id) => !id.startsWith('tl-'))
      .map(normalizeSkillId);
    const expertiseEligibleIds = new Set(
      this.subclassSkillChoicePools()
        .filter((p) => p.expertiseIfAlreadyProficient)
        .flatMap((p) => this.subclassSkillChoiceAnswers().get(p.id) ?? [])
        .filter((id) => !id.startsWith('tl-'))
        .map(normalizeSkillId),
    );
    const subclassSkills = this.subclassFixedSkills();
    const knownBeforeNested = new Set([
      ...this.selectedClassSkills(),
      ...this.selectedBgSkills(),
      ...this.selectedSpeciesSkills(),
      ...subclassSkills,
    ].map(normalizeSkillId));
    const nestedExpertiseFinal = [
      ...new Set(nestedSkillPicks.filter((id) => expertiseEligibleIds.has(id) && knownBeforeNested.has(id))),
    ];
    const nestedSkillsFinal = [...new Set(nestedSkillPicks.filter((id) => !nestedExpertiseFinal.includes(id)))];

    // 2. Sauvegarde centralisée
    const subclassExpertise = this.subclassFixedExpertise();
    this.builder.setProficiencies(
      [
        ...new Set([
          ...this.selectedClassSkills(),
          ...this.selectedSpeciesSkills(),
          ...subclassSkills,
          ...nestedSkillsFinal,
          ...this.selectedSecondaryClassSkills(),
        ]),
      ],
      this.selectedBgSkills(),
      [...this.selectedBgTools(), ...this.selectedSpeciesTools()],
      bgSlots,
    );
    this.builder.setExpertiseSkills([
      ...new Set([...this.selectedExpertise(), ...subclassExpertise, ...nestedExpertiseFinal]),
    ]);
    this.builder.setSecondaryClassSkills(this.selectedSecondaryClassSkills());

    const extraWeapons = [...this.classWeaponAnswers().values()].flat();
    const extraTools = [...this.classToolAnswers().values(), nestedToolPicks].flat();
    const profAnswers: Record<string, string[]> = {};
    for (const [k, v] of this.classWeaponAnswers()) profAnswers[k] = v;
    for (const [k, v] of this.classToolAnswers()) profAnswers[k] = v;
    for (const [k, v] of this.subclassSkillChoiceAnswers()) profAnswers[k] = v;
    if (extraWeapons.length || extraTools.length || Object.keys(profAnswers).length) {
      this.builder.mergeClassProficiencies(extraWeapons, extraTools, profAnswers);
    }

    this.builder.nextStep();
  }

  prevStep(): void {
    this.builder.previousStep();
  }
}
