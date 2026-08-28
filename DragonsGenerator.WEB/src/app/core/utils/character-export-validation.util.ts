import {
  CURRENT_SCHEMA_VERSION,
  type Character,
} from '@core/models/Character/character';
import { isEquipmentCategoryId, isMasteredProficiencyChoice } from './equipment.utils';

export interface CharacterExportValidation {
  valid: boolean;
  errors: string[];
}

function isUnresolvedProficiencyId(id: string): boolean {
  if (!id || typeof id !== 'string') return true;
  if (isMasteredProficiencyChoice(id)) return true;
  if (id.endsWith('-any') || id === 'any' || id === 'skill-any') return true;
  if (id.startsWith('category-') || id.startsWith('wp-cat-')) return true;
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
    }
  }

  if (!character.species?.id?.trim()) {
    errors.push('Espèce manquante.');
  }

  if ((character.totalLevel ?? 0) < 1) {
    errors.push('Niveau total invalide.');
  }

  const weapons = character.proficiencies?.weapons ?? [];
  for (const id of weapons) {
    if (isUnresolvedProficiencyId(id)) {
      errors.push(`Maîtrise d'arme non résolue : ${id}.`);
    }
  }

  const tools = character.proficiencies?.tools ?? [];
  for (const id of tools) {
    if (isUnresolvedProficiencyId(id)) {
      errors.push(`Maîtrise d'outil non résolue : ${id}.`);
    }
  }

  for (const item of character.equipment ?? []) {
    const refId = item.refId;
    if (!refId?.trim()) {
      errors.push("Objet d'équipement sans référence.");
      continue;
    }
    if (isMasteredProficiencyChoice(refId) || isEquipmentCategoryId(refId)) {
      errors.push(`Équipement non résolu : ${refId}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function formatCharacterExportErrors(errors: string[]): string {
  if (!errors.length) return '';
  if (errors.length === 1) return errors[0];
  return `Export incomplet : ${errors.join(' · ')}`;
}
