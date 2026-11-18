import type { AbilityKey, Size } from '@core/models/Character/character';
import type { Spell } from '@core/models/Spells/spell';
import type { Species, Subspecies, CreationChoice } from '@core/models/Species/species';
import type { SpeciesSelection } from '@core/services/character-builder.service';
import { apiAsiToPartialScores, apiCodeToAbilityKey, mergePartialScores } from '@core/utils/ability-mapping';
import { pickRandom } from '@core/utils/pregen-random.util';
import {
  speciesResistancesFromTraits,
  speciesTraitBonusProficiencies,
} from '@core/utils/species-proficiencies.util';
import { pickRandomSubset } from './random';

function flattenChoiceOptions(choice: CreationChoice): string[] {
  const raw = choice.options;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((o) => {
        if (typeof o === 'string') return o;
        if (o && typeof o === 'object' && 'id' in o) return String((o as { id: string }).id);
        return null;
      })
      .filter((x): x is string => !!x && x !== 'any');
  }
  return [];
}

function autoSpeciesChoiceAnswers(species: Species, sub: Subspecies | null): Record<string, string[]> {
  const answers: Record<string, string[]> = {};
  const choices = [...(species.creationChoices ?? []), ...(sub?.creationChoices ?? [])];
  for (const choice of choices) {
    if (choice.type === 'ability_score_increase') {
      const opts = flattenChoiceOptions(choice);
      const count = choice.choiceCount ?? 1;
      answers[choice.id] = pickRandomSubset(opts, count);
      continue;
    }
    if (choice.type === 'single_select' || choice.type === 'multi_select') {
      const opts = flattenChoiceOptions(choice);
      if (!opts.length) continue;
      const count = choice.type === 'multi_select' ? (choice.choiceCount ?? 1) : 1;
      answers[choice.id] = pickRandomSubset(opts, count);
    }
  }
  return answers;
}

function asiFromChoiceAnswers(
  species: Species,
  sub: Subspecies | null,
  answers: Record<string, string[]>,
): Partial<Record<AbilityKey, number>> {
  const result: Partial<Record<AbilityKey, number>> = {};
  const choices = [...(species.creationChoices ?? []), ...(sub?.creationChoices ?? [])];
  for (const choice of choices) {
    if (choice.type !== 'ability_score_increase') continue;
    const picks = answers[choice.id] ?? [];
    const value = choice.valuePerChoice ?? 1;
    for (const code of picks) {
      const key = apiCodeToAbilityKey(code);
      if (!key) continue;
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}

export function buildAutoSpeciesSelection(
  species: Species,
  targetLevel = 1,
  spells: Spell[] = [],
): SpeciesSelection {
  const playableSubs = (species.subspecies ?? []).filter((s) => s.playable);
  const sub: Subspecies | null = playableSubs.length ? pickRandom(playableSubs) : null;
  const choiceAnswers = autoSpeciesChoiceAnswers(species, sub);
  const baseAsi = apiAsiToPartialScores(species.baseStats.abilityScoreIncrease);
  const subAsi = sub ? apiAsiToPartialScores(sub.abilityScoreIncrease) : {};
  const choiceAsi = asiFromChoiceAnswers(species, sub, choiceAnswers);
  const racialBonuses = mergePartialScores(baseAsi, subAsi, choiceAsi);

  const traits = [...(species.traits ?? []), ...(sub?.traits ?? [])].map((t) => ({
    refId: t.id,
    name: t.name,
    desc: t.desc,
    source: 'species' as const,
    sourceDetail: sub ? `${species.name} (${sub.name})` : species.name,
    level: 1,
  }));

  const allChoices = [...(species.creationChoices ?? []), ...(sub?.creationChoices ?? [])];
  const bonusLanguageCount = allChoices
    .filter((c) => c.type === 'language' || (c.type === 'single_select' && String(c.name).toLowerCase().includes('langue')))
    .reduce((sum, c) => sum + (c.choiceCount ?? 1), 0);
  const bonusSkillCount = allChoices.filter((c) => c.type === 'skill_proficiency' || c.type === 'skill').reduce((sum, c) => sum + (c.choiceCount ?? 1), 0);
  const bonusToolCount = allChoices.filter((c) => c.type === 'tool_proficiency' || c.type === 'tool').reduce((sum, c) => sum + (c.choiceCount ?? 1), 0);

  const racialSpellGrants = allChoices
    .filter((c) => c.spellList || c.type === 'spell')
    .map((c) => ({
      choiceId: c.id,
      label: c.name,
      desc: c.desc ?? '',
      pool: flattenChoiceOptions(c),
      spellLevel: c.spellLevel ?? 0,
      spellcastingAbility: c.spellcastingAbility ?? 'Intelligence',
    }))
    .filter((g) => g.pool.length > 0);

  const rawTraits = [...(species.traits ?? []), ...(sub?.traits ?? [])];
  const traitBonus = speciesTraitBonusProficiencies(rawTraits);
  const lineageId =
    choiceAnswers['choice-lignee-draconique']?.[0] ?? choiceAnswers['choice-heritage-draconique']?.[0];
  const resistances = speciesResistancesFromTraits(rawTraits, species, sub, lineageId);

  const spellMap = new Map(spells.map((s) => [s.id, s]));
  const innateSpells: SpeciesSelection['innateSpells'] = [];
  for (const trait of rawTraits) {
    const mech = trait.mechanics as Record<string, unknown> | undefined;
    if (!mech || mech['type'] !== 'innate_spellcasting') continue;
    const innate = mech['innate_spells'];
    if (!Array.isArray(innate)) continue;
    for (const entry of innate) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const unlockLevel = Number(e['unlocks_at_level'] ?? 1);
      if (unlockLevel > targetLevel) continue;
      const spellId = e['spell_id'];
      if (typeof spellId !== 'string' || !spellId.trim()) continue;
      const raw = spellMap.get(spellId);
      const castLevel = Number(e['cast_as_spell_level'] ?? raw?.level ?? 0);
      const recharge = typeof e['recharge'] === 'string' ? (e['recharge'] as string) : 'at_will';
      const rechargeLabel =
        recharge === 'at_will'
          ? 'à volonté'
          : recharge === 'long_rest'
            ? '1× / repos long'
            : recharge === 'short_rest'
              ? '1× / repos court'
              : recharge;
      innateSpells.push({
        refId: spellId,
        name: raw?.name ?? spellId.replace(/^spl-/, '').replace(/-/g, ' '),
        level: castLevel,
        prepared: true,
        alwaysPrepared: true,
        effectSummary: `Inné (${rechargeLabel}) · ${(raw?.description ?? '').slice(0, 100)}`,
      });
    }
  }

  return {
    speciesId: species.id,
    speciesName: species.name,
    subspeciesId: sub?.id ?? null,
    subspeciesName: sub?.name ?? null,
    racialBonuses,
    traits,
    speed: species.baseStats.speedM,
    size: (species.baseStats.size ?? 'M') as Size,
    languages: [...(species.languages?.fixed ?? []), ...(sub?.languages?.fixed ?? [])],
    bonusLanguageCount,
    bonusSkillCount,
    bonusToolCount,
    bonusToolPoolIds: [],
    bonusToolChoiceLabel: '',
    resistances,
    hasDarkvision: (species.baseStats.darkvisionM ?? 0) > 0,
    darkvisionRadius: species.baseStats.darkvisionM ?? 0,
    bonusSkills: traitBonus.skills,
    bonusWeapons: traitBonus.weapons,
    bonusArmor: traitBonus.armor,
    bonusTools: traitBonus.tools,
    innateSpells,
    choiceAnswers,
    racialSpellGrants,
  };
}

export function pickPlayableSpecies(all: Species[]): Species[] {
  return all.filter((s) => {
    const subs = s.subspecies ?? [];
    if (!subs.length) return true;
    return subs.some((sub) => sub.playable);
  });
}
