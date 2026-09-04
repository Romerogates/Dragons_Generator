// features/character-creation/steps/class-step/multiclass-panel/multiclass-panel.ts
//
// Panneau de MULTICLASSAGE (RAW 5e), affiché sous le carrousel de classe primaire une fois
// celle-ci choisie. Ajoute une ou plusieurs classes SECONDAIRES en plus de la classe primaire
// (dont le flux/les mécaniques restent strictement inchangés pour un personnage mono-classe).
//
// Chaque classe secondaire a son propre compteur de niveau (indépendant du niveau de la classe
// primaire) et n'accorde que les maîtrises RÉDUITES de multiclassage (jamais les maîtrises de
// départ complètes, jamais de nouvelle maîtrise de jet de sauvegarde — RAW).

import { Component, OnInit, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../../../core/services/data.service';
import {
  CharacterBuilderService,
  type SecondaryClassSelection,
} from '../../../../../core/services/character-builder.service';
import type { CharacterClass, Subclass } from '../../../../../core/models/CharacterClasses/character-class';
import { buildClassFeaturesForLevel, listSubclassOptions } from '@core/utils/character-class-features.util';
import { CLASS_SPELLCASTING } from '@core/utils/character-auto-build.util';
import {
  multiclassPrerequisiteLabel,
  multiclassPrerequisitesMet,
  multiclassProficiencies,
} from '@core/utils/progression-choices.util';
import { getClassIcon } from '@core/utils/class-icons';

/** Paliers de déblocage de la magie plus tardifs que le niveau 1 (RAW : Paladin/Rôdeur niv. 2). */
const SPELLCASTING_FROM_LEVEL: Record<string, number> = {
  'cls-paladin': 2,
  'cls-rodeur': 2,
};

interface SecondaryClassRow {
  entry: SecondaryClassSelection;
  index: number;
  cls: CharacterClass | null;
  subclassOptions: Subclass[];
  subclassLevelUnlocked: number;
  prerequisiteLabel: string | null;
  prerequisitesMet: boolean;
  maxLevel: number;
}

@Component({
  selector: 'app-multiclass-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './multiclass-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MulticlassPanel implements OnInit {
  readonly builder = inject(CharacterBuilderService);
  private readonly dataService = inject(DataService);

  /** Catalogue complet des classes (chargé une fois), indexé par id pour un accès direct. */
  private readonly classesById = signal<Map<string, CharacterClass>>(new Map());
  readonly loaded = signal(false);

  readonly selectedClassIdToAdd = signal<string>('');
  readonly getClassIcon = getClassIcon;

  ngOnInit(): void {
    this.dataService.getClasses().subscribe({
      next: (classes) => {
        this.classesById.set(new Map(classes.map((c) => [c.id, c])));
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  /** Niveau total déjà engagé (classe primaire + classes secondaires ajoutées). */
  readonly usedLevels = computed(
    () => this.builder.targetLevel() + this.builder.secondaryClassesTotalLevel(),
  );

  readonly remainingLevels = computed(() => Math.max(0, 20 - this.usedLevels()));

  readonly canAddClass = computed(() => this.builder.creation().classId !== null && this.remainingLevels() > 0);

  readonly availableClassesToAdd = computed<CharacterClass[]>(() => {
    const primaryId = this.builder.creation().classId;
    const secondaryIds = new Set(this.builder.secondaryClasses().map((s) => s.classId));
    return [...this.classesById().values()]
      .filter((c) => c.id !== primaryId && !secondaryIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly secondaryRows = computed<SecondaryClassRow[]>(() => {
    const map = this.classesById();
    return this.builder.secondaryClasses().map((entry, index) => {
      const cls = map.get(entry.classId) ?? null;
      const subclassBlock = cls ? this.subclassBlockFor(cls) : null;
      const otherLevels = this.usedLevels() - entry.level;
      return {
        entry,
        index,
        cls,
        subclassOptions: subclassBlock?.options ?? [],
        subclassLevelUnlocked: subclassBlock?.levelUnlocked ?? 3,
        prerequisiteLabel: cls ? multiclassPrerequisiteLabel(cls) : null,
        prerequisitesMet: cls ? multiclassPrerequisitesMet(cls, this.builder.finalAbilities()) : true,
        maxLevel: Math.max(1, 20 - otherLevels),
      };
    });
  });

  private subclassBlockFor(cls: CharacterClass): { options: Subclass[]; levelUnlocked: number } | null {
    if (!cls.data.subclasses) return null;
    const options = listSubclassOptions(cls.data);
    const raw = cls.data.subclasses as unknown as { level_unlocked?: number; unlocked_at_level?: number };
    return { options, levelUnlocked: raw.level_unlocked ?? raw.unlocked_at_level ?? 3 };
  }

  private spellcastingFor(
    classId: string,
    level: number,
  ): { hasSpellcasting: boolean; spellcastingKind: SecondaryClassSelection['spellcastingKind']; spellcastingAbility: SecondaryClassSelection['spellcastingAbility'] } {
    const fromLevel = SPELLCASTING_FROM_LEVEL[classId] ?? 1;
    const info = level >= fromLevel ? (CLASS_SPELLCASTING[classId] ?? null) : null;
    return {
      hasSpellcasting: info !== null,
      spellcastingKind: info?.kind ?? null,
      spellcastingAbility: info?.ability ?? null,
    };
  }

  private buildSelectionFor(
    cls: CharacterClass,
    level: number,
    subclassId: string | null,
    subclassName: string | null,
  ): SecondaryClassSelection {
    const hitDie = cls.data.hit_die || 8;
    const prof = multiclassProficiencies(cls);
    const spell = this.spellcastingFor(cls.id, level);
    const { classFeatures } = buildClassFeaturesForLevel(
      cls,
      {
        classId: cls.id,
        subclassId,
        hasSpellcasting: spell.hasSpellcasting,
        spellcastingKind: spell.spellcastingKind,
        spellcastingAbility: spell.spellcastingAbility,
        existingClassFeatures: [],
      },
      level,
    );
    return {
      classId: cls.id,
      className: cls.name,
      subclassId,
      subclassName,
      level,
      hitDie,
      hpPerLevelAverage: Math.floor(hitDie / 2) + 1,
      hasSpellcasting: spell.hasSpellcasting,
      spellcastingKind: spell.spellcastingKind,
      spellcastingAbility: spell.spellcastingAbility,
      armorProficiencies: prof.armor,
      weaponProficiencies: prof.weapons,
      toolProficiencies: prof.tools,
      skillChooseCount: prof.skillChooseCount,
      skillOptions: prof.skillOptions,
      classFeatures,
    };
  }

  addSelectedClass(): void {
    const id = this.selectedClassIdToAdd();
    const cls = this.classesById().get(id);
    if (!cls) return;
    const level = Math.min(1, this.remainingLevels()) || 1;
    this.builder.addSecondaryClass(this.buildSelectionFor(cls, level, null, null));
    this.selectedClassIdToAdd.set('');
  }

  onLevelChange(row: SecondaryClassRow, rawLevel: number): void {
    if (!row.cls) return;
    const level = Math.min(row.maxLevel, Math.max(1, Math.floor(Number(rawLevel)) || 1));
    const subclassBlock = this.subclassBlockFor(row.cls);
    const keepsSubclass = subclassBlock && level >= subclassBlock.levelUnlocked ? row.entry.subclassId ?? null : null;
    const keepsSubclassName = keepsSubclass ? row.entry.subclassName ?? null : null;
    const updated = this.buildSelectionFor(row.cls, level, keepsSubclass, keepsSubclassName);
    this.builder.updateSecondaryClassDetails(row.index, updated);
  }

  onSubclassChange(row: SecondaryClassRow, subclassId: string): void {
    if (!row.cls) return;
    const option = row.subclassOptions.find((o) => o.id === subclassId) ?? null;
    const updated = this.buildSelectionFor(row.cls, row.entry.level, option?.id ?? null, option?.name ?? null);
    this.builder.updateSecondaryClassDetails(row.index, updated);
  }

  removeClass(row: SecondaryClassRow): void {
    this.builder.removeSecondaryClass(row.index);
  }
}
