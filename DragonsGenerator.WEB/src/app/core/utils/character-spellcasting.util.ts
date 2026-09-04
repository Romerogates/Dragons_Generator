import { invocationLabel, pactBoonLabel } from '@core/data/warlock-invocations.data';
import { metamagicLabel } from '@core/data/metamagic-labels.data';
import type {
  AbilityScores,
  CharacterCreation,
  CharacterSpellcasting,
  EquipmentInstance,
  FeatureInstance,
  SpellcastingKind,
  SpellInstance,
} from '@core/models/Character/character';
import { ABILITY_LABEL_TO_KEY } from '@core/models/Character/character';
import { proficiencyBonusForLevel } from './character-progression.util';

export function buildKnownSpellsFromCreation(c: CharacterCreation): SpellInstance[] {
  const details = c.spellcastingDetails as
    | {
        cantrips?: {
          refId: string;
          name: string;
          level: number;
          prepared: boolean;
          effectSummary?: string;
        }[];
        spells?: {
          refId: string;
          name: string;
          level: number;
          prepared: boolean;
          alwaysPrepared?: boolean;
          effectSummary?: string;
        }[];
      }
    | undefined;
  if (!details) return [];
  const result: SpellInstance[] = [];
  if (details.cantrips) {
    for (const s of details.cantrips) {
      result.push({
        refId: s.refId,
        name: s.name,
        level: 0,
        prepared: true,
        effectSummary: s.effectSummary,
      });
    }
  }
  if (details.spells) {
    for (const s of details.spells) {
      result.push({
        refId: s.refId,
        name: s.name,
        level: s.level,
        prepared: s.prepared ?? true,
        alwaysPrepared: s.alwaysPrepared,
        effectSummary: s.effectSummary,
      });
    }
  }
  return result;
}

export function detectSpellcastingFocus(c: CharacterCreation): string | null {
  const KEYWORDS = [
    'luth',
    'lyre',
    'flûte',
    'flute',
    'tambour',
    'viole',
    'cor',
    'cornemuse',
    'bombarde',
    'dulcimer',
    'baguette',
    'orbe',
    'bâton',
    'cristal',
    'focaliseur',
    'sceptre',
    'symbole sacré',
    'reliquaire',
    'amulette',
    'emblème',
    'totem',
    'gui',
  ];
  const allEquip: EquipmentInstance[] = [
    ...(c.selectedEquipment ?? []),
    ...((c as CharacterCreation & { backgroundEquipment?: EquipmentInstance[] })
      .backgroundEquipment ?? []),
  ];
  for (const eq of allEquip) {
    const name = eq.name.toLowerCase();
    if (KEYWORDS.some((k) => name.includes(k))) return eq.name;
  }
  return null;
}

/**
 * Emplacements de sorts selon le type d'incantateur et le niveau.
 * Tables SRD-like (full / half / warlock).
 */
export function spellSlotsForCharacterLevel(
  kind: SpellcastingKind | null,
  level: number,
  jsonSlots?: { level: number; max: number }[],
): { level: number; max: number }[] {
  if (!kind) return [];
  if (jsonSlots?.length) return jsonSlots.map((s) => ({ ...s }));
  const lvl = Math.min(20, Math.max(1, level));

  const FULL: Record<number, number[]> = {
    1: [2],
    2: [3],
    3: [4, 2],
    4: [4, 3],
    5: [4, 3, 2],
    6: [4, 3, 3],
    7: [4, 3, 3, 1],
    8: [4, 3, 3, 2],
    9: [4, 3, 3, 3, 1],
    10: [4, 3, 3, 3, 2],
    11: [4, 3, 3, 3, 2, 1],
    12: [4, 3, 3, 3, 2, 1],
    13: [4, 3, 3, 3, 2, 1, 1],
    14: [4, 3, 3, 3, 2, 1, 1],
    15: [4, 3, 3, 3, 2, 1, 1, 1],
    16: [4, 3, 3, 3, 2, 1, 1, 1],
    17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
    18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
    20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
  };
  const HALF: Record<number, number[]> = {
    1: [],
    2: [2],
    3: [3],
    4: [3],
    5: [4, 2],
    6: [4, 2],
    7: [4, 3],
    8: [4, 3],
    9: [4, 3, 2],
    10: [4, 3, 2],
    11: [4, 3, 3],
    12: [4, 3, 3],
    13: [4, 3, 3, 1],
    14: [4, 3, 3, 1],
    15: [4, 3, 3, 2],
    16: [4, 3, 3, 2],
    17: [4, 3, 3, 3, 1],
    18: [4, 3, 3, 3, 1],
    19: [4, 3, 3, 3, 2],
    20: [4, 3, 3, 3, 2],
  };
  const WARLOCK: Record<number, { slotLevel: number; count: number }> = {
    1: { slotLevel: 1, count: 1 },
    2: { slotLevel: 1, count: 2 },
    3: { slotLevel: 2, count: 2 },
    4: { slotLevel: 2, count: 2 },
    5: { slotLevel: 3, count: 2 },
    6: { slotLevel: 3, count: 2 },
    7: { slotLevel: 4, count: 2 },
    8: { slotLevel: 4, count: 2 },
    9: { slotLevel: 5, count: 2 },
    10: { slotLevel: 5, count: 2 },
    11: { slotLevel: 5, count: 3 },
    12: { slotLevel: 5, count: 3 },
    13: { slotLevel: 5, count: 3 },
    14: { slotLevel: 5, count: 3 },
    15: { slotLevel: 5, count: 3 },
    16: { slotLevel: 5, count: 3 },
    17: { slotLevel: 5, count: 4 },
    18: { slotLevel: 5, count: 4 },
    19: { slotLevel: 5, count: 4 },
    20: { slotLevel: 5, count: 4 },
  };

  const fullKinds: SpellcastingKind[] = ['wizard', 'sorcerer', 'bard', 'cleric', 'druid'];
  const halfKinds: SpellcastingKind[] = ['paladin', 'ranger', 'fighter_eldritch_knight'];

  if (kind === 'warlock') {
    const w = WARLOCK[lvl] ?? WARLOCK[1];
    return [{ level: w.slotLevel, max: w.count }];
  }

  const table = fullKinds.includes(kind)
    ? FULL
    : halfKinds.includes(kind)
      ? HALF
      : FULL;
  const counts = table[lvl] ?? [];
  return counts.map((max, i) => ({ level: i + 1, max })).filter((s) => s.max > 0);
}

export function buildCharacterSpellcasting(
  c: CharacterCreation,
  modifiers: AbilityScores,
  opts?: { totalLevel?: number; warlockLevel?: number },
): CharacterSpellcasting | null {
  if (!c.spellcastingKind || !c.spellcastingAbility) return null;
  const abilityKey = ABILITY_LABEL_TO_KEY[c.spellcastingAbility];
  const spellMod = modifiers[abilityKey] ?? 0;
  const details = c.spellcastingDetails as
    | { cantrips?: unknown[]; spells?: unknown[] }
    | undefined;
  const cantripCount = Array.isArray(details?.cantrips) ? details.cantrips.length : 0;
  const focus = detectSpellcastingFocus(c);
  const classLevel = Math.min(20, Math.max(1, c.targetLevel || 1));
  const profLevel = Math.min(20, Math.max(1, opts?.totalLevel ?? classLevel));
  const prof = proficiencyBonusForLevel(profLevel);
  const slots = spellSlotsForCharacterLevel(c.spellcastingKind, classLevel, c.classSpellSlots).map(
    (s) => ({ ...s, used: 0 }),
  );
  const warlockLevel = opts?.warlockLevel;
  const pactSlots =
    warlockLevel && warlockLevel > 0
      ? spellSlotsForCharacterLevel('warlock', warlockLevel).map((s) => ({ ...s, used: 0 }))
      : undefined;
  const base = {
    ability: c.spellcastingAbility,
    spellSaveDC: 8 + prof + spellMod,
    spellAttackBonus: prof + spellMod,
    focus,
    spellSlots: slots,
    cantrips: { max: cantripCount, used: 0 },
    ...(pactSlots?.length && c.spellcastingKind !== 'warlock' ? { pactSlots } : {}),
  };
  const d = (details ?? {}) as Record<string, unknown>;
  const detailStr = (key: string, fallback = ''): string => {
    const v = d[key];
    return typeof v === 'string' ? v : fallback;
  };
  const detailArr = <T>(key: string): T[] =>
    Array.isArray(d[key]) ? (d[key] as T[]) : [];

  switch (c.spellcastingKind) {
    case 'wizard': {
      const masteryDetail = detailArr<{
        spellLevel: number;
        spellId: string;
        spellName: string;
      }>('spellMastery');
      const sigDetail = detailArr<{ spellId: string; spellName: string }>('signatureSpells');
      const masteryFromCreation = Object.entries(c.spellMasteryPicks ?? {}).map(
        ([lvl, spellId]) => {
          const spellLevel = Number(lvl);
          const hit = masteryDetail.find((d) => d.spellLevel === spellLevel);
          return {
            spellLevel,
            spellId,
            spellName: hit?.spellName ?? spellId,
          };
        },
      );
      const signatureFromCreation = (c.signatureSpellIds ?? []).map((spellId) => {
        const hit = sigDetail.find((d) => d.spellId === spellId);
        return { spellId, spellName: hit?.spellName ?? spellId };
      });
      return {
        ...base,
        kind: 'wizard',
        arcaneTradition: detailStr('arcaneTradition', c.subclassName ?? ''),
        spellMastery: masteryDetail.length ? masteryDetail : masteryFromCreation,
        signatureSpells: sigDetail.length ? sigDetail : signatureFromCreation,
      };
    }
    case 'sorcerer':
      return {
        ...base,
        kind: 'sorcerer',
        atavism: detailStr('atavism', c.subclassName ?? ''),
        sorceryPoints: {
          max: Number(c.classProgressionResources?.['arcane_points'] ?? 0) || 0,
          current: Number(c.classProgressionResources?.['arcane_points'] ?? 0) || 0,
        },
        metamagic: (c.metamagicOptions ?? []).map(metamagicLabel),
      };
    case 'warlock': {
      const arcanumPicks = c.mysticArcanumPicks ?? {};
      const detailArcanum = detailArr<{
        spellLevel: number;
        spellId: string;
        spellName: string;
      }>('mysticArcanum');
      const mysticArcanum = Object.entries(arcanumPicks)
        .map(([lvl, spellId]) => {
          const spellLevel = Number(lvl);
          const hit = detailArcanum.find(
            (d) => d.spellLevel === spellLevel || d.spellId === spellId,
          );
          return {
            spellLevel,
            spellId,
            spellName: hit?.spellName ?? spellId,
          };
        })
        .filter((a) => a.spellLevel >= 6 && !!a.spellId)
        .sort((a, b) => a.spellLevel - b.spellLevel);
      return {
        ...base,
        kind: 'warlock',
        patron: detailStr('patron', c.subclassName ?? ''),
        pact: pactBoonLabel(c.pactBoon),
        eldritchInvocations: (c.eldritchInvocations ?? []).map(invocationLabel),
        mysticArcanum,
      };
    }
    case 'cleric': {
      const channelUses =
        Number(c.classProgressionResources?.['conduit_divin_uses'] ?? 0) || 1;
      const channels = (c.classFeatures ?? [])
        .filter((f: FeatureInstance) => {
          const id = f.refId ?? '';
          return (
            id.startsWith('feat-conduit-divin-') &&
            !id.endsWith('-2repos') &&
            !id.endsWith('-3repos')
          );
        })
        .map((f) => ({
          id: f.refId ?? '',
          name: f.name,
          desc: f.desc ?? '',
          uses: { max: channelUses, current: channelUses },
        }));
      return {
        ...base,
        kind: 'cleric',
        deity: detailStr('deity'),
        domain: detailStr('domain', c.subclassName ?? ''),
        divineChannels: channels,
      };
    }
    case 'druid': {
      const hasTrance = (c.classFeatures ?? []).some(
        (f) => f.refId === 'feat-transe-mystique',
      );
      const circleFromDetails = detailArr<string>('circleSpells');
      return {
        ...base,
        kind: 'druid',
        druidCircle: detailStr('druidCircle', c.subclassName ?? ''),
        circleSpells: circleFromDetails,
        mysticTranceAvailable: hasTrance,
        mysticTranceUsed: false,
      };
    }
    case 'bard':
      return { ...base, kind: 'bard', bardicCollege: c.subclassName ?? '' };
    case 'ranger':
      return {
        ...base,
        kind: 'ranger',
        knownSpellsCount: Array.isArray(details?.spells) ? details.spells.length : 0,
      };
    case 'paladin': {
      const oathFromDetails = detailArr<{
        characterLevel: number;
        spells: string[];
      }>('oathSpells');
      return {
        ...base,
        kind: 'paladin',
        oath: c.subclassName ?? '',
        oathSpells: oathFromDetails,
      };
    }
    case 'fighter_eldritch_knight':
      return {
        ...base,
        kind: 'fighter_eldritch_knight',
        soulWeapon: {
          name: '',
          bondedAbilityModifiers: { intelligence: 0, sagesse: 0, charisme: 0 },
        },
        magicAbility: 'Intelligence',
      };
    default:
      return null;
  }
}
