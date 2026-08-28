import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Species, Subspecies } from '@core/models/Species/species';
import type { FeatureInstance, Size } from '@core/models/Character/character';
import type { ClassSelection, SpeciesSelection } from '@core/services/character-builder.service';
import { apiAsiToPartialScores, mergePartialScores } from '@core/utils/ability-mapping';
import { extractScalarResources, resolveFeatureUses } from '@core/utils/feature-uses.util';
import { proficiencyBonusForLevel } from '@core/services/character-builder.service';

const HERO_NAMES = [
  'Kael',
  'Lyra',
  'Thorin',
  'Mira',
  'Dorn',
  'Sera',
  'Viktor',
  'Naïla',
  'Ewan',
  'Zara',
  'Bryn',
  'Iska',
  'Orrin',
  'Ysolde',
];

export function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

export function randomHeroName(): string {
  return pickRandom(HERO_NAMES) ?? 'Aventurier';
}

export function buildSpeciesSelection(species: Species): SpeciesSelection {
  const playableSubs = (species.subspecies ?? []).filter((s) => s.playable);
  const sub: Subspecies | null = playableSubs.length ? pickRandom(playableSubs) : null;
  const baseAsi = apiAsiToPartialScores(species.baseStats.abilityScoreIncrease);
  const subAsi = sub ? apiAsiToPartialScores(sub.abilityScoreIncrease) : {};
  const racialBonuses = mergePartialScores(baseAsi, subAsi);

  const traits = [...(species.traits ?? []), ...(sub?.traits ?? [])].map((t) => ({
    refId: t.id,
    name: t.name,
    desc: t.desc,
    source: 'species' as const,
    sourceDetail: sub ? `${species.name} (${sub.name})` : species.name,
    level: 1,
  }));

  const languages = [
    ...(species.languages?.fixed ?? []),
    ...(sub?.languages?.fixed ?? []),
  ];

  return {
    speciesId: species.id,
    speciesName: species.name,
    subspeciesId: sub?.id ?? null,
    subspeciesName: sub?.name ?? null,
    racialBonuses,
    traits,
    speed: species.baseStats.speedM,
    size: (species.baseStats.size ?? 'M') as Size,
    languages,
    bonusLanguageCount: (species.languages?.choiceCount ?? 0) + (sub?.languages?.choiceCount ?? 0),
    bonusSkillCount: 0,
    bonusToolCount: 0,
    resistances: [],
    hasDarkvision: (species.baseStats.darkvisionM ?? 0) > 0,
    darkvisionRadius: species.baseStats.darkvisionM ?? 0,
    choiceAnswers: {},
    racialSpellGrants: [],
  };
}

function resolveClassFeature(
  cls: CharacterClass,
  featureId: string,
  level: number,
  profBonus: number,
): FeatureInstance | null {
  const details = cls.data.features_details ?? [];
  const feat = details.find((f) => f.id === featureId);
  if (!feat) return null;
  return {
    refId: feat.id,
    name: feat.name,
    desc: feat.desc,
    source: 'class',
    sourceDetail: cls.name,
    level: feat.level ?? level,
    uses: resolveFeatureUses(feat, cls, level, profBonus),
  };
}

export function buildClassSelection(cls: CharacterClass, targetLevel: number): ClassSelection {
  const prof = cls.data.proficiencies;
  const profBonus = proficiencyBonusForLevel(targetLevel);
  const progression = cls.data.progression ?? [];
  const features: FeatureInstance[] = [];

  for (const prog of progression) {
    if (prog.level > targetLevel) continue;
    for (const fid of prog.features ?? []) {
      const feat = resolveClassFeature(cls, fid, prog.level, profBonus);
      if (feat) features.push(feat);
    }
  }

  const progAtLevel = progression.find((p) => p.level === targetLevel);
  const data = cls.data as Record<string, unknown>;

  let spellInfo: { kind: ClassSelection['spellcastingKind']; ability: ClassSelection['spellcastingAbility'] } | null =
    null;
  if (cls.data.spellcasting?.ability) {
    spellInfo = {
      kind: null,
      ability: cls.data.spellcasting.ability,
    };
  }

  return {
    classId: cls.id,
    className: cls.name,
    hitDie: cls.data.hit_die,
    hpAtLevel1: typeof data['hp_at_level_1'] === 'number' ? data['hp_at_level_1'] : cls.data.hit_die,
    hpPerLevelAverage:
      typeof data['hp_per_level_average'] === 'number'
        ? data['hp_per_level_average']
        : Math.floor(cls.data.hit_die / 2) + 1,
    hasSpellcasting: spellInfo !== null,
    spellcastingKind: spellInfo?.kind ?? null,
    spellcastingAbility: spellInfo?.ability ?? null,
    savingThrows: prof.saving_throws ?? [],
    armorProficiencies: prof.armor ?? [],
    weaponProficiencies: prof.weapons ?? [],
    toolProficiencies: Array.isArray(prof.tools) ? prof.tools : [],
    skillOptions: Array.isArray(prof.skills?.options) ? prof.skills.options : [],
    skillChooseCount: prof.skills?.count ?? 0,
    classFeatures: features,
    startingEquipmentSlots: cls.data.starting_equipment ?? [],
    classProgressionResources: extractScalarResources(progAtLevel?.resources),
    classBonusLanguageCount: 0,
    classSpellSlots: [],
  };
}
