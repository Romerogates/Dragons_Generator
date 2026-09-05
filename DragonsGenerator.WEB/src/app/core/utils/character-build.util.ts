import type {
  AbilityScores,
  Character,
  Currency,
  FeatureInstance,
} from '@core/models/Character/character';
import { ABILITY_KEY_TO_LABEL, CURRENT_SCHEMA_VERSION } from '@core/models/Character/character';
import type { ExtendedCharacterCreation } from '@core/models/Character/character-builder.types';
import {
  buildCharacterAttacks,
  computeCharacterArmorClass,
  computeCharacterWalkSpeed,
  findEquippedArmorName,
  mergeClassProgressionResources,
} from './character-combat.util';
import {
  attachWarlockFlavor,
  buildCharacterSpellcasting,
  buildKnownSpellsFromCreation,
} from './character-spellcasting.util';
import {
  combinedCasterLevel,
  multiclassSpellSlotsForCasterLevel,
} from './progression-choices.util';
import { collectCasterSources } from './class-spellcasting.util';

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

  // Multiclassage (RAW) : classes secondaires ajoutées en plus de la classe primaire ci-dessus.
  const secondaryClasses = c.secondaryClasses ?? [];
  const secondaryTotalLevel = secondaryClasses.reduce((sum, sc) => sum + (sc.level || 0), 0);
  const totalCharacterLevel = targetLevel + secondaryTotalLevel;

  const casters = collectCasterSources(c);
  const leadCaster = casters[0] ?? null;
  let creationForSpellcasting = leadCaster
    ? {
        ...c,
        hasSpellcasting: true,
        spellcastingKind: leadCaster.kind,
        spellcastingAbility: leadCaster.ability,
      }
    : c;
  if (casters.length > 1 || (leadCaster && !leadCaster.isPrimary)) {
    const casterLevel = combinedCasterLevel(
      casters.map((src) => ({ level: src.level, spellcastingKind: src.kind })),
    );
    if (casterLevel > 0 && leadCaster?.kind !== 'warlock') {
      creationForSpellcasting = {
        ...creationForSpellcasting,
        classSpellSlots: multiclassSpellSlotsForCasterLevel(casterLevel),
      };
    }
  } else if (secondaryClasses.length > 0) {
    const casterLevel = combinedCasterLevel([
      { level: targetLevel, spellcastingKind: c.spellcastingKind },
      ...secondaryClasses.map((sc) => ({ level: sc.level, spellcastingKind: sc.spellcastingKind })),
    ]);
    if (casterLevel > 0) {
      creationForSpellcasting = {
        ...creationForSpellcasting,
        classSpellSlots: multiclassSpellSlotsForCasterLevel(casterLevel),
      };
    }
  }

  const warlockCaster = casters.find((src) => src.kind === 'warlock');
  const built = buildCharacterSpellcasting(creationForSpellcasting, modifiers, {
    totalLevel: totalCharacterLevel,
    warlockLevel: warlockCaster?.level,
  });
  const spellcasting = built ? attachWarlockFlavor(built, creationForSpellcasting) : null;
  const features: FeatureInstance[] = [
    ...c.speciesTraits,
    ...c.classFeatures,
    ...secondaryClasses.flatMap((sc) => sc.classFeatures),
  ];
  const featIds =
    c.selectedFeatIds?.length > 0
      ? c.selectedFeatIds
      : c.selectedFeatId
        ? [c.selectedFeatId]
        : [];
  for (const featId of featIds) {
    const featSlot = c.asiChoices?.find((s) => s.mode === 'feat' && s.featId === featId);
    const details = c.featDetailsById?.[featId];
    features.push({
      refId: featId,
      name: details?.name ?? featId.replace(/^don-/, '').replace(/-/g, ' '),
      desc: details?.desc ?? 'Don choisi à la place d’une augmentation de caractéristique.',
      source: 'feat',
      sourceDetail: 'ASI',
      level: featSlot?.level ?? 4,
    });
  }

  const allEquipmentForAttacks = [...c.selectedEquipment, ...(c.backgroundEquipment ?? [])];
  const knownSpells = [
    ...buildKnownSpellsFromCreation(c),
    ...(c.speciesInnateSpells ?? []),
    ...(c.talentBonusCantrips ?? []),
  ];
  const mergedFeatures = [
    ...c.classFeatures,
    ...secondaryClasses.flatMap((sc) => sc.classFeatures),
  ];
  const mergedResources = mergeClassProgressionResources(
    c.classProgressionResources ?? {},
    secondaryClasses.map((sc) => sc.classProgressionResources ?? {}),
  );
  const classIds = [c.classId, ...secondaryClasses.map((sc) => sc.classId)].filter(
    (id): id is string => !!id,
  );
  const subclassIds = [c.subclassId, ...secondaryClasses.map((sc) => sc.subclassId)].filter(
    (id): id is string => !!id,
  );
  const attacks = buildCharacterAttacks(
    allEquipmentForAttacks,
    modifiers,
    proficiencyBonus,
    knownSpells,
    {
      spellAbility: c.spellcastingAbility,
      classId: c.classId,
      classIds,
      classFeatures: mergedFeatures,
      resources: mergedResources,
    },
  );

  const allEquipment = [...c.selectedEquipment, ...c.backgroundEquipment];
  const totalWeight = allEquipment.reduce((sum, item) => sum + (item.wKg ?? 0) * item.qty, 0);
  const maxCarry = abilities.force * 7.5;

  const armorClass = computeCharacterArmorClass(allEquipment, modifiers, {
    classId: c.classId,
    classIds,
    subclassId: c.subclassId,
    subclassIds,
    classFeatures: mergedFeatures,
  });

  const walkSpeed = computeCharacterWalkSpeed(c, allEquipment);

  const mergedCurrency: Currency = {
    cuivre: c.currency.cuivre + c.backgroundCurrency.cuivre,
    argent: c.currency.argent + c.backgroundCurrency.argent,
    or: c.currency.or + c.backgroundCurrency.or,
    platine: c.currency.platine + c.backgroundCurrency.platine,
  };

  const allTools = [
    ...new Set([
      ...c.toolProficiencies,
      ...c.backgroundTools,
      ...(c.speciesFixedTools ?? []),
      ...(c.featBonusTools ?? []),
      ...secondaryClasses.flatMap((sc) => sc.toolProficiencies),
    ]),
  ];
  const allArmor = [
    ...new Set([
      ...c.armorProficiencies,
      ...(c.speciesFixedArmor ?? []),
      ...(c.featBonusArmor ?? []),
      ...secondaryClasses.flatMap((sc) => sc.armorProficiencies),
    ]),
  ];
  const allWeapons = [
    ...new Set([
      ...c.weaponProficiencies,
      ...(c.speciesFixedWeapons ?? []),
      ...(c.talentBonusWeapons ?? []),
      ...secondaryClasses.flatMap((sc) => sc.weaponProficiencies),
    ]),
  ];

  // PV par classe (RAW : dés de vie groupés par type, ex. "1×d10 + 1×d6").
  const hitDiceByType = new Map<number, number>();
  hitDiceByType.set(c.hitDie, (hitDiceByType.get(c.hitDie) ?? 0) + targetLevel);
  for (const sc of secondaryClasses) {
    hitDiceByType.set(sc.hitDie, (hitDiceByType.get(sc.hitDie) ?? 0) + sc.level);
  }
  const hitDice = [...hitDiceByType.entries()].map(([dieType, total]) => ({
    dieType,
    total,
    used: 0,
  }));

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
      ...secondaryClasses.map((sc) => ({
        classId: sc.classId,
        classLabel: sc.className,
        ...(sc.subclassId ? { subclassId: sc.subclassId, subclassLabel: sc.subclassName! } : {}),
        level: sc.level,
        hitDie: sc.hitDie,
      })),
    ],
    totalLevel: totalCharacterLevel,
    experience: 0,

    abilities,
    abilityModifiers: modifiers,
    proficiencyBonus,

    vitality: {
      hitPointsMax: hpMax,
      hitPointsCurrent: hpMax,
      hitPointsTemporary: 0,
      woundThreshold: Math.ceil(hpMax / 2),
      hitDice,
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
      resistances: [
        ...new Set([...c.speciesResistances, ...(c.classResistances ?? []), ...(c.featResistances ?? [])]),
      ],
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
      hasDarkvision:
        c.hasDarkvision || (c.classDarkvisionRadius ?? 0) > 0 || (c.featDarkvisionRadius ?? 0) > 0,
      darkvisionRadius: Math.max(
        c.darkvisionRadius,
        c.classDarkvisionRadius ?? 0,
        c.featDarkvisionRadius ?? 0,
      ),
      hasBlindsight: c.classHasBlindsight ?? false,
      blindsightRadius: c.classBlindsightRadius ?? 0,
    },

    proficiencies: {
      armor: allArmor,
      weapons: allWeapons,
      tools: allTools,
      savingThrows: [
        ...new Set([
          ...c.savingThrows,
          ...(c.talentSavingThrows ?? []).map((k) => ABILITY_KEY_TO_LABEL[k as keyof typeof ABILITY_KEY_TO_LABEL]),
        ]),
      ],
      skills: [
        ...new Set([
          ...c.selectedSkills,
          ...c.backgroundSkills,
          ...(c.speciesFixedSkills ?? []),
          ...(c.talentBonusSkills ?? []),
        ]),
      ],
      expertiseSkills: [
        ...new Set([...(c.expertiseSkills ?? []), ...(c.talentExpertiseSkills ?? [])]),
      ],
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
      Object.entries(mergedResources)
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

    // Persistés pour permettre une réédition fiable (montée de niveau) sans reperdre les choix.
    classChoiceAnswers: c.classChoiceAnswers,
    asiChoices: c.asiChoices,
    wizardAbilitySnapshot: {
      baseAbilities: c.baseAbilities,
      racialBonuses: c.racialBonuses ?? {},
    },
    secondaryClassSelections: secondaryClasses.length ? secondaryClasses : undefined,
  };
}
