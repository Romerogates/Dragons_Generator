import type { Ability, CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { FeatureInstance, SpellcastingKind } from '@core/models/Character/character';
import type {
  ExtendedCharacterCreation,
  SecondaryClassSelection,
} from '@core/models/Character/character-builder.types';
import { buildClassFeaturesForLevel } from './character-class-features.util';
import { multiclassProficiencies } from './progression-choices.util';

export const CLASS_SPELLCASTING: Record<string, { kind: SpellcastingKind; ability: Ability } | null> = {
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

export const SPELLCASTING_FROM_LEVEL: Record<string, number> = {
  'cls-paladin': 2,
  'cls-rodeur': 2,
};

/** Sous-classes qui débloquent l'incantation alors que la classe racine n'incante pas. (PHB EK/AT : pas dans Eana.) */
export const SUBCLASS_SPELLCASTING: Record<
  string,
  { kind: SpellcastingKind; ability: Ability; fromLevel: number }
> = {};

export interface ResolvedClassSpellcasting {
  kind: SpellcastingKind;
  ability: Ability;
}

export function resolveClassSpellcasting(
  classId: string,
  level: number,
  subclassId?: string | null,
): ResolvedClassSpellcasting | null {
  if (subclassId) {
    const sub = SUBCLASS_SPELLCASTING[subclassId];
    if (sub && level >= sub.fromLevel) return { kind: sub.kind, ability: sub.ability };
  }
  const fromLevel = SPELLCASTING_FROM_LEVEL[classId] ?? 1;
  if (level < fromLevel) return null;
  return CLASS_SPELLCASTING[classId] ?? null;
}

export interface CasterSource {
  classId: string;
  className: string;
  subclassId: string | null;
  subclassName: string | null;
  level: number;
  kind: SpellcastingKind;
  ability: Ability;
  isPrimary: boolean;
}

/** Toutes les classes (primaire + secondaires) qui incantent vraiment à leur niveau actuel. */
export function collectCasterSources(c: ExtendedCharacterCreation): CasterSource[] {
  const out: CasterSource[] = [];
  const primaryLevel = c.targetLevel || 1;
  const resolvedPrimary = c.classId
    ? resolveClassSpellcasting(c.classId, primaryLevel, c.subclassId)
    : null;
  const primary =
    resolvedPrimary ??
    (c.hasSpellcasting && c.spellcastingKind && c.spellcastingAbility
      ? { kind: c.spellcastingKind, ability: c.spellcastingAbility }
      : null);
  if (c.classId && primary) {
    out.push({
      classId: c.classId,
      className: c.className ?? c.classId,
      subclassId: c.subclassId,
      subclassName: c.subclassName,
      level: primaryLevel,
      kind: primary.kind,
      ability: primary.ability,
      isPrimary: true,
    });
  }
  for (const sc of c.secondaryClasses ?? []) {
    const resolved = resolveClassSpellcasting(sc.classId, sc.level, sc.subclassId)
      ?? (sc.hasSpellcasting && sc.spellcastingKind && sc.spellcastingAbility
        ? { kind: sc.spellcastingKind, ability: sc.spellcastingAbility }
        : null);
    if (!resolved) continue;
    out.push({
      classId: sc.classId,
      className: sc.className,
      subclassId: sc.subclassId ?? null,
      subclassName: sc.subclassName ?? null,
      level: sc.level,
      kind: resolved.kind,
      ability: resolved.ability,
      isPrimary: false,
    });
  }
  return out;
}

export function creationNeedsMagicStep(c: ExtendedCharacterCreation): boolean {
  if ((c.racialSpellGrants?.length ?? 0) > 0) return true;
  return collectCasterSources(c).length > 0;
}

/** Premier lanceur (souvent le primaire, sinon la 1re classe secondaire qui incante). */
export function primaryCasterSource(c: ExtendedCharacterCreation): CasterSource | null {
  return collectCasterSources(c)[0] ?? null;
}

export function buildSecondaryClassSelection(
  cls: CharacterClass,
  level: number,
  subclassId: string | null,
  subclassName: string | null,
  extras?: {
    classChoiceAnswers?: Record<string, string[]>;
    pactBoon?: string | null;
    eldritchInvocations?: string[];
    metamagicOptions?: string[];
    extraFeatures?: FeatureInstance[];
  },
): SecondaryClassSelection {
  const hitDie = cls.data.hit_die || 8;
  const prof = multiclassProficiencies(cls);
  const spell = resolveClassSpellcasting(cls.id, level, subclassId);
  const extraFeatures = extras?.extraFeatures ?? [];
  const { classFeatures, classProgressionResources } = buildClassFeaturesForLevel(
    cls,
    {
      classId: cls.id,
      subclassId,
      hasSpellcasting: spell !== null,
      spellcastingKind: spell?.kind ?? null,
      spellcastingAbility: spell?.ability ?? null,
      existingClassFeatures: extraFeatures,
    },
    level,
  );
  const mergedFeatures = [
    ...classFeatures.filter((f) => !extraFeatures.some((e) => e.refId && e.refId === f.refId)),
    ...extraFeatures,
  ];
  return {
    classId: cls.id,
    className: cls.name,
    subclassId,
    subclassName,
    level,
    hitDie,
    hpPerLevelAverage: Math.floor(hitDie / 2) + 1,
    hasSpellcasting: spell !== null,
    spellcastingKind: spell?.kind ?? null,
    spellcastingAbility: spell?.ability ?? null,
    armorProficiencies: prof.armor,
    weaponProficiencies: prof.weapons,
    toolProficiencies: prof.tools,
    skillChooseCount: prof.skillChooseCount,
    skillOptions: prof.skillOptions,
    classFeatures: mergedFeatures,
    classProgressionResources,
    classChoiceAnswers: extras?.classChoiceAnswers,
    pactBoon: extras?.pactBoon ?? null,
    eldritchInvocations: extras?.eldritchInvocations ?? [],
    metamagicOptions: extras?.metamagicOptions ?? [],
  };
}
