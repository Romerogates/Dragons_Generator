import type { CharacterCreation } from '@core/models/Character/character';
import type { ExtendedCharacterCreation } from '@core/models/Character/character-builder.types';
import type { EquipmentSlot } from '@core/models/CharacterClasses/character-class';

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

function asiChoicesComplete(c: CharacterCreation): boolean {
  const slots = c.asiChoices ?? [];
  if (slots.length === 0) return true;
  return slots.every((s) => {
    if (s.mode === 'feat') {
      if (!s.featId) return false;
      const spends = s.featTalentSpends ?? [];
      if (s.featId === 'feat-talent' && spends.length === 0 && (s.featAbilityChoice || s.featResistanceChoice)) {
        return true;
      }
      return true;
    }
    if (s.mode === 'plus2') return !!s.primary;
    return !!s.primary && !!s.secondary && s.primary !== s.secondary;
  });
}

function languagesStepComplete(c: CharacterCreation): boolean {
  if (c.languages.length === 0) return false;
  const bonusNeeded = c.bonusLanguageCount ?? 0;
  const exoticNeeded = c.requiredExoticLanguageCount ?? 0;
  const baseNeeded = c.requiredBaseLanguageCount ?? 0;
  const extraNeeded = bonusNeeded + exoticNeeded + baseNeeded;
  if (extraNeeded <= 0) return true;
  const locked = new Set<string>([
    ...(c.speciesLanguages ?? []),
    ...(c.civilizationLanguages ?? []),
    ...(c.backgroundLanguages ?? []),
  ]);
  if (c.classId === 'cls-druide') locked.add('Langue des druides');
  if (c.classId === 'cls-roublard') locked.add('Argot des voleurs');
  const bonusPicked = c.languages.filter((l) => !locked.has(l)).length;
  return bonusPicked >= extraNeeded;
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
  return secondaryProgressionComplete(c);
}

function skillsStepComplete(c: CharacterCreation): boolean {
  if (!c.classId) return false;
  const needed = (c.skillChooseCount ?? 0) + (c.speciesBonusSkillCount ?? 0);
  if ((c.selectedSkills?.length ?? 0) < needed) return false;
  const ext = asExtended(c);
  const secondaryNeed = (ext.secondaryClasses ?? []).reduce((sum, sc) => sum + (sc.skillChooseCount ?? 0), 0);
  if ((ext.secondaryClassSelectedSkills?.length ?? 0) < secondaryNeed) return false;
  return true;
}

function slotNeedsPick(slot: EquipmentSlot): boolean {
  return (slot.alternatives?.length ?? 0) > 0;
}

function equipmentStepComplete(c: CharacterCreation): boolean {
  const ext = asExtended(c);
  const slots: EquipmentSlot[] = [
    ...(c.startingEquipmentSlots ?? []),
    ...(ext.backgroundEquipmentSlots ?? []),
    ...(ext.toolEquipmentSlots ?? []),
  ];
  const choosable = slots.filter(slotNeedsPick);
  if (choosable.length === 0) {
    if (slots.length === 0) return c.selectedEquipment.length > 0;
    return c.selectedEquipment.length > 0;
  }
  if (c.selectedEquipment.length === 0) return false;
  const picks = ext.equipmentWizardPicks;
  if (!picks) return true;
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

function magicDetailsComplete(c: CharacterCreation): boolean {
  if (!racialSpellsComplete(c)) return false;
  const details = c.spellcastingDetails as
    | {
        cantrips?: unknown[];
        spells?: unknown[];
        deityId?: string;
        deity?: string;
      }
    | undefined;
  const hasSecondaryCaster = (asExtended(c).secondaryClasses ?? []).some((sc) => sc.hasSpellcasting);
  if (!c.hasSpellcasting && !hasSecondaryCaster) {
    return !!(details?.cantrips?.length);
  }
  if (!details) return false;
  const cantrips = Array.isArray(details.cantrips) ? details.cantrips : null;
  const spells = Array.isArray(details.spells) ? details.spells : null;
  if (cantrips && cantrips.length === 0 && (!spells || spells.length === 0) && !details.deityId && !details.deity) {
    return false;
  }
  if (c.spellcastingKind === 'cleric' && !(details.deityId || details.deity)) return false;
  if (!wizardHighLevelPicksComplete(c)) return false;
  return !!(cantrips?.length || spells?.length || details.deityId || details.deity);
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
