import type { CharacterCreation } from '@core/models/Character/character';
import type { ExtendedCharacterCreation } from '@core/models/Character/character-builder.types';
import type { EquipmentSlot } from '@core/models/CharacterClasses/character-class';
import { coerceEquipmentSlots } from './class-data.adapter';
import { isMasteredProficiencyChoice } from './equipment.utils';
import {
  isTalentSpendComplete,
  talentSpendsTotalCost,
} from './feat-benefits.util';
import { isBaseLanguageName, isExoticLanguageName } from './character-languages.util';
import { resolveSpellQuota, spellPickCount } from './spell-quota.util';

/** Points flexibles du don Talent (aligné sur abilities-step / JSON feat). */
const TALENT_FLEXIBLE_POINTS = 4;

export interface WizardStepValidationContext {
  needsMagicStep: boolean;
}

function asExtended(c: CharacterCreation): ExtendedCharacterCreation {
  return c as ExtendedCharacterCreation;
}

/** Tous les sorts raciaux requis ont été choisis (étape Magie). */
export function racialSpellsComplete(
  c: Pick<CharacterCreation, 'racialSpellGrants' | 'speciesChoiceAnswers'>,
): boolean {
  const grants = c.racialSpellGrants ?? [];
  if (!grants.length) return true;
  const answers = c.speciesChoiceAnswers ?? {};
  return grants.every((g) => {
    const pick = answers[g.choiceId]?.[0];
    return !!pick && pick !== 'any_wizard_cantrip';
  });
}

/**
 * Aligné sur `abilities-step.asiComplete` : Talent exige 4 pts dépensés + sous-choix
 * complets ; ASI +2 / +1+1 inchangés. Sans catalogue de dons, on ne peut pas exiger
 * featAbilityChoice / featResistanceChoice pour les autres dons (validés dans l’UI).
 */
function asiChoicesComplete(c: CharacterCreation): boolean {
  const slots = c.asiChoices ?? [];
  if (slots.length === 0) return true;
  return slots.every((s) => {
    if (s.mode === 'feat') {
      if (!s.featId) return false;
      const spends = s.featTalentSpends ?? [];
      if (s.featId === 'feat-talent') {
        if (talentSpendsTotalCost(spends) !== TALENT_FLEXIBLE_POINTS) return false;
        return spends.every((sp) => isTalentSpendComplete(sp));
      }
      // Autres dons : id requis ; si des dépenses Talent ont été saisies, elles doivent être OK.
      if (spends.length > 0) return spends.every((sp) => isTalentSpendComplete(sp));
      return true;
    }
    if (s.mode === 'plus2') return !!s.primary;
    return !!s.primary && !!s.secondary && s.primary !== s.secondary;
  });
}

function languagesStepComplete(c: CharacterCreation): boolean {
  if (c.languages.length === 0) return false;
  const bonusNeeded = c.bonusLanguageCount ?? 0;
  // Exotique / commune obligatoire = contraintes *parmi* les slots bonus, pas des slots en plus.
  if (bonusNeeded <= 0) return true;

  const locked = new Set<string>([
    ...(c.speciesLanguages ?? []),
    ...(c.civilizationLanguages ?? []),
    ...(c.backgroundLanguages ?? []),
  ]);
  if (c.classId === 'cls-druide') locked.add('Langue des druides');
  if (c.classId === 'cls-roublard') locked.add('Argot des voleurs');
  const bonusPicked = c.languages.filter((l) => !locked.has(l));
  if (bonusPicked.length < bonusNeeded) return false;

  const exoticNeed = c.requiredExoticLanguageCount ?? 0;
  const baseNeed = c.requiredBaseLanguageCount ?? 0;
  if (exoticNeed > 0) {
    const exoticCount = bonusPicked.filter((l) => isExoticLanguageName(l)).length;
    if (exoticCount < exoticNeed) return false;
  }
  if (baseNeed > 0) {
    const baseCount = bonusPicked.filter((l) => isBaseLanguageName(l)).length;
    if (baseCount < baseNeed) return false;
  }
  return true;
}

function secondaryProgressionComplete(c: CharacterCreation): boolean {
  for (const sc of asExtended(c).secondaryClasses ?? []) {
    if (sc.level >= 3 && !sc.subclassId) return false;
    if (sc.classId === 'cls-sorcier') {
      if (sc.level >= 3 && !sc.pactBoon) return false;
      if (sc.level >= 2 && !(sc.eldritchInvocations?.length)) return false;
    }
    if (sc.classId === 'cls-ensorceleur' && sc.level >= 3 && !(sc.metamagicOptions?.length)) {
      return false;
    }
  }
  return true;
}

function classStepComplete(c: CharacterCreation): boolean {
  if (c.classId === null || (c.hitDie ?? 0) <= 0) return false;
  const level = c.targetLevel || 1;
  if (level >= 3 && !c.subclassId) return false;
  if (c.classId === 'cls-sorcier') {
    if (level >= 3 && !c.pactBoon) return false;
    if (level >= 2 && !(c.eldritchInvocations?.length)) return false;
  }
  // Ensorceleur primaire niv. 3+ : métamagie obligatoire (miroir secondaire).
  if (c.classId === 'cls-ensorceleur' && level >= 3 && !(c.metamagicOptions?.length)) {
    return false;
  }
  return secondaryProgressionComplete(c);
}

function skillsStepComplete(c: CharacterCreation): boolean {
  if (!c.classId) return false;
  const needed = (c.skillChooseCount ?? 0) + (c.speciesBonusSkillCount ?? 0);
  if ((c.selectedSkills?.length ?? 0) < needed) return false;
  const ext = asExtended(c);
  const secondaryNeed = (ext.secondaryClasses ?? []).reduce((sum, sc) => sum + (sc.skillChooseCount ?? 0), 0);
  if ((ext.secondaryClassSelectedSkills?.length ?? 0) < secondaryNeed) return false;
  const bgToolNeed =
    ext.backgroundProficiencies?.tools?.choose?.reduce((sum, g) => sum + (g.chooseCount ?? 0), 0) ?? 0;
  if (bgToolNeed > 0 && (c.backgroundTools?.length ?? 0) < bgToolNeed) return false;
  // Placeholders non résolus (armes/outils « au choix ») → forcer le passage par Savoirs.
  const unresolved = (id: string) =>
    isMasteredProficiencyChoice(id) || id.endsWith('-any') || id === 'any';
  if ((c.weaponProficiencies ?? []).some(unresolved)) return false;
  if ((c.toolProficiencies ?? []).some(unresolved)) return false;
  return true;
}

function slotNeedsPick(slot: EquipmentSlot): boolean {
  return (slot.alternatives?.length ?? 0) > 0;
}

function equipmentStepComplete(c: CharacterCreation): boolean {
  const ext = asExtended(c);
  const slots: EquipmentSlot[] = [
    ...coerceEquipmentSlots(c.startingEquipmentSlots),
    ...coerceEquipmentSlots(ext.backgroundEquipmentSlots),
    ...coerceEquipmentSlots(ext.toolEquipmentSlots),
  ];
  const choosable = slots.filter(slotNeedsPick);
  if (choosable.length === 0) {
    if (slots.length === 0) return c.selectedEquipment.length > 0;
    return c.selectedEquipment.length > 0;
  }
  if (c.selectedEquipment.length === 0) return false;
  const picks = ext.equipmentWizardPicks;
  if (!picks) return false;
  return choosable.every((slot) => picks.alt[String(slot.slot)] != null);
}

/** Niveau dans la classe Magicien (primaire ou secondaire). */
function wizardClassLevel(c: CharacterCreation): number {
  if (c.classId === 'cls-magicien' || c.spellcastingKind === 'wizard') {
    return c.targetLevel || 1;
  }
  const secondary = (asExtended(c).secondaryClasses ?? []).find(
    (sc) => sc.classId === 'cls-magicien' || sc.spellcastingKind === 'wizard',
  );
  return secondary?.level ?? 0;
}

/** Magicien L17+ : maîtrise niv.1+2 ; L19+ : 2 sorts attitrés niv.3. */
function wizardHighLevelPicksComplete(c: CharacterCreation): boolean {
  const level = wizardClassLevel(c);
  if (level < 17) return true;
  const details = c.spellcastingDetails as
    | { spellMastery?: unknown[]; signatureSpells?: unknown[] }
    | undefined;
  const masteryOk =
    (Array.isArray(details?.spellMastery) && details.spellMastery.length >= 2) ||
    (!!c.spellMasteryPicks?.['1'] && !!c.spellMasteryPicks?.['2']);
  if (!masteryOk) return false;
  if (level < 19) return true;
  return (
    (Array.isArray(details?.signatureSpells) && details.signatureSpells.length >= 2) ||
    (c.signatureSpellIds?.length ?? 0) >= 2
  );
}

function countSpellInstances(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}

/**
 * Vérifie les quotas de sorts (repli kind si JSON classe absent).
 * Exposée pour les tests ; utilisée par l’étape Magie via isWizardStepValid.
 */
export function magicDetailsComplete(c: CharacterCreation): boolean {
  if (!racialSpellsComplete(c)) return false;
  const details = c.spellcastingDetails as
    | {
        cantrips?: unknown[];
        spells?: unknown[];
        deityId?: string;
        deity?: string;
        mysticArcanum?: { spellId?: string }[];
      }
    | undefined;
  const hasSecondaryCaster = (asExtended(c).secondaryClasses ?? []).some((sc) => sc.hasSpellcasting);
  if (!c.hasSpellcasting && !hasSecondaryCaster) {
    // Uniquement sorts raciaux — déjà couverts par racialSpellsComplete.
    return true;
  }
  if (!details) return false;

  const cantripCount = countSpellInstances(details.cantrips);
  const spellCount = countSpellInstances(details.spells);

  if (c.hasSpellcasting && c.spellcastingKind) {
    const bonusCantrips = c.subclassId === 'subcls-cercle-de-la-terre' ? 1 : 0;
    const quota = resolveSpellQuota({
      cls: null,
      kind: c.spellcastingKind,
      classLevel: c.targetLevel || 1,
      bonusCantrips,
    });
    if (quota) {
      if (cantripCount < quota.cantrips) return false;
      const needSpells = spellPickCount(quota);
      // Prepared full-list (prêtre / druide…) : pas d’obligation de liste « connus » au wizard.
      if (needSpells > 0 && !quota.hasFullListAccess && spellCount < needSpells) return false;
    }
    if (c.spellcastingKind === 'cleric' && !(details.deityId || details.deity)) return false;
    if (c.spellcastingKind === 'warlock') {
      const level = c.targetLevel || 1;
      const arcanumLevels = [11, 13, 15, 17].filter((l) => level >= l);
      if (arcanumLevels.length) {
        const picks = Array.isArray(details.mysticArcanum) ? details.mysticArcanum : [];
        if (picks.filter((p) => !!p?.spellId).length < arcanumLevels.length) return false;
      }
    }
  }

  if (!wizardHighLevelPicksComplete(c)) return false;

  // Secondaire lanceur : au minimum un détail magique scellé (cantrips ou sorts).
  if (hasSecondaryCaster && !c.hasSpellcasting) {
    return cantripCount > 0 || spellCount > 0;
  }

  return cantripCount > 0 || spellCount > 0 || !!(details.deityId || details.deity);
}

function backgroundStepComplete(c: CharacterCreation): boolean {
  if (!c.backgroundId) return false;
  if (c.backgroundPreset === false) {
    const name = (c.background ?? '').trim();
    const privName = (c.privilegeName ?? '').trim();
    const privDesc = (c.privilegeDesc ?? '').trim();
    return name.length > 0 && privName.length > 0 && privDesc.length > 0;
  }
  return true;
}

function speciesStepComplete(c: CharacterCreation): boolean {
  if (!c.speciesId) return false;
  const answers = c.speciesChoiceAnswers ?? {};
  return Object.entries(answers).every(([, picks]) => !picks || picks.length > 0);
}

export function isWizardStepValid(
  step: number,
  c: CharacterCreation,
  ctx: WizardStepValidationContext,
): boolean {
  switch (step) {
    case 1:
      return true;
    case 2:
      return speciesStepComplete(c);
    case 3:
      return c.civilizationId !== null;
    case 4:
      return backgroundStepComplete(c);
    case 5:
      return classStepComplete(c);
    case 6:
      return c.pointsRemaining === 0 && asiChoicesComplete(c);
    case 7:
      return skillsStepComplete(c);
    case 8:
      return equipmentStepComplete(c);
    case 9:
      return languagesStepComplete(c);
    case 10:
      if (ctx.needsMagicStep) return magicDetailsComplete(c);
      return c.name.trim().length > 0;
    case 11:
      if (ctx.needsMagicStep) return c.name.trim().length > 0;
      return true;
    case 12:
      return true;
    default:
      return false;
  }
}
