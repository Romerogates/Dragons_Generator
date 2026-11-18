import type { Ability, AbilityKey } from '@core/models/Character/character';
import { ABILITY_LABEL_TO_KEY } from '@core/models/Character/character';
import type { SpellcastingDetailsDraft } from './magic-step.types';

const ABILITY_ALIAS: Record<string, AbilityKey> = {
  str: 'force',
  dex: 'dexterite',
  con: 'constitution',
  int: 'intelligence',
  wis: 'sagesse',
  cha: 'charisme',
  force: 'force',
  dexterite: 'dexterite',
  constitution: 'constitution',
  intelligence: 'intelligence',
  sagesse: 'sagesse',
  charisme: 'charisme',
};

export function magicAbilityToKey(ability: string): AbilityKey | null {
  const fromLabel = ABILITY_LABEL_TO_KEY[ability as Ability];
  if (fromLabel) return fromLabel;
  return ABILITY_ALIAS[ability] ?? ABILITY_ALIAS[ability.toLowerCase()] ?? null;
}

export function restoreMagicDraft(input: {
  speciesChoiceAnswers: Record<string, string[]>;
  racialChoiceIds: string[];
  details: SpellcastingDetailsDraft | undefined;
  activeClassId: string | null;
  deities: { id: string; name: string }[];
  mysticArcanumPicks: Record<string, string>;
  spellMasteryPicks: Record<string, string>;
  signatureSpellIds: string[];
}): {
  racialCantripPicks: Record<string, string>;
  selectedCantrips: string[];
  selectedSpells: string[];
  selectedDeityId: string | null;
  picksByClass: Record<string, { cantrips: string[]; spells: string[]; deityId: string | null }>;
  arcanumPicks: Record<number, string>;
  masteryPicks: Record<number, string>;
  signatureIds: string[];
} {
  const racial: Record<string, string> = {};
  const answers = input.speciesChoiceAnswers ?? {};
  for (const choiceId of input.racialChoiceIds) {
    const pick = answers[choiceId]?.[0];
    if (pick && pick !== 'any_wizard_cantrip') racial[choiceId] = pick;
  }
  const racialIds = new Set(Object.values(racial));
  const details = input.details;
  const arcanumIds = new Set((details?.mysticArcanum ?? []).map((a) => a.spellId).filter(Boolean));

  const picksByClass: Record<string, { cantrips: string[]; spells: string[]; deityId: string | null }> = {};
  let selectedCantrips: string[] = [];
  if (details?.cantrips) {
    const byClass = details.byClass;
    const fromClass = input.activeClassId ? byClass?.[input.activeClassId]?.cantrips : undefined;
    const cantripIds = fromClass ?? details.cantrips.map((c) => c.refId);
    selectedCantrips = cantripIds.filter((id): id is string => typeof id === 'string' && !racialIds.has(id));
    if (byClass) {
      for (const [id, p] of Object.entries(byClass)) {
        picksByClass[id] = {
          cantrips: p.cantrips ?? [],
          spells: p.spells ?? [],
          deityId: p.deityId ?? null,
        };
      }
    }
  }

  const selectedSpells = details?.spells
    ? details.spells.filter((s) => !s.alwaysPrepared && !arcanumIds.has(s.refId)).map((s) => s.refId)
    : [];

  let selectedDeityId: string | null = null;
  if (details?.deity) {
    selectedDeityId = input.deities.find((d) => d.name === details.deity)?.id ?? null;
  }

  const arcanumPicks: Record<number, string> = {};
  const fromDetails = details?.mysticArcanum;
  if (fromDetails?.length) {
    for (const a of fromDetails) {
      if (a.spellId) arcanumPicks[a.spellLevel] = a.spellId;
    }
  } else {
    for (const [k, v] of Object.entries(input.mysticArcanumPicks ?? {})) {
      const lvl = Number(k);
      if (v) arcanumPicks[lvl] = v;
    }
  }

  const masteryPicks: Record<number, string> = {};
  const masteryFromDetails = details?.spellMastery;
  if (masteryFromDetails?.length) {
    for (const m of masteryFromDetails) {
      if (m.spellId) masteryPicks[m.spellLevel] = m.spellId;
    }
  } else {
    for (const [k, v] of Object.entries(input.spellMasteryPicks ?? {})) {
      if (v) masteryPicks[Number(k)] = v;
    }
  }

  const sigFromDetails = details?.signatureSpells;
  const signatureIds = sigFromDetails?.length
    ? sigFromDetails.map((s) => s.spellId).filter(Boolean)
    : [...(input.signatureSpellIds ?? [])];

  return {
    racialCantripPicks: racial,
    selectedCantrips,
    selectedSpells,
    selectedDeityId,
    picksByClass,
    arcanumPicks,
    masteryPicks,
    signatureIds,
  };
}
