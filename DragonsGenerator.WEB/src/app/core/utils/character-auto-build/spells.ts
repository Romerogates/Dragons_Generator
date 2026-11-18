import type { AbilityScores } from '@core/models/Character/character';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Spell } from '@core/models/Spells/spell';
import type { SpeciesSelection } from '@core/services/character-builder.service';
import { resolveSpellQuota, spellPickCount } from '@core/utils/spell-quota.util';
import { extractSubclassBonusSpells } from '@core/utils/subclass-bonus-spells.util';
import { pickRandom } from '@core/utils/pregen-random.util';
import { pickRandomSubset } from './random';
import { resolveSpellcasting } from './shared';

export function buildAutoSpellcastingDetails(
  cls: CharacterClass,
  spells: Spell[],
  racialGrants: SpeciesSelection['racialSpellGrants'],
  speciesChoiceAnswers: Record<string, string[]>,
  abilityModifiers?: Partial<AbilityScores> | null,
  opts?: { level?: number; subclassId?: string | null },
): Record<string, unknown> | null {
  const level = opts?.level ?? 1;
  const spellInfo = resolveSpellcasting(cls, level);
  if (!spellInfo?.kind) return null;
  const quota = resolveSpellQuota({
    cls,
    kind: spellInfo.kind,
    classLevel: level,
    abilityModifiers: abilityModifiers ?? null,
  });
  if (!quota) return { cantrips: [], spells: [] };

  const classSpells = spells.filter((s) => s.classes?.includes(cls.id) || s.classes?.some((c) => c.includes(cls.id.replace('cls-', ''))));
  const cantripPool = classSpells.filter((s) => s.level === 0);
  const level1Pool = classSpells.filter((s) => s.level === 1);

  const cantripIds = pickRandomSubset(cantripPool.map((s) => s.id), quota.cantrips);
  const racialCantrips = racialGrants
    .filter((g) => g.spellLevel === 0)
    .map((g) => {
      const fromAnswers = speciesChoiceAnswers[g.choiceId]?.[0];
      return fromAnswers ?? pickRandom(g.pool);
    })
    .filter((x): x is string => !!x);

  const allCantripIds = [...new Set([...racialCantrips, ...cantripIds])];
  const spellIds = pickRandomSubset(level1Pool.map((s) => s.id), spellPickCount(quota));

  const spellMap = new Map(spells.map((s) => [s.id, s]));
  const nameById = new Map(spells.map((s) => [s.id, s.name]));
  const oathSpells =
    spellInfo.kind === 'paladin'
      ? extractSubclassBonusSpells(cls, opts?.subclassId ?? null, level, nameById)
      : [];

  return {
    cantrips: allCantripIds.map((id) => {
      const raw = spellMap.get(id);
      return {
        refId: id,
        name: raw?.name ?? id,
        level: 0,
        prepared: true,
        effectSummary: raw?.description?.slice(0, 120) ?? '',
      };
    }),
    spells: spellIds.map((id) => {
      const raw = spellMap.get(id);
      return {
        refId: id,
        name: raw?.name ?? id,
        level: 1,
        prepared: true,
        effectSummary: raw?.description?.slice(0, 120) ?? '',
      };
    }),
    ...(oathSpells.length ? { oathSpells } : {}),
  };
}
