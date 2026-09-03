import type { Character, SpellInstance } from '@core/models/Character/character';
import {
  INITIAL_CREATION_STATE,
  type ExtendedCharacterCreation,
} from '@core/models/Character/character-builder.types';
import type { CharacterBuildEditingRef } from './character-build.util';
import { aggregateAsiChoices } from './character-abilities.util';

export interface CharacterEditLoadResult {
  creation: ExtendedCharacterCreation;
  editing: CharacterBuildEditingRef;
}

/** Vérifie qu'un export cloud peut être rechargé dans le wizard. */
export function validateCharacterForEdit(saved: Character): string[] {
  const errors: string[] = [];
  if (!saved.id?.trim()) errors.push('identifiant manquant');
  if (!saved.species?.id) errors.push('espèce manquante');
  if (!saved.civilization?.id) errors.push('civilisation manquante');
  if (!saved.classes?.length || !saved.classes[0]?.classId) errors.push('classe manquante');
  if (!saved.abilities) errors.push('caractéristiques manquantes');
  return errors;
}

/** Reconstruit l'état wizard à partir d'un personnage sauvegardé. */
export function mapCharacterToEditState(saved: Character): CharacterEditLoadResult {
  const creation = structuredClone(INITIAL_CREATION_STATE);
  const species = saved.species;
  const primaryClass = saved.classes[0];
  const sc = saved.spellcasting;

  creation.speciesId = species.id;
  creation.speciesName = species.label;
  creation.subspeciesId = species.subspeciesId ?? null;
  creation.subspeciesName = species.subspeciesLabel ?? null;
  creation.speciesTraits = saved.features.filter(
    (f) => f.source === 'species' || f.source === 'subspecies',
  );
  creation.speciesSpeed = saved.movement.walk;
  creation.speciesSize = saved.size;
  creation.speciesResistances = saved.defense.resistances;
  creation.hasDarkvision = saved.senses.hasDarkvision;
  creation.darkvisionRadius = saved.senses.darkvisionRadius;

  creation.civilizationId = saved.civilization.id;
  creation.civilizationName = saved.civilization.label;
  creation.civilizationWritingSystems = saved.proficiencies.writingSystems;

  creation.backgroundId = saved.backgroundRef?.id ?? null;
  creation.backgroundName = saved.backgroundRef?.label ?? null;
  creation.backgroundPreset = saved.backgroundRef !== null;
  creation.privilegeId = saved.privilegeRef?.id ?? null;
  creation.privilegeName = saved.privilegeRef?.name ?? null;
  creation.privilegeDesc = saved.privilegeRef?.desc ?? null;

  creation.classId = primaryClass?.classId ?? null;
  creation.className = primaryClass?.classLabel ?? null;
  creation.subclassId = primaryClass?.subclassId ?? null;
  creation.subclassName = primaryClass?.subclassLabel ?? null;
  creation.targetLevel = saved.totalLevel || primaryClass?.level || 1;
  creation.hitDie = primaryClass?.hitDie ?? 0;
  creation.hpAtLevel1 = primaryClass?.hitDie ?? 0;
  creation.hpPerLevelAverage = primaryClass?.hitDie
    ? Math.floor(primaryClass.hitDie / 2) + 1
    : 0;
  creation.hasSpellcasting = sc !== null;
  creation.spellcastingKind = sc?.kind ?? null;
  creation.spellcastingAbility = sc?.ability ?? null;
  creation.savingThrows = saved.proficiencies.savingThrows;
  creation.armorProficiencies = saved.proficiencies.armor;
  creation.weaponProficiencies = saved.proficiencies.weapons;
  creation.toolProficiencies = saved.proficiencies.tools;
  creation.skillChooseCount = saved.proficiencies.skills.length;
  creation.classFeatures = saved.features.filter(
    (f) => f.source === 'class' || f.source === 'subclass',
  );
  creation.expertiseSkills = saved.proficiencies.expertiseSkills ?? [];
  // Restaure les choix de progression (ancêtre draconique, domaine, métamagie…) et les dons/ASI
  // pour que la réédition à un niveau supérieur ne perde pas les choix déjà faits.
  creation.classChoiceAnswers = saved.classChoiceAnswers ?? {};
  creation.asiChoices = saved.asiChoices ?? [];
  if (creation.asiChoices.length) {
    const { bonuses, featIds } = aggregateAsiChoices(creation.asiChoices);
    creation.asiBonuses = bonuses;
    creation.selectedFeatIds = featIds;
    creation.selectedFeatId = featIds[0] ?? null;
  }

  if (sc?.kind === 'sorcerer') {
    creation.metamagicOptions = sc.metamagic ?? [];
  }
  if (sc?.kind === 'warlock') {
    creation.eldritchInvocations = sc.eldritchInvocations ?? [];
    creation.pactBoon = sc.pact || null;
    creation.mysticArcanumPicks = Object.fromEntries(
      (sc.mysticArcanum ?? []).map((a) => [String(a.spellLevel), a.spellId]),
    );
  }
  if (sc?.kind === 'wizard') {
    creation.spellMasteryPicks = Object.fromEntries(
      (sc.spellMastery ?? []).map((a) => [String(a.spellLevel), a.spellId]),
    );
    creation.signatureSpellIds = (sc.signatureSpells ?? []).map((s) => s.spellId);
  }

  creation.baseAbilities = saved.abilities;
  creation.pointsRemaining = 0;
  creation.selectedSkills = saved.proficiencies.skills;
  creation.selectedEquipment = saved.equipment;
  creation.currency = saved.currency;
  creation.languages = saved.proficiencies.languages;

  creation.name = saved.name;
  creation.sex = saved.personality.sex ?? 'X';
  creation.description = saved.personality.description;
  creation.background = saved.personality.background;
  creation.alignment = saved.personality.alignment;
  creation.traits = saved.personality.traits;
  creation.ideal = saved.personality.ideal;
  creation.bonds = saved.personality.bonds;
  creation.flaws = saved.personality.flaws;
  creation.handicap = saved.personality.handicap;
  creation.story = saved.personality.story;

  creation.spellcastingDetails = mapKnownSpellsToSpellcastingDetails(saved.knownSpells);

  return {
    creation,
    editing: {
      id: saved.id,
      createdAt: saved.createdAt,
      cloudSynced: saved.cloudSynced === true,
    },
  };
}

function mapKnownSpellsToSpellcastingDetails(
  knownSpells: SpellInstance[],
): ExtendedCharacterCreation['spellcastingDetails'] {
  if (!knownSpells.length) return {};
  return {
    cantrips: knownSpells
      .filter((s) => s.level === 0)
      .map((s) => ({
        refId: s.refId,
        name: s.name,
        level: 0,
        prepared: true,
        effectSummary: s.effectSummary ?? '',
      })),
    spells: knownSpells
      .filter((s) => s.level >= 1)
      .map((s) => ({
        refId: s.refId,
        name: s.name,
        level: s.level,
        prepared: s.prepared,
        effectSummary: s.effectSummary ?? '',
      })),
  };
}
