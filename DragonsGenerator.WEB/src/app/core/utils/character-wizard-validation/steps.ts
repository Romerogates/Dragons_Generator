import type { CharacterCreation } from '@core/models/Character/character';
import type { EquipmentSlot } from '@core/models/CharacterClasses/character-class';
import { coerceEquipmentSlots } from '../class-data.adapter';
import { isMasteredProficiencyChoice } from '../equipment.utils';
import { isTalentSpendComplete, talentSpendsTotalCost } from '../feat-benefits.util';
import { isBaseLanguageName, isExoticLanguageName } from '../character-languages.util';
import { asExtended, type WizardStepValidationContext } from './types';
import { magicDetailsComplete } from './magic';

const TALENT_FLEXIBLE_POINTS = 4;

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
