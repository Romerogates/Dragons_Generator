import type { Character } from '@core/models/Character/character';

/** Courte description physique pour un pré-tiré (fiche page Âme). */
export function buildPregenPhysicalDescription(
  character: Character,
  speciesLabel: string,
  classLabel: string,
): string {
  const sex = character.personality?.sex ?? 'X';
  const subject = sex === 'F' ? 'Elle' : sex === 'M' ? 'Il' : 'Iel';
  const adjective =
    sex === 'F' ? 'marquée' : sex === 'M' ? 'marqué' : 'marqué·e';
  const ready = sex === 'F' ? 'prête' : sex === 'M' ? 'prêt' : 'prêt·e';
  return `${subject} est ${speciesLabel.toLowerCase()}, d’allure de ${classLabel.toLowerCase()}, ${adjective} par la route et ${ready} à entrer en scène.`;
}
