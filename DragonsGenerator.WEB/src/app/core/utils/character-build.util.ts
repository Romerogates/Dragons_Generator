import type {
  AbilityScores,
  Character,
  Currency,
  FeatureInstance,
} from '@core/models/Character/character';
import { CURRENT_SCHEMA_VERSION } from '@core/models/Character/character';
import type { ExtendedCharacterCreation } from '@core/models/Character/character-builder.types';
import {
  buildCharacterAttacks,
  computeCharacterArmorClass,
  computeCharacterWalkSpeed,
  findEquippedArmorName,
} from './character-combat.util';
import {
  buildCharacterSpellcasting,
  buildKnownSpellsFromCreation,
} from './character-spellcasting.util';

export interface CharacterBuildEditingRef {
  id: string;
  createdAt: string;
  cloudSynced?: boolean;
}

export interface CharacterBuildInput {
  creation: ExtendedCharacterCreation;
  abilities: AbilityScores;
  modifiers: AbilityScores;
  hpMax: number;
  proficiencyBonus: number;
  targetLevel: number;
  passivePerception: number;
  editing?: CharacterBuildEditingRef | null;
  now?: string;
}

/** Assemble un `Character` exportable à partir de l'état wizard + dérivés calculés. */
export function buildCharacterFromCreation(input: CharacterBuildInput): Character {
  const {
    creation: c,
    abilities,
    modifiers,
    hpMax,
    proficiencyBonus,
    targetLevel,
    passivePerception,
    editing,
    now = new Date().toISOString(),
  } = input;

  const spellcasting = buildCharacterSpellcasting(c, modifiers);
  const features: FeatureInstance[] = [...c.speciesTraits, ...c.classFeatures];
  const featIds =
    c.selectedFeatIds?.length > 0
      ? c.selectedFeatIds
      : c.selectedFeatId
        ? [c.selectedFeatId]
        : [];
  for (const featId of featIds) {
    const featSlot = c.asiChoices?.find((s) => s.mode === 'feat' && s.featId === featId);
    features.push({
      refId: featId,
      name: featId.replace(/^don-/, '').replace(/-/g, ' '),
      desc: 'Don choisi à la place d’une augmentation de caractéristique.',
      source: 'feat',
      sourceDetail: 'ASI',
      level: featSlot?.level ?? 4,
    });
  }

  const allEquipmentForAttacks = [...c.selectedEquipment, ...(c.backgroundEquipment ?? [])];
  const knownSpells = buildKnownSpellsFromCreation(c);
  const attacks = buildCharacterAttacks(
    allEquipmentForAttacks,
    modifiers,
    proficiencyBonus,
    knownSpells,
    {
      spellAbility: c.spellcastingAbility,
      classId: c.classId,
      classFeatures: c.classFeatures,
      resources: c.classProgressionResources ?? {},
    },
  );

  const allEquipment = [...c.selectedEquipment, ...c.backgroundEquipment];
  const totalWeight = allEquipment.reduce((sum, item) => sum + (item.wKg ?? 0) * item.qty, 0);
  const maxCarry = abilities.force * 7.5;

  const armorClass = computeCharacterArmorClass(allEquipment, modifiers, {
    classId: c.classId,
    subclassId: c.subclassId,
    classFeatures: c.classFeatures,
  });

  const walkSpeed = computeCharacterWalkSpeed(c, allEquipment);

  const mergedCurrency: Currency = {
    cuivre: c.currency.cuivre + c.backgroundCurrency.cuivre,
    argent: c.currency.argent + c.backgroundCurrency.argent,
    or: c.currency.or + c.backgroundCurrency.or,
    platine: c.currency.platine + c.backgroundCurrency.platine,
  };

  const allTools = [...new Set([...c.toolProficiencies, ...c.backgroundTools])];

  return {
    id: editing?.id ?? crypto.randomUUID(),
    cloudSynced: editing?.cloudSynced ?? false,
    createdAt: editing?.createdAt ?? now,
    updatedAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,

    name: c.name,
    species: {
      id: c.speciesId!,
      label: c.speciesName!,
      ...(c.subspeciesId
        ? { subspeciesId: c.subspeciesId, subspeciesLabel: c.subspeciesName! }
        : {}),
    },
    size: c.speciesSize,
    civilization: { id: c.civilizationId!, label: c.civilizationName! },

    backgroundRef: c.backgroundId ? { id: c.backgroundId, label: c.backgroundName! } : null,
    privilegeRef: c.privilegeId
      ? { id: c.privilegeId, name: c.privilegeName!, desc: c.privilegeDesc! }
      : null,

    classes: [
      {
        classId: c.classId!,
        classLabel: c.className!,
        ...(c.subclassId ? { subclassId: c.subclassId, subclassLabel: c.subclassName! } : {}),
        level: targetLevel,
        hitDie: c.hitDie,
      },
    ],
    totalLevel: targetLevel,
    experience: 0,

    abilities,
    abilityModifiers: modifiers,
    proficiencyBonus,

    vitality: {
      hitPointsMax: hpMax,
      hitPointsCurrent: hpMax,
      hitPointsTemporary: 0,
      woundThreshold: Math.ceil(hpMax / 2),
      hitDice: [{ dieType: c.hitDie, total: targetLevel, used: 0 }],
      fatigue: 0,
      deathSaves: { successes: 0, failures: 0 },
      inspiration: false,
    },
    defense: {
      armorClass,
      armorType: findEquippedArmorName(allEquipment),
      hasShield: allEquipment.some(
        (e) => e.equipped && e.name.toLowerCase().includes('bouclier'),
      ),
      resistances: [...new Set([...c.speciesResistances, ...(c.classResistances ?? [])])],
      immunities: [],
      vulnerabilities: [],
      conditionImmunities: [],
      harmfulStates: [],
    },
    initiative: modifiers.dexterite,
    attacks,

    movement: {
      walk: walkSpeed,
      climb: Math.floor(walkSpeed / 2),
      swim: Math.floor(walkSpeed / 2),
      jumpHeight: 3 + modifiers.force,
      jumpLength: 3 + modifiers.force,
    },
    senses: {
      passivePerception,
      hasDarkvision: c.hasDarkvision,
      darkvisionRadius: c.darkvisionRadius,
    },

    proficiencies: {
      armor: c.armorProficiencies,
      weapons: c.weaponProficiencies,
      tools: allTools,
      savingThrows: c.savingThrows,
      skills: [...new Set([...c.selectedSkills, ...c.backgroundSkills])],
      expertiseSkills: c.expertiseSkills ?? [],
      languages: c.languages,
      writingSystems: c.civilizationWritingSystems,
    },
    features,

    equipment: allEquipment,
    currency: mergedCurrency,
    carryCapacity: {
      currentKg: Math.round(totalWeight * 10) / 10,
      maxKg: maxCarry,
      encumberedAtKg: Math.round((maxCarry * 2) / 3),
      heavilyEncumberedAtKg: Math.round((maxCarry * 5) / 6),
      status:
        totalWeight > (maxCarry * 5) / 6
          ? 'heavily_encumbered'
          : totalWeight > (maxCarry * 2) / 3
            ? 'encumbered'
            : 'normal',
    },

    spellcasting,
    knownSpells,
    classResources: Object.fromEntries(
      Object.entries(c.classProgressionResources ?? {})
        .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
        .map(([k, v]) => [k, Number(v)]),
    ),
    ammunition: [],
    notes: '',

    personality: {
      description: c.description,
      sex: c.sex,
      background: c.background,
      backgroundId: c.backgroundId,
      story: c.story,
      awakened: false,
      ideal: c.ideal,
      traits: c.traits,
      alignment: c.alignment,
      bonds: c.bonds,
      flaws: c.flaws,
      handicap: c.handicap,
      madness: '',
      corruption: { stage1: 0, stage2: 0, stage3: 0, stage4: 0 },
    },
  };
}
