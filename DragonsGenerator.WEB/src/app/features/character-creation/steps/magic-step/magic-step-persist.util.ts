import { labelForGameId } from '@core/utils/game-id-labels';
import type { BonusSpellGrant, SpellDetailEntry, SpellcastingDetailsDraft } from './magic-step.types';

export type MagicPersistSpellLike = {
  id: string;
  name: string;
  level: number;
};

export type MagicPersistPick = {
  cantrips: string[];
  spells: string[];
  deityId: string | null;
};

export type MagicPersistDraft = SpellcastingDetailsDraft & {
  confirmed: true;
  deity: string;
  deityId: string;
  domain: string;
  domainId: string;
  hasFullSpellList: boolean;
  preparedCount: number;
  byClass: Record<string, MagicPersistPick>;
  patron: string;
  arcaneTradition: string;
  mysticArcanum: { spellLevel: number; spellId: string; spellName: string }[];
  spellMastery: { spellLevel: number; spellId: string; spellName: string }[];
  signatureSpells: { spellId: string; spellName: string }[];
  oathSpells: { characterLevel: number; spells: string[] }[];
};

export function persistMagicDraft(input: {
  casterClassIds: string[];
  picksByClass: Record<string, MagicPersistPick>;
  selectedCantrips: Iterable<string>;
  selectedSpells: Iterable<string>;
  racialGrants: { choiceId: string; label: string }[];
  racialCantripPicks: Record<string, string>;
  domainSpellIds: string[];
  arcanumLevels: number[];
  arcanumPicks: Record<number, string>;
  masteryPicks: Record<number, string>;
  signatureIds: string[];
  subclassBonusSpells: BonusSpellGrant[];
  targetLevel: number;
  deity: { id: string; name: string } | null;
  domainName: string;
  domainId: string;
  quota: { hasFullListAccess?: boolean; preparedSpells?: number } | null;
  spellsById: Map<string, MagicPersistSpellLike>;
  effectOf: (id: string | undefined) => string;
}): {
  details: MagicPersistDraft;
  mysticArcanumPicks: Record<string, string>;
  spellMasteryPicks: Record<string, string>;
  signatureSpellIds: string[];
  speciesChoiceAnswersPatch: Record<string, string[]>;
} {
  const mergedCantripIds = new Set<string>();
  const mergedSpellIds = new Set<string>();
  for (const classId of input.casterClassIds) {
    const p = input.picksByClass[classId];
    (p?.cantrips ?? []).forEach((id) => mergedCantripIds.add(id));
    (p?.spells ?? []).forEach((id) => mergedSpellIds.add(id));
  }
  if (!mergedCantripIds.size) {
    for (const id of input.selectedCantrips) mergedCantripIds.add(id);
  }
  if (!mergedSpellIds.size) {
    for (const id of input.selectedSpells) mergedSpellIds.add(id);
  }

  const nameOf = (id: string): string => input.spellsById.get(id)?.name ?? labelForGameId(id);

  const racialCantripInstances: SpellDetailEntry[] = [];
  for (const grant of input.racialGrants) {
    const id = input.racialCantripPicks[grant.choiceId];
    if (!id) continue;
    racialCantripInstances.push({
      refId: id,
      name: nameOf(id),
      level: 0,
      prepared: true,
      effectSummary: `${grant.label} · ${input.effectOf(id)}`,
    });
  }

  const cantripInstances: SpellDetailEntry[] = [
    ...racialCantripInstances,
    ...[...mergedCantripIds].map((id) => ({
      refId: id,
      name: nameOf(id),
      level: 0,
      prepared: true,
      effectSummary: input.effectOf(id),
    })),
  ];

  const chosenSpellIds = [...mergedSpellIds];
  const domainIds = input.domainSpellIds.filter((id) => !chosenSpellIds.includes(id));
  const spellInstances: SpellDetailEntry[] = [...chosenSpellIds, ...domainIds].map((id) => {
    const raw = input.spellsById.get(id);
    const isDomain = input.domainSpellIds.includes(id);
    return {
      refId: id,
      name: nameOf(id),
      level: raw?.level ?? 1,
      prepared: true,
      alwaysPrepared: isDomain,
      effectSummary: input.effectOf(id),
    };
  });

  const mysticArcanum: { spellLevel: number; spellId: string; spellName: string }[] = [];
  for (const spellLevel of input.arcanumLevels) {
    const spellId = input.arcanumPicks[spellLevel];
    if (!spellId) continue;
    mysticArcanum.push({ spellLevel, spellId, spellName: nameOf(spellId) });
  }

  for (const a of mysticArcanum) {
    if (spellInstances.some((s) => s.refId === a.spellId)) continue;
    spellInstances.push({
      refId: a.spellId,
      name: a.spellName,
      level: a.spellLevel,
      prepared: true,
      alwaysPrepared: true,
      effectSummary: `Arcane (1× / repos long) · ${input.effectOf(a.spellId)}`,
    });
  }

  const spellMastery: { spellLevel: number; spellId: string; spellName: string }[] = [];
  for (const spellLevel of [1, 2]) {
    const spellId = input.masteryPicks[spellLevel];
    if (!spellId) continue;
    spellMastery.push({ spellLevel, spellId, spellName: nameOf(spellId) });
  }

  const signatureSpells = input.signatureIds.slice(0, 2).map((spellId) => ({
    spellId,
    spellName: nameOf(spellId),
  }));

  for (const s of signatureSpells) {
    const existing = spellInstances.find((x) => x.refId === s.spellId);
    if (existing) {
      existing.alwaysPrepared = true;
      existing.effectSummary = `Sort attitré (1× / repos court ou long) · ${existing.effectSummary}`;
    }
  }
  for (const m of spellMastery) {
    const existing = spellInstances.find((x) => x.refId === m.spellId);
    if (existing) {
      existing.effectSummary = `Maîtrise (à volonté) · ${existing.effectSummary}`;
    }
  }

  const oathSpells = input.subclassBonusSpells
    .filter((g) => (g.level_unlocked ?? 99) <= input.targetLevel)
    .map((g) => ({
      characterLevel: g.level_unlocked ?? 0,
      spells: (g.spells ?? []).map((id) => nameOf(id)),
    }))
    .filter((g) => g.spells.length > 0);

  const deity = input.deity;
  const subclass = input.domainName;
  const details: MagicPersistDraft = {
    confirmed: true,
    cantrips: cantripInstances,
    spells: spellInstances,
    deity: deity?.name ?? '',
    deityId: deity?.id ?? '',
    domain: subclass,
    domainId: input.domainId,
    hasFullSpellList: input.quota?.hasFullListAccess ?? false,
    preparedCount: input.quota?.preparedSpells ?? 0,
    byClass: input.picksByClass,
    patron: subclass,
    arcaneTradition: subclass,
    mysticArcanum,
    spellMastery,
    signatureSpells,
    oathSpells,
  };

  const mysticArcanumPicks: Record<string, string> = {};
  for (const a of mysticArcanum) mysticArcanumPicks[String(a.spellLevel)] = a.spellId;
  const spellMasteryPicks: Record<string, string> = {};
  for (const m of spellMastery) spellMasteryPicks[String(m.spellLevel)] = m.spellId;

  const speciesChoiceAnswersPatch: Record<string, string[]> = {};
  for (const grant of input.racialGrants) {
    const pick = input.racialCantripPicks[grant.choiceId];
    if (pick) speciesChoiceAnswersPatch[grant.choiceId] = [pick];
  }

  return {
    details,
    mysticArcanumPicks,
    spellMasteryPicks,
    signatureSpellIds: signatureSpells.map((s) => s.spellId),
    speciesChoiceAnswersPatch,
  };
}
