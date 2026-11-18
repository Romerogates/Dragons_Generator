import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { FeatureInstance } from '@core/models/Character/character';
import { extractProgressionChoices } from './extract';
import { PROGRESSION_MAX_LEVEL } from './shared';

/** Applique les réponses UI (pacte, invocations, métamagie) aux choix extraits. */
export function collectProgressionPicksFromAnswers(
  cls: CharacterClass,
  level: number,
  answers: Record<string, string[]>,
): {
  classChoiceAnswers: Record<string, string[]>;
  pactBoon: string | null;
  eldritchInvocations: string[];
  metamagicOptions: string[];
  extraFeatures: FeatureInstance[];
} {
  const pactChoice = extractProgressionChoices(cls, level, PROGRESSION_MAX_LEVEL).find(
    (c) => c.type === 'pact_boon',
  );
  const pactBoonId = (pactChoice ? answers[pactChoice.id]?.[0] : null) ?? null;
  const choices = extractProgressionChoices(cls, level, PROGRESSION_MAX_LEVEL, {
    pactBoonId,
  });
  const classChoiceAnswers: Record<string, string[]> = {};
  const eldritchInvocations: string[] = [];
  const metamagicOptions: string[] = [];
  const extraFeatures: FeatureInstance[] = [];
  let pactBoon: string | null = null;
  /** Dédup inter-pools feature_selection (astuces Lettré, etc.). */
  const takenFeatureIds = new Set<string>();

  for (const choice of choices) {
    if (choice.deferred) continue;
    let picks = [...(answers[choice.id] ?? [])];
    if (choice.type === 'feature_selection') {
      picks = picks.filter((id) => !takenFeatureIds.has(id));
      const need = choice.count || 1;
      if (picks.length > need) picks = picks.slice(0, need);
      for (const id of picks) takenFeatureIds.add(id);
      for (const fid of choice.fixedFeatureIds ?? []) takenFeatureIds.add(fid);
    }
    classChoiceAnswers[choice.id] = picks;
    if (choice.type === 'invocation') eldritchInvocations.push(...picks);
    if (choice.type === 'metamagic') metamagicOptions.push(...picks);
    if (choice.type === 'pact_boon' && picks[0]) pactBoon = picks[0];
    for (const pickId of picks) {
      if (extraFeatures.some((f) => f.refId === pickId)) continue;
      const opt = choice.options.find((o) => o.id === pickId);
      extraFeatures.push({
        refId: pickId,
        name: opt?.name ?? pickId,
        desc: opt?.desc ?? '',
        source: 'class',
        sourceDetail: `${cls.name} · ${choice.label}`,
        level: 1,
      });
    }
    for (const fid of choice.fixedFeatureIds ?? []) {
      if (extraFeatures.some((f) => f.refId === fid)) continue;
      const feat = (cls.data.features_details ?? []).find((f) => f.id === fid);
      extraFeatures.push({
        refId: fid,
        name: feat?.name ?? fid,
        desc: feat?.desc ?? '',
        source: 'class',
        sourceDetail: `${cls.name} · ${choice.label}`,
        level: feat?.level ?? 1,
      });
    }
  }

  return { classChoiceAnswers, pactBoon, eldritchInvocations, metamagicOptions, extraFeatures };
}
