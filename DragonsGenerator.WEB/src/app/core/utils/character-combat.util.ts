import type {
  Ability,
  AbilityScores,
  Attack,
  CharacterCreation,
  EquipmentInstance,
  FeatureInstance,
  SpellInstance,
} from '@core/models/Character/character';
import { ABILITY_LABEL_TO_KEY } from '@core/models/Character/character';

export interface CombatBuildContext {
  spellAbility?: Ability | null;
  classId?: string | null;
  /** Classe primaire + secondaires (moine / attaque supplémentaire / UD). */
  classIds?: string[];
  classFeatures?: FeatureInstance[];
  resources?: Record<string, number | string | null>;
}

export interface ArmorClassContext {
  classId?: string | null;
  classIds?: string[];
  subclassId?: string | null;
  subclassIds?: string[];
  classFeatures?: FeatureInstance[];
}

export function buildCharacterAttacks(
  equipment: EquipmentInstance[],
  modifiers: AbilityScores,
  proficiencyBonus: number,
  knownSpells: SpellInstance[] = [],
  ctx: CombatBuildContext = {},
): Attack[] {
  const spellAbility = ctx.spellAbility ?? null;
  const classIds = collectClassIds(ctx.classId, ctx.classIds);
  const isMonk = classIds.has('cls-moine');
  const martialArtsDie =
    typeof ctx.resources?.['martial_arts_die'] === 'string'
      ? String(ctx.resources['martial_arts_die'])
      : isMonk
        ? '1d4'
        : null;
  const unarmored = isUnarmoredForMonk(equipment);
  const canUseMartialArts = isMonk && unarmored && !!martialArtsDie;
  const extraAttacks = Math.max(0, Number(ctx.resources?.['extra_attacks'] ?? 0) || 0);
  const sneakDice =
    typeof ctx.resources?.['sneak_attack_dice'] === 'string'
      ? String(ctx.resources['sneak_attack_dice'])
      : null;

  const weaponAttacks = equipment
    .filter(
      (eq) =>
        (eq.customData as { isWeapon?: boolean })?.isWeapon === true ||
        (eq.refId ?? '').startsWith('wp-'),
    )
    .map((eq) => {
      const wd = (eq.customData ?? {}) as {
        damage?: string;
        damageType?: string;
        properties?: string[];
        subtype?: string | null;
      };
      const props = (wd.properties ?? []).map((p) => p.toLowerCase());
      const isRanged = props.some((p) => p.includes('projectile') || p.includes('lancer'));
      const isFinesse = props.some((p) => p.includes('finesse'));
      const monkWeapon = canUseMartialArts && isMonkWeapon(eq, props, wd.subtype);
      const abilityMod = isRanged
        ? modifiers.dexterite
        : isFinesse || monkWeapon
          ? Math.max(modifiers.force, modifiers.dexterite)
          : modifiers.force;
      const attackBonus = abilityMod + proficiencyBonus;
      const dmgMod = abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`;
      let damageDie = wd.damage ?? '?';
      if (monkWeapon && martialArtsDie && damageDie !== '?') {
        damageDie = pickHigherDie(damageDie, martialArtsDie);
      } else if (monkWeapon && martialArtsDie) {
        damageDie = martialArtsDie;
      }
      const rangeProp = (wd.properties ?? []).find(
        (p) => p.toLowerCase().includes('projectile') || p.toLowerCase().includes('lancer'),
      );
      return {
        name: eq.name,
        source: 'weapon' as const,
        refId: eq.refId,
        attackBonus,
        damage: `${damageDie}${damageDie !== '?' ? dmgMod : ''}`,
        damageType: wd.damageType ?? (monkWeapon ? 'contondant' : ''),
        range: isRanged ? (rangeProp ?? 'Distance') : 'Corps à corps',
        properties: [
          ...(wd.properties ?? []),
          ...(extraAttacks > 0 ? [`Attaques ×${1 + extraAttacks}`] : []),
          ...(sneakDice && (isFinesse || isRanged) ? [`Attaque sournoise ${sneakDice}`] : []),
        ],
      };
    });

  if (canUseMartialArts && martialArtsDie) {
    const abilityMod = Math.max(modifiers.force, modifiers.dexterite);
    const dmgMod = abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`;
    weaponAttacks.unshift({
      name: 'Mains nues',
      source: 'weapon' as const,
      refId: 'atk-unarmed-monk',
      attackBonus: abilityMod + proficiencyBonus,
      damage: `${martialArtsDie}${dmgMod}`,
      damageType: 'contondant',
      range: 'Corps à corps',
      properties: [
        'Arts martiaux',
        ...(extraAttacks > 0 ? [`Attaques ×${1 + extraAttacks}`] : []),
      ],
    });
  }

  const spellAttacks: Attack[] = [];
  if (weaponAttacks.length < 5 && knownSpells.length > 0) {
    const spellMod = spellAbility
      ? (modifiers[ABILITY_LABEL_TO_KEY[spellAbility]] ?? 0)
      : modifiers.sagesse;
    const attackBonus = spellMod + proficiencyBonus;
    for (const sp of knownSpells) {
      if (spellAttacks.length + weaponAttacks.length >= 5) break;
      if (sp.level > 0) continue;
      const summary = (sp.effectSummary ?? '').toLowerCase();
      const name = sp.name.toLowerCase();
      const looksOffensive =
        /dégât|degat|attaque|rayon|flamme|bolt|projectile|blessure|missile/.test(
          summary + ' ' + name,
        );
      if (!looksOffensive) continue;
      spellAttacks.push({
        name: sp.name,
        source: 'spell',
        refId: sp.refId,
        attackBonus,
        damage: 'sort',
        damageType: '',
        range: 'Sort',
        properties: [],
      });
    }
  }

  return [...weaponAttacks, ...spellAttacks];
}

/** Vitesse de marche : espèce + bonus moine sans armure (mètres). */
export function computeCharacterWalkSpeed(
  c: CharacterCreation,
  equipment: EquipmentInstance[],
): number {
  let walk = c.speciesSpeed || 9;
  const secondaryIds = ((c as { secondaryClasses?: { classId: string }[] }).secondaryClasses ?? []).map(
    (sc) => sc.classId,
  );
  const isMonk =
    c.classId === 'cls-moine' ||
    secondaryIds.includes('cls-moine') ||
    (c.classFeatures ?? []).some(
      (f) =>
        f.refId === 'feat-deplacement-sans-armure' ||
        f.refId === 'feat-mouvement-sans-armure',
    );
  if (isMonk && isUnarmoredForMonk(equipment)) {
    const extras = (
      (c as { secondaryClasses?: { classProgressionResources?: Record<string, number | string | null> }[] })
        .secondaryClasses ?? []
    ).map((sc) => sc.classProgressionResources ?? {});
    const bonus = Number(
      mergeClassProgressionResources(c.classProgressionResources ?? {}, extras)[
        'unarmored_movement_bonus_m'
      ] ?? 0,
    );
    if (!Number.isNaN(bonus) && bonus > 0) walk += bonus;
  }
  return walk;
}

export function isUnarmoredForMonk(equipment: EquipmentInstance[]): boolean {
  const armor = equipment.find(
    (e) =>
      e.equipped &&
      (e.customData as { isArmor?: boolean; isShield?: boolean })?.isArmor &&
      !(e.customData as { isShield?: boolean })?.isShield,
  );
  const shield = equipment.find(
    (e) => e.equipped && (e.customData as { isShield?: boolean })?.isShield,
  );
  return !armor && !shield;
}

export function isMonkWeapon(
  eq: EquipmentInstance,
  props: string[],
  subtype: string | null | undefined,
): boolean {
  const id = eq.refId ?? '';
  if (id === 'wp-epee-courte' || id === 'wp-cimeterre') return true;
  const sub = (subtype ?? '').toUpperCase();
  const isSimpleMelee =
    sub === 'SIMPLE_MELEE' ||
    sub.includes('SIMPLE_MELEE') ||
    (sub.includes('SIMPLE') && sub.includes('MELEE'));
  if (!isSimpleMelee) return false;
  const heavyOrTwoHanded = props.some(
    (p) =>
      p.includes('lourde') ||
      p.includes('heavy') ||
      p.includes('deux mains') ||
      p.includes('two-handed') ||
      p.includes('deux_mains'),
  );
  return !heavyOrTwoHanded;
}

/** Choisit le dé de dégâts le plus avantageux (ex. 1d6 > 1d4). */
export function pickHigherDie(a: string, b: string): string {
  const avg = (die: string): number => {
    const m = die.match(/(\d*)d(\d+)/i);
    if (!m) return 0;
    const n = parseInt(m[1] || '1', 10);
    const sides = parseInt(m[2], 10);
    return n * ((sides + 1) / 2);
  };
  return avg(a) >= avg(b) ? a : b;
}

/**
 * CA : armure équipée (avec plafond Dex) ou défense sans armure de classe,
 * + bouclier si autorisé, + style Défense (+1 avec armure).
 */
export function computeCharacterArmorClass(
  equipment: EquipmentInstance[],
  modifiers: AbilityScores,
  ctx?: ArmorClassContext,
): number {
  const armor = equipment.find(
    (e) =>
      e.equipped &&
      (e.customData as { isArmor?: boolean; isShield?: boolean })?.isArmor &&
      !(e.customData as { isShield?: boolean })?.isShield,
  );
  const shield = equipment.find(
    (e) => e.equipped && (e.customData as { isShield?: boolean })?.isShield,
  );

  const classIds = collectClassIds(ctx?.classId, ctx?.classIds);
  const subclassIds = new Set(
    [ctx?.subclassId, ...(ctx?.subclassIds ?? [])].filter((id): id is string => !!id),
  );
  const features = ctx?.classFeatures ?? [];
  const featureIds = new Set(features.map((f) => f.refId));

  const hasBarbarianUD =
    classIds.has('cls-barbare') || featureIds.has('feat-defense-sans-armure');
  const hasMonkUD =
    classIds.has('cls-moine') || featureIds.has('feat-defense-sans-armure-moine');
  const hasDraconicResilience =
    subclassIds.has('subcls-lignee-draconique') ||
    featureIds.has('feat-resistance-draconique');
  const hasDefenseStyle = features.some(
    (f) =>
      f.refId === 'style-defense' ||
      f.refId === 'feat-style-defense' ||
      f.refId === 'style-defense-rodeur' ||
      /^style-defense/i.test(f.refId ?? '') ||
      /Style\s*:\s*Défense/i.test(f.name ?? ''),
  );

  let ac: number;

  if (armor) {
    const data = armor.customData as {
      ac?: number;
      dexModifier?: { type?: string; max?: number } | string;
      maxDexBonus?: number | null;
    };
    const base = data.ac ?? 10;
    let dexBonus = modifiers.dexterite;
    const dexMod = data.dexModifier;
    const dexType = typeof dexMod === 'string' ? dexMod : dexMod?.type;

    if (dexType === 'none') {
      dexBonus = 0;
    } else if (dexType === 'max' || data.maxDexBonus != null) {
      const cap =
        data.maxDexBonus ??
        (typeof dexMod === 'object' ? dexMod?.max : undefined) ??
        2;
      dexBonus = Math.min(dexBonus, cap);
    }
    ac = base + dexBonus;

    if (hasDefenseStyle) ac += 1;
  } else if (hasBarbarianUD) {
    ac = 10 + modifiers.dexterite + modifiers.constitution;
  } else if (hasMonkUD && !shield) {
    ac = 10 + modifiers.dexterite + modifiers.sagesse;
  } else if (hasDraconicResilience) {
    ac = 13 + modifiers.dexterite;
  } else {
    ac = 10 + modifiers.dexterite;
  }

  if (shield) {
    const monkBlocksShield = hasMonkUD && !armor;
    if (!monkBlocksShield) {
      const shieldAc = (shield.customData as { ac?: number })?.ac ?? 2;
      ac += shieldAc;
    }
  }

  return ac;
}

export function findEquippedArmorName(equipment: EquipmentInstance[]): string {
  return (
    equipment.find((e) => e.equipped && (e.customData as { isArmor?: boolean })?.isArmor)?.name ??
    'Aucune'
  );
}

export function collectClassIds(
  primary?: string | null,
  extra?: string[] | null,
): Set<string> {
  return new Set([primary, ...(extra ?? [])].filter((id): id is string => !!id));
}

/** Fusionne rage/ki/extra_attacks/dés de moine/roublard entre classes. */
export function mergeClassProgressionResources(
  primary: Record<string, number | string | null>,
  extras: Record<string, number | string | null>[],
): Record<string, number | string | null> {
  const out: Record<string, number | string | null> = { ...primary };
  for (const extra of extras) {
    for (const [key, value] of Object.entries(extra)) {
      if (value == null) continue;
      if (key === 'extra_attacks' || key === 'unarmored_movement_bonus_m') {
        out[key] = Math.max(Number(out[key] ?? 0) || 0, Number(value) || 0);
        continue;
      }
      if (
        (key === 'martial_arts_die' || key === 'sneak_attack_dice') &&
        typeof value === 'string'
      ) {
        const current = out[key];
        out[key] = typeof current === 'string' ? pickHigherDie(current, value) : value;
        continue;
      }
      if (out[key] == null) {
        out[key] = value;
        continue;
      }
      if (typeof value === 'number' && typeof out[key] === 'number') {
        out[key] = Math.max(out[key] as number, value);
      }
    }
  }
  return out;
}
