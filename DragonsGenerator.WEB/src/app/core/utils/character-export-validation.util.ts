import {
  CURRENT_SCHEMA_VERSION,
  type Character,
} from '@core/models/Character/character';
import {
  CATEGORY_FILTERS,
  isEquipmentCategoryId,
  isMasteredProficiencyChoice,
  resolveEquipmentRefId,
} from './equipment.utils';
import { labelForGameId } from './game-id-labels';
import { resolveSpellQuota, spellPickCount } from './spell-quota.util';

export interface CharacterExportValidation {
  valid: boolean;
  errors: string[];
}

function isValidCategoryProficiency(id: string, kind: 'weapon' | 'tool'): boolean {
  const resolved = resolveEquipmentRefId(id);
  const filter = CATEGORY_FILTERS[resolved];
  if (!filter) return false;
  if (kind === 'weapon') return filter.type === 'WEAPON';
  return filter.type === 'TOOL' || filter.type === 'GEAR' || filter.type === 'VEHICLE';
}

function isUnresolvedProficiencyId(id: string, kind: 'weapon' | 'tool'): boolean {
  if (!id || typeof id !== 'string') return true;
  if (isMasteredProficiencyChoice(id)) return true;
  if (id.endsWith('-any') || id === 'any' || id === 'skill-any') return true;
  if (isValidCategoryProficiency(id, kind)) return false;
  const resolved = resolveEquipmentRefId(id);
  if (resolved.startsWith('category-') || id.startsWith('wp-cat-')) return true;
  return false;
}

/** Bloque la sauvegarde cloud si l'export contient des placeholders non résolus. */
export function validateCharacterExport(character: Character): CharacterExportValidation {
  const errors: string[] = [];

  if (character.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    errors.push(`Version de schéma invalide (${character.schemaVersion}).`);
  }

  if (!character.name?.trim()) {
    errors.push('Le personnage doit avoir un nom.');
  }

  if (!character.classes?.length) {
    errors.push('Au moins une classe est requise.');
  } else {
    for (const cls of character.classes) {
      if (!cls.classId?.trim()) {
        errors.push('Classe sans identifiant.');
        break;
      }
      if ((cls.level ?? 0) >= 3 && !cls.subclassId?.trim()) {
        errors.push(
          `Sous-classe manquante pour ${labelForGameId(cls.classId)} (niveau ${cls.level}).`,
        );
      }
    }
  }

  if (!character.species?.id?.trim()) {
    errors.push('Espèce manquante.');
  }

  if ((character.totalLevel ?? 0) < 1) {
    errors.push('Niveau total invalide.');
  }

  for (const slot of character.asiChoices ?? []) {
    if (slot.mode === 'feat' && !slot.featId) {
      errors.push('Choix de don ASI incomplet.');
    } else if (slot.mode === 'plus2' && !slot.primary) {
      errors.push('ASI +2 incomplet.');
    } else if (slot.mode === 'plus1plus1' && (!slot.primary || !slot.secondary || slot.primary === slot.secondary)) {
      errors.push('ASI +1/+1 incomplet.');
    }
  }

  if (character.spellcasting) {
    const cantrips = (character.knownSpells ?? []).filter((s) => (s.level ?? 0) === 0);
    const leveled = (character.knownSpells ?? []).filter((s) => (s.level ?? 0) > 0);
    const kind = character.spellcasting.kind;
    const primaryLevel =
      character.classes.find((c) => c.classId === character.classes[0]?.classId)?.level ??
      character.totalLevel ??
      1;
    if (kind) {
      const quota = resolveSpellQuota({
        cls: null,
        kind,
        classLevel: primaryLevel,
      });
      if (quota) {
        if (cantrips.length < quota.cantrips) {
          errors.push(
            `Tours de magie incomplets (${cantrips.length}/${quota.cantrips}). Revenez à l’étape Magie.`,
          );
        }
        const need = spellPickCount(quota);
        if (need > 0 && !quota.hasFullListAccess && leveled.length < need) {
          errors.push(
            `Sorts incomplets (${leveled.length}/${need}). Revenez à l’étape Magie.`,
          );
        }
      }
    }
    if (kind === 'cleric') {
      const deity =
        (character.spellcasting as { deityId?: string; deity?: string }).deityId ||
        (character.spellcasting as { deity?: string }).deity;
      if (!deity) {
        errors.push('Divinité manquante pour le prêtre.');
      }
    }
  }

  const weapons = character.proficiencies?.weapons ?? [];
  for (const id of weapons) {
    if (isUnresolvedProficiencyId(id, 'weapon')) {
      errors.push(
        `Maîtrise d'arme non résolue : ${labelForGameId(id)}. Revenez à l’étape Compétences ou Équipement.`,
      );
    }
  }

  const tools = character.proficiencies?.tools ?? [];
  for (const id of tools) {
    if (isUnresolvedProficiencyId(id, 'tool')) {
      errors.push(
        `Maîtrise d'outil non résolue : ${labelForGameId(id)}. Revenez à l’étape Compétences.`,
      );
    }
  }

  for (const item of character.equipment ?? []) {
    const refId = item.refId;
    if (!refId?.trim()) {
      errors.push("Objet d'équipement sans référence.");
      continue;
    }
    if (isMasteredProficiencyChoice(refId) || isEquipmentCategoryId(refId)) {
      errors.push(
        `Équipement non résolu : ${labelForGameId(refId)}. Revenez à l’étape Équipement.`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function formatCharacterExportErrors(errors: string[]): string {
  if (!errors.length) return '';
  if (errors.length === 1) return errors[0];
  return `Export incomplet : ${errors.join(' · ')}`;
}
